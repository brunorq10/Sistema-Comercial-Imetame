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
      { label: 'Indicadores Comercial', href: '/orcamentos/dashboard' },
    ],
  },
  {
    key: 'acordos',
    label: 'Acordos',
    basePath: '/acordos',
    icon: IconAcordos,
    items: [
      { label: 'Meu Painel',              href: '/acordos/painel' },
      { label: 'Controle de faturamento', href: '/acordos/faturamento' },
      { label: 'Consolidado x Realizado', href: '/acordos/previsao' },
      { label: 'Controle de HH',          href: '/acordos/hh' },
      { label: 'Indicadores Acordos',     href: '/acordos/dashboard' },
    ],
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
  /** Trilha recolhida no desktop (lg+). Persistente — alternada pelo hambúrguer. */
  collapsed?: boolean
}

export function Sidebar({ mobileOpen = false, onClose, collapsed = false }: SidebarProps) {
  const pathname  = usePathname()
  const { data: session } = useSession()

  // Hover temporário: quando recolhida, passar o mouse expande por cima (sem fixar)
  const [hovered, setHovered] = useState(false)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    orcamentos: pathname.startsWith('/orcamentos'),
    acordos:    pathname.startsWith('/acordos'),
  })

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const initials = session?.user?.nome
    ? session.user.nome.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase()
    : '?'

  // Modo "só ícones" — ativo apenas no lg+ quando recolhida e sem hover.
  // Aplicado via utilitários `lg:` para nunca afetar o drawer mobile.
  const railMode = collapsed && !hovered
  const hideInRail = railMode ? 'lg:hidden' : ''

  return (
    <>
      {/* Backdrop — só no drawer mobile */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Spacer — reserva a largura no fluxo (lg+). Usa `collapsed`, não o hover,
          para que a expansão por hover seja overlay e não empurre o conteúdo. */}
      <div
        className={cn(
          'hidden flex-shrink-0 transition-[width] duration-200 lg:block',
          collapsed ? 'lg:w-[56px]' : 'lg:w-[220px]',
        )}
      />

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'flex w-[220px] flex-col overflow-y-auto overflow-x-hidden bg-white border-r border-gray-200',
          // mobile: drawer fixo deslizante
          'fixed inset-y-0 left-0 z-50 transition-[transform,width] duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // desktop: overlay absoluto sobre o spacer; largura conforme rail
          'lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:translate-x-0',
          railMode ? 'lg:w-[56px]' : 'lg:w-[220px]',
        )}
      >

      {/* ── Cabeçalho verde ────────────────────────────────────────────── */}
      <div className={cn('bg-green-primary flex flex-col items-center pt-5 pb-5', railMode && 'lg:py-3')}>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="Imetame"
          width={120}
          style={{ filter: 'brightness(0) invert(1)' }}
          className={cn('select-none', hideInRail)}
        />

        {/* Divider */}
        <div className={cn('w-full border-t border-white/20 mt-4 mb-4', hideInRail)} />

        {/* Usuário */}
        {session?.user && (
          <div className="flex flex-col items-center gap-1.5 px-4 w-full">
            <div className={cn(
              'rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white font-bold select-none w-[56px] h-[56px] text-[18px]',
              railMode && 'lg:w-9 lg:h-9 lg:text-[12px] lg:border',
            )}>
              {initials}
            </div>
            <p className={cn('text-white text-[11px] font-semibold text-center leading-tight', hideInRail)}>
              {session.user.nome}
            </p>
            <p className={cn('text-white/55 text-[9px] text-center truncate w-full px-2', hideInRail)}>
              {session.user.email}
            </p>
          </div>
        )}
      </div>

      {/* ── Navegação ──────────────────────────────────────────────────── */}
      <nav className="flex-1 py-1.5">
        <p className={cn('px-4 pt-2 pb-1 text-[9px] font-semibold text-gray-400 uppercase tracking-[0.1em]', hideInRail)}>
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
                title={section.label}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-[9px] text-[12px] font-semibold transition-colors',
                  railMode && 'lg:justify-center lg:px-0',
                  isSection
                    ? 'text-green-primary'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50',
                )}
              >
                <span className={cn('flex items-center gap-2.5', railMode && 'lg:gap-0')}>
                  <Icon active={isSection} />
                  <span className={hideInRail}>{section.label}</span>
                </span>
                <Chevron open={isOpen} className={hideInRail} />
              </button>

              {isOpen && (
                <div className={cn('bg-gray-50 border-l-0', hideInRail)}>
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
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
          onClick={onClose}
          title="Cadastros"
          className={cn(
            'flex items-center gap-2.5 px-4 py-[9px] text-[12px] font-semibold transition-colors',
            railMode && 'lg:justify-center lg:px-0 lg:gap-0',
            pathname.startsWith('/cadastros')
              ? 'text-green-primary bg-green-light'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50',
          )}
        >
          <IconCadastros active={pathname.startsWith('/cadastros')} />
          <span className={hideInRail}>Cadastros</span>
        </Link>
      </nav>

      {/* ── Sair ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        title="Sair"
        className={cn(
          'border-t border-gray-200 px-4 py-3 flex items-center gap-2 text-left text-[11px] text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-50',
          railMode && 'lg:justify-center lg:px-0 lg:gap-0',
        )}
      >
        <IconSair />
        <span className={hideInRail}>Sair</span>
      </button>
      </aside>
    </>
  )
}

// ── Chevron ──────────────────────────────────────────────────────────────────
function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      width="12" height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={cn('transition-transform duration-200 text-gray-400', open && 'rotate-180', className)}
    >
      <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Ícones de seção ──────────────────────────────────────────────────────────
function IconOrcamentos({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={cn('flex-shrink-0', active ? 'text-green-primary' : 'text-gray-400')}>
      <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5.5H11M4 7.5H11M4 9.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconAcordos({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={cn('flex-shrink-0', active ? 'text-green-primary' : 'text-gray-400')}>
      <path d="M2 10L5.5 6.5L7.5 8.5L10 5.5L13 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function IconCadastros({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={cn('flex-shrink-0', active ? 'text-green-primary' : 'text-gray-400')}>
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 13C1.5 10.5 3.5 9 6 9C8.5 9 10.5 10.5 10.5 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 5.5H13.5M12 4V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconSair() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="flex-shrink-0 text-gray-400">
      <path d="M5 2H2.5C2 2 1.5 2.5 1.5 3V10C1.5 10.5 2 11 2.5 11H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 9L11.5 6.5L8.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 6.5H11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
