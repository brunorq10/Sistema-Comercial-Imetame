// ════════════════════════════════════════════════════════════════════════════
// Ocorrências Contratuais — fonte única de tipos, responsabilidade e impactos.
// OBS: a lista de TIPOS é provisória (o modelo de dados definitivo virá com o
// prompt do modal de lançamento). `tipo` é String no banco — alterar aqui basta.
// ════════════════════════════════════════════════════════════════════════════

export const TIPOS_OCORRENCIA = [
  { value: 'FALTA_ENERGIA',          label: 'Falta de Energia' },
  { value: 'CHUVA',                  label: 'Chuva' },
  { value: 'ENTREGA_MATERIAL',       label: 'Entrega de Material' },
  { value: 'PARALISACAO_TERCEIROS',  label: 'Paralisação por Terceiros' },
  { value: 'INDISPONIBILIDADE_LOCAL', label: 'Indisponibilidade do Local' },
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
  { value: 'IMETAME',     label: 'Imetame',     cor: '#185FA5', corBg: '#EAF2FB' },
  { value: 'TERCEIROS',   label: 'Terceiros',   cor: '#B45309', corBg: '#FEF6EC' },
  { value: 'FORCA_MAIOR', label: 'Força Maior', cor: '#7C3AED', corBg: '#F3EDFE' },
  { value: 'A_APURAR',    label: 'A apurar',    cor: '#6B7280', corBg: '#F3F4F6' },
]

export const RESPONSABILIDADE_MAP: Record<string, ResponsabilidadeCfg> = Object.fromEntries(
  RESPONSABILIDADES.map((r) => [r.value, r]),
)

export const IMPACTOS_OCORRENCIA = [
  { value: 'PRAZO',            label: 'Prazo' },
  { value: 'CUSTO',            label: 'Custo' },
  { value: 'IMPRODUTIVIDADE',  label: 'Improdutividade' },
  { value: 'SEGURANCA',        label: 'Segurança' },
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
