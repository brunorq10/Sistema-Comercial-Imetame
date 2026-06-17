import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DiaSchema = z.object({
  etapa: z.enum(['PREPARATIVO', 'PARADA', 'ACOMP_DESMOB']),
  data: z.string(), // ISO date
  efetivo_plan: z.number().int().nullable().optional(),
  hh_plan: z.number().nullable().optional(),
  efetivo_real: z.number().int().nullable().optional(),
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
  mob_dias: z.number().int().nullable().optional(),
  mob_pico_efetivo: z.number().int().nullable().optional(),

  desmob_ativo: z.boolean().optional(),
  desmob_dias: z.number().int().nullable().optional(),
  desmob_pico_efetivo: z.number().int().nullable().optional(),

  integ_ativo: z.boolean().optional(),
  integ_dias: z.number().int().nullable().optional(),
  integ_pico_efetivo: z.number().int().nullable().optional(),

  folga_ativo: z.boolean().optional(),
  folga_dias: z.number().int().nullable().optional(),
  folga_pessoas: z.number().int().nullable().optional(),

  fin_prev_mob: z.number().nullable().optional(),
  fin_prev_integ: z.number().nullable().optional(),
  fin_prev_prep: z.number().nullable().optional(),
  fin_prev_parada: z.number().nullable().optional(),
  fin_prev_acomp: z.number().nullable().optional(),
  fin_prev_desmob: z.number().nullable().optional(),
  fin_prev_folga: z.number().nullable().optional(),

  fin_real_mob: z.number().nullable().optional(),
  fin_real_integ: z.number().nullable().optional(),
  fin_real_prep: z.number().nullable().optional(),
  fin_real_parada: z.number().nullable().optional(),
  fin_real_acomp: z.number().nullable().optional(),
  fin_real_desmob: z.number().nullable().optional(),
  fin_real_folga: z.number().nullable().optional(),

  ucr_f1: z.number().optional(),
  ucr_f2: z.number().optional(),
  ucr_f3: z.number().optional(),
  ucr_f4: z.number().optional(),

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
      mob_dias: configData.mob_dias ?? null,
      mob_pico_efetivo: configData.mob_pico_efetivo ?? null,
      desmob_ativo: configData.desmob_ativo ?? false,
      desmob_dias: configData.desmob_dias ?? null,
      desmob_pico_efetivo: configData.desmob_pico_efetivo ?? null,
      integ_ativo: configData.integ_ativo ?? false,
      integ_dias: configData.integ_dias ?? null,
      integ_pico_efetivo: configData.integ_pico_efetivo ?? null,
      folga_ativo: configData.folga_ativo ?? false,
      folga_dias: configData.folga_dias ?? null,
      folga_pessoas: configData.folga_pessoas ?? null,
      fin_prev_mob: toDecimal(configData.fin_prev_mob),
      fin_prev_integ: toDecimal(configData.fin_prev_integ),
      fin_prev_prep: toDecimal(configData.fin_prev_prep),
      fin_prev_parada: toDecimal(configData.fin_prev_parada),
      fin_prev_acomp: toDecimal(configData.fin_prev_acomp),
      fin_prev_desmob: toDecimal(configData.fin_prev_desmob),
      fin_prev_folga: toDecimal(configData.fin_prev_folga),
      fin_real_mob: toDecimal(configData.fin_real_mob),
      fin_real_integ: toDecimal(configData.fin_real_integ),
      fin_real_prep: toDecimal(configData.fin_real_prep),
      fin_real_parada: toDecimal(configData.fin_real_parada),
      fin_real_acomp: toDecimal(configData.fin_real_acomp),
      fin_real_desmob: toDecimal(configData.fin_real_desmob),
      fin_real_folga: toDecimal(configData.fin_real_folga),
      ucr_f1: configData.ucr_f1 ?? 0.85,
      ucr_f2: configData.ucr_f2 ?? 0.93,
      ucr_f3: configData.ucr_f3 ?? 1.00,
      ucr_f4: configData.ucr_f4 ?? 1.07,
    },
    update: {
      prep_inicio: configData.prep_inicio !== undefined ? (configData.prep_inicio ? new Date(configData.prep_inicio) : null) : undefined,
      prep_fim: configData.prep_fim !== undefined ? (configData.prep_fim ? new Date(configData.prep_fim) : null) : undefined,
      parada_inicio: configData.parada_inicio !== undefined ? (configData.parada_inicio ? new Date(configData.parada_inicio) : null) : undefined,
      parada_fim: configData.parada_fim !== undefined ? (configData.parada_fim ? new Date(configData.parada_fim) : null) : undefined,
      acomp_inicio: configData.acomp_inicio !== undefined ? (configData.acomp_inicio ? new Date(configData.acomp_inicio) : null) : undefined,
      acomp_fim: configData.acomp_fim !== undefined ? (configData.acomp_fim ? new Date(configData.acomp_fim) : null) : undefined,
      mob_ativo: configData.mob_ativo,
      mob_dias: configData.mob_dias,
      mob_pico_efetivo: configData.mob_pico_efetivo,
      desmob_ativo: configData.desmob_ativo,
      desmob_dias: configData.desmob_dias,
      desmob_pico_efetivo: configData.desmob_pico_efetivo,
      integ_ativo: configData.integ_ativo,
      integ_dias: configData.integ_dias,
      integ_pico_efetivo: configData.integ_pico_efetivo,
      folga_ativo: configData.folga_ativo,
      folga_dias: configData.folga_dias,
      folga_pessoas: configData.folga_pessoas,
      fin_prev_mob: toDecimal(configData.fin_prev_mob),
      fin_prev_integ: toDecimal(configData.fin_prev_integ),
      fin_prev_prep: toDecimal(configData.fin_prev_prep),
      fin_prev_parada: toDecimal(configData.fin_prev_parada),
      fin_prev_acomp: toDecimal(configData.fin_prev_acomp),
      fin_prev_desmob: toDecimal(configData.fin_prev_desmob),
      fin_prev_folga: toDecimal(configData.fin_prev_folga),
      fin_real_mob: toDecimal(configData.fin_real_mob),
      fin_real_integ: toDecimal(configData.fin_real_integ),
      fin_real_prep: toDecimal(configData.fin_real_prep),
      fin_real_parada: toDecimal(configData.fin_real_parada),
      fin_real_acomp: toDecimal(configData.fin_real_acomp),
      fin_real_desmob: toDecimal(configData.fin_real_desmob),
      fin_real_folga: toDecimal(configData.fin_real_folga),
      ucr_f1: configData.ucr_f1,
      ucr_f2: configData.ucr_f2,
      ucr_f3: configData.ucr_f3,
      ucr_f4: configData.ucr_f4,
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
            hh_plan: d.hh_plan != null ? d.hh_plan : null,
            efetivo_real: d.efetivo_real ?? null,
            hh_real: d.hh_real != null ? d.hh_real : null,
          },
          update: {
            efetivo_plan: d.efetivo_plan ?? null,
            hh_plan: d.hh_plan != null ? d.hh_plan : null,
            efetivo_real: d.efetivo_real ?? null,
            hh_real: d.hh_real != null ? d.hh_real : null,
          },
        }),
      ),
    )
  }

  return NextResponse.json({ data: { config } })
}
