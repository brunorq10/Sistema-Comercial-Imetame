// ════════════════════════════════════════════════════════════════════════════
// Cenário (módulo Comercial) — cálculos compartilhados entre o cenário AO VIVO
// e os RETRATOS (histórico congelado). Ambos alimentam estas mesmas funções
// com uma lista de "linhas" no mesmo formato — só muda a origem do dado.
// ════════════════════════════════════════════════════════════════════════════

export type OrigemCenario = 'CONTRATO' | 'PROPOSTA'
export type ClassificacaoCenario = 'OBRAS' | 'PARADAS' | 'FABRICACOES' | 'OLEO_GAS'

export const CLASSIFICACAO_LABEL: Record<ClassificacaoCenario, string> = {
  OBRAS: 'Obras', PARADAS: 'Paradas', FABRICACOES: 'Fabricação', OLEO_GAS: 'Óleo e Gás',
}
/** Paradas usam um único efetivo para todo o período — as demais classificações admitem detalhamento mês a mês. */
export function admiteEfetivoMensal(classificacao: ClassificacaoCenario): boolean {
  return classificacao !== 'PARADAS'
}

export interface CenarioLinha {
  id: number
  proposta_comercial_id: number
  cliente_nome: string
  cliente_final_nome: string | null
  cidade: string | null
  estado: string | null
  escopo: string | null
  classificacao: ClassificacaoCenario
  origem: OrigemCenario
  data_inicio: Date
  data_fim: Date
  efetivo: number
  /** Efetivo por mês ("AAAA-MM" -> valor) — Obras/Fabricações/Óleo e Gás. Null = usa `efetivo` em todos os meses (Paradas ou lançamento sem detalhamento). */
  efetivo_mensal: Record<string, number> | null
  observacao: string | null
}

export interface MesRef { ano: number; mes: number } // mes: 1-12

export function mesKey(m: MesRef): string { return `${m.ano}-${String(m.mes).padStart(2, '0')}` }

/** Todos os meses (ano,mes) tocados pelo intervalo [inicio,fim], inclusive nas pontas. */
export function mesesDoIntervalo(inicio: Date, fim: Date): MesRef[] {
  const out: MesRef[] = []
  let ano = inicio.getUTCFullYear()
  let mes = inicio.getUTCMonth() + 1
  const anoFim = fim.getUTCFullYear()
  const mesFim = fim.getUTCMonth() + 1
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    out.push({ ano, mes })
    mes++
    if (mes > 12) { mes = 1; ano++ }
  }
  return out
}

/**
 * Período contínuo: do menor início ao maior fim dos lançamentos, mas nunca
 * menor que 2 anos a partir do primeiro mês previsto — mesmo sem nenhum
 * lançamento cobrindo esse horizonte, o relatório sempre mostra essa janela
 * mínima (ex.: primeiro previsto em jul/2026 → colunas até jul/2028).
 */
export function periodoCenario(linhas: CenarioLinha[]): MesRef[] {
  if (linhas.length === 0) return []
  const inicioMin = new Date(Math.min(...linhas.map((l) => l.data_inicio.getTime())))
  const fimMax = new Date(Math.max(...linhas.map((l) => l.data_fim.getTime())))
  const fimMinimo = new Date(Date.UTC(inicioMin.getUTCFullYear() + 2, inicioMin.getUTCMonth(), 1))
  const fimEfetivo = fimMax.getTime() > fimMinimo.getTime() ? fimMax : fimMinimo
  return mesesDoIntervalo(inicioMin, fimEfetivo)
}

/**
 * Efetivo por mês tocado pelo lançamento. Usa `efetivo_mensal[mesKey]` quando
 * informado (Obras/Fabricações/Óleo e Gás com detalhamento mês a mês); nos
 * demais casos (Paradas, ou mês sem detalhamento), repete `efetivo`.
 */
export function efetivoPorMes(linha: CenarioLinha): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of mesesDoIntervalo(linha.data_inicio, linha.data_fim)) {
    const key = mesKey(m)
    map.set(key, linha.efetivo_mensal?.[key] ?? linha.efetivo)
  }
  return map
}

export interface TotalMes extends MesRef {
  contratos: number
  propostas: number
  total: number
  saldo: number
  acimaCapacidade: boolean
}

export function totaisPorMes(linhas: CenarioLinha[], periodo: MesRef[], capacidade: number): TotalMes[] {
  return periodo.map((m) => {
    const key = mesKey(m)
    let contratos = 0, propostas = 0
    for (const l of linhas) {
      const efeMap = efetivoPorMes(l)
      const v = efeMap.get(key)
      if (v == null) continue
      if (l.origem === 'CONTRATO') contratos += v
      else propostas += v
    }
    const total = contratos + propostas
    return { ...m, contratos, propostas, total, saldo: capacidade - total, acimaCapacidade: total > capacidade }
  })
}

