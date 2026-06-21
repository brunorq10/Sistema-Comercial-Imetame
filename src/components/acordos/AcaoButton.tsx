'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Botão de ação padronizado das tabelas de HH (Obras, Paradas, Fabricações)
export function AcaoButton({ onClick, title, color, children }: {
  onClick: () => void; title: string; color: 'blue' | 'green' | 'gray' | 'red'; children: ReactNode
}) {
  const colors: Record<string, string> = {
    blue:  'border-blue-400 text-blue-500 hover:bg-blue-50',
    green: 'border-green-primary text-green-primary hover:bg-green-light',
    gray:  'border-gray-300 text-gray-500 hover:bg-gray-100',
    red:   'border-red-400 text-red-400 hover:bg-red-50',
  }
  return (
    <button onClick={onClick} title={title}
      className={cn('border rounded px-1.5 py-0.5 text-[11px]', colors[color] ?? colors.gray)}>
      {children}
    </button>
  )
}

// Ícones padronizados por ação (mesma ação → mesmo ícone em todas as telas)
export const ACAO_ICONS = {
  visualizar: '👁',
  editar:     '✎',
  lancar:     '+',
  historico:  '🕘',
  excluir:    '🗑',
} as const
