// ─────────────────────────────────────────────────────────────────────────────
// Cálculo de HH (Horas-Homem) de contratos de Paradas — compartilhado entre a
// listagem do Controle de HH (getParadas em src/app/api/acordos/hh/route.ts)
// e o resumo de HH por contrato (src/app/api/acordos/hh/[id]/resumo/route.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from '@prisma/client'

const HH_DIA = 8.8

type ParadaHhConfigComDias = Prisma.ParadaHhConfigGetPayload<{ include: { dias: true } }>

export interface ParadaHhTotais {
  hhTotalPrev: number
  hhTotalReal: number
}

// Total previsto/realizado de HH da Parada: soma diária (todas as etapas) +
// adicionais de mobilização/desmobilização/integração/folga (lump-sum, sem
// data específica — calculados a partir do pico de efetivo na etapa Parada).
export function calcParadaHhTotais(cfg: ParadaHhConfigComDias): ParadaHhTotais {
  let baseHhPlan = 0, baseHhReal = 0, picoEfPrev = 0, picoEfReal = 0
  for (const d of cfg.dias) {
    baseHhPlan += Number(d.hh_plan ?? 0)
    baseHhReal += Number(d.hh_real ?? 0)
    if (d.etapa === 'PARADA') {
      picoEfPrev = Math.max(picoEfPrev, d.efetivo_plan ?? 0)
      picoEfReal = Math.max(picoEfReal, d.efetivo_real ?? 0)
    }
  }

  const calcA = (ativo: boolean, pico: number, dias: unknown) =>
    ativo && dias ? pico * Number(dias) * HH_DIA : 0

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

  return { hhTotalPrev: baseHhPlan + adicPrev, hhTotalReal: baseHhReal + adicReal }
}

export interface MesHh { ano: number; mes: number; previsto: number; realizado: number | null }

// Junta registros mensais de previsto e de realizado (Obras/Fabricações — já
// vêm com mes/ano diretos) num único array por mês. `realizado` fica null em
// meses sem nenhum lançamento de realizado ainda (distinto de realizado = 0).
export function bucketMesesPrevistoRealizado(
  previstos: Array<{ ano: number; mes: number; valor: number | null }>,
  realizados: Array<{ ano: number; mes: number; valor: number | null }>,
): MesHh[] {
  const map = new Map<string, { previsto: number; realizado: number; temReal: boolean }>()
  for (const p of previstos) {
    const key = `${p.ano}-${p.mes}`
    const cur = map.get(key) ?? { previsto: 0, realizado: 0, temReal: false }
    cur.previsto += p.valor ?? 0
    map.set(key, cur)
  }
  for (const r of realizados) {
    const key = `${r.ano}-${r.mes}`
    const cur = map.get(key) ?? { previsto: 0, realizado: 0, temReal: false }
    if (r.valor != null) { cur.realizado += r.valor; cur.temReal = true }
    map.set(key, cur)
  }
  return Array.from(map.entries())
    .map(([key, v]) => {
      const [ano, mes] = key.split('-').map(Number)
      return { ano, mes, previsto: v.previsto, realizado: v.temReal ? v.realizado : null }
    })
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
}

// Quebra mensal do HH diário (sem os adicionais — não têm data específica).
// `realizado` fica null em meses sem nenhum lançamento de realizado ainda.
export function bucketParadaHhPorMes(dias: ParadaHhConfigComDias['dias']): MesHh[] {
  const map = new Map<string, { previsto: number; realizado: number; temReal: boolean }>()
  for (const d of dias) {
    const dt = new Date(d.data)
    const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`
    const cur = map.get(key) ?? { previsto: 0, realizado: 0, temReal: false }
    cur.previsto += Number(d.hh_plan ?? 0)
    if (d.hh_real != null) { cur.realizado += Number(d.hh_real); cur.temReal = true }
    map.set(key, cur)
  }
  return Array.from(map.entries())
    .map(([key, v]) => {
      const [ano, mes] = key.split('-').map(Number)
      return { ano, mes, previsto: v.previsto, realizado: v.temReal ? v.realizado : null }
    })
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
}
