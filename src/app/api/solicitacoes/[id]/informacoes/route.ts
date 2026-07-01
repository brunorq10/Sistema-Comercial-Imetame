import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const TIPOS = ['REUNIAO_CALL', 'DEFINICAO_INTERNA', 'FEEDBACK_CLIENTE', 'DEFINICAO_ESCOPO', 'CONCORRENCIA', 'OUTROS'] as const

// Rótulos para busca por palavra-chave (ex.: "concorrência" → tipo CONCORRENCIA)
const TIPO_LABELS: Record<string, string> = {
  REUNIAO_CALL: 'Reunião / Call', DEFINICAO_INTERNA: 'Definição Interna',
  FEEDBACK_CLIENTE: 'Feedback Cliente', DEFINICAO_ESCOPO: 'Definição de Escopo',
  CONCORRENCIA: 'Concorrência', OUTROS: 'Outros',
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function inicioPeriodo(periodo: string): Date | null {
  const hoje = new Date()
  if (periodo === '30d') return new Date(hoje.getTime() - 30 * 86400000)
  if (periodo === '90d') return new Date(hoje.getTime() - 90 * 86400000)
  if (periodo === 'mes_atual') return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return null
}

const anexoSchema = z.object({
  nome: z.string().min(1),
  tipo: z.string().min(1),
  url: z.string().min(1),
  tamanho: z.number().int().nullable().optional(),
})
const schemaPost = z.object({
  tipo: z.enum(TIPOS, { required_error: 'Selecione o tipo de informação' }),
  data: z.string().min(1, 'Informe a data do evento'),
  comentario: z.string().min(1, 'Informe a descrição'),
  versao: z.number().int().optional(),
  anexos: z.array(anexoSchema).optional().default([]),
})

// Próximo código sequencial por solicitação (INF-0001, ...). Considera apenas
// registros que já têm código (informações do usuário; automáticos ficam null).
async function gerarCodigo(solicitacaoId: number): Promise<string> {
  const ultima = await prisma.solicitacaoInfo.findFirst({
    where: { solicitacao_id: solicitacaoId, codigo: { not: null } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  })
  const n = ultima?.codigo ? parseInt(ultima.codigo.replace(/\D/g, ''), 10) + 1 : 1
  return `INF-${String(n).padStart(4, '0')}`
}

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
  const periodo = sp.get('periodo') ?? 'all'
  const autor = sp.get('autor') ?? ''
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? 10), 1), 50)
  const offset = Math.max(Number(sp.get('offset') ?? 0), 0)

  // Filtros multi-valor: lista separada por vírgula
  const tiposSel = tipoFiltro ? tipoFiltro.split(',').filter((t) => (TIPOS as readonly string[]).includes(t)) : []
  const autoresIds = autor ? autor.split(',').map(Number).filter((n) => !isNaN(n)) : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { solicitacao_id: id }
  // Aba "Linha do Tempo" = registros manuais (com tipo). Breadcrumbs
  // automáticos (tipo null) pertencem ao auditlog (aba Histórico do Sistema).
  if (tiposSel.length) where.tipo = { in: tiposSel }
  else where.tipo = { not: null }
  if (autoresIds.length) where.created_by = { in: autoresIds }
  const desde = inicioPeriodo(periodo)
  if (desde) where.data = { gte: desde }

  if (q) {
    const nq = norm(q)
    const tiposMatch = TIPOS.filter((t) => norm(TIPO_LABELS[t]).includes(nq))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [
      { codigo: { contains: q, mode: 'insensitive' } },
      { comentario: { contains: q, mode: 'insensitive' } },
      { criador: { nome: { contains: q, mode: 'insensitive' } } },
    ]
    if (tiposMatch.length) or.push({ tipo: { in: tiposMatch } })
    where.AND = [{ OR: or }]
  }

  const [total, infos, proximoCodigo, autoresRaw] = await Promise.all([
    prisma.solicitacaoInfo.count({ where }),
    prisma.solicitacaoInfo.findMany({
      where,
      orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
      skip: offset,
      take: limit,
      include: { criador: { select: { nome: true } }, _count: { select: { anexos: true } } },
    }),
    gerarCodigo(id),
    // Autores de TODAS as informações (com tipo) da solicitação — para o select
    prisma.solicitacaoInfo.findMany({
      where: { solicitacao_id: id, tipo: { not: null } },
      distinct: ['created_by'],
      select: { created_by: true, criador: { select: { nome: true } } },
      orderBy: { criador: { nome: 'asc' } },
    }),
  ])

  return NextResponse.json({
    data: {
      total,
      proximoCodigo,
      autores: autoresRaw.map((a) => ({ id: a.created_by, nome: a.criador.nome })),
      items: infos.map(i => ({
        id: i.id,
        codigo: i.codigo,
        tipo: i.tipo,
        data: i.data.toISOString(),
        comentario: i.comentario,
        versao: i.versao,
        created_at: i.created_at.toISOString(),
        created_by: i.created_by,
        autor: i.criador.nome,
        anexosCount: i._count.anexos,
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

  // Limite defensivo de payload (anexos base64 ~1,33x)
  const totalBytes = parsed.data.anexos.reduce((s, a) => s + a.url.length, 0)
  if (totalBytes > 5 * 1024 * 1024) {
    return NextResponse.json({ data: null, error: 'Anexos excedem o limite total permitido.' }, { status: 413 })
  }

  const versaoAtual = parsed.data.versao
    ?? sol.propostas_tecnicas[0]?.versao
    ?? sol.propostas_fabricacao[0]?.versao
    ?? null
  const codigo = await gerarCodigo(id)

  const info = await prisma.solicitacaoInfo.create({
    data: {
      solicitacao_id: id,
      codigo,
      tipo: parsed.data.tipo,
      data: new Date(parsed.data.data),
      comentario: parsed.data.comentario,
      versao: versaoAtual,
      created_by: Number(session.user.id),
      anexos: parsed.data.anexos.length
        ? { create: parsed.data.anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, url: a.url, tamanho: a.tamanho ?? null })) }
        : undefined,
    },
    include: { criador: { select: { nome: true } }, _count: { select: { anexos: true } } },
  })

  return NextResponse.json({
    data: {
      id: info.id,
      codigo: info.codigo,
      tipo: info.tipo,
      data: info.data.toISOString(),
      comentario: info.comentario,
      versao: info.versao,
      created_at: info.created_at.toISOString(),
      created_by: info.created_by,
      autor: info.criador.nome,
      anexosCount: info._count.anexos,
    },
    error: null,
  }, { status: 201 })
}
