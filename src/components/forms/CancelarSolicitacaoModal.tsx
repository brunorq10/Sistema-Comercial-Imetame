'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import type { SolicitacaoListItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacao: SolicitacaoListItem | null
}

type Acao = 'cancelar' | 'suspender'

export function CancelarSolicitacaoModal({ open, onClose, onSuccess, solicitacao }: Props) {
  const temProposta = !!solicitacao?.tem_proposta_enviada
  // Regra: cancela só sem proposta enviada; com proposta enviada, só suspende.
  const acaoPadrao: Acao = temProposta ? 'suspender' : 'cancelar'

  const [acao, setAcao] = useState<Acao>(acaoPadrao)
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setAcao(acaoPadrao); setMotivo(''); setError(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, solicitacao?.id])

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
        body: JSON.stringify({ acao, cancel_reason: motivo }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Erro ao processar')
        return
      }
      setMotivo('')
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const confirmLabel = acao === 'cancelar' ? 'Confirmar cancelamento' : 'Confirmar suspensão'

  return (
    <Modal
      open={open}
      hasChanges={motivo.trim().length > 0}
      onClose={onClose}
      title={`Cancelar / Suspender — ${solicitacao?.numero ?? ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant={acao === 'cancelar' ? 'danger' : 'warning'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Processando...' : confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-600 mb-3">
        Escolha a ação. {temProposta
          ? 'Esta solicitação já teve proposta enviada ao cliente, portanto só pode ser suspensa.'
          : 'Nenhuma proposta foi enviada ainda, portanto pode ser cancelada.'}
      </p>

      <div className="space-y-2 mb-4">
        <OpcaoAcao
          ativo={acao === 'cancelar'}
          desabilitado={temProposta}
          onClick={() => !temProposta && setAcao('cancelar')}
          titulo="Cancelar"
          descricao="Remove a solicitação do sistema. Disponível apenas enquanto nenhuma proposta foi enviada ao cliente. O número só será reutilizado se não existir solicitação com numeração posterior."
        />
        <OpcaoAcao
          ativo={acao === 'suspender'}
          desabilitado={!temProposta}
          onClick={() => temProposta && setAcao('suspender')}
          titulo="Suspender"
          descricao="Remove a solicitação do painel do orçamentista. As propostas já enviadas permanecem na aba Propostas."
        />
      </div>

      <Field label="Justificativa *">
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={acao === 'cancelar' ? 'Descreva o motivo do cancelamento...' : 'Descreva o motivo da suspensão...'}
          className="h-20"
        />
      </Field>
    </Modal>
  )
}

interface OpcaoProps {
  ativo: boolean
  desabilitado: boolean
  onClick: () => void
  titulo: string
  descricao: string
}

function OpcaoAcao({ ativo, desabilitado, onClick, titulo, descricao }: OpcaoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className={[
        'w-full text-left border rounded-md px-3 py-2.5 transition-colors',
        desabilitado
          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
          : ativo
          ? 'border-green-primary bg-green-light'
          : 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border',
            ativo && !desabilitado ? 'border-green-primary' : 'border-gray-400',
          ].join(' ')}
        >
          {ativo && !desabilitado && <span className="h-1.5 w-1.5 rounded-full bg-green-primary" />}
        </span>
        <span className="text-[12px] font-semibold text-gray-800">{titulo}</span>
        {desabilitado && <span className="text-[10px] text-gray-400">(indisponível)</span>}
      </div>
      <p className="text-[10px] text-gray-500 mt-1 pl-[22px]">{descricao}</p>
    </button>
  )
}
