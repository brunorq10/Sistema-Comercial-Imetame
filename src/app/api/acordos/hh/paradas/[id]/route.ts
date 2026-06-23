import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DiaSchema = z.object({
  etapa: z.enum(['PREPARATIVO', 'PARADA', 'ACOMP_DESMOB']),
  data: z.string(), // ISO date
  efetivo_plan: z.number().int().nullable().optional(),
  horas_dia_plan: z.number().nullable().optional(),
  hh_plan: z.number().nullable().optional(),
  efetivo_real: z.number().int().nullable().optional(),
  horas_dia_real: z.number().nullable().optional(),
  hh_real: z.number().nullable().optional(),
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

  fin_prev_valor_servico: z.number().nullable().optional(),
  fin_prev_ase: z.number().nullable().optional(),

  ucr_nao_suficiente: z.number().optional(),
  ucr_a_evoluir: z.number().optional(),
  ucr_bom: z.number().optional(),
  ucr_otimo: z.number().optional(),
  ucr_esplendido: z.number().optional(),

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
        include: { dias: { orderBy: [{ etapa: 'asc' }, { data: 'asc' }] } },
      },
      subindices: {
        include: {
          notas_fiscais: { where: { ativa: true } },
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
        escopo: contrato.descricao,
        responsavel: contrato.responsavel?.nome ?? '',
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
  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dias, ...configData } = parsed.data

  const toDecimal = (v: number | null | undefined) => v != null ? v : null

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
      ucr_nao_suficiente: configData.ucr_nao_suficiente ?? 161.98,
      ucr_a_evoluir: configData.ucr_a_evoluir ?? 162.00,
      ucr_bom: configData.ucr_bom ?? 180.00,
      ucr_otimo: configData.ucr_otimo ?? 234.00,
      ucr_esplendido: configData.ucr_esplendido ?? 270.00,
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
      fin_prev_valor_servico: toDecimal(configData.fin_prev_valor_servico),
      fin_prev_ase: toDecimal(configData.fin_prev_ase),
      ucr_nao_suficiente: configData.ucr_nao_suficiente,
      ucr_a_evoluir: configData.ucr_a_evoluir,
      ucr_bom: configData.ucr_bom,
      ucr_otimo: configData.ucr_otimo,
      ucr_esplendido: configData.ucr_esplendido,
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
          },
          update: {
            efetivo_plan: d.efetivo_plan ?? null,
            horas_dia_plan: d.horas_dia_plan ?? null,
            hh_plan: d.hh_plan != null ? d.hh_plan : null,
            efetivo_real: d.efetivo_real ?? null,
            horas_dia_real: d.horas_dia_real ?? null,
            hh_real: d.hh_real != null ? d.hh_real : null,
          },
        }),
      ),
    )
  }

  return NextResponse.json({ data: { config } })
}
