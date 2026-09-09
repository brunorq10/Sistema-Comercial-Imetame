'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { CLASSIFICACAO_LABELS } from '@/types'
import type { Classificacao } from '@/types'

interface PropostaRemovida {
  solicitacao_id: number
  numero: string
  cliente_nome: string
  cidade: string | null
  estado: string | null
  escopo: string | null
  classificacao: Classificacao | null
}

interface Props {
  open: boolean
  onClose: () => void
  onIncluida: () => void
}

export function IncluirPropostaProbabilidadeModal({ open, onClose, onIncluida }: Props) {
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<PropostaRemovida[]>([])
  const [loading, setLoading] = useState(false)
  const [incluindoId, setIncluindoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBusca(''); setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/probabilidade/removidas${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`)
        .then((r) => r.json())
        .then((j) => setLista(j.data ?? []))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [open, busca])

  const incluir = async (solicitacaoId: number) => {
    setIncluindoId(solicitacaoId); setError(null)
    try {
      const res = await fetch(`/api/probabilidade/${solicitacaoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'restaurar' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao incluir proposta'); return }
      setLista((prev) => prev.filter((p) => p.solicitacao_id !== solicitacaoId))
      onIncluida()
    } finally {
      setIncluindoId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Incluir proposta" wide footer={<ModalCancelButton label="Fechar" />}>
      <Field label="Buscar por proposta, cliente ou escopo" className="mb-3">
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para buscar..." autoFocus />
      </Field>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>}

      <p className="text-[10px] text-gray-400 mb-2">
        Propostas comerciais enviadas e em aberto que foram removidas do painel — inclua para que voltem a aparecer, em &quot;Não classificadas&quot;.
      </p>

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">Nenhuma proposta removida do painel encontrada.</p>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {lista.map((p) => (
            <div key={p.solicitacao_id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-bold text-green-dark">{p.numero}</span>
                  <span className="text-[11px] text-gray-600">{p.cliente_nome}</span>
                  {p.classificacao && (
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{CLASSIFICACAO_LABELS[p.classificacao]}</span>
                  )}
                  <span className="text-[10px] text-gray-400">{[p.cidade, p.estado].filter(Boolean).join('/') || '—'}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{p.escopo ?? '—'}</p>
              </div>
              <Button size="sm" onClick={() => incluir(p.solicitacao_id)} disabled={incluindoId === p.solicitacao_id}>
                {incluindoId === p.solicitacao_id ? '...' : 'Incluir'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
