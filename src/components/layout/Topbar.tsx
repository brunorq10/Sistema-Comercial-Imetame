'use client'

import { useSession } from 'next-auth/react'
import { PERFIL_LABELS } from '@/components/layout/perfilLabels'
import { NotificacoesBell } from '@/components/ui/NotificacoesBell'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
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
    <header className="flex h-[52px] flex-shrink-0 items-center justify-between bg-white border-b border-gray-200/80 px-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Título da página */}
      <h1 className="text-[14px] font-semibold text-navy tracking-tight">{title}</h1>

      {/* Lado direito */}
      <div className="flex items-center gap-4">
        {/* Data + perfil */}
        <span className="text-[11px] text-gray-400 hidden sm:block">
          {mesAno}
          {perfil && (
            <>
              <span className="mx-2 text-gray-200">|</span>
              <span className="text-gray-500">{labelCompleto}</span>
            </>
          )}
        </span>

        {/* Sino de notificações */}
        <NotificacoesBell />
      </div>
    </header>
  )
}
