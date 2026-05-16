'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import type { AcordoListItem } from '@/types'

interface Cliente {
  id: number
  nome: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editando?: AcordoListItem | null
}

export function AcordoModal({ open, onClose, onSuccess, editando }: Props) {
  const isEdit = !!editando

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [valorAnosSeguintes, setValorAnosSeguintes] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/clientes').then((r) => r.json()).then((j) => setClientes(j.data ?? []))
  }, [open])

  useEffect(() => {
    if (open && editando) {
      setClienteId(String(editando.cliente.id))
      setDescricao(editando.descricao ?? '')
      setValorTotal(String(editando.valor_total))
      setAno(String(editando.ano))
      setValorAnosSeguintes(editando.valor_anos_seguintes != null ? String(editando.valor_anos_seguintes) : '')
      setDataInicio(editando.data_inicio ? editando.data_inicio.split('T')[0] : '')
      setDataFim(editando.data_fim ? editando.data_fim.split('T')[0] : '')
    }
    if (open && !editando) {
      setClienteId(''); setDescricao(''); setValorTotal('')
      setAno(String(new Date().getFullYear())); setValorAnosSeguintes('')
      setDataInicio(''); setDataFim('')
    }
  }, [open, editando])

  const handleSubmit = async () => {
    if (!isEdit && !clienteId) { setError('Selecione o cliente'); return }
    if (!valorTotal || Number(valorTotal) <= 0) { setError('Informe o valor total'); return }
    if (!ano) { setError('Informe o ano'); return }

    setLoading(true)
    setError(null)
    try {
      const url = isEdit ? `/api/acordos/${editando!.id}` : '/api/acordos'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: Number(clienteId),
          descricao: descricao || undefined,
          valor_total: Number(valorTotal),
          ano: Number(ano),
          valor_anos_seguintes: valorAnosSeguintes ? Number(valorAnosSeguintes) : undefined,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
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
      title={isEdit ? `Editar Acordo · ${editando!.numero}` : 'Novo Acordo'}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Acordo'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Cliente" className="col-span-2">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} disabled={isEdit}>
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Field>

        <Field label="Descrição / Escopo" className="col-span-2">
          <Input
            placeholder="Ex: Manutenção mecânica 2026"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Field>

        <Field label="Valor Total do Contrato (R$)">
          <Input
            type="number"
            placeholder="Ex: 5000000"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
          />
          {valorTotal && Number(valorTotal) > 0 && (
            <p className="text-[10px] text-auto-value mt-0.5">{formatCurrency(Number(valorTotal))}</p>
          )}
        </Field>

        <Field label="Ano de vigência">
          <Input
            type="number"
            placeholder="Ex: 2026"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
          />
        </Field>

        <Field label="Prev. Anos Seguintes (R$) — opcional">
          <Input
            type="number"
            placeholder="Ex: 3000000"
            value={valorAnosSeguintes}
            onChange={(e) => setValorAnosSeguintes(e.target.value)}
          />
          {valorAnosSeguintes && Number(valorAnosSeguintes) > 0 && (
            <p className="text-[10px] text-[#6A1B9A] mt-0.5">{formatCurrency(Number(valorAnosSeguintes))}</p>
          )}
        </Field>

        <div />

        <Field label="Data de início">
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </Field>
        <Field label="Data de fim">
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
