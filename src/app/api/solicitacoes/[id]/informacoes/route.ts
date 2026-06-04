import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schemaPost = z.object({
  data: z.string().min(1),
  comentario: z.string().min(1),
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
      data: i.data.toISOString(),
      comentario: i.comentario,
      versao: i.versao,
      created_at: i.created_at.toISOString(),
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
      data: new Date(parsed.data.data),
      comentario: parsed.data.comentario,
      versao: versaoAtual,
      created_by: Number(session.user.id),
    },
    include: { criador: { select: { nome: true } } },
  })

  return NextResponse.json({
    data: {
      id: info.id,
      data: info.data.toISOString(),
      comentario: info.comentario,
      versao: info.versao,
      created_at: info.created_at.toISOString(),
      autor: info.criador.nome,
    },
    error: null,
  }, { status: 201 })
}
