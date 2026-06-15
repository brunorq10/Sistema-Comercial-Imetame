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
    <div className="min-h-screen flex items-center justify-center bg-[#2E7D32]">
      {/* Card */}
      <div className="w-full max-w-[380px] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Topo verde */}
        <div className="bg-[#2E7D32] flex flex-col items-center pt-8 pb-6 px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Imetame"
            width={200}
            style={{ filter: 'brightness(0) invert(1)' }}
            className="select-none"
          />
        </div>

        {/* Formulário */}
        <div className="px-8 py-7">
          <h2 className="text-[17px] font-bold text-gray-800 text-center mb-6">Entrar na sua conta</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Campo Usuário */}
            <div className="relative">
              <label className="absolute left-3 top-1.5 text-[10px] text-gray-400 pointer-events-none select-none">
                Usuário
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-[#F5F8FF] px-3 pb-2 pt-5 text-[13px] text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15"
                placeholder="nome@imetame.com.br"
                required
                autoComplete="email"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                  <circle cx="8.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M2 15c0-3 3-5 6.5-5s6.5 2 6.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
            </div>

            {/* Campo Senha */}
            <div className="relative">
              <label className="absolute left-3 top-1.5 text-[10px] text-gray-400 pointer-events-none select-none">
                Senha
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-[#F5F8FF] px-3 pb-2 pt-5 pr-10 text-[13px] text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPwd ? (
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <path d="M2 8.5C2 8.5 4.5 3.5 8.5 3.5S15 8.5 15 8.5s-2.5 5-6.5 5S2 8.5 2 8.5Z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M3 3l11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <path d="M2 8.5C2 8.5 4.5 3.5 8.5 3.5S15 8.5 15 8.5s-2.5 5-6.5 5S2 8.5 2 8.5Z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                )}
              </button>
            </div>

            {/* Manter logado + Esqueceu a senha */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#2E7D32]"
                />
                <span className="text-[12px] text-gray-500">Manter logado</span>
              </label>
              <button type="button" className="text-[12px] text-[#2E7D32] hover:underline">
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-[#2E7D32] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1B5E20] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
