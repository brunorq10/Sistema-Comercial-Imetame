'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import type { SubIndiceItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onDelete: () => void
  subindice: SubIndiceItem
  indiceLabel: string
}

export function EditarSubIndiceModal({ open, onClose, onSuccess, onDelete, subindice, indiceLabel }: Props) {
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [meses, setMeses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open && subindice) {
      setDescricao(subindice.descricao)
      setValorTotal(String(subindice.valor_total))
      setDataInicio(subindice.data_inicio ? subindice.data_inicio.substring(0, 10) : '')
      setDataFim(subindice.data_fim ? subindice.data_fim.substring(0, 10) : '')
      setComentarios(subindice.comentarios ?? '')
      setMeses(Object.fromEntries(MESES.map((m) => [m, subindice[m] != null ? String(subindice[m]) : ''])))
      setConfirmDelete(false)
      setError(null)
    }
  }, [open, subindice])

  const handleSave = async () => {
    if (!descricao.trim()) { setError('Descrição obrigatória'); return }
    if (!valorTotal || isNaN(Number(valorTotal))) { setError('Valor total inválido'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/faturamento/subindices/${subindice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          valor_total: Number(valorTotal),
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          comentarios: comentarios || null,
          ...Object.fromEntries(MESES.map((m) => [m, meses[m] ? Number(meses[m]) : null])),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/faturamento/subindices/${subindice.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao excluir'); return }
      onDelete(); onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar Sub-índice · ${indiceLabel}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <ModalSection>Dados do evento</ModalSection>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Descrição / Evento *" className="col-span-2">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
        <Field label="Valor Total (R$) *">
          <Input type="number" min="0" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
        </Field>
        <Field label="Comentários">
          <Input placeholder="Obs..." value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
        </Field>
        <Field label="Período — De">
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </Field>
      </div>

      <ModalSection>Previsão mensal</ModalSection>
      <div className="grid grid-cols-6 gap-1.5 mb-6">
        {MESES.map((m, idx) => (
          <div key={m}>
            <p className="text-[9px] text-gray-400 uppercase text-center mb-0.5">{MESES_LABELS[idx]}</p>
            <input
              type="number" min="0" step="0.01" placeholder="—"
              value={meses[m] ?? ''}
              onChange={(e) => setMeses((prev) => ({ ...prev, [m]: e.target.value }))}
              className="w-full border border-gray-300 rounded px-1.5 py-[3px] text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-green-primary/40"
            />
          </div>
        ))}
      </div>

      {/* Zona de exclusão */}
      <div className="border-t border-red-100 pt-3 mt-2">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-red-500 text-[11px] hover:text-red-700 hover:underline"
          >
            🗑 Excluir este sub-índice
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-[11px] text-red-700 mb-2">
              Confirma a exclusão de <strong>{indiceLabel}</strong>? Todas as NFs associadas também serão removidas.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
                {loading ? 'Excluindo...' : 'Confirmar exclusão'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
