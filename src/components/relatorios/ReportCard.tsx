'use client'

import type { ReactNode } from 'react'

interface ReportCardProps {
  codigo: string
  titulo: string
  pergunta: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

// Envelope padrão de cada relatório: código + nome, a pergunta que ele
// responde em destaque, filtros próprios (se houver) e o conteúdo.
export function ReportCard({ codigo, titulo, pergunta, actions, children, className }: ReportCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <span className="text-[9px] font-mono text-gray-400 tracking-wide">{codigo}</span>
          <h3 className="text-[13.5px] font-bold text-gray-800 leading-tight">{titulo}</h3>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      <p className="text-[11.5px] text-gray-500 italic mb-3">&ldquo;{pergunta}&rdquo;</p>
      {children}
    </div>
  )
}
