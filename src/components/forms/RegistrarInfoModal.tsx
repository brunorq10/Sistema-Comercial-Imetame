'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { todayInput } from '@/lib/utils'
import { TIPOS_INTERACAO } from '@/lib/interacoes'
import { AnexosUploader, type AnexoNovo } from '@/components/forms/AnexosUploader'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
  proximoCodigo?: string
}

export function RegistrarInfoModal({ open, onClose, onSuccess, solicitacaoId, numero, proximoCodigo }: Props) {
  const [tipo, setTipo] = useState<string | null>(null)
  const [data, setData] = useState(todayInput())
  const [comentario, setComentario] = useState('')
  const [anexos, setAnexos] = useState<AnexoNovo[]>([])
  const [codigo, setCodigo] = useState(proximoCodigo ?? 'INF-••••')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quando aberto sem o código (ex.: a partir do Meu Painel), busca o próximo.
  useEffect(() => {
    if (!open) return
    if (proximoCodigo) { setCodigo(proximoCodigo); return }
    let ativo = true
    fetch(`/api/solicitacoes/${solicitacaoId}/informacoes?limit=1`)
      .then(r => r.json())
      .then(j => { if (ativo && !j.error && j.data.proximoCodigo) setCodigo(j.data.proximoCodigo) })
      .catch(() => {})
    return () => { ativo = false }
  }, [open, proximoCodigo, solicitacaoId])

  const reset = () => { setTipo(null); setData(todayInput()); setComentario(''); setAnexos([]); setError(null) }

  const handleSubmit = async () => {
    if (!tipo) { setError('Selecione o tipo de informação'); return }
    if (!data) { setError('Informe a data do evento'); return }
    if (!comentario.trim()) { setError('Informe a descrição'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/informacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, data, comentario: comentario.trim(), anexos }),
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
      title={`Nova Informação — ${numero}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar Informação'}</Button>
        </>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      {/* Código (read-only) */}
      <div className="mb-4 border border-gray-200 rounded-md px-3 py-2 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-gray-500">Código da Informação</span>
          <p className="text-[9px] text-gray-400 mt-0.5">Gerado automaticamente ao salvar — sequencial por solicitação</p>
        </div>
        <span className="text-[14px] font-bold text-green-primary">{codigo}</span>
      </div>

      {/* Tipo de Informação — cards */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Tipo de Informação *</label>
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
              style={{ borderColor: sel ? t.cor : '#E5E7EB', backgroundColor: sel ? t.corBg : '#fff', color: sel ? t.cor : '#6B7280' }}
            >
              {sel && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white text-[9px]" style={{ backgroundColor: t.cor }}>✓</span>
              )}
              <Icon style={{ color: sel ? t.cor : '#9CA3AF' }} />
              <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Data do evento */}
      <Field label="Data do Evento *" className="mb-4">
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} max={todayInput()} />
      </Field>

      {/* Descrição */}
      <Field label="Descrição *" className="mb-4">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          placeholder="Descreva o que aconteceu..."
          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[11px] text-gray-900 focus:outline-none focus:border-green-primary resize-none"
        />
      </Field>

      {/* Anexos */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Anexo</label>
      <AnexosUploader
        value={anexos}
        onChange={setAnexos}
        onError={setError}
        hint="Print de e-mail, áudio transcrito, documento — múltiplos arquivos"
      />
    </Modal>
  )
}
