'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('E-mail ou senha inválidos')
      setLoading(false)
      return
    }

    router.push('/orcamentos/solicitacoes')
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-auto">
      {/* ── Painel esquerdo — formulário ─────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 md:w-1/2 md:px-16">
        <div className="w-full max-w-[320px]">
          {/* Logo / marca */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2E7D32]">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3h18v4H3V3zm0 7h12v4H3v-4zm0 7h18v4H3v-4z" fill="white" fillOpacity=".9" />
              </svg>
            </div>
            <span className="text-[18px] font-bold tracking-tight text-[#1B5E20]">IMETAME</span>
          </div>

          {/* Título */}
          <div className="mb-1 text-[28px] font-extrabold leading-tight tracking-tight text-[#212121]">
            Bem-vindo
          </div>
          <p className="mb-8 text-[13px] text-[#757575]">
            Acesse o Sistema Comercial com suas credenciais corporativas.
          </p>

          {/* Alerta de erro */}
          {error && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
              {error}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#757575]">
                E-mail corporativo
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-[#D5D5D5] px-3.5 py-2.5 text-[13px] text-[#212121] outline-none transition-colors placeholder:text-[#BDBDBD] focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/10"
                placeholder="nome@imetame.com.br"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#757575]">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-[#D5D5D5] px-3.5 py-2.5 text-[13px] text-[#212121] outline-none transition-colors placeholder:text-[#BDBDBD] focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/10"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-[#2E7D32] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1B5E20] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Painel direito — decorativo Fuse-style ──────────────── */}
      <div className="relative hidden flex-auto items-center justify-center overflow-hidden bg-[#1B5E20] p-16 md:flex lg:px-28">
        {/* Anéis decorativos (mesmo padrão do Fuse template) */}
        <svg
          className="pointer-events-none absolute inset-0"
          viewBox="0 0 960 540"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMax slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="100">
            <circle r="234" cx="196" cy="23" />
            <circle r="234" cx="790" cy="491" />
          </g>
        </svg>

        {/* Pontos no canto superior direito */}
        <svg
          className="absolute -right-16 -top-16 text-[#2E7D32]"
          viewBox="0 0 220 192"
          width="220"
          height="192"
          fill="none"
        >
          <defs>
            <pattern id="dots-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="4" height="4" fill="rgba(255,255,255,0.12)" />
            </pattern>
          </defs>
          <rect width="220" height="192" fill="url(#dots-pattern)" />
        </svg>

        {/* Conteúdo */}
        <div className="relative z-10 w-full max-w-xl">
          <div className="text-[56px] font-bold leading-none text-white">
            <div>Sistema</div>
            <div>Comercial</div>
          </div>
          <p className="mt-5 text-[15px] leading-relaxed tracking-tight text-[#A5D6A7]">
            Gestão integrada de orçamentos, propostas e acordos de faturamento da Imetame Engenharia.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {[
              { label: 'Orçamentos', desc: 'Controle de solicitações e propostas técnico-comerciais' },
              { label: 'Acordos', desc: 'Faturamento, NFs e previsão vs. realizado' },
              { label: 'Dashboards', desc: 'Indicadores comerciais em tempo real' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#81C784]" />
                <div>
                  <span className="text-[13px] font-semibold text-white">{item.label}</span>
                  <span className="text-[13px] text-[#A5D6A7]"> — {item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
