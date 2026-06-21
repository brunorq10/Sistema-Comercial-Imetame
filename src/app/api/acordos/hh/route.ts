import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const
const HH_DIA = 8.8

async function getParadas(disponivel: boolean) {
  const contratos = await prisma.contrato.findMany({
    where: { cancelled_at: null, classificacao: 'PARADAS' },
    orderBy: { indice: 'asc' },
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      parada_hh_config: { include: { dias: true } },
      subindices:    { include: { notas_fiscais: { where: { ativa: true } } } },
    },
  })

  const data = contratos.map(c => {
    const temConfig = c.parada_hh_config !== null

    const valorOrcado = c.subindices.reduce((acc, s) =>
      acc + MESES.reduce((b, m) => b + Number((s as Record<string, unknown>)[m] ?? 0), 0), 0)
    const valorFaturado = c.subindices.reduce((acc, s) =>
      acc + s.notas_fiscais.reduce((b, nf) => b + Number(nf.valor_atribuido), 0), 0)

    let paradaStats: {
      hh_previsto: number | null; hh_realizado: number | null; pct_real_prev: number | null
      fin_orcado_rs_hh: number | null; fin_prev_rs_hh: number | null; fin_real_rs_hh: number | null
      classificacao_ucr: string | null
    } | null = null

    if (c.parada_hh_config) {
      const cfg = c.parada_hh_config
      let baseHhPlan = 0, baseHhReal = 0, picoEfPrev = 0, picoEfReal = 0
      for (const d of cfg.dias) {
        baseHhPlan += Number(d.hh_plan ?? 0)
        baseHhReal += Number(d.hh_real ?? 0)
        if (d.etapa === 'PARADA') {
          picoEfPrev = Math.max(picoEfPrev, d.efetivo_plan ?? 0)
          picoEfReal = Math.max(picoEfReal, d.efetivo_real ?? 0)
        }
      }

      const calcA = (ativo: boolean, pico: number, d: unknown) =>
        ativo && d ? pico * Number(d) * HH_DIA : 0

      const adicPrev =
        calcA(cfg.mob_ativo, picoEfPrev, cfg.mob_dias_prev) +
        calcA(cfg.desmob_ativo, picoEfPrev, cfg.desmob_dias_prev) +
        calcA(cfg.integ_ativo, picoEfPrev, cfg.integ_dias_prev) +
        (cfg.folga_ativo && cfg.folga_pessoas_prev && cfg.folga_dias_prev
          ? Number(cfg.folga_pessoas_prev) * Number(cfg.folga_dias_prev) * HH_DIA : 0)

      const adicReal =
        calcA(cfg.mob_ativo, picoEfReal, cfg.mob_dias_real) +
        calcA(cfg.desmob_ativo, picoEfReal, cfg.desmob_dias_real) +
        calcA(cfg.integ_ativo, picoEfReal, cfg.integ_dias_real) +
        (cfg.folga_ativo && cfg.folga_pessoas_real && cfg.folga_dias_real
          ? Number(cfg.folga_pessoas_real) * Number(cfg.folga_dias_real) * HH_DIA : 0)

      const hhTotalPrev = baseHhPlan + adicPrev
      const hhTotalReal = baseHhReal + adicReal

      const finPrevTotal = Number(cfg.fin_prev_valor_servico ?? 0) + Number(cfg.fin_prev_ase ?? 0)
      const finOrcRsHH   = hhTotalPrev > 0 ? valorOrcado   / hhTotalPrev : null
      const finPrevRsHH  = hhTotalReal  > 0 ? finPrevTotal  / hhTotalReal  : null
      const finRealRsHH  = hhTotalReal  > 0 ? valorFaturado / hhTotalReal  : null

      const ns = Number(cfg.ucr_nao_suficiente), ae = Number(cfg.ucr_a_evoluir)
      const bm = Number(cfg.ucr_bom),             ot = Number(cfg.ucr_otimo)
      const classifyUcr = (v: number | null): string | null => {
        if (v == null) return null
        if (v <= ns) return 'Não Suficiente'
        if (v <= ae) return 'A Evoluir'
        if (v <= bm) return 'Bom'
        if (v <= ot) return 'Ótimo'
        return 'Esplêndido'
      }

      paradaStats = {
        hh_previsto:       hhTotalPrev > 0 ? hhTotalPrev : null,
        hh_realizado:      hhTotalReal > 0 ? hhTotalReal : null,
        pct_real_prev:     hhTotalPrev > 0 && hhTotalReal > 0 ? (hhTotalReal / hhTotalPrev) * 100 : null,
        fin_orcado_rs_hh:  finOrcRsHH,
        fin_prev_rs_hh:    finPrevRsHH,
        fin_real_rs_hh:    finRealRsHH,
        classificacao_ucr: classifyUcr(finRealRsHH),
      }
    }

    return {
      id: c.id, indice: c.indice, num_os: c.num_os, ano_referencia: c.ano_referencia,
      num_acordo: c.num_acordo ?? null, num_proposta: c.num_proposta ?? null,
      cidade: c.cidade, estado: c.estado, classificacao: c.classificacao,
      cliente: c.cliente, cliente_final: c.cliente_final ?? null,
      descricao: c.descricao, responsavel: c.responsavel,
      data_inicio: c.data_inicio?.toISOString() ?? null,
      data_fim:    c.data_fim?.toISOString()    ?? null,
      tem_lancamento: temConfig,
      valor_orcado:   valorOrcado   > 0 ? valorOrcado   : null,
      valor_faturado: valorFaturado > 0 ? valorFaturado : null,
      hh_previsto: null as number | null, hh_planejado: null as number | null,
      hh_realizado: null as number | null, lancamento_atual: null, realizados: [],
      parada_hh_previsto:       paradaStats?.hh_previsto       ?? null,
      parada_hh_realizado:      paradaStats?.hh_realizado      ?? null,
      parada_pct_real_prev:     paradaStats?.pct_real_prev     ?? null,
      parada_fin_orcado_rs_hh:  paradaStats?.fin_orcado_rs_hh  ?? null,
      parada_fin_prev_rs_hh:    paradaStats?.fin_prev_rs_hh    ?? null,
      parada_fin_real_rs_hh:    paradaStats?.fin_real_rs_hh    ?? null,
      parada_classificacao_ucr: paradaStats?.classificacao_ucr ?? null,
    }
  })

  if (disponivel) return NextResponse.json({ data: data.filter(c => !c.tem_lancamento), error: null })
  return NextResponse.json({ data: data.filter(c => c.tem_lancamento), error: null })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const classificacao  = searchParams.get('classificacao') ?? 'OBRAS'
  const disponivel     = searchParams.get('disponivel') === '1'

  if (classificacao === 'PARADAS') return getParadas(disponivel)

  const contratos = await prisma.contrato.findMany({
    where: {
      cancelled_at: null,
      ...(classificacao !== 'TODOS' && { classificacao: classificacao as never }),
    },
    orderBy: { indice: 'asc' },
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      hh_lancamentos: {
        orderBy: { versao: 'desc' },
        take: 1,
        include: { meses: true, criador: { select: { nome: true } } },
      },
      hh_realizados: {
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
      },
      subindices: { include: { notas_fiscais: { where: { ativa: true } } } },
    },
  })

  const data = contratos.map(c => {
    const lancamento    = c.hh_lancamentos[0] ?? null
    const temLancamento = lancamento !== null
    const hhPrevisto    = lancamento ? lancamento.meses.reduce((s, m) => s + (m.hh_previsto  ?? 0), 0) : null
    const hhPlanejado   = lancamento ? lancamento.meses.reduce((s, m) => s + (m.hh_planejado ?? 0), 0) : null
    const hhRealizado   = c.hh_realizados.length > 0
      ? c.hh_realizados.reduce((s, r) => s + r.hh_realizado, 0) : null

    const valorOrcado = c.subindices.reduce((acc, s) =>
      acc + MESES.reduce((b, m) => b + Number((s as Record<string, unknown>)[m] ?? 0), 0), 0)
    const valorFaturado = c.subindices.reduce((acc, s) =>
      acc + s.notas_fiscais.reduce((b, nf) => b + Number(nf.valor_atribuido), 0), 0)

    return {
      id: c.id, indice: c.indice, num_os: c.num_os,
      num_acordo: c.num_acordo ?? null, num_proposta: c.num_proposta ?? null,
      cidade: c.cidade, estado: c.estado, classificacao: c.classificacao,
      cliente: c.cliente, cliente_final: c.cliente_final ?? null,
      descricao: c.descricao, responsavel: c.responsavel,
      data_inicio: c.data_inicio?.toISOString() ?? null,
      data_fim:    c.data_fim?.toISOString()    ?? null,
      tem_lancamento: temLancamento,
      valor_orcado:   valorOrcado   > 0 ? valorOrcado   : null,
      valor_faturado: valorFaturado > 0 ? valorFaturado : null,
      hh_previsto:  hhPrevisto,
      hh_planejado: hhPlanejado,
      hh_realizado: hhRealizado,
      lancamento_atual: lancamento ? {
        id: lancamento.id, versao: lancamento.versao,
        data_inicio: lancamento.data_inicio.toISOString(),
        data_fim:    lancamento.data_fim.toISOString(),
        motivo: lancamento.motivo,
        created_at: lancamento.created_at.toISOString(),
        criador: (lancamento as typeof lancamento & { criador: { nome: string } }).criador.nome,
        meses: lancamento.meses,
      } : null,
      realizados: c.hh_realizados,
      parada_hh_previsto: null as number | null, parada_hh_realizado: null as number | null,
      parada_pct_real_prev: null as number | null, parada_fin_orcado_rs_hh: null as number | null,
      parada_fin_prev_rs_hh: null as number | null, parada_fin_real_rs_hh: null as number | null,
      parada_classificacao_ucr: null as string | null,
    }
  })

  if (disponivel) return NextResponse.json({ data: data.filter(c => !c.tem_lancamento), error: null })
  return NextResponse.json({ data: data.filter(c => c.tem_lancamento), error: null })
}
