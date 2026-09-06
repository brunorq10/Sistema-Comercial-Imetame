'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface ReportShellProps {
  titulo: string
  descricao: string
  onExport?: () => void
  exportDisabled?: boolean
  filtros?: ReactNode
  children: ReactNode
}

// Casca padrão de todo relatório: voltar à biblioteca (sempre visível),
// título, exportar, barra de filtros persistente e a tabela — que é sempre
// o elemento central, nunca um gráfico ou card de indicador.
export function ReportShell({ titulo, descricao, onExport, exportDisabled, filtros, children }: ReportShellProps) {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <Link href="/relatorios" className="inline-flex items-center gap-1 text-[11px] text-green-primary hover:text-green-dark font-semibold mb-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L3 6l4.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Voltar à biblioteca
          </Link>
          <h1 className="text-[16px] font-bold text-gray-800">{titulo}</h1>
          <p className="text-[11px] text-gray-500">{descricao}</p>
        </div>
        {onExport && (
          <Button variant="outline" onClick={onExport} disabled={exportDisabled}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5V8M6 8L3.5 5.5M6 8l2.5-2.5M2 9.5v1a1 1 0 001 1h6a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Exportar Excel
          </Button>
        )}
      </div>

      {filtros && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 my-3 flex items-end gap-3 flex-wrap">
          {filtros}
        </div>
      )}

      <div className={filtros ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}
