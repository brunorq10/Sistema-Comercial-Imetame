import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const updateSchema = z.object({
  ano_referencia: z.number().int().min(2000).max(2100).optional(),
  status: z.enum(['A_FATURAR', 'FATURADO', 'PARCIAL', 'CANCELADO']).optional(),
  cliente_id: z.number().int().positive().optional(),
  num_os: z.string().optional().nullable(),
  num_acordo: z.string().optional().nullable(),
  num_proposta: z.string().optional().nullable(),
  responsavel_id: z.number().int().positive().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  data_fim: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']).optional().nullable(),
  valor_contrato: z.number().nonnegative().optional().nullable(),
  cancel_reason: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true, ramo_atuacao: true } },
      responsavel: { select: { id: true, nome: true } },
      subindices: {
        orderBy: { ordem: 'asc' },
        include: { notas_fiscais: true },
      },
    },
  })

  if (!contrato) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ data: serializeContrato(contrato), error: null })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const { cancel_reason, ...rest } = parsed.data

  const data: Record<string, unknown> = { ...rest }
  if (cancel_reason !== undefined) {
    data.cancelled_at = new Date()
    data.cancel_reason = cancel_reason
    data.status = 'CANCELADO'
  }
  if (rest.data_inicio !== undefined) data.data_inicio = rest.data_inicio ? new Date(rest.data_inicio) : null
  if (rest.data_fim !== undefined) data.data_fim = rest.data_fim ? new Date(rest.data_fim) : null

  const contrato = await prisma.contrato.update({
    where: { id },
    data,
    include: {
      cliente: { select: { id: true, nome: true, ramo_atuacao: true } },
      responsavel: { select: { id: true, nome: true } },
      subindices: { orderBy: { ordem: 'asc' }, include: { notas_fiscais: true } },
    },
  })

  return NextResponse.json({ data: serializeContrato(contrato), error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  await prisma.contrato.update({
    where: { id },
    data: { cancelled_at: new Date(), cancel_reason: 'Excluído pelo usuário', status: 'CANCELADO' },
  })

  return NextResponse.json({ data: null, error: null })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeContrato(c: any) {
  return {
    id: c.id,
    indice: c.indice,
    ano_referencia: c.ano_referencia,
    status: c.status,
    cliente: c.cliente,
    responsavel: c.responsavel,
    num_os: c.num_os,
    num_acordo: c.num_acordo,
    num_proposta: c.num_proposta,
    data_inicio: c.data_inicio?.toISOString() ?? null,
    data_fim: c.data_fim?.toISOString() ?? null,
    descricao: c.descricao,
    classificacao: c.classificacao ?? null,
    valor_contrato: c.valor_contrato ? Number(c.valor_contrato) : null,
    cancelled_at: c.cancelled_at?.toISOString() ?? null,
    prev_anos_seguintes: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subindices: c.subindices.map((s: any) => serializeSubindice(s)),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSubindice(s: any) {
  const nfsAtivas = s.notas_fiscais?.filter((nf: any) => nf.ativa) ?? []
  const totalFaturado = nfsAtivas.reduce((acc: number, nf: any) => acc + Number(nf.valor_atribuido), 0)
  const status: 'A_FATURAR' | 'FATURADO' | 'PARCIAL' =
    totalFaturado === 0 ? 'A_FATURAR'
    : totalFaturado >= Number(s.valor_total) ? 'FATURADO'
    : 'PARCIAL'

  return {
    id: s.id,
    contrato_id: s.contrato_id,
    ordem: s.ordem,
    descricao: s.descricao,
    valor_total: Number(s.valor_total),
    data_inicio: s.data_inicio?.toISOString() ?? null,
    data_fim: s.data_fim?.toISOString() ?? null,
    comentarios: s.comentarios,
    jan: s.jan ? Number(s.jan) : null, fev: s.fev ? Number(s.fev) : null,
    mar: s.mar ? Number(s.mar) : null, abr: s.abr ? Number(s.abr) : null,
    mai: s.mai ? Number(s.mai) : null, jun: s.jun ? Number(s.jun) : null,
    jul: s.jul ? Number(s.jul) : null, ago: s.ago ? Number(s.ago) : null,
    set: s.set ? Number(s.set) : null, out: s.out ? Number(s.out) : null,
    nov: s.nov ? Number(s.nov) : null, dez: s.dez ? Number(s.dez) : null,
    total_faturado: totalFaturado,
    status_faturamento: status,
    prev_anos_seguintes: 0,
    notas_fiscais: s.notas_fiscais?.map((nf: any) => ({
      id: nf.id, numero_nf: nf.numero_nf,
      valor_total_nf: Number(nf.valor_total_nf),
      percentual: Number(nf.percentual),
      valor_atribuido: Number(nf.valor_atribuido),
      data_emissao: nf.data_emissao.toISOString(),
      data_vencimento: nf.data_vencimento.toISOString(),
      ativa: nf.ativa, motivo_inativacao: nf.motivo_inativacao,
    })) ?? [],
  }
}
