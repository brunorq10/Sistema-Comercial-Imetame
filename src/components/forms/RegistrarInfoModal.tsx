'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { todayInput } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
}

export function RegistrarInfoModal({ open, onClose, onSuccess, solicitacaoId, numero }: Props) {
  const [data, setData] = useState(todayInput())
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!comentario.trim()) { setError('Informe o comentário'); return }
    if (!data) { setError('Informe a data'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/informacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, comentario: comentario.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }
      setComentario(''); setData(todayInput())
      onSuccess(); onClose()
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Registrar Informação — ${numero}`}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}
      <p className="text-[11px] text-gray-500 mb-4">
        Registre um fato ou acontecimento relevante durante a negociação desta proposta.
        A informação ficará disponível no histórico de revisões.
      </p>
      <Field label="Data do acontecimento" className="mb-3">
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
      <Field label="Comentário / Acontecimento *" className="mb-5">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          placeholder="Descreva o acontecimento ou informação relevante..."
          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30 resize-none"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Salvando...' : 'Registrar'}
        </Button>
      </div>
    </Modal>
  )
}
