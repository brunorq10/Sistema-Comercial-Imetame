import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'

const CAMPO_LABELS: Record<string, string> = {
  num_os: 'Nº OS', num_acordo: 'Nº Acordo', num_proposta: 'Nº Proposta',
  descricao: 'Descrição', classificacao: 'Classificação', valor_contrato: 'Valor do Contrato',
  data_inicio: 'Data Início', data_fim: 'Data Fim', ano_referencia: 'Ano Referência',
  status: 'Status', responsavel_id: 'Responsável',
}

function formatContratoVal(campo: string, val: unknown): string {
  if (val == null) return '—'
  if (campo === 'valor_contrato') return formatCurrency(Number(val))
  if (campo === 'data_inicio' || campo === 'data_fim')
    return formatDate(val instanceof Date ? val.toISOString() : String(val)) ?? '—'
  return String(val)
}

const updateSchema = z.object({
  ano_referencia: z.number().int().min(2000).max(2100).optional(),
  status: z.enum(['A_FATURAR', 'FATURADO', 'PARCIAL', 'CANCELADO']).optional(),
  cliente_id: z.number().int().positive().optional(),
  num_os: z.string().optional().nullable(),
  num_acordo: z.string().optional().nullable(),
  num_proposta: z.string().optional().nullable(),
  solicitacao_id: z.number().int().positive().optional().nullable(),
  responsavel_id: z.number().int().positive().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  data_fim: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']).optional().nullable(),
  valor_contrato: z.number().nonnegative().optional().nullable(),
  cancel_reason: z.string().optional(),
})

