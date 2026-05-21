'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'

const MODULES = [
  {
    label: 'Orçamentos',
    desc: 'Solicitações, propostas técnico-comerciais e painel do orçamentista',
    href: '/orcamentos/solicitacoes',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 9h14M7 13h14M7 17h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Acordos',
    desc: 'Controle de faturamento, NFs e previsão × realizado',
    href: '/acordos/faturamento',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 18l6-7 4 4 4-5 4 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Dashboard',
    desc: 'Indicadores comerciais e métricas de desempenho',
    href: '/orcamentos/dashboard',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="15" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="2" y="15" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="15" y="15" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    label: 'Cadastros',
    desc: 'Clientes, usuários e tabelas de referência',
    href: '/cadastros',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="11" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 24c0-4.5 3.5-8 8-8s8 3.5 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M20 10h6M23 7v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function HomePage() {
  const { data: session } = useSession()
  const nome = session?.user?.nome ?? 'Usuário'
  const primeiroNome = nome.split(' ')[0]

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
      {/* Card de boas-vindas */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 flex flex-col items-center px-10 py-10 mb-10 w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-[64px] h-[64px] rounded-xl bg-[#2E7D32] flex items-center justify-center mb-3">
            <svg viewBox="0 0 40 28" fill="none" className="w-[44px] h-auto">
              <text x="20" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" fontFamily="Arial, sans-serif" letterSpacing="0.5">IM</text>
            </svg>
          </div>
          <span className="text-[18px] font-extrabold tracking-[0.15em] text-[#1B5E20]">IMETAME</span>
          <span className="text-[9px] text-gray-400 tracking-[0.08em] uppercase mt-0.5">Pessoas que fazem a diferença</span>
        </div>

        <h1 className="text-[20px] font-bold text-gray-800 mb-1">
          Bem-vindo, {primeiroNome}!
        </h1>
        <p className="text-[13px] text-gray-400 text-center">
          Você está no Sistema Comercial Imetame
        </p>
      </div>

      {/* Módulos */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-[560px]">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 hover:border-[#2E7D32] hover:shadow-md transition-all group"
          >
            <span className="text-[#2E7D32] group-hover:text-[#1B5E20] transition-colors">
              {mod.icon}
            </span>
            <div>
              <p className="text-[13px] font-bold text-gray-800 mb-0.5">{mod.label}</p>
              <p className="text-[11px] text-gray-400 leading-snug">{mod.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
