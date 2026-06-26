import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const TIPOS = ['REUNIAO_CALL', 'DECISAO_INTERNA', 'FEEDBACK_CLIENTE', 'CONCORRENCIA', 'ALTERACAO_INFORMAL', 'COMPROMISSO_ASSUMIDO'] as const
const IMPACTOS = ['AFETA_PRAZO', 'AFETA_VALOR', 'AFETA_ESCOPO', 'NENHUM'] as const

const schemaPost = z.object({
  tipo: z.enum(TIPOS, { required_error: 'Selecione o tipo de interação' }),
  data: z.string().min(1, 'Informe a data do evento'),
  comentario: z.string().min(1, 'Informe a descrição'),
  impacto: z.array(z.enum(IMPACTOS)).optional().default([]),
  versao: z.number().int().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const infos = await prisma.solicitacaoInfo.findMany({
    where: { solicitacao_id: id },
    orderBy: { data: 'desc' },
    include: { criador: { select: { nome: true } } },
  })

  return NextResponse.json({
    data: infos.map(i => ({
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
