'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

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
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/home')
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — navy ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col items-center justify-center bg-navy-dark relative overflow-hidden">
        {/* Padrão geométrico de fundo */}
        <div className="absolute inset-0 opacity-[0.04]" aria-hidden>
          <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full border border-white" />
          <div className="absolute top-[40px] left-[40px] w-[300px] h-[300px] rounded-full border border-white" />
          <div className="absolute bottom-[-60px] right-[-60px] w-[350px] h-[350px] rounded-full border border-white" />
          <div className="absolute bottom-[60px] right-[60px] w-[250px] h-[250px] rounded-full border border-white" />
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
          {/* Logo mark */}
          <div className="w-[72px] h-[72px] rounded-2xl bg-green-primary/90 flex items-center justify-center shadow-xl shadow-black/30">
            <svg width="36" height="36" viewBox="0 0 20 20" fill="none">
              <path d="M3 15V5l7 7 7-7v10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <h1 className="text-white text-[32px] font-extrabold tracking-[0.18em] leading-none">IMETAME</h1>
            <p className="text-white/35 text-[10px] tracking-[0.14em] uppercase mt-2">
              Pessoas que fazem a diferença
            </p>
          </div>

          <div className="w-12 h-[2px] bg-green-primary rounded-full" />

          <p className="text-white/40 text-[13px] leading-relaxed max-w-[260px]">
            Sistema Comercial — gestão de orçamentos, acordos e faturamento
          </p>
        </div>
      </div>

      {/* ── Painel direito — formulário ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F5F5F5] px-6">

        {/* Logo mobile */}
        <div className="flex lg:hidden flex-col items-center mb-8 gap-2">
          <div className="w-[56px] h-[56px] rounded-xl bg-navy flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
              <path d="M3 15V5l7 7 7-7v10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-navy text-[22px] font-extrabold tracking-[0.15em]">IMETAME</span>
        </div>

        {/* Card */}
        <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-8">
          <div className="mb-7">
            <h2 className="text-[20px] font-bold text-navy leading-tight">Entrar na conta</h2>
            <p className="text-[13px] text-gray-400 mt-1">Use seu e-mail corporativo para acessar</p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* E-mail */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-navy/70">
                E-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-navy focus:ring-2 focus:ring-navy/10"
                  placeholder="nome@imetame.com.br"
                  required
                  autoComplete="email"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300">
                  <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
                    <circle cx="8.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 15c0-3 3-5 6.5-5s6.5 2 6.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-navy/70">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 pr-10 text-[13px] text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-navy focus:ring-2 focus:ring-navy/10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
                      <path d="M2 8.5C2 8.5 4.5 3.5 8.5 3.5S15 8.5 15 8.5s-2.5 5-6.5 5S2 8.5 2 8.5Z" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M3 3l11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
                      <path d="M2 8.5C2 8.5 4.5 3.5 8.5 3.5S15 8.5 15 8.5s-2.5 5-6.5 5S2 8.5 2 8.5Z" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Manter logado + Esqueceu a senha */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 accent-navy rounded"
                />
                <span className="text-[12px] text-gray-500">Manter logado</span>
              </label>
              <button type="button" className="text-[12px] text-green-primary hover:text-green-dark transition-colors hover:underline">
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-navy py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-navy-dark active:bg-navy-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-[11px] text-gray-400">
          © {new Date().getFullYear()} Imetame. Sistema de uso interno.
        </p>
      </div>

    </div>
  )
}
