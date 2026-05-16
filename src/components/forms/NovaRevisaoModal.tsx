'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SolicitacaoListItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacao: SolicitacaoListItem | null
}

export function NovaRevisaoModal({ open, onClose, onSuccess, solicitacao }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirmar = async () => {
    if (!solicitacao) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacao.id}/nova-revisao`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao criar revisão'); return }
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!solicitacao) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Nova Revisão — ${solicitacao.numero}`}
    >
      <div className="text-[12px] text-gray-700 mb-4 space-y-2">
        <p>
          Criar uma nova revisão para esta solicitação irá:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>Retornar o status para <strong>Em elaboração</strong></li>
          <li>Notificar o orçamentista atribuído por e-mail</li>
          <li>Criar um novo item no painel do orçamentista</li>
        </ul>
        <p className="text-gray-500 mt-2">
          O histórico de propostas anteriores será mantido na aba Propostas.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Solicitação</p>
        <p className="text-[12px] font-semibold">{solicitacao.numero} — {solicitacao.cliente.nome}</p>
        {solicitacao.orcamentista && (
          <>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1.5 mb-0.5">Orçamentista</p>
            <p className="text-[12px] font-semibold">{solicitacao.orcamentista.nome}</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleConfirmar} disabled={loading}>
          {loading ? 'Criando...' : 'Confirmar nova revisão'}
        </Button>
      </div>
    </Modal>
  )
}