export interface IndicadoresCenario {
  totalItens: number
  totalContratos: number
  totalPropostas: number
  qtdParadas: number
  qtdObras: number
  qtdFabricacoes: number
  qtdOleoGas: number
  capacidade: number
  pico: number
  mesPico: MesRef | null
  saldoNoPico: number
  mesesAcimaCapacidade: number
}

export function calcularIndicadores(linhas: CenarioLinha[], capacidade: number): IndicadoresCenario {
  const periodo = periodoCenario(linhas)
  const totais = totaisPorMes(linhas, periodo, capacidade)
  const pico = totais.reduce((max, t) => (t.total > max.total ? t : max), { total: -1, ano: 0, mes: 0 } as TotalMes)
  return {
    totalItens: linhas.length,
    totalContratos: linhas.filter((l) => l.origem === 'CONTRATO').length,
    totalPropostas: linhas.filter((l) => l.origem === 'PROPOSTA').length,
    qtdParadas: linhas.filter((l) => l.classificacao === 'PARADAS').length,
    qtdObras: linhas.filter((l) => l.classificacao === 'OBRAS').length,
    qtdFabricacoes: linhas.filter((l) => l.classificacao === 'FABRICACOES').length,
    qtdOleoGas: linhas.filter((l) => l.classificacao === 'OLEO_GAS').length,
    capacidade,
    pico: pico.total > 0 ? pico.total : 0,
    mesPico: pico.total > 0 ? { ano: pico.ano, mes: pico.mes } : null,
    saldoNoPico: pico.total > 0 ? capacidade - pico.total : capacidade,
    mesesAcimaCapacidade: totais.filter((t) => t.acimaCapacidade).length,
  }
}

export interface ResumoLinha {
  classificacao: ClassificacaoCenario
  origem: OrigemCenario
  totais: Map<string, number> // mesKey -> efetivo somado
}

const CLASSIFICACOES_ORDEM: ClassificacaoCenario[] = ['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS']
const ORIGENS_ORDEM: OrigemCenario[] = ['CONTRATO', 'PROPOSTA']

/**
 * Consolida o efetivo por mês de cada combinação Classificação × Origem — a
 * aba Resumo do Cenário. Sempre retorna as 4 classificações × 2 origens (8
 * linhas), zeradas quando não há lançamento — mesma lógica de `efetivoPorMes`
 * usada no detalhamento, só que somada por grupo em vez de por lançamento.
 */
export function resumoPorClassificacaoOrigem(linhas: CenarioLinha[], periodo: MesRef[]): ResumoLinha[] {
  const resumo: ResumoLinha[] = []
  for (const classificacao of CLASSIFICACOES_ORDEM) {
    for (const origem of ORIGENS_ORDEM) {
      const totais = new Map<string, number>()
      for (const m of periodo) totais.set(mesKey(m), 0)
      for (const l of linhas) {
        if (l.classificacao !== classificacao || l.origem !== origem) continue
        for (const [key, v] of Array.from(efetivoPorMes(l))) {
          if (!totais.has(key)) continue
          totais.set(key, (totais.get(key) ?? 0) + v)
        }
      }
      resumo.push({ classificacao, origem, totais })
    }
  }
  return resumo
}

/** GANHOU -> CONTRATO; qualquer outro resultado (AGUARDANDO/PERDEU/null) -> PROPOSTA. */
export function computeOrigem(resultado: string | null): OrigemCenario {
  return resultado === 'GANHOU' ? 'CONTRATO' : 'PROPOSTA'
}

// Usados pelas rotas de API de Cenário — ficam aqui (não em route.ts) porque um
// Route Handler só pode exportar as funções de método HTTP.
export const CENARIO_LANCAMENTO_INCLUDE = {
  proposta_comercial: { select: { id: true, resultado: true } },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toLinha(l: any): CenarioLinha {
  return {
    id: l.id,
    proposta_comercial_id: l.proposta_comercial_id,
    cliente_nome: l.cliente_nome,
    cliente_final_nome: l.cliente_final_nome,
    cidade: l.cidade,
    estado: l.estado,
    escopo: l.escopo,
    classificacao: l.classificacao,
    origem: computeOrigem(l.proposta_comercial.resultado),
    data_inicio: l.data_inicio,
    data_fim: l.data_fim,
    efetivo: l.efetivo,
    efetivo_mensal: (l.efetivo_mensal as Record<string, number> | null) ?? null,
    observacao: l.observacao,
  }
}
