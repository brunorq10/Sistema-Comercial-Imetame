'use client'

import { useState } from 'react'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import type { AcordoListItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  acordo: AcordoListItem
}

export function LancarNFModal({ open, onClose, onSuccess, acordo }: Props) {
  const [numeroNf, setNumeroNf] = useState('')
  const [valor, setValor] = useState('')
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0])
  const [dataVencimento, setDataVencimento] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setNumeroNf(''); setValor('')
    setDataEmissao(new Date().toISOString().split('T')[0]); setDataVencimento('')
  }

  const handleSubmit = async () => {
    if (!numeroNf) { setError('Informe o número da NF'); return }
    if (!valor || Number(valor) <= 0) { setError('Informe o valor da NF'); return }
    if (!dataVencimento) { setError('Vencimento é obrigatório (RN-21)'); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/acordos/${acordo.id}/nfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_nf: numeroNf,
          valor: Number(valor),
          data_emissao: dataEmissao,
          data_vencimento: dataVencimento,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao lançar NF'); return }
      resetForm()
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
      title={`Lançar NF — ${acordo.numero} · ${acordo.cliente.nome}`}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Lançar NF'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3 text-[11px]">
        <span className="text-gray-400">Saldo disponível: </span>
        <span className="font-bold text-green-primary">{formatCurrency(acordo.saldo)}</span>
        <span className="text-gray-300 mx-2">|</span>
        <span className="text-gray-400">Contrato: </span>
        <span className="font-semibold">{formatCurrency(acordo.valor_total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Número da NF" className="col-span-2">
          <Input
            placeholder="Ex: 000123456"
            value={numeroNf}
            onChange={(e) => setNumeroNf(e.target.value)}
          />
        </Field>

        <Field label="Valor (R$)">
          <Input
            type="number"
            placeholder="Ex: 250000"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          {valor && Number(valor) > 0 && (
            <p className="text-[10px] text-auto-value mt-0.5">{formatCurrency(Number(valor))}</p>
          )}
        </Field>

        <Field label="Data de emissão">
          <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
        </Field>

        <Field label="Data de vencimento *" className="col-span-2">
          <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-0.5">Obrigatório (RN-21)</p>
        </Field>
      </div>
    </Modal>
  )
}

