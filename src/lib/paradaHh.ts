// ─────────────────────────────────────────────────────────────────────────────
// Grade diária de HH Previsto x Realizado de uma Parada (Preparativo → Parada →
// Pós Parada), usada em Controle de Faturamento → Visão Geral do contrato
// (src/components/faturamento/ParadaHhTabela.tsx e ParadaHhChart.tsx). Não tem
// import de chart.js — fica separado dos componentes visuais para que a tabela
// e o gráfico possam ser lazy-loaded (ssr:false) sem precisar carregar isso
// junto, e para os dois lerem exatamente as mesmas linhas já prontas.
// ─────────────────────────────────────────────────────────────────────────────

export type Etapa = 'PREPARATIVO' | 'PARADA' | 'ACOMP_DESMOB'

export const ETAPA_LABEL: Record<Etapa, string> = { PREPARATIVO: 'Preparativo', PARADA: 'Parada', ACOMP_DESMOB: 'Pós Parada' }
export const ETAPA_COR: Record<Etapa, string> = { PREPARATIVO: '#64748B', PARADA: '#B45309', ACOMP_DESMOB: '#7C3AED' }

export interface ParadaHhConfigDados {
  prep_inicio: string | null; prep_fim: string | null
  parada_inicio: string | null; parada_fim: string | null
  acomp_inicio: string | null; acomp_fim: string | null
  dias: { etapa: string; data: string; hh_plan: number | null; hh_real: number | null }[]
}

export interface ParadaHhRow {
  etapa: Etapa; data: string
  previsto: number; realizado: number | null
  previstoAcum: number; realizadoAcum: number | null
}

function isoDay(v: string | null): string { return v ? v.split('T')[0] : '' }

function diasEntreDatas(inicio: string, fim: string): string[] {
  if (!inicio || !fim) return []
  const result: string[] = []
  const cur = new Date(inicio + 'T12:00:00')
  const end = new Date(fim + 'T12:00:00')
  while (cur <= end) {
    result.push(cur.toISOString().substring(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

/**
 * Gera a grade diária completa das 3 fases (Preparativo → Parada → Pós
 * Parada, nessa ordem fixa — mesmo critério de
 * src/app/acordos/hh/paradas/[id]/page.tsx) e acumula previsto/realizado.
 * Dia sem lançamento vira previsto:0/realizado:null (distinto de "zero").
 * O acumulado de realizado para no primeiro dia sem lançamento — não retoma
 * depois de um buraco (mesma regra aplicada ao gráfico "Comportamento do HH"
 * de Obras).
 */
export function buildParadaHhRows(config: ParadaHhConfigDados | null): ParadaHhRow[] {
  if (!config) return []

  const mapa = new Map<string, { hh_plan: number | null; hh_real: number | null }>()
  for (const d of config.dias) {
    mapa.set(`${d.etapa}__${isoDay(d.data)}`, { hh_plan: d.hh_plan, hh_real: d.hh_real })
  }

  const fases: { etapa: Etapa; inicio: string | null; fim: string | null }[] = [
    { etapa: 'PREPARATIVO', inicio: config.prep_inicio,   fim: config.prep_fim },
    { etapa: 'PARADA',      inicio: config.parada_inicio, fim: config.parada_fim },
    { etapa: 'ACOMP_DESMOB', inicio: config.acomp_inicio, fim: config.acomp_fim },
  ]

  const brutos: { etapa: Etapa; data: string; previsto: number; realizado: number | null }[] = []
  for (const f of fases) {
    for (const data of diasEntreDatas(isoDay(f.inicio), isoDay(f.fim))) {
      const d = mapa.get(`${f.etapa}__${data}`)
      brutos.push({
        etapa: f.etapa,
        data,
        previsto: d?.hh_plan != null ? Number(d.hh_plan) : 0,
        realizado: d?.hh_real != null ? Number(d.hh_real) : null,
      })
    }
  }

  let previstoAcum = 0
  let realizadoAcum: number | null = 0
  let parou = false
  return brutos.map((b) => {
    previstoAcum += b.previsto
    if (parou || b.realizado == null) { parou = true; realizadoAcum = null }
    else { realizadoAcum = (realizadoAcum ?? 0) + b.realizado }
    return { ...b, previstoAcum, realizadoAcum }
  })
}
