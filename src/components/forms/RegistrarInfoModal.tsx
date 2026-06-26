'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { todayInput } from '@/lib/utils'
import { TIPOS_INTERACAO, IMPACTOS } from '@/lib/interacoes'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
}

export function RegistrarInfoModal({ open, onClose, onSuccess, solicitacaoId, numero }: Props) {
  const [tipo, setTipo] = useState<string | null>(null)
  const [data, setData] = useState(todayInput())
  const [comentario, setComentario] = useState('')
  const [impacto, setImpacto] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTipo(null); setData(todayInput()); setComentario(''); setImpacto([]); setError(null)
  }

  const toggleImpacto = (v: string) =>
    setImpacto((prev) => {
      // "Nenhum" é exclusivo
      if (v === 'NENHUM') return prev.includes('NENHUM') ? [] : ['NENHUM']
      const semNenhum = prev.filter((x) => x !== 'NENHUM')
      return semNenhum.includes(v) ? semNenhum.filter((x) => x !== v) : [...semNenhum, v]
    })

  const handleSubmit = async () => {
    if (!tipo) { setError('Selecione o tipo de interação'); return }
    if (!data) { setError('Informe a data do evento'); return }
    if (!comentario.trim()) { setError('Informe a descrição'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/informacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, data, comentario: comentario.trim(), impacto }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }
      reset()
      onSuccess(); onClose()
    } finally { setLoading(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Nova Interação — ${numero}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Interação'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* 1. Tipo de interação — cards */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">
        Tipo de Interação *
      </label>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {TIPOS_INTERACAO.map((t) => {
          const sel = tipo === t.value
          const Icon = t.icon
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors"
              style={{
                borderColor: sel ? t.cor : '#E5E7EB',
                backgroundColor: sel ? t.corBg : '#fff',
                color: sel ? t.cor : '#6B7280',
              }}
            >
              {sel && (
                <span
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white text-[9px]"
                  style={{ backgroundColor: t.cor }}
                >
                  ✓
                </span>
              )}
              <Icon style={{ color: sel ? t.cor : '#9CA3AF' }} />
              <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* 2. Data do evento */}
      <Field label="Data do Evento *" className="mb-4">
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} max={todayInput()} />
      </Field>

      {/* 3. Descrição */}
      <Field label="Descrição *" className="mb-4">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          placeholder="Descreva o que aconteceu..."
          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[11px] text-gray-900 focus:outline-none focus:border-green-primary resize-none"
        />
      </Field>

      {/* 4. Impacto — chips múltiplos */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">
        Impacto (opcional)
      </label>
      <div className="flex flex-wrap gap-2">
        {IMPACTOS.map((imp) => {
          const sel = impacto.includes(imp.value)
          return (
            <button
              key={imp.value}
              type="button"
              onClick={() => toggleImpacto(imp.value)}
              className={
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ' +
                (sel
                  ? 'bg-green-primary border-green-primary text-white'
                  : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100')
              }
            >
              {sel && <span className="text-[9px]">✓</span>}
              {imp.label}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
