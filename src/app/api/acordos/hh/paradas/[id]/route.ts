import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { exigirTitularContrato } from '@/lib/permissaoApi'

const DiaSchema = z.object({
  etapa: z.enum(['PREPARATIVO', 'PARADA', 'ACOMP_DESMOB']),
  data: z.string(), // ISO date
  efetivo_plan: z.number().int().nonnegative().nullable().optional(),
  horas_dia_plan: z.number().nonnegative().nullable().optional(),
  hh_plan: z.number().nonnegative().nullable().optional(),
  efetivo_real: z.number().int().nonnegative().nullable().optional(),
  horas_dia_real: z.number().nonnegative().nullable().optional(),
  hh_real: z.number().nonnegative().nullable().optional(),
})

const FolgaLinhaSchema = z.object({
  pessoas_prev: z.number().int().nullable().optional(),
  pessoas_real: z.number().int().nullable().optional(),
  dias_prev: z.number().nullable().optional(),
  dias_real: z.number().nullable().optional(),
})

const BodySchema = z.object({
  prep_inicio: z.string().nullable().optional(),
  prep_fim: z.string().nullable().optional(),
  parada_inicio: z.string().nullable().optional(),
  parada_fim: z.string().nullable().optional(),
  acomp_inicio: z.string().nullable().optional(),
  acomp_fim: z.string().nullable().optional(),

  mob_ativo: z.boolean().optional(),
  mob_dias_prev: z.number().nullable().optional(),
  mob_dias_real: z.number().nullable().optional(),

  desmob_ativo: z.boolean().optional(),
  desmob_dias_prev: z.number().nullable().optional(),
  desmob_dias_real: z.number().nullable().optional(),

  integ_ativo: z.boolean().optional(),
  integ_dias_prev: z.number().nullable().optional(),
  integ_dias_real: z.number().nullable().optional(),

  folga_ativo: z.boolean().optional(),
  folga_dias_prev: z.number().nullable().optional(),
  folga_dias_real: z.number().nullable().optional(),
  folga_pessoas_prev: z.number().int().nullable().optional(),
  folga_pessoas_real: z.number().int().nullable().optional(),
  // Múltiplas linhas de Folga (grupos com dias/efetivo diferentes) — substitui
  // por completo as linhas existentes a cada save (mesmo padrão já usado para
  // os meses de FabricacaoItem). Os campos escalares folga_dias_prev/real e
  // folga_pessoas_prev/real acima ficam legados (não mais escritos).
  folgas: z.array(FolgaLinhaSchema).optional(),

  fin_prev_valor_servico: z.number().nullable().optional(),
  fin_prev_ase: z.number().nullable().optional(),

  dias: z.array(DiaSchema).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    include: {
      cliente: true,
      cliente_final: true,
      responsavel: true,
      parada_hh_config: {
        include: {
          dias: { orderBy: [{ etapa: 'asc' }, { data: 'asc' }] },
          folgas: { orderBy: { ordem: 'asc' } },
          quemFechou: { select: { nome: true } },
        },
      },
      subindices: {
        where: { deleted_at: null },
        include: {
          notas_fiscais: { where: { ativa: true, deleted_at: null } },
        },
      },
    },
  })

  if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

  // Calcula valor orçado total (soma de todos os meses dos sub-índices)
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
  const valorOrcado = contrato.subindices.reduce((acc, s) =>
    acc + MESES.reduce((b, m) => b + Number((s as Record<string, unknown>)[m] ?? 0), 0), 0)

  // Calcula valor faturado (NFs ativas)
  const valorFaturado = contrato.subindices.reduce((acc, s) =>
    acc + s.notas_fiscais.reduce((b, nf) => b + Number(nf.valor_atribuido), 0), 0)

  return NextResponse.json({
    data: {
      contrato: {
        id: contrato.id,
        numero: contrato.indice,
        descricao: contrato.descricao,
        cliente: contrato.cliente?.nome ?? '',
        cliente_final: contrato.cliente_final?.nome ?? null,
        cidade: contrato.cidade,
        estado: contrato.estado,
        escopo: contrato.descricao,
        responsavel: contrato.responsavel?.nome ?? '',
        responsavel_id: contrato.responsavel?.id ?? null,
        data_inicio: contrato.data_inicio?.toISOString() ?? null,
        valor_orcado: valorOrcado,
        valor_faturado: valorFaturado,
      },
      config: contrato.parada_hh_config,
    },
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.paradas.controlehh.editar'); if (_n) return _n }

  const existente = await prisma.paradaHhConfig.findUnique({ where: { contrato_id: contratoId } })
  if (existente?.fechada_em) {
    return NextResponse.json({ error: 'Esta Parada está fechada e não pode mais ser ajustada. Reabra-a antes de editar.' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dias, folgas, ...configData } = parsed.data
  const userId = Number(session.user.id)

  const toDecimal = (v: number | null | undefined) => v != null ? v : null

  // ── Auditoria: diff campo a campo do previsto/planejado (mesmo padrão já
  // usado em FabricacaoItemHistorico) — Paradas hoje sobrescreve a config sem
  // deixar rastro de quem mudou o quê.
  const fmtData = (v: Date | string | null | undefined) => {
    if (!v) return null
    const d = typeof v === 'string' ? new Date(v) : v
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }
  const fmtNum = (v: number | { toString(): string } | null | undefined) => v != null ? Number(v).toLocaleString('pt-BR') : null
  const fmtBool = (v: boolean | null | undefined) => v == null ? null : (v ? 'Sim' : 'Não')
  const fmtMoeda = (v: number | { toString(): string } | null | undefined) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

  const hist: { campo: string; valor_de: string | null; valor_para: string | null; created_by: number }[] = []
  const push = (campo: string, de: string | null, para: string | null) => {
    if (de !== para) hist.push({ campo, valor_de: de, valor_para: para, created_by: userId })
  }
  if (existente) {
    if (configData.prep_inicio !== undefined) push('Preparativo — Início', fmtData(existente.prep_inicio), fmtData(configData.prep_inicio))
    if (configData.prep_fim !== undefined) push('Preparativo — Fim', fmtData(existente.prep_fim), fmtData(configData.prep_fim))
    if (configData.parada_inicio !== undefined) push('Parada — Início', fmtData(existente.parada_inicio), fmtData(configData.parada_inicio))
    if (configData.parada_fim !== undefined) push('Parada — Fim', fmtData(existente.parada_fim), fmtData(configData.parada_fim))
    if (configData.acomp_inicio !== undefined) push('Pós Parada — Início', fmtData(existente.acomp_inicio), fmtData(configData.acomp_inicio))
    if (configData.acomp_fim !== undefined) push('Pós Parada — Fim', fmtData(existente.acomp_fim), fmtData(configData.acomp_fim))

    if (configData.mob_ativo !== undefined) push('Mobilização — Considerar', fmtBool(existente.mob_ativo), fmtBool(configData.mob_ativo))
    if (configData.mob_dias_prev !== undefined) push('Mobilização — Dias Previsto', fmtNum(existente.mob_dias_prev), fmtNum(configData.mob_dias_prev))
    if (configData.mob_dias_real !== undefined) push('Mobilização — Dias Realizado', fmtNum(existente.mob_dias_real), fmtNum(configData.mob_dias_real))

    if (configData.desmob_ativo !== undefined) push('Desmobilização — Considerar', fmtBool(existente.desmob_ativo), fmtBool(configData.desmob_ativo))
    if (configData.desmob_dias_prev !== undefined) push('Desmobilização — Dias Previsto', fmtNum(existente.desmob_dias_prev), fmtNum(configData.desmob_dias_prev))
    if (configData.desmob_dias_real !== undefined) push('Desmobilização — Dias Realizado', fmtNum(existente.desmob_dias_real), fmtNum(configData.desmob_dias_real))

    if (configData.integ_ativo !== undefined) push('Integração — Considerar', fmtBool(existente.integ_ativo), fmtBool(configData.integ_ativo))
    if (configData.integ_dias_prev !== undefined) push('Integração — Dias Previsto', fmtNum(existente.integ_dias_prev), fmtNum(configData.integ_dias_prev))
    if (configData.integ_dias_real !== undefined) push('Integração — Dias Realizado', fmtNum(existente.integ_dias_real), fmtNum(configData.integ_dias_real))

    if (configData.folga_ativo !== undefined) push('Folga — Considerar', fmtBool(existente.folga_ativo), fmtBool(configData.folga_ativo))
    if (configData.folga_dias_prev !== undefined) push('Folga — Dias Previsto', fmtNum(existente.folga_dias_prev), fmtNum(configData.folga_dias_prev))
    if (configData.folga_dias_real !== undefined) push('Folga — Dias Realizado', fmtNum(existente.folga_dias_real), fmtNum(configData.folga_dias_real))
    if (configData.folga_pessoas_prev !== undefined) push('Folga — Pessoas Previsto', fmtNum(existente.folga_pessoas_prev), fmtNum(configData.folga_pessoas_prev))
    if (configData.folga_pessoas_real !== undefined) push('Folga — Pessoas Realizado', fmtNum(existente.folga_pessoas_real), fmtNum(configData.folga_pessoas_real))

    if (configData.fin_prev_valor_servico !== undefined) push('Valor Total Serviço (Previsto)', fmtMoeda(existente.fin_prev_valor_servico), fmtMoeda(configData.fin_prev_valor_servico))
    if (configData.fin_prev_ase !== undefined) push('Serviços Extras — ASE (Previsto)', fmtMoeda(existente.fin_prev_ase), fmtMoeda(configData.fin_prev_ase))
  }

  const config = await prisma.paradaHhConfig.upsert({
    where: { contrato_id: contratoId },
    create: {
      contrato_id: contratoId,
      prep_inicio: configData.prep_inicio ? new Date(configData.prep_inicio) : null,
      prep_fim: configData.prep_fim ? new Date(configData.prep_fim) : null,
      parada_inicio: configData.parada_inicio ? new Date(configData.parada_inicio) : null,
      parada_fim: configData.parada_fim ? new Date(configData.parada_fim) : null,
      acomp_inicio: configData.acomp_inicio ? new Date(configData.acomp_inicio) : null,
      acomp_fim: configData.acomp_fim ? new Date(configData.acomp_fim) : null,
      mob_ativo: configData.mob_ativo ?? false,
      mob_dias_prev: configData.mob_dias_prev ?? null,
      mob_dias_real: configData.mob_dias_real ?? null,
      desmob_ativo: configData.desmob_ativo ?? false,
      desmob_dias_prev: configData.desmob_dias_prev ?? null,
      desmob_dias_real: configData.desmob_dias_real ?? null,
      integ_ativo: configData.integ_ativo ?? false,
      integ_dias_prev: configData.integ_dias_prev ?? null,
      integ_dias_real: configData.integ_dias_real ?? null,
      folga_ativo: configData.folga_ativo ?? false,
      folga_dias_prev: configData.folga_dias_prev ?? null,
      folga_dias_real: configData.folga_dias_real ?? null,
      folga_pessoas_prev: configData.folga_pessoas_prev ?? null,
      folga_pessoas_real: configData.folga_pessoas_real ?? null,
      fin_prev_valor_servico: toDecimal(configData.fin_prev_valor_servico),
      fin_prev_ase: toDecimal(configData.fin_prev_ase),
    },
    update: {
      prep_inicio: configData.prep_inicio !== undefined ? (configData.prep_inicio ? new Date(configData.prep_inicio) : null) : undefined,
      prep_fim: configData.prep_fim !== undefined ? (configData.prep_fim ? new Date(configData.prep_fim) : null) : undefined,
      parada_inicio: configData.parada_inicio !== undefined ? (configData.parada_inicio ? new Date(configData.parada_inicio) : null) : undefined,
      parada_fim: configData.parada_fim !== undefined ? (configData.parada_fim ? new Date(configData.parada_fim) : null) : undefined,
      acomp_inicio: configData.acomp_inicio !== undefined ? (configData.acomp_inicio ? new Date(configData.acomp_inicio) : null) : undefined,
      acomp_fim: configData.acomp_fim !== undefined ? (configData.acomp_fim ? new Date(configData.acomp_fim) : null) : undefined,
      mob_ativo: configData.mob_ativo,
      mob_dias_prev: configData.mob_dias_prev,
      mob_dias_real: configData.mob_dias_real,
      desmob_ativo: configData.desmob_ativo,
      desmob_dias_prev: configData.desmob_dias_prev,
      desmob_dias_real: configData.desmob_dias_real,
      integ_ativo: configData.integ_ativo,
      integ_dias_prev: configData.integ_dias_prev,
      integ_dias_real: configData.integ_dias_real,
      folga_ativo: configData.folga_ativo,
      folga_dias_prev: configData.folga_dias_prev,
      folga_dias_real: configData.folga_dias_real,
      folga_pessoas_prev: configData.folga_pessoas_prev,
      folga_pessoas_real: configData.folga_pessoas_real,
      fin_prev_valor_servico: configData.fin_prev_valor_servico !== undefined ? toDecimal(configData.fin_prev_valor_servico) : undefined,
      fin_prev_ase: configData.fin_prev_ase !== undefined ? toDecimal(configData.fin_prev_ase) : undefined,
    },
  })

  if (dias && dias.length > 0) {
    await Promise.all(
      dias.map((d) =>
        prisma.paradaHhDia.upsert({
          where: {
            config_id_etapa_data: {
              config_id: config.id,
              etapa: d.etapa,
              data: new Date(d.data),
            },
          },
          create: {
            config_id: config.id,
            etapa: d.etapa,
            data: new Date(d.data),
            efetivo_plan: d.efetivo_plan ?? null,
            horas_dia_plan: d.horas_dia_plan ?? null,
            hh_plan: d.hh_plan != null ? d.hh_plan : null,
            efetivo_real: d.efetivo_real ?? null,
            horas_dia_real: d.horas_dia_real ?? null,
            hh_real: d.hh_real != null ? d.hh_real : null,
            created_by: userId,
            updated_by: userId,
          },
          update: {
            efetivo_plan: d.efetivo_plan ?? null,
            horas_dia_plan: d.horas_dia_plan ?? null,
            hh_plan: d.hh_plan != null ? d.hh_plan : null,
            efetivo_real: d.efetivo_real ?? null,
            horas_dia_real: d.horas_dia_real ?? null,
            hh_real: d.hh_real != null ? d.hh_real : null,
            updated_by: userId,
          },
        }),
      ),
    )
  }

  if (folgas !== undefined) {
    await prisma.$transaction([
      prisma.paradaFolgaLinha.deleteMany({ where: { config_id: config.id } }),
      ...(folgas.length > 0
        ? [prisma.paradaFolgaLinha.createMany({
            data: folgas.map((f, i) => ({
              config_id: config.id,
              ordem: i,
              pessoas_prev: f.pessoas_prev ?? null,
              pessoas_real: f.pessoas_real ?? null,
              dias_prev: f.dias_prev ?? null,
              dias_real: f.dias_real ?? null,
              created_by: userId,
            })),
          })]
        : []),
    ])
  }

  if (hist.length > 0) {
    await prisma.paradaHhConfigHistorico.createMany({
      data: hist.map((h) => ({ ...h, config_id: config.id })),
    })
  }

  const folgasFinais = folgas !== undefined
    ? await prisma.paradaFolgaLinha.findMany({ where: { config_id: config.id }, orderBy: { ordem: 'asc' } })
    : undefined

  return NextResponse.json({ data: { config: { ...config, folgas: folgasFinais } } })
}
