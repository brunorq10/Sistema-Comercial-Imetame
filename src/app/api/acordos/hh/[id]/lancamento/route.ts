import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schemaPost = z.object({
  data_inicio: z.string().min(1),
  data_fim:    z.string().min(1),
  motivo:      z.string().optional(),
  meses: z.array(z.object({
    mes:          z.number().int().min(1).max(12),
    ano:          z.number().int(),
    hh_previsto:  z.number().int().min(0).optional(),
    hh_planejado: z.number().int().min(0).optional(),
  })).min(1),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const lancamentos = await prisma.hhLancamento.findMany({
    where: { contrato_id: id },
    orderBy: { versao: 'desc' },
    include: {
      meses:   { orderBy: [{ ano: 'asc' }, { mes: 'asc' }] },
      criador: { select: { nome: true } },
    },
  })

  return NextResponse.json({ data: lancamentos.map(l => ({
    id: l.id, versao: l.versao,
    data_inicio: l.data_inicio.toISOString(),
    data_fim: l.data_fim.toISOString(),
    motivo: l.motivo,
    created_at: l.created_at.toISOString(),
    criador: l.criador.nome,
    meses: l.meses,
  })), error: null })
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

  const contrato = await prisma.contrato.findUnique({ where: { id } })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })

  const d = parsed.data

  // Cálculo de versão e criação dentro da mesma transação para evitar duplicidade
  const lancamento = await prisma.$transaction(async (tx) => {
    const ultimaVersao = await tx.hhLancamento.findFirst({
      where: { contrato_id: id }, orderBy: { versao: 'desc' }, select: { versao: true },
    })
    const novaVersao = (ultimaVersao?.versao ?? 0) + 1

    return tx.hhLancamento.create({
      data: {
        contrato_id: id,
        versao: novaVersao,
        data_inicio: new Date(d.data_inicio),
        data_fim: new Date(d.data_fim),
        motivo: novaVersao > 1 ? (d.motivo ?? null) : null,
        created_by: Number(session.user.id),
        meses: {
          create: d.meses.map(m => ({
            mes: m.mes, ano: m.ano,
            hh_previsto:  m.hh_previsto  ?? null,
            hh_planejado: m.hh_planejado ?? null,
          })),
        },
      },
      include: { meses: true },
    })
  })

  return NextResponse.json({ data: lancamento, error: null }, { status: 201 })
}
