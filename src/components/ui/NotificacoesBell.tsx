'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/utils'
import type { NotificacaoItem } from '@/types'

export function NotificacoesBell() {
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotificacoes = async () => {
    try {
      const res = await fetch('/api/notificacoes')
      const json = await res.json()
      if (json.data) {
        setNotificacoes(json.data)
        setNaoLidas(json.total_nao_lidas ?? 0)
      }
    } catch {}
  }

  useEffect(() => {
    fetchNotificacoes()
    const interval = setInterval(fetchNotificacoes, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen((v) => !v)
  }

  const marcarTodasLidas = async () => {
    await fetch('/api/notificacoes', { method: 'PATCH' })
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    setNaoLidas(0)
  }

  const marcarLida = async (id: number) => {
    await fetch(`/api/notificacoes?id=${id}`, { method: 'PATCH' })
    setNotificacoes((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n))
    setNaoLidas((v) => Math.max(0, v - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
        title="Notificações"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold bg-red-500 text-white rounded-full">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[340px] bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <p className="text-[12px] font-semibold text-gray-700">Notificações</p>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="text-[10px] text-green-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notificacoes.length === 0 ? (
              <p className="text-center text-[11px] text-gray-400 py-6">Nenhuma notificação.</p>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.lida) marcarLida(n.id) }}
                  className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.lida ? 'bg-green-light' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lida && (
                      <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-primary" />
                    )}
                    <div className={!n.lida ? '' : 'pl-3.5'}>
                      <p className="text-[11px] font-semibold text-gray-700">{n.titulo}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{n.mensagem}</p>
                      <p className="text-[9px] text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
