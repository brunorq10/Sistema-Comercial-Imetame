'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import type { SubIndiceItem, ContratoItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  contrato: ContratoItem
  subindice: SubIndiceItem
}

export function LancarNFContratoModal({ open, onClose, onSuccess, contrato, subindice }: Props) {
  const [numeroNF, setNumeroNF] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [percentual, setPercentual] = useState('100')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valorAtribuido = valorTotal && percentual
    ? (Number(valorTotal) * Number(percentual)) / 100
    : 0

  useEffect(() => {
    if (open) {
      setNumeroNF(''); setDataEmissao(''); setDataVencimento('')
      setValorTotal(''); setPercentual('100'); setError(null)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!numeroNF.trim()) { setError('Número da NF obrigatório'); return }
    if (!dataEmissao) { setError('Data de emissão obrigatória'); return }
    if (!dataVencimento) { setError('Data de vencimento obrigatória'); return }
    if (!valorTotal || Number(valorTotal) <= 0) { setError('Valor total inválido'); return }
    if (!percentual || Number(percentual) <= 0 || Number(percentual) > 100) { setError('Percentual deve estar entre 0,01 e 100'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/faturamento/subindices/${subindice.id}/nfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_nf: numeroNF,
          valor_total_nf: Number(valorTotal),
          percentual: Number(percentual),
          data_emissao: dataEmissao,
          data_vencimento: dataVencimento,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao lançar NF'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  const indiceSubindice = `${contrato.indice}.${subindice.ordem}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Lançar NF — ${indiceSubindice}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Lançando...' : 'Lançar NF'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* Bloco somente leitura com dados do sub-índice */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <p className="text-[9px] text-gray-400 uppercase">Índice</p>
          <p className="text-[12px] font-bold text-green-dark">{indiceSubindice}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase">Cliente</p>
          <p className="text-[12px] font-medium">{contrato.cliente.nome}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase">Nº OS</p>
          <p className="text-[12px]">{contrato.num_os ?? '—'}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase">Evento de medição</p>
          <p className="text-[12px]">{subindice.descricao}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase">Valor do evento</p>
          <p className="text-[12px] font-semibold">{formatCurrency(subindice.valor_total)}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase">Já faturado</p>
          <p className="text-[12px] font-semibold text-auto-value">{formatCurrency(subindice.total_faturado)}</p>
        </div>
      </div>

      <ModalSection>Dados da nota fiscal</ModalSection>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Número da NF *" className="col-span-2">
          <Input placeholder="Ex: 000123" value={numeroNF} onChange={(e) => setNumeroNF(e.target.value)} />
        </Field>
        <Field label="Data de emissão *">
          <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
        </Field>
        <Field label="Data de vencimento *">
          <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
        </Field>
        <Field label="Valor total da NF (R$) *">
          <Input
            type="number" min="0.01" step="0.01" placeholder="0,00"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
          />
        </Field>
        <Field label="% referente a este item">
          <Input
            type="number" min="0.01" max="100" step="0.01" placeholder="100"
            value={percentual}
            onChange={(e) => setPercentual(e.target.value)}
          />
        </Field>
      </div>

      {/* Valor atribuído calculado em tempo real */}
      <div className="bg-auto-bg border border-auto-value/30 rounded-md p-3 mb-2">
        <p className="text-[10px] text-auto-value font-semibold uppercase tracking-wide mb-0.5">
          Valor atribuído a este item
        </p>
        <p className="text-[18px] font-bold text-auto-value">{formatCurrency(valorAtribuido)}</p>
      </div>

      {Number(percentual) < 100 && Number(percentual) > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded">
          ⚠ O percentual restante ({(100 - Number(percentual)).toFixed(2)}%) deve ser lançado em outro item.
        </div>
      )}
    </Modal>
  )
}
