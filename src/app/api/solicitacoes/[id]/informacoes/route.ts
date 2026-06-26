import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const TIPOS = ['REUNIAO_CALL', 'DECISAO_INTERNA', 'FEEDBACK_CLIENTE', 'CONCORRENCIA', 'ALTERACAO_INFORMAL', 'COMPROMISSO_ASSUMIDO'] as const
const IMPACTOS = ['AFETA_PRAZO', 'AFETA_VALOR', 'AFETA_ESCOPO', 'NENHUM'] as const

// Rótulos para busca por palavra-chave (ex.: "concorrência" → tipo CONCORRENCIA)
const TIPO_LABELS: Record<string, string> = {
  REUNIAO_CALL: 'Reunião / Call', DECISAO_INTERNA: 'Decisão Interna',
  FEEDBACK_CLIENTE: 'Feedback do Cliente', CONCORRENCIA: 'Concorrência',
  ALTERACAO_INFORMAL: 'Alteração Informal', COMPROMISSO_ASSUMIDO: 'Compromisso Assumido',
}
const IMPACTO_LABELS: Record<string, string> = {
  AFETA_PRAZO: 'Afeta Prazo', AFETA_VALOR: 'Afeta Valor',
  AFETA_ESCOPO: 'Afeta Escopo', NENHUM: 'Nenhum',
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const schemaPost = z.object({
  tipo: z.enum(TIPOS, { required_error: 'Selecione o tipo de interação' }),
  data: z.string().min(1, 'Informe a data do evento'),
  comentario: z.string().min(1, 'Informe a descrição'),
  impacto: z.array(z.enum(IMPACTOS)).optional().default([]),
  versao: z.number().int().optional(),
})

// GET — lista paginada/filtrada server-side. Query: ?q=&tipo=&limit=&offset=
// Visível para qualquer usuário com acesso (histórico coletivo da negociação).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const tipoFiltro = sp.get('tipo') ?? ''
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? 10), 1), 50)
  const offset = Math.max(Number(sp.get('offset') ?? 0), 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { solicitacao_id: id }
  if (tipoFiltro && (TIPOS as readonly string[]).includes(tipoFiltro)) where.tipo = tipoFiltro

  if (q) {
    const nq = norm(q)
    const tiposMatch = TIPOS.filter((t) => norm(TIPO_LABELS[t]).includes(nq))
    const impactosMatch = IMPACTOS.filter((i) => norm(IMPACTO_LABELS[i]).includes(nq))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [
      { comentario: { contains: q, mode: 'insensitive' } },
      { criador: { nome: { contains: q, mode: 'insensitive' } } },
    ]
    if (tiposMatch.length) or.push({ tipo: { in: tiposMatch } })
    if (impactosMatch.length) or.push({ impacto: { hasSome: impactosMatch } })
    const rev = q.match(/rev\s*0*(\d+)/i)
    if (rev) or.push({ versao: Number(rev[1]) })
    where.AND = [{ OR: or }]
  }

  const [total, infos] = await Promise.all([
    prisma.solicitacaoInfo.count({ where }),
    prisma.solicitacaoInfo.findMany({
      where,
      orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
      skip: offset,
      take: limit,
      include: { criador: { select: { nome: true } } },
    }),
  ])

  return NextResponse.json({
    data: {
      total,
      items: infos.map(i => ({
        id: i.id,
        tipo: i.tipo,
        data: i.data.toISOString(),
        comentario: i.comentario,
        impacto: i.impacto,
        versao: i.versao,
        created_at: i.created_at.toISOString(),
        created_by: i.created_by,
        autor: i.criador.nome,
      })),
    },
    error: null,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const { erro } = await exigirPermissao('orc.info.registrar'); if (erro) return erro }

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1 },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1 },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  // Auto-detect current revision if not provided
  const versaoAtual = parsed.data.versao
    ?? sol.propostas_tecnicas[0]?.versao
    ?? sol.propostas_fabricacao[0]?.versao
    ?? null

  const info = await prisma.solicitacaoInfo.create({
    data: {
      solicitacao_id: id,
      tipo: parsed.data.tipo,
      data: new Date(parsed.data.data),
      comentario: parsed.data.comentario,
      impacto: parsed.data.impacto,
      versao: versaoAtual,
      created_by: Number(session.user.id),
    },
    include: { criador: { select: { nome: true } } },
  })

  return NextResponse.json({
    data: {
      id: info.id,
      tipo: info.tipo,
      data: info.data.toISOString(),
      comentario: info.comentario,
      impacto: info.impacto,
      versao: info.versao,
      created_at: info.created_at.toISOString(),
      created_by: info.created_by,
      autor: info.criador.nome,
    },
    error: null,
  }, { status: 201 })
}
