import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exigirPermissao } from '@/lib/permissaoApi'

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

const mesesSchema = {
  jan: z.number().nonnegative().optional(), fev: z.number().nonnegative().optional(),
  mar: z.number().nonnegative().optional(), abr: z.number().nonnegative().optional(),
  mai: z.number().nonnegative().optional(), jun: z.number().nonnegative().optional(),
  jul: z.number().nonnegative().optional(), ago: z.number().nonnegative().optional(),
  set: z.number().nonnegative().optional(), out: z.number().nonnegative().optional(),
  nov: z.number().nonnegative().optional(), dez: z.number().nonnegative().optional(),
}
const subindiceUpdateSchema = z.object({
  id: z.number().int().positive().optional(),  // ausente = novo sub-índice
  descricao: z.string().min(1),
  valor_total: z.number().nonnegative(),
  data_inicio: z.string().optional().nullable(),
  data_fim: z.string().optional().nullable(),
  comentarios: z.string().optional().nullable(),
  ...mesesSchema,
})
const MESES_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

const updateSchema = z.object({
  ano_referencia: z.number().int().min(2000).max(2100).optional(),
  subindices: z.array(subindiceUpdateSchema).optional(),
  status: z.enum(['A_FATURAR', 'FATURADO', 'PARCIAL', 'CANCELADO']).optional(),
  cliente_id: z.number().int().positive().optional(),
  cliente_final_id: z.number().int().positive().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
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
      data_base: true, data_envio: true, resultado: true,
    },
  },
  propostas_fabricacao: {
    orderBy: { versao: 'desc' as const },
    select: {
      id: true, versao: true,
      peso_total: true, valor_total: true,
      data_base: true, data_envio: true, resultado: true,
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
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      subindices: {
        where: { deleted_at: null },
        orderBy: { ordem: 'asc' },
        include: { notas_fiscais: { where: { deleted_at: null } } },
      },
    },
  })

  if (!contrato) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  // Busca solicitação vinculada pelo num_proposta (= Solicitacao.numero na aba Propostas)
  const solicitacao = contrato.num_proposta
    ? await prisma.solicitacao.findFirst({
        where: { numero: contrato.num_proposta, cancelled_at: null },
        select: { id: true, numero: true, ...SOLICITACAO_INCLUDE },
      })
    : null

  // Compute total % launched per NF across entire DB
  const allNFNumbers = Array.from(new Set(
    contrato.subindices.flatMap((s) => s.notas_fiscais?.map((nf) => nf.numero_nf) ?? [])
  ))
  const nfTotals = allNFNumbers.length > 0
    ? await prisma.notaFiscalContrato.groupBy({
        by: ['numero_nf'],
        where: { numero_nf: { in: allNFNumbers }, deleted_at: null },
        _sum: { percentual: true },
      })
    : []
  const nfTotalMap: Record<string, number> = {}
  nfTotals.forEach((t) => { nfTotalMap[t.numero_nf] = Number(t._sum.percentual ?? 0) })

  return NextResponse.json({ data: serializeContrato(contrato, nfTotalMap, solicitacao), error: null })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('acordos.faturamento.item.editar'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const { cancel_reason, subindices: subsBody, ...rest } = parsed.data

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

  // Mantém o vínculo com a solicitação de origem em sincronia com o Nº Proposta
  // (elo dos relatórios cruzados Comercial × Acordos), exceto se o chamador já
  // enviou solicitacao_id explicitamente.
  if (rest.num_proposta !== undefined && rest.solicitacao_id === undefined) {
    const sol = rest.num_proposta
      ? await prisma.solicitacao.findFirst({ where: { numero: rest.num_proposta.trim(), cancelled_at: null }, select: { id: true } })
      : null
    data.solicitacao_id = sol?.id ?? null
  }

  const contrato = await prisma.contrato.update({
    where: { id },
    data,
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      subindices: { where: { deleted_at: null }, orderBy: { ordem: 'asc' }, include: { notas_fiscais: { where: { deleted_at: null } } } },
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

  // ── Sincroniza os sub-índices (eventos de medição) enviados na edição ──────
  // Atualiza os existentes (por id), cria os novos (sem id) e remove os que
  // sumiram — exceto se tiverem NFs lançadas (não pode perder faturamento).
  if (subsBody) {
    const userId = Number(session.user.id)
    const existentes = await prisma.subIndiceFaturamento.findMany({
      where: { contrato_id: id, deleted_at: null },
      select: { id: true, ordem: true, _count: { select: { notas_fiscais: true } } },
    })
    const idsBody = new Set(subsBody.filter((s) => s.id != null).map((s) => s.id as number))
    let maxOrdem = existentes.reduce((m, e) => Math.max(m, e.ordem), 0)
    const naoExcluidos: number[] = []

    const ops = []
    // Remoções (apenas sub-índices sem NFs) — Lixeira: soft-delete recuperável
    for (const e of existentes) {
      if (!idsBody.has(e.id)) {
        if (e._count.notas_fiscais === 0) {
          ops.push(prisma.subIndiceFaturamento.update({
            where: { id: e.id },
            data: { deleted_at: new Date(), deleted_by: userId },
          }))
        } else naoExcluidos.push(e.id)
      }
    }
    // Atualizações e criações
    for (const s of subsBody) {
      const meses = Object.fromEntries(MESES_KEYS.map((m) => [m, s[m] ?? null]))
      const comum = {
        descricao: s.descricao,
        valor_total: s.valor_total,
        data_inicio: s.data_inicio ? new Date(s.data_inicio) : null,
        data_fim: s.data_fim ? new Date(s.data_fim) : null,
        comentarios: s.comentarios ?? null,
        ...meses,
      }
      if (s.id != null && existentes.some((e) => e.id === s.id)) {
        ops.push(prisma.subIndiceFaturamento.update({ where: { id: s.id }, data: comum }))
      } else {
        maxOrdem += 1
        ops.push(prisma.subIndiceFaturamento.create({ data: { contrato_id: id, ordem: maxOrdem, ...comum, created_by: userId } }))
      }
    }
    if (ops.length > 0) await prisma.$transaction(ops)

    // Recarrega o contrato com os sub-índices atualizados para a resposta
    const atualizado = await prisma.contrato.findUnique({
      where: { id },
      include: {
        cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
        cliente_final: { select: { id: true, nome: true } },
        responsavel:   { select: { id: true, nome: true } },
        subindices: { where: { deleted_at: null }, orderBy: { ordem: 'asc' }, include: { notas_fiscais: { where: { deleted_at: null } } } },
      },
    })
    const aviso = naoExcluidos.length > 0
      ? `${naoExcluidos.length} evento(s) não foram excluídos porque possuem NFs lançadas. Inative/exclua as NFs antes de remover o evento.`
      : undefined
    return NextResponse.json({ data: serializeContrato(atualizado), warning: aviso, error: null })
  }

  return NextResponse.json({ data: serializeContrato(contrato), error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  // RN-CF-22: apenas GESTAO_ACORDOS ou ADM_GERAL podem cancelar contratos
  { const { erro } = await exigirPermissao('acordos.faturamento.item.excluir'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  // RN-CF-21: só pode cancelar macro se não houver sub-índices vinculados
  const qtSubindices = await prisma.subIndiceFaturamento.count({ where: { contrato_id: id } })
  if (qtSubindices > 0) {
    return NextResponse.json(
      { data: null, error: `Não é possível cancelar: o contrato ainda possui ${qtSubindices} sub-índice(s). Exclua-os antes de cancelar o contrato.` },
      { status: 422 },
    )
  }

  await prisma.contrato.update({
    where: { id },
    data: { cancelled_at: new Date(), cancel_reason: 'Excluído pelo usuário', status: 'CANCELADO' },
  })

  return NextResponse.json({ data: null, error: null })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeContratoStatus(c: any): string {
  if (c.cancelled_at) return 'CANCELADO'
  if (!c.subindices || c.subindices.length === 0) return c.status
  // RN-CF-19: status calculado dinamicamente a partir dos sub-índices
  const statuses = c.subindices.map((s: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fat = (s.notas_fiscais ?? []).filter((nf: any) => nf.ativa).reduce((a: number, nf: any) => a + Number(nf.valor_atribuido), 0)
    if (fat === 0) return 'A_FATURAR'
    if (fat >= Number(s.valor_total)) return 'FATURADO'
    return 'PARCIAL'
  })
  if (statuses.every((s: string) => s === 'FATURADO')) return 'FATURADO'
  if (statuses.some((s: string) => s === 'FATURADO' || s === 'PARCIAL')) return 'PARCIAL'
  return 'A_FATURAR'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeContrato(c: any, nfTotalMap: Record<string, number> = {}, solicitacao: any = null) {
  return {
    id: c.id,
    indice: c.indice,
    ano_referencia: c.ano_referencia,
    status: computeContratoStatus(c),
    cliente: c.cliente,
    cliente_final: c.cliente_final ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    responsavel: c.responsavel,
    solicitacao: solicitacao ? serializeSolicitacao(solicitacao) : null,
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
  const dataBase =
    s.propostas_comerciais.slice().reverse().find((pc: any) => pc.data_base)?.data_base ??
    s.propostas_fabricacao?.slice().reverse().find((pf: any) => pf.data_base)?.data_base ??
    null

  return {
    id: s.id,
    numero: s.numero,
    data_base: dataBase?.toISOString() ?? null,
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
      data_base: pc.data_base?.toISOString() ?? null,
      data_envio: pc.data_envio?.toISOString() ?? null,
      resultado: pc.resultado,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propostas_fabricacao: (s.propostas_fabricacao ?? []).map((pf: any) => ({
      id: pf.id,
      versao: pf.versao,
      peso_total: pf.peso_total ? Number(pf.peso_total) : null,
      valor_total: pf.valor_total ? Number(pf.valor_total) : null,
      data_base: pf.data_base?.toISOString() ?? null,
      data_envio: pf.data_envio?.toISOString() ?? null,
      resultado: pf.resultado,
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
    num_os: s.num_os ?? null,
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
      ativa: nf.ativa, motivo_inativacao: nf.motivo_inativacao, tipo_documento: nf.tipo_documento ?? 'NF',
      status_aprovacao: nf.status_aprovacao ?? 'APROVADO',
      created_at: nf.created_at.toISOString(),
    })) ?? [],
  }
}
