// Tipos de Multa/Penalidade (Movimentações Financeiras do contrato)
export const TIPOS_MULTA = [
  { value: 'MULTA',      label: 'Multa',      cor: '#A32D2D', corBg: '#FCEDED' },
  { value: 'GLOSAS',     label: 'Glosas',     cor: '#B45309', corBg: '#FEF6EC' },
  { value: 'REEMBOLSOS', label: 'Reembolsos', cor: '#15803D', corBg: '#ECFDF3' },
  { value: 'OUTROS',     label: 'Outros',     cor: '#6B7280', corBg: '#F3F4F6' },
] as const

export const TIPO_MULTA_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_MULTA.map((t) => [t.value, t.label]),
)
export const TIPO_MULTA_MAP: Record<string, (typeof TIPOS_MULTA)[number]> = Object.fromEntries(
  TIPOS_MULTA.map((t) => [t.value, t]),
)
