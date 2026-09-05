'use client'

import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  accent: string
  sub?: string
  onClick?: () => void
  selected?: boolean
}

// Card de KPI padrão das telas de indicadores: branco, borda-esquerda de 4px
// na cor `accent`, valor grande na mesma cor. Quando `onClick` é informado,
// vira um botão selecionável (usado pelos cards que também funcionam como
// filtro clicável, ex. "Solicitações em Aberto").
export function KpiCard({ label, value, accent, sub, onClick, selected }: KpiCardProps) {
  const content = (
    <>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-[24px] font-bold leading-none tracking-tight" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5">{sub}</p>}
    </>
  )

  const baseCls = 'bg-white rounded-xl border shadow-sm p-4 border-l-4 text-left w-full'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseCls, 'transition-shadow', selected ? 'border-slate-200' : 'border-slate-200 hover:shadow-md')}
        style={{ borderLeftColor: accent, boxShadow: selected ? `0 0 0 2px ${accent}` : undefined }}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={cn(baseCls, 'border-slate-200')} style={{ borderLeftColor: accent }}>
      {content}
    </div>
  )
}

interface KpiMiniCardProps {
  label: string
  value: string
}

// Card secundário/de apoio — sem borda-esquerda colorida, valor menor.
export function KpiMiniCard({ label, value }: KpiMiniCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3.5 py-2.5">
      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-[16px] font-bold text-gray-800 leading-none">{value}</p>
    </div>
  )
}
