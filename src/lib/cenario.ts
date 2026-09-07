// ════════════════════════════════════════════════════════════════════════════
// Cenário (módulo Comercial) — cálculos compartilhados entre o cenário AO VIVO
// e os RETRATOS (histórico congelado). Ambos alimentam estas mesmas funções
// com uma lista de "linhas" no mesmo formato — só muda a origem do dado.
// v1: apenas efetivo (Obras e Paradas). Fabricações fica para 2ª etapa.
// ════════════════════════════════════════════════════════════════════════════

export type OrigemCenario = 'CONTRATO' | 'PROPOSTA'

export interface CenarioLinha {
  id: number
  proposta_comercial_id: number
  cliente_nome: string
  cliente_final_nome: string | null
  cidade: string | null
  estado: string | null
  escopo: string | null
  classificacao: 'OBRAS' | 'PARADAS'
  origem: OrigemCenario
  data_inicio: Date
  data_fim: Date
  efetivo: number
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

/** Período contínuo (todo mês entre o menor início e o maior fim dos lançamentos). */
export function periodoCenario(linhas: CenarioLinha[]): MesRef[] {
  if (linhas.length === 0) return []
  const inicioMin = new Date(Math.min(...linhas.map((l) => l.data_inicio.getTime())))
  const fimMax = new Date(Math.max(...linhas.map((l) => l.data_fim.getTime())))
  return mesesDoIntervalo(inicioMin, fimMax)
}

/** Efetivo de pico: o mesmo valor em todos os meses tocados pelo lançamento (não dividido). */
export function efetivoPorMes(linha: CenarioLinha): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of mesesDoIntervalo(linha.data_inicio, linha.data_fim)) map.set(mesKey(m), linha.efetivo)
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
    capacidade,
    pico: pico.total > 0 ? pico.total : 0,
    mesPico: pico.total > 0 ? { ano: pico.ano, mes: pico.mes } : null,
    saldoNoPico: pico.total > 0 ? capacidade - pico.total : capacidade,
    mesesAcimaCapacidade: totais.filter((t) => t.acimaCapacidade).length,
  }
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
    observacao: l.observacao,
  }
}
