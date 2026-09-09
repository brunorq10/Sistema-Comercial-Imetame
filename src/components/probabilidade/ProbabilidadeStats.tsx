'use client'

import { formatCurrency } from '@/lib/utils'
import type { ProbabilidadeItem } from './types'

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 border-l-[3px] min-w-0" style={{ borderLeftColor: accent ?? '#2E7D32' }}>
      <p className="text-[9px] text-gray-400 uppercase tracking-[0.03em] mb-0.5 truncate">{label}</p>
      <p className="text-[16px] font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function pct(valor: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((valor / total) * 100)}%`
}

interface Props { itens: ProbabilidadeItem[] }

export function ProbabilidadeStats({ itens }: Props) {
  const total = itens.reduce((s, i) => s + (i.valor_total ?? 0), 0)
  const porNivel = (nivel: string) => itens.filter((i) => i.nivel === nivel)
  const alta = porNivel('ALTA')
  const media = porNivel('MEDIA')
  const baixa = porNivel('BAIXA')
  const budget = porNivel('BUDGET')
  const somaAlta = alta.reduce((s, i) => s + (i.valor_total ?? 0), 0)
  const somaMedia = media.reduce((s, i) => s + (i.valor_total ?? 0), 0)
  const somaBaixa = baixa.reduce((s, i) => s + (i.valor_total ?? 0), 0)
  const somaBudget = budget.reduce((s, i) => s + (i.valor_total ?? 0), 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
      <Card label="Propostas no painel" value={String(itens.length)} sub={`${formatCurrency(total)} em aberto`} />
      <Card label="Alta probabilidade" value={String(alta.length)} sub={`${formatCurrency(somaAlta)} · ${pct(somaAlta, total)}`} accent="#2E7D32" />
      <Card label="Média probabilidade" value={String(media.length)} sub={`${formatCurrency(somaMedia)} · ${pct(somaMedia, total)}`} accent="#E65100" />
      <Card label="Baixa probabilidade" value={String(baixa.length)} sub={`${formatCurrency(somaBaixa)} · ${pct(somaBaixa, total)}`} accent="#C62828" />
      <Card label="Budget" value={String(budget.length)} sub={`${formatCurrency(somaBudget)} · ${pct(somaBudget, total)}`} accent="#6A1B9A" />
    </div>
  )
}
