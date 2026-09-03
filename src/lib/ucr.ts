// ─────────────────────────────────────────────────────────────────────────────
// UCR (Uso Consciente do Recurso) — faixas de classificação de R$/HH,
// cadastradas por região e por PERÍODO DE VIGÊNCIA (ver UcrFaixaVigencia no
// schema). A faixa aplicada a uma Parada é a vigência da região do contrato
// (Estado) cujo período cobre a data de início da Parada — fixada nesse
// momento, mesmo que a vigência já tenha vencido quando a Parada for fechada.
// ─────────────────────────────────────────────────────────────────────────────

export type UcrCampo = 'ucr_nao_suficiente' | 'ucr_a_evoluir' | 'ucr_bom' | 'ucr_otimo' | 'ucr_esplendido'
export type UcrRegiao = 'ES' | 'MG' | 'BAHIA' | 'SP' | 'OUTROS'

export const UCR_CAMPOS: UcrCampo[] = ['ucr_nao_suficiente', 'ucr_a_evoluir', 'ucr_bom', 'ucr_otimo', 'ucr_esplendido']

export const UCR_FAIXAS: Array<{ campo: UcrCampo; label: string; cor: string; bg: string }> = [
  { campo: 'ucr_nao_suficiente', label: 'Não Suficiente', cor: '#D4554F', bg: '#F7D4D2' },
  { campo: 'ucr_a_evoluir',      label: 'A Evoluir',      cor: '#BE9B1E', bg: '#FAF0C4' },
  { campo: 'ucr_bom',            label: 'Bom',            cor: '#5FA06D', bg: '#D9EBDB' },
  { campo: 'ucr_otimo',          label: 'Ótimo',          cor: '#5E9BD2', bg: '#D7E8F6' },
  { campo: 'ucr_esplendido',     label: 'Esplêndido',     cor: '#8779C8', bg: '#E1DDF4' },
]

export const UCR_REGIOES: Array<{ regiao: UcrRegiao; label: string; exemplos: string }> = [
  { regiao: 'ES',     label: 'ES',     exemplos: 'AMT, Suzano Aracruz' },
  { regiao: 'MG',     label: 'MG',     exemplos: 'AMM, Cenibra, Gerdau, Vallourec' },
  { regiao: 'BAHIA',  label: 'BAHIA',  exemplos: 'Bracell, Suzano Mucuri, Veracel' },
  { regiao: 'SP',     label: 'SP',     exemplos: 'Bracell, Klingele, Suzano Jacareí, Suzano Suzano, Sylvamo LA, Sylvamo MG' },
  { regiao: 'OUTROS', label: 'OUTROS', exemplos: 'Alumar, AMP, CMPC, Eldorado, Klabin, Suzano Imperatriz, Suzano RRP, Suzano Três Lagoas' },
]

// Estado (UF) do contrato → região da faixa de UCR aplicada automaticamente.
export function regiaoPorEstado(uf: string | null | undefined): UcrRegiao {
  const u = (uf ?? '').trim().toUpperCase()
  if (u === 'ES') return 'ES'
  if (u === 'MG') return 'MG'
  if (u === 'BA') return 'BAHIA'
  if (u === 'SP') return 'SP'
  return 'OUTROS'
}

export type UcrFaixaValores = Record<UcrCampo, number>

export interface UcrVigencia extends UcrFaixaValores {
  id: number
  regiao: UcrRegiao
  vigencia_inicio: string // ISO date
  vigencia_fim: string    // ISO date
}

// Vigência da região cujo período [inicio, fim] cobre `data` — usada tanto
// para classificar o R$/HH de uma Parada quanto para exibir a tabela de
// faixas aplicável a ela. `data` normalmente é a data de início da Parada.
export function resolverVigencia<T extends { regiao: UcrRegiao; vigencia_inicio: string; vigencia_fim: string }>(
  vigencias: T[],
  regiao: UcrRegiao,
  data: Date,
): T | null {
  const d = data.toISOString().substring(0, 10)
  return vigencias.find((v) =>
    v.regiao === regiao && v.vigencia_inicio.substring(0, 10) <= d && v.vigencia_fim.substring(0, 10) >= d,
  ) ?? null
}

// Classificação por R$/HH — aplicada com a faixa da vigência resolvida.
export function classificarUcr(rsHH: number | null, faixa: UcrFaixaValores | null): string | null {
  if (rsHH == null || isNaN(rsHH) || !faixa) return null
  if (rsHH <= faixa.ucr_nao_suficiente) return 'Não Suficiente'
  if (rsHH <= faixa.ucr_a_evoluir)      return 'A Evoluir'
  if (rsHH <= faixa.ucr_bom)            return 'Bom'
  if (rsHH <= faixa.ucr_otimo)          return 'Ótimo'
  return 'Esplêndido'
}
