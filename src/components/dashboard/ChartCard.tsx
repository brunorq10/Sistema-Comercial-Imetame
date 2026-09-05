'use client'

import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  subtitle?: string
  accent?: string
  className?: string
  children: React.ReactNode
}

// Card branco padrão para envolver gráficos/tabelas das telas de indicadores:
// título simples em negrito, sem banda colorida de largura total. Quando o
// bloco precisa indicar uma natureza negativa/de atenção, usar `accent` para
// uma borda-esquerda discreta — nunca uma banda cheia.
export function ChartCard({ title, subtitle, accent, className, children }: ChartCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm p-4',
        accent && 'border-l-4',
        className,
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <p className="text-[12px] font-bold text-gray-700 mb-3">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-400 -mt-2 mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}
