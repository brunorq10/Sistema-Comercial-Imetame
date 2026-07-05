import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const TIPOS = ['MULTA', 'GLOSAS', 'REEMBOLSOS', 'OUTROS'] as const

const postSchema = z.object({
  tipo: z.enum(TIPOS, { required_error: 'Selecione o tipo' }),
  descricao: z.string().min(1, 'Informe a descrição'),
  data_ocorrencia: z.string().min(1, 'Informe a data da ocorrência'),
  data_notificacao_cliente: z.string().nullable().optional(),
  data_desconto: z.string().nullable().optional(),
  valor_total: z.number().positive('Valor total inválido'),
})

function serialize(m: {
  id: number; tipo: string; descricao: string; data_ocorrencia: Date
  data_notificacao_cliente: Date | null; data_desconto: Date | null
  valor_total: unknown; ativa: boolean; motivo_inativacao: string | null
  created_at: Date; created_by: number; criador?: { nome: string }
}) {
  return {
    id: m.id,
    tipo: m.tipo,
    descricao: m.descricao,
    data_ocorrencia: m.data_ocorrencia.toISOString(),
    data_notificacao_cliente: m.data_notificacao_cliente?.toISOString() ?? null,
    data_desconto: m.data_desconto?.toISOString() ?? null,
    valor_total: Number(m.valor_total),
    ativa: m.ativa,
    motivo_inativacao: m.motivo_inativacao,
    created_at: m.created_at.toISOString(),
    created_by: m.created_by,
    autor: m.criador?.nome ?? '',
  }
}

// GET — multas de um contrato (Visão Geral / aba do modal).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const multas = await prisma.multaPenalidade.findMany({
    where: { contrato_id: contratoId, deleted_at: null },
    orderBy: [{ data_ocorrencia: 'desc' }, { created_at: 'desc' }],
    include: { criador: { select: { nome: true } } },
  })
  return NextResponse.json({ data: multas.map(serialize), error: null })
}

// POST — lança uma multa/penalidade no contrato.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  { const { erro } = await exigirPermissao('acordos.faturamento.item.editar'); if (erro) return erro }

  const parsed = postSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data

  const multa = await prisma.multaPenalidade.create({
    data: {
      contrato_id: contratoId,
      tipo: d.tipo,
      descricao: d.descricao,
      data_ocorrencia: new Date(d.data_ocorrencia),
      data_notificacao_cliente: d.data_notificacao_cliente ? new Date(d.data_notificacao_cliente) : null,
      data_desconto: d.data_desconto ? new Date(d.data_desconto) : null,
      valor_total: d.valor_total,
      created_by: Number(session.user.id),
    },
    include: { criador: { select: { nome: true } } },
  })
  return NextResponse.json({ data: serialize(multa), error: null }, { status: 201 })
}
