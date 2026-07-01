// Tipos puros + formatação — SEM dependência de Prisma. Seguro para o cliente.
import type { Agregacao, Granularidade } from './catalog'

export interface DimMeta { key: string; label: string; eData: boolean; granularidade?: Granularidade }
export interface ValMeta { key: string; label: string; formato: string; agregacao?: Agregacao }
export interface LeafColumn { colPath: string[]; isTotal: boolean; valorLabel: string; formato: string }
export interface PivotRow { dims: string[]; values: (number | null)[] }
export interface PivotResult {
  rowDimLabels: string[]
  colDimLabels: string[]
  valoresMeta: ValMeta[]
  topHeader: { label: string; span: number; isTotal: boolean }[] | null
  leaves: LeafColumn[]
  rows: PivotRow[]
  totalRow: (number | null)[]
}

export function formatValor(v: number | null, formato: string): string {
  if (v === null || v === undefined || isNaN(v)) return '—'
  if (formato === 'moeda') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (formato === 'percent') return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  if (formato === 'decimal') return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
