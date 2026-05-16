'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, AutoInput } from '@/components/ui/Input'
import { CurrencyInput } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import type { NFContratoListItem } from '@/types'

interface SubitemOpcao {
  id: number
  ordem: number
  descricao: string
  contrato: { id: number; indice: string; cliente: { nome: string } }
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  nf: NFContratoListItem
}

export function EditarNFModal({ open, onClose, onSuccess, nf }: Props) {
  const [numeroNF, setNumeroNF]       = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataVenc, setDataVenc]       = useState('')
  const [valorTotal, setValorTotal]   = useState('')
  const [percentual, setPercentual]   = useState('')
  const [subindiceId, setSubindiceId] = useState('')

  const [subitems, setSubitems] = useState<SubitemOpcao[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Preenche form ao abrir
  useEffect(() => {
    if (!open) return
    setNumeroNF(nf.numero_nf)
    setDataEmissao(nf.data_emissao.substring(0, 10))
    setDataVenc(nf.data_vencimento.substring(0, 10))
    setValorTotal(String(nf.valor_total_nf))
    setPercentual(String(nf.percentual))
    setSubindiceId(String(nf.subindice.id))
    setError(null)
  }, [open, nf])

  // Carrega subitems
  useEffect(() => {
    if (!open) return
    setLoadingSubs(true)
    fetch('/api/faturamento/subindices')
      .then((r) => r.json())
      .then((j) => setSubitems(j.data ?? []))
      .finally(() => setLoadingSubs(false))
  }, [open])

  const numValorTotal = Number(valorTotal) || 0
  const numPercentual = Number(percentual) || 0
  const valorAtribuido = numValorTotal > 0 && numPercentual > 0
    ? (numValorTotal * numPercentual) / 100
    : 0

  // Agrupa subitems por contrato para o <select>
  const grupos = subitems.reduce<Record<string, { label: string; items: SubitemOpcao[] }>>((acc, s) => {
    const key = String(s.contrato.id)
    if (!acc[key]) acc[key] = { label: `${s.contrato.indice} — ${s.contrato.cliente.nome}`, items: [] }
    acc[key].items.push(s)
    return acc
  }, {})

  const handleSubmit = async () => {
    if (!numeroNF.trim()) { setError('Informe o número da NF'); return }
    if (!dataEmissao)     { setError('Data de emissão obrigatória'); return }
    if (!dataVenc)        { setError('Data de vencimento obrigatória'); return }
    if (numValorTotal <= 0) { setError('Valor Total NF inválido'); return }
    if (numPercentual <= 0 || numPercentual > 100) { setError('Percentual deve ser entre 0,01 e 100'); return }
    if (!subindiceId)     { setError('Selecione o sub-item'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/faturamento/nfs/${nf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_nf:     numeroNF.trim(),
          valor_total_nf: numValorTotal,
          percentual:    numPercentual,
          data_emissao:  dataEmissao,
          data_vencimento: dataVenc,
          subindice_id:  Number(subindiceId),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar NF · ${nf.numero_nf}`}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <ModalSection>1. Identificação</ModalSection>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Field label="Nº NF" className="col-span-1">
          <Input value={numeroNF} onChange={(e) => setNumeroNF(e.target.value)} placeholder="Ex: 000123" />
        </Field>
        <Field label="Data de emissão">
          <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
        </Field>
        <Field label="Data de vencimento">
          <Input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} />
        </Field>
      </div>

      <ModalSection>2. Valores</ModalSection>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Field label="Valor Total NF (R$)">
          <CurrencyInput value={valorTotal} onChange={setValorTotal} />
        </Field>
        <Field label="% Atribuído a este sub-item">
          <Input
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={percentual}
            onChange={(e) => setPercentual(e.target.value)}
            placeholder="100"
          />
        </Field>
        <Field label="Valor Faturado (calculado)">
          <AutoInput value={valorAtribuido > 0 ? formatCurrency(valorAtribuido) : '—'} />
        </Field>
      </div>

      <ModalSection>3. Sub-item de referência</ModalSection>
      <Field label="Sub-item do contrato">
        {loadingSubs ? (
          <p className="text-[11px] text-gray-400 py-1">Carregando subitems...</p>
        ) : (
          <Select value={subindiceId} onChange={(e) => setSubindiceId(e.target.value)}>
            <option value="">Selecione...</option>
            {Object.values(grupos).map((grupo) => (
              <optgroup key={grupo.label} label={grupo.label}>
                {grupo.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.contrato.indice}.{s.ordem} — {s.descricao}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
      </Field>

      {subindiceId !== String(nf.subindice.id) && (
        <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded">
          ⚠ O sub-item foi alterado. O valor faturado será movido do sub-item anterior para o novo.
        </div>
      )}
    </Modal>
  )
}