const SOLICITACAO_INCLUDE = {
  propostas_tecnicas: {
    orderBy: { versao: 'desc' as const },
    select: {
      id: true, versao: true,
      hh_direto: true, hh_indireto: true, hh_total: true,
      peso_montagem: true,
      peso_equipamentos: true, peso_tubulacoes: true,
      peso_suportes: true, peso_estruturas: true,
      data_envio: true,
    },
  },
  propostas_comerciais: {
    orderBy: { versao: 'desc' as const },
    select: {
      id: true, versao: true,
      proposta_tecnica_id: true,
      valor_montagem_mecanica: true,
      valor_eletrica: true, valor_isolamento: true, valor_civil: true,
      valor_hidraulica: true, valor_fibra: true,
      valor_tijolo_antiacido: true, valor_outros_terceiros: true,
      valor_terceiros: true, valor_total: true,
      data_envio: true, resultado: true,
    },
  },
}

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
      solicitacao: {
        select: { id: true, numero: true, ...SOLICITACAO_INCLUDE },
      },
    },
  })

  if (!contrato) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  // Compute total % launched per NF across entire DB
  const allNFNumbers = Array.from(new Set(
    contrato.subindices.flatMap((s) => s.notas_fiscais?.map((nf) => nf.numero_nf) ?? [])
  ))
  const nfTotals = allNFNumbers.length > 0
    ? await prisma.notaFiscalContrato.groupBy({
        by: ['numero_nf'],
        where: { numero_nf: { in: allNFNumbers } },
        _sum: { percentual: true },
      })
    : []
  const nfTotalMap: Record<string, number> = {}
  nfTotals.forEach((t) => { nfTotalMap[t.numero_nf] = Number(t._sum.percentual ?? 0) })

  return NextResponse.json({ data: serializeContrato(contrato, nfTotalMap), error: null })
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

  // Busca valores atuais para comparar
  const atual = await prisma.contrato.findUnique({ where: { id } })
  if (!atual) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

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
      solicitacao: {
        select: { id: true, numero: true, ...SOLICITACAO_INCLUDE },
      },
    },
  })

  // Registra campos alterados no histórico
  const camposVerificar = ['num_os','num_acordo','num_proposta','descricao','classificacao',
    'valor_contrato','data_inicio','data_fim','ano_referencia','status','responsavel_id'] as const
  const historico: { contrato_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }[] = []

  for (const campo of camposVerificar) {
    const antigo = (atual as Record<string, unknown>)[campo]
    const novo   = (contrato as Record<string, unknown>)[campo]
    const antigoStr = antigo == null ? null : String(antigo)
    const novoStr   = novo   == null ? null : String(novo)
    if (antigoStr !== novoStr) {
      historico.push({
        contrato_id: id,
        campo: CAMPO_LABELS[campo] ?? campo,
        valor_de:   formatContratoVal(campo, antigo),
        valor_para: formatContratoVal(campo, novo),
        created_by: Number(session.user.id),
      })
    }
  }
  if (historico.length > 0) {
    await prisma.historicoContrato.createMany({ data: historico })
  }

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
function serializeContrato(c: any, nfTotalMap: Record<string, number> = {}) {
  return {
    id: c.id,
    indice: c.indice,
    ano_referencia: c.ano_referencia,
    status: c.status,
    cliente: c.cliente,
    responsavel: c.responsavel,
    solicitacao_id: c.solicitacao_id ?? null,
    solicitacao: c.solicitacao ? serializeSolicitacao(c.solicitacao) : null,
    num_os: c.num_os,
    num_acordo: c.num_acordo,
    num_proposta: c.num_proposta,
    data_inicio: c.data_inicio?.toISOString() ?? null,
    data_fim: c.data_fim?.toISOString() ?? null,
    descricao: c.descricao,
    classificacao: c.classificacao ?? null,
    valor_contrato: c.valor_contrato ? Number(c.valor_contrato) : null,
    cancelled_at: c.cancelled_at?.toISOString() ?? null,
    created_at: c.created_at.toISOString(),
    prev_anos_seguintes: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subindices: c.subindices.map((s: any) => serializeSubindice(s, nfTotalMap)),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSolicitacao(s: any) {
  return {
    id: s.id,
    numero: s.numero,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propostas_tecnicas: s.propostas_tecnicas.map((pt: any) => ({
      id: pt.id,
      versao: pt.versao,
      hh_direto: pt.hh_direto,
      hh_indireto: pt.hh_indireto,
      hh_total: pt.hh_total,
      peso_montagem: pt.peso_montagem ? Number(pt.peso_montagem) : null,
      peso_equipamentos: pt.peso_equipamentos ? Number(pt.peso_equipamentos) : null,
      peso_tubulacoes: pt.peso_tubulacoes ? Number(pt.peso_tubulacoes) : null,
      peso_suportes: pt.peso_suportes ? Number(pt.peso_suportes) : null,
      peso_estruturas: pt.peso_estruturas ? Number(pt.peso_estruturas) : null,
      data_envio: pt.data_envio?.toISOString() ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propostas_comerciais: s.propostas_comerciais.map((pc: any) => ({
      id: pc.id,
      versao: pc.versao,
      proposta_tecnica_id: pc.proposta_tecnica_id,
      valor_montagem_mecanica: pc.valor_montagem_mecanica ? Number(pc.valor_montagem_mecanica) : null,
      valor_terceiros: pc.valor_terceiros ? Number(pc.valor_terceiros) : null,
      valor_total: pc.valor_total ? Number(pc.valor_total) : null,
      data_envio: pc.data_envio?.toISOString() ?? null,
      resultado: pc.resultado,
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSubindice(s: any, nfTotalMap: Record<string, number> = {}) {
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
      percentual_total: nfTotalMap[nf.numero_nf] ?? Number(nf.percentual),
      valor_atribuido: Number(nf.valor_atribuido),
      data_emissao: nf.data_emissao.toISOString(),
      data_vencimento: nf.data_vencimento.toISOString(),
      ativa: nf.ativa, motivo_inativacao: nf.motivo_inativacao,
      created_at: nf.created_at.toISOString(),
    })) ?? [],
  }
}
