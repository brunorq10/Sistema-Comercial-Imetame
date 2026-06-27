export type SortDir = 'asc' | 'desc'
export interface SortState { key: string; dir: SortDir }

// Subconjunto estrutural dos campos usados na ordenação — compatível tanto com
// ContratoItem quanto com variações (ex.: ContratoComAlteracoes do Meu Painel).
export interface ContratoSortavel {
  indice: string
  cliente: { nome: string; ramo_atuacao?: string | null }
  cliente_final: { nome: string } | null
  cidade: string | null
  estado: string | null
  classificacao: string | null
  num_os: string | null
  ano_referencia: number
  num_acordo: string | null
  num_proposta: string | null
  data_inicio: string | null
  data_fim: string | null
  status: string
  valor_contrato: number | null
  responsavel: { nome: string } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subindices: any[]
}

const MESES_K = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

function valorTotal(c: ContratoSortavel): number {
  return c.valor_contrato ?? c.subindices.reduce((a, s) => a + (s.valor_total ?? 0), 0)
}
function faturado(c: ContratoSortavel): number {
  return c.subindices.reduce((a, s) => a + (s.total_faturado ?? 0), 0)
}
function previsto(c: ContratoSortavel): number {
  return c.subindices.reduce((a, s) => a + MESES_K.reduce((b, m) => b + Number(s[m] ?? 0), 0), 0)
}

// Acessores por coluna (valor comparável). Strings usam ordenação alfabética pt-BR.
const ACESSO: Record<string, (c: ContratoSortavel) => string | number> = {
  indice:        (c) => c.indice ?? '',
  cliente:       (c) => c.cliente?.nome ?? '',
  cliente_final: (c) => c.cliente_final?.nome ?? '',
  cidade:        (c) => `${c.cidade ?? ''} ${c.estado ?? ''}`.trim(),
  classificacao: (c) => c.classificacao ?? '',
  ramo:          (c) => c.cliente?.ramo_atuacao ?? '',
  num_os:        (c) => c.num_os ?? '',
  ano:           (c) => c.ano_referencia ?? 0,
  num_acordo:    (c) => c.num_acordo ?? '',
  num_proposta:  (c) => c.num_proposta ?? '',
  data_inicio:   (c) => c.data_inicio ?? '',
  data_fim:      (c) => c.data_fim ?? '',
  status:        (c) => c.status ?? '',
  valor_total:   (c) => valorTotal(c),
  valor_faturado:(c) => faturado(c),
  saldo:         (c) => valorTotal(c) - faturado(c),
  previsto:      (c) => previsto(c),
  responsavel:   (c) => c.responsavel?.nome ?? '',
}

export function compareContratos(a: ContratoSortavel, b: ContratoSortavel, sort: SortState): number {
  const acc = ACESSO[sort.key]
  if (!acc) return 0
  const va = acc(a), vb = acc(b)
  let r: number
  if (typeof va === 'number' && typeof vb === 'number') r = va - vb
  else r = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' })
  return sort.dir === 'asc' ? r : -r
}

// Clique no cabeçalho: 1º asc → 2º desc → 3º limpa (volta à ordem original)
export function nextSort(cur: SortState | null, key: string): SortState | null {
  if (!cur || cur.key !== key) return { key, dir: 'asc' }
  if (cur.dir === 'asc') return { key, dir: 'desc' }
  return null
}

export function sortIndicator(cur: SortState | null, key: string): string {
  if (!cur || cur.key !== key) return ''
  return cur.dir === 'asc' ? ' ▲' : ' ▼'
}
