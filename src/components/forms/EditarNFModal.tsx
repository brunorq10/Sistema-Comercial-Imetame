'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
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
  const [enviadoAprovacao, setEnviadoAprovacao] = useState(false)

  // Mesmo alerta de duplicidade/percentual já alocado do lançamento (Lançar
  // Faturamento) — aqui exclui o próprio registro do total, senão ele contaria
  // contra si mesmo.
  const [nfAlocado, setNfAlocado] = useState<number | null>(null)
  const [nfValorExistente, setNfValorExistente] = useState<number | null>(null)

  const checarNumeroNF = async (numero: string) => {
    if (!numero.trim()) { setNfAlocado(null); setNfValorExistente(null); return }
    try {
      const res = await fetch(`/api/faturamento/nfs/percentual-total?numero_nf=${encodeURIComponent(numero.trim())}&excluir_id=${nf.id}`)
      if (res.ok) {
        const json = await res.json()
        setNfAlocado(Number(json.data?.total ?? 0))
        setNfValorExistente(json.data?.valor_total_nf != null ? Number(json.data.valor_total_nf) : null)
      }
    } catch { /* silencia — não bloqueia a edição */ }
  }

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
    setEnviadoAprovacao(false)
    setNfAlocado(null); setNfValorExistente(null)
    checarNumeroNF(nf.numero_nf)
  }, [open, nf])

  // Carrega subitems
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoadingSubs(true)
    fetch('/api/faturamento/subindices', { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        setSubitems(j.data ?? [])
        setLoadingSubs(false)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setLoadingSubs(false)
      })
    return () => controller.abort()
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
      // Edição de NF já ativa: a proposta fica em análise da coordenação — os
      // dados atuais continuam contando no faturamento até a aprovação.
      if (json.pendente) { setEnviadoAprovacao(true); onSuccess(); return }
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
      title={`Editar NF · ${nf.numero_nf}`}
      wide
      footer={
        enviadoAprovacao ? (
          <ModalCancelButton label="Fechar" />
        ) : (
          <>
            <ModalCancelButton disabled={loading} />
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </>
        )
      }
    >
      {enviadoAprovacao ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center my-2">
          <p className="text-[28px] mb-1">✅</p>
          <p className="text-[13px] font-semibold text-green-800">Edição enviada para aprovação</p>
          <p className="text-[11px] text-green-700 mt-1">
            A NF <strong>{nf.numero_nf}</strong> continua no faturamento com os dados atuais.
            As alterações <strong>só passam a valer após a aprovação</strong> da coordenação de Acordos.
          </p>
        </div>
      ) : (
        <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <ModalSection>1. Identificação</ModalSection>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Field label="Nº NF" className="col-span-1">
          <Input
            value={numeroNF}
            onChange={(e) => { setNumeroNF(e.target.value); setNfAlocado(null); setNfValorExistente(null) }}
            onBlur={() => checarNumeroNF(numeroNF)}
            placeholder="Ex: 000123"
          />
          {(nfAlocado !== null && nfAlocado > 0) && (
            <p className={`text-[10px] mt-1 ${nfAlocado >= 100 ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
              {nfAlocado >= 100
                ? `NF ${numeroNF} já tem 100% alocados em outros itens.`
                : `NF ${numeroNF} já possui ${nfAlocado.toFixed(2)}% alocados em outros itens. Disponível: ${(100 - nfAlocado).toFixed(2)}%`}
              {nfValorExistente != null && ` · Valor total já lançado: ${formatCurrency(nfValorExistente)}`}
            </p>
          )}
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

      {numPercentual < 100 && numPercentual > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded mb-4">
          ⚠ O percentual restante ({(100 - numPercentual).toFixed(2)}%) deve ser lançado em outro item.
        </div>
      )}

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
        </>
      )}
    </Modal>
  )
}

