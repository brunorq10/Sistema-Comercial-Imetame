'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, CurrencyInput } from '@/components/ui/Input'
import { todayInput } from '@/lib/utils'
import { TIPOS_MULTA } from '@/lib/multas'

export interface MultaEdit {
  id: number
  tipo: string
  descricao: string
  data_ocorrencia: string
  data_notificacao_cliente: string | null
  data_desconto: string | null
  valor_total: number
}

interface Props {
  contratoId: number
  editando?: MultaEdit | null
  onSaved: () => void
  onCancel: () => void
}

const isoToInput = (s: string | null) => (s ? s.slice(0, 10) : '')

export function MultaForm({ contratoId, editando, onSaved, onCancel }: Props) {
  const [tipo, setTipo] = useState(editando?.tipo ?? '')
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [dataOcorrencia, setDataOcorrencia] = useState(editando ? isoToInput(editando.data_ocorrencia) : todayInput())
  const [dataNotif, setDataNotif] = useState(editando ? isoToInput(editando.data_notificacao_cliente) : '')
  const [dataDesconto, setDataDesconto] = useState(editando ? isoToInput(editando.data_desconto) : '')
  const [valorTotal, setValorTotal] = useState(editando ? String(editando.valor_total) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!tipo) { setError('Selecione o tipo de lançamento'); return }
    if (!descricao.trim()) { setError('Informe a descrição do evento'); return }
    if (!dataOcorrencia) { setError('Informe a data da ocorrência'); return }
    if (!valorTotal || Number(valorTotal) <= 0) { setError('Valor total inválido'); return }

    setLoading(true); setError(null)
    const body = {
      tipo,
      descricao: descricao.trim(),
      data_ocorrencia: dataOcorrencia,
      data_notificacao_cliente: dataNotif || null,
      data_desconto: dataDesconto || null,
      valor_total: Number(valorTotal),
    }
    try {
      const url = editando
        ? `/api/faturamento/multas/${editando.id}`
        : `/api/faturamento/contratos/${contratoId}/multas`
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSaved()
    } finally { setLoading(false) }
  }

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Tipo de lançamento *</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {TIPOS_MULTA.map((t) => {
          const sel = tipo === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className="rounded-md px-3 py-1.5 text-[12px] font-semibold border transition-colors"
              style={sel
                ? { backgroundColor: t.cor, borderColor: t.cor, color: '#fff' }
                : { backgroundColor: '#fff', borderColor: '#D1D5DB', color: '#6B7280' }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <Field label="Descrição do evento *" className="mb-4">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="Descreva o evento que originou o lançamento..."
          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[11px] text-gray-900 focus:outline-none focus:border-green-primary resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <Field label="Data da ocorrência *">
          <Input type="date" value={dataOcorrencia} onChange={(e) => setDataOcorrencia(e.target.value)} />
        </Field>
        <Field label="Valor total (R$) *">
          <CurrencyInput value={valorTotal} onChange={setValorTotal} />
        </Field>
        <Field label="Data de notificação ao cliente">
          <Input type="date" value={dataNotif} onChange={(e) => setDataNotif(e.target.value)} />
        </Field>
        <Field label="Data do desconto">
          <Input type="date" value={dataDesconto} onChange={(e) => setDataDesconto(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : editando ? 'Salvar' : 'Lançar'}</Button>
      </div>
    </div>
  )
}
