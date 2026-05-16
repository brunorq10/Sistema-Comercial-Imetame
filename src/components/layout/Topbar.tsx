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
    <header className="flex h-[46px] flex-shrink-0 items-center justify-between bg-green-primary px-[14px]">
      <h1 className="text-[14px] font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-white/80">
          {mesAno}
          {perfil && <>&nbsp;&nbsp;|&nbsp;&nbsp;{labelCompleto}</>}
        </span>
        <NotificacoesBell />
      </div>
    </header>
  )
}
