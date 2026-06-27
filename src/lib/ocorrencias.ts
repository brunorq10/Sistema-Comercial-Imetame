// ════════════════════════════════════════════════════════════════════════════
// Ocorrências Contratuais — fonte única de tipos, responsabilidade e impactos.
// OBS: a lista de TIPOS é provisória (o modelo de dados definitivo virá com o
// prompt do modal de lançamento). `tipo` é String no banco — alterar aqui basta.
// ════════════════════════════════════════════════════════════════════════════

export const TIPOS_OCORRENCIA = [
  { value: 'CHUVA',                  label: 'Chuva' },
  { value: 'INDISPONIBILIDADE_LOCAL', label: 'Indisponibilidade do Local' },
  { value: 'PARALISACAO_TERCEIROS',  label: 'Paralisação por Terceiros' },
  { value: 'ALTERACAO_ESCOPO',       label: 'Alteração de Escopo' },
  { value: 'ATRASO_MATERIAL',        label: 'Atraso de Material/Insumo' },
  { value: 'OUTROS',                 label: 'Outros' },
] as const

export const TIPO_OCORRENCIA_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_OCORRENCIA.map((t) => [t.value, t.label]),
)

export interface ResponsabilidadeCfg {
  value: string
  label: string
  cor: string    // texto
  corBg: string  // fundo do badge
}

export const RESPONSABILIDADES: ResponsabilidadeCfg[] = [
  { value: 'CLIENTE',     label: 'Cliente',     cor: '#A32D2D', corBg: '#FCEDED' },
  { value: 'FORCA_MAIOR', label: 'Força Maior', cor: '#7C3AED', corBg: '#F3EDFE' },
  { value: 'IMETAME',     label: 'Imetame',     cor: '#185FA5', corBg: '#EAF2FB' },
  { value: 'TERCEIROS',   label: 'Terceiros',   cor: '#B45309', corBg: '#FEF6EC' },
]

export const RESPONSABILIDADE_MAP: Record<string, ResponsabilidadeCfg> = Object.fromEntries(
  RESPONSABILIDADES.map((r) => [r.value, r]),
)

export const IMPACTOS_OCORRENCIA = [
  { value: 'PRAZO',            label: 'Prazo' },
  { value: 'CUSTO',            label: 'Custo' },
  { value: 'CRONOGRAMA',       label: 'Cronograma' },
  { value: 'MARCO_CONTRATUAL', label: 'Marco Contratual' },
  { value: 'OUTROS',           label: 'Outros' },
] as const

export const IMPACTO_OCORRENCIA_LABEL: Record<string, string> = Object.fromEntries(
  IMPACTOS_OCORRENCIA.map((i) => [i.value, i.label]),
)

export const PERIODOS = [
  { value: 'all',       label: 'Todo o período' },
  { value: '30d',       label: 'Últimos 30 dias' },
  { value: '90d',       label: 'Últimos 90 dias' },
  { value: 'mes_atual', label: 'Mês atual' },
] as const
