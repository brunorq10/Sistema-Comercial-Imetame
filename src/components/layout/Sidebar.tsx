'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    key: 'orcamentos',
    label: 'Orçamentos',
    basePath: '/orcamentos',
    icon: IconOrcamentos,
    items: [
      { label: 'Meu Painel',          href: '/orcamentos/painel' },
      { label: 'Solicitações',        href: '/orcamentos/solicitacoes' },
      { label: 'Propostas',           href: '/orcamentos/propostas' },
      { label: 'Dashboard Comercial', href: '/orcamentos/dashboard' },
    ],
  },
  {
    key: 'acordos',
    label: 'Acordos',
    basePath: '/acordos',
    icon: IconAcordos,
    items: [
      { label: 'Controle de faturamento', href: '/acordos/faturamento' },
      { label: 'Previsão x Realizado',    href: '/acordos/previsao' },
      { label: 'Dashboard Acordos',       href: '/acordos/dashboard' },
    ],
  },
]

export function Sidebar() {
  const pathname  = usePathname()
  const { data: session } = useSession()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    orcamentos: pathname.startsWith('/orcamentos'),
    acordos:    pathname.startsWith('/acordos'),
  })

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const initials = session?.user?.nome
    ? session.user.nome.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase()
    : '?'

  return (
    <aside className="flex w-[220px] flex-shrink-0 flex-col overflow-y-auto bg-white border-r border-gray-200">

      {/* ── Cabeçalho verde ────────────────────────────────────────────── */}
      <div className="bg-green-primary flex flex-col items-center pt-5 pb-5">
        {/* Logo */}
        <span className="text-white text-[18px] font-bold tracking-[0.15em]">IMETAME</span>
        <span className="text-white/55 text-[7.5px] tracking-[0.08em] uppercase mt-0.5">
          Pessoas que fazem a diferença
        </span>

        {/* Divider */}
        <div className="w-full border-t border-white/20 mt-4 mb-4" />

        {/* Usuário */}
        {session?.user && (
          <div className="flex flex-col items-center gap-1.5 px-4 w-full">
            <div className="w-[56px] h-[56px] rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-[18px] font-bold select-none">
              {initials}
            </div>
            <p className="text-white text-[11px] font-semibold text-center leading-tight">
              {session.user.nome}
            </p>
            <p className="text-white/55 text-[9px] text-center truncate w-full px-2">
              {session.user.email}
            </p>
          </div>
        )}
      </div>

      {/* ── Navegação ──────────────────────────────────────────────────── */}
      <nav className="flex-1 py-1.5">
        <p className="px-4 pt-2 pb-1 text-[9px] font-semibold text-gray-400 uppercase tracking-[0.1em]">
          Menu
        </p>

        {NAV_SECTIONS.map((section) => {
          const isOpen    = expanded[section.key]
          const isSection = pathname.startsWith(section.basePath)
          const Icon      = section.icon

          return (
            <div key={section.key}>
              <button
                onClick={() => toggle(section.key)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-[9px] text-[12px] font-semibold transition-colors',
                  isSection
                    ? 'text-green-primary'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon active={isSection} />
                  {section.label}
                </span>
                <Chevron open={isOpen} />
              </button>

              {isOpen && (
                <div className="bg-gray-50 border-l-0">
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'block pl-[42px] pr-4 py-[7px] text-[11px] transition-colors border-l-[2px]',
                          active
                            ? 'text-green-primary font-semibold bg-green-light border-green-primary'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-transparent',
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Divider */}
        <div className="border-t border-gray-100 my-1.5" />

        {/* Cadastros — aba separada */}
        <Link
          href="/cadastros"
          className={cn(
            'flex items-center gap-2.5 px-4 py-[9px] text-[12px] font-semibold transition-colors',
            pathname.startsWith('/cadastros')
              ? 'text-green-primary bg-green-light'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50',
          )}
        >
          <IconCadastros active={pathname.startsWith('/cadastros')} />
          Cadastros
        </Link>
      </nav>

      {/* ── Sair ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="border-t border-gray-200 px-4 py-3 flex items-center gap-2 text-left text-[11px] text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-50"
      >
        <IconSair />
        Sair
      </button>
    </aside>
  )
}

// ── Chevron ──────────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={cn('transition-transform duration-200 text-gray-400', open && 'rotate-180')}
    >
      <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Ícones de seção ──────────────────────────────────────────────────────────
function IconOrcamentos({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? 'text-green-primary' : 'text-gray-400'}>
      <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5.5H11M4 7.5H11M4 9.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconAcordos({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? 'text-green-primary' : 'text-gray-400'}>
      <path d="M2 10L5.5 6.5L7.5 8.5L10 5.5L13 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function IconCadastros({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? 'text-green-primary' : 'text-gray-400'}>
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 13C1.5 10.5 3.5 9 6 9C8.5 9 10.5 10.5 10.5 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 5.5H13.5M12 4V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconSair() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-gray-400">
      <path d="M5 2H2.5C2 2 1.5 2.5 1.5 3V10C1.5 10.5 2 11 2.5 11H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 9L11.5 6.5L8.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 6.5H11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
