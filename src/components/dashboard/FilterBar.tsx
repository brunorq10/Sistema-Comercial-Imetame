'use client'

import { cn } from '@/lib/utils'

// Classe do rótulo e do campo (select/input) da barra de filtros — exportadas
// para os poucos casos em que o campo precisa ser montado manualmente (ex.:
// um <select> nativo com opções específicas da tela).
export const filterLabelClass = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em]'
export const filterSelectClass = 'w-full px-2 py-[5px] border border-gray-300 rounded text-[11px] text-gray-800 bg-white outline-none focus:border-green-primary transition-colors'

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

// Container padrão da barra de filtros das telas de indicadores.
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-md px-3.5 py-2.5 flex flex-wrap gap-2.5 items-end', className)}>
      {children}
    </div>
  )
}

interface FilterFieldProps {
  label: string
  className?: string
  children: React.ReactNode
}

export function FilterField({ label, className, children }: FilterFieldProps) {
  return (
    <div className={className}>
      <label className={filterLabelClass}>{label}</label>
      {children}
    </div>
  )
}

export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] hover:bg-gray-100 transition-colors">
      ✕ Limpar
    </button>
  )
}
