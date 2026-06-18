'use client'

import { useState } from 'react'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import type { SolicitacaoListItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacao: SolicitacaoListItem | null
}

export function CancelarSolicitacaoModal({ open, onClose, onSuccess, solicitacao }: Props) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!solicitacao) return
    if (motivo.trim().length < 5) {
      setError('Informe uma justificativa com pelo menos 5 caracteres')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacao.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: motivo }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Erro ao cancelar')
        return
      }

      setMotivo('')
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={`Cancelar SolicitaÃ§Ã£o â€” ${solicitacao?.numero ?? ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </>
      }
    >
      <p className="text-xs text-gray-600 mb-4">
        O cancelamento Ã© irreversÃ­vel. A solicitaÃ§Ã£o serÃ¡ mantida no histÃ³rico (RN-18).
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}
      <Field label="Justificativa do cancelamento *">
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Descreva o motivo do cancelamento..."
          className="h-20"
        />
      </Field>
    </Modal>
  )
}

