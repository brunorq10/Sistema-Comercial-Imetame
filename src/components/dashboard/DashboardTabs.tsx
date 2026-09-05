'use client'

import { cn } from '@/lib/utils'

interface DashboardTabsProps<T extends string> {
  tabs: { key: T; label: string }[]
  active: T
  onChange: (key: T) => void
  className?: string
}

// Abas estilo sublinhado das telas de indicadores: ativa em verde
// institucional com sublinhado, inativa em cinza.
export function DashboardTabs<T extends string>({ tabs, active, onChange, className }: DashboardTabsProps<T>) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-gray-200 !mt-3 overflow-x-auto', className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'text-[12px] font-semibold px-3 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors',
            active === t.key ? 'border-green-primary text-green-primary' : 'border-transparent text-gray-400 hover:text-gray-600',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
