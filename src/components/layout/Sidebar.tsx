'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  sub?: boolean
}

const NAV_ACORDOS: NavItem[] = [
  { label: 'Meu Painel — Acordos', href: '/acordos/painel' },
  { label: 'Controle de faturamento', href: '/acordos/faturamento', sub: true },
  { label: 'Registro de NFs', href: '/acordos/nfs', sub: true },
  { label: 'Previsão vs. realizado', href: '/acordos/previsao', sub: true },
  { label: 'Dashboard Acordos', href: '/acordos/dashboard', sub: true },
]

const NAV_ORCAMENTOS_BASE: NavItem[] = [
  { label: 'Meu Painel', href: '/orcamentos/painel' },
  { label: 'Solicitações', href: '/orcamentos/solicitacoes', sub: true },
  { label: 'Propostas', href: '/orcamentos/propostas', sub: true },
  { label: 'Dashboard Comercial', href: '/orcamentos/dashboard', sub: true },
]

const NAV_ANALISE: NavItem = { label: 'Análise de Solicitações', href: '/orcamentos/analise' }

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAnalistaCritico = session?.user?.is_analista_critico ?? false

  const navOrcamentos: NavItem[] = isAnalistaCritico
    ? [NAV_ANALISE, ...NAV_ORCAMENTOS_BASE]
    : NAV_ORCAMENTOS_BASE

  return (
    <aside className="flex w-[220px] flex-shrink-0 flex-col overflow-y-auto bg-green-dark">
      {/* Logo */}
      <div className="border-b border-white/10 px-[14px] py-3 text-[15px] font-bold text-white">
        IMETAME
      </div>

      {/* Usuário */}
      {session?.user && (
        <div className="border-b border-white/[0.08] px-[14px] py-[10px]">
          <p className="text-[12px] font-medium text-white">{session.user.nome}</p>
          <p className="mt-0.5 text-[10px] text-white/40">{session.user.email}</p>
          {isAnalistaCritico && (
            <p className="mt-0.5 text-[9px] text-amber-300/70 font-medium">Analista Crítico</p>
          )}
        </div>
      )}

      {/* Navegação */}
      <nav className="flex-1">
        <SectionLabel>Orçamentos</SectionLabel>
        {navOrcamentos.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <SectionLabel>Acordos</SectionLabel>
        {NAV_ACORDOS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <SectionLabel>Gestão</SectionLabel>
        <NavLink item={{ label: 'Cadastros', href: '/cadastros' }} pathname={pathname} />
      </nav>

      {/* Sair */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="border-t border-white/10 px-[14px] py-3 text-left text-[11px] text-white/50 transition-colors hover:text-white/80"
      >
        Sair
      </button>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-[14px] pb-[3px] pt-2 text-[9px] uppercase tracking-[0.1em] text-white/30">
      {children}
    </p>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/')

  if (item.sub) {
    return (
      <Link
        href={item.href}
        className={cn(
          'block px-[14px] py-[7px] text-[11px] transition-colors',
          active ? 'font-medium text-white' : 'text-white/52 hover:text-white',
        )}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'block px-[14px] py-[9px] text-[12px] transition-colors',
        active
          ? 'bg-green-primary font-semibold text-white'
          : 'text-white/[0.72] hover:bg-white/[0.08]',
      )}
    >
      {item.label}
    </Link>
  )
}
