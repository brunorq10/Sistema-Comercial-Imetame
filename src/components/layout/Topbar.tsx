'use client'

import { useSession } from 'next-auth/react'
import { PERFIL_LABELS } from '@/components/layout/perfilLabels'
import { NotificacoesBell } from '@/components/ui/NotificacoesBell'

interface TopbarProps {
  title: string
  onMenuClick?: () => void
  onToggleCollapse?: () => void
  collapsed?: boolean
}

export function Topbar({ title, onMenuClick, onToggleCollapse, collapsed }: TopbarProps) {
  const { data: session } = useSession()
  const perfil = session?.user?.perfil
  const isAnalistaCritico = session?.user?.is_analista_critico

  const hoje = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const mesAno = hoje.charAt(0).toUpperCase() + hoje.slice(1)

  const perfilLabel = perfil ? PERFIL_LABELS[perfil] : ''
  const labelCompleto = isAnalistaCritico
    ? `${perfilLabel} · Analista Crítico`
    : perfilLabel

  return (
    <header className="flex h-[46px] flex-shrink-0 items-center justify-between gap-2 bg-green-primary px-[14px]">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hambúrguer mobile — abre o drawer (abaixo de lg) */}
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="-ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-white transition-colors hover:bg-white/15 lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2.5 5H15.5M2.5 9H15.5M2.5 13H15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        {/* Hambúrguer desktop — recolhe/expande a trilha (lg+) */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-pressed={collapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="-ml-1 hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded text-white transition-colors hover:bg-white/15 lg:flex"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2.5 5H15.5M2.5 9H15.5M2.5 13H15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="truncate text-[14px] font-semibold text-white">{title}</h1>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="hidden text-[11px] text-white/80 sm:inline">
          {mesAno}
          {perfil && <>&nbsp;&nbsp;|&nbsp;&nbsp;{labelCompleto}</>}
        </span>
        <NotificacoesBell />
      </div>
    </header>
  )
}
