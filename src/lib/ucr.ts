// ─────────────────────────────────────────────────────────────────────────────
// UCR (Uso Consciente do Recurso) — faixas de classificação de R$/HH,
// cadastradas por região (não mais por contrato — ver UcrFaixaRegiao no
// schema). Aplicadas automaticamente ao contrato de Parada pelo Estado (UF).
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

// Classificação por R$/HH — mesma regra usada antes por contrato, agora
// aplicada com a faixa da região do contrato.
export function classificarUcr(rsHH: number | null, faixa: UcrFaixaValores | null): string | null {
  if (rsHH == null || isNaN(rsHH) || !faixa) return null
  if (rsHH <= faixa.ucr_nao_suficiente) return 'Não Suficiente'
  if (rsHH <= faixa.ucr_a_evoluir)      return 'A Evoluir'
  if (rsHH <= faixa.ucr_bom)            return 'Bom'
  if (rsHH <= faixa.ucr_otimo)          return 'Ótimo'
  return 'Esplêndido'
}
