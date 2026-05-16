'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import type { ContratoItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

interface SubIndiceForm {
  descricao: string
  valor_total: string
  data_inicio: string
  data_fim: string
  comentarios: string
  meses: Record<string, string>
}

function emptySubindice(): SubIndiceForm {
  return {
    descricao: '', valor_total: '', data_inicio: '', data_fim: '', comentarios: '',
    meses: Object.fromEntries(MESES.map((m) => [m, ''])),
  }
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editando?: ContratoItem | null
}

export function ContratoModal({ open, onClose, onSuccess, editando }: Props) {
  const isEdit = !!editando
  const anoAtual = new Date().getFullYear()

  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: number; nome: string }[]>([])

  const [anoRef, setAnoRef] = useState(String(anoAtual))
  const [status, setStatus] = useState('A_FATURAR')
  const [clienteId, setClienteId] = useState('')
  const [numOs, setNumOs] = useState('')
  const [numAcordo, setNumAcordo] = useState('')
  const [numProposta, setNumProposta] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [descricao, setDescricao] = useState('')
  const [subindices, setSubindices] = useState<SubIndiceForm[]>([emptySubindice()])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anoFimUltrapassaAno = dataFim ? new Date(dataFim).getFullYear() > Number(anoRef) : false

  useEffect(() => {
    fetch('/api/clientes').then((r) => r.json()).then((j) => setClientes(j.data ?? []))
    fetch('/api/users/acordos').then((r) => r.json()).then((j) => setResponsaveis(j.data ?? []))
  }, [])

  useEffect(() => {
    if (!open) return
    if (editando) {
      setAnoRef(String(editando.ano_referencia))
      setStatus(editando.status)
      setClienteId(String(editando.cliente.id))
      setNumOs(editando.num_os ?? '')
      setNumAcordo(editando.num_acordo ?? '')
      setNumProposta(editando.num_proposta ?? '')
      setResponsavelId(editando.responsavel ? String(editando.responsavel.id) : '')
      setDataInicio(editando.data_inicio ? editando.data_inicio.substring(0, 10) : '')
      setDataFim(editando.data_fim ? editando.data_fim.substring(0, 10) : '')
      setDescricao(editando.descricao ?? '')
      setSubindices(editando.subindices.map((s) => ({
        descricao: s.descricao,
        valor_total: String(s.valor_total),
        data_inicio: s.data_inicio ? s.data_inicio.substring(0, 10) : '',
        data_fim: s.data_fim ? s.data_fim.substring(0, 10) : '',
        comentarios: s.comentarios ?? '',
        meses: Object.fromEntries(MESES.map((m) => [m, s[m] != null ? String(s[m]) : ''])),
      })))
    } else {
      setAnoRef(String(anoAtual)); setStatus('A_FATURAR'); setClienteId('')
      setNumOs(''); setNumAcordo(''); setNumProposta(''); setResponsavelId('')
      setDataInicio(''); setDataFim(''); setDescricao('')
      setSubindices([emptySubindice()])
    }
    setError(null)
  }, [open, editando, anoAtual])

  const addSubindice = () => setSubindices((prev) => [...prev, emptySubindice()])
  const removeSubindice = (i: number) => setSubindices((prev) => prev.filter((_, idx) => idx !== i))
  const updateSubindice = (i: number, field: keyof SubIndiceForm, value: string) =>
    setSubindices((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  const updateMes = (i: number, mes: string, value: string) =>
    setSubindices((prev) => prev.map((s, idx) => idx === i ? { ...s, meses: { ...s.meses, [mes]: value } } : s))

  const nextIndice = isEdit ? editando!.indice : `CT-???`

  const handleSubmit = async () => {
    if (!clienteId) { setError('Selecione o cliente'); return }
    if (!anoRef) { setError('Ano de referência obrigatório'); return }
    for (let i = 0; i < subindices.length; i++) {
      const s = subindices[i]
      if (!s.descricao.trim()) { setError(`Evento ${i + 1}: descrição obrigatória`); return }
      if (!s.valor_total || isNaN(Number(s.valor_total))) { setError(`Evento ${i + 1}: valor total inválido`); return }
    }

    setLoading(true); setError(null)
    try {
      const body = {
        ano_referencia: Number(anoRef),
        status,
        cliente_id: Number(clienteId),
        num_os: numOs || undefined,
        num_acordo: numAcordo || undefined,
        num_proposta: numProposta || undefined,
        responsavel_id: responsavelId ? Number(responsavelId) : undefined,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        descricao: descricao || undefined,
        subindices: subindices.map((s) => ({
          descricao: s.descricao,
          valor_total: Number(s.valor_total),
          data_inicio: s.data_inicio || undefined,
          data_fim: s.data_fim || undefined,
          comentarios: s.comentarios || undefined,
          ...Object.fromEntries(MESES.map((m) => [m, s.meses[m] ? Number(s.meses[m]) : undefined])),
        })),
      }

      const url = isEdit ? `/api/faturamento/contratos/${editando!.id}` : '/api/faturamento/contratos'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Editar Contrato · ${editando!.indice}` : 'Novo Lançamento — Contrato'}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar contrato'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* Seção 1 — Dados cadastrais */}
      <ModalSection>1. Dados cadastrais</ModalSection>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Índice (automático)">
          <div className="border border-gray-200 bg-green-light rounded px-2.5 py-[5px] text-[12px] font-bold text-green-dark text-center">
            {isEdit ? editando!.indice : nextIndice}
          </div>
        </Field>
        <Field label="Ano referência">
          <Select value={anoRef} onChange={(e) => setAnoRef(e.target.value)}>
            {Array.from({ length: 8 }, (_, i) => anoAtual - 1 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="A_FATURAR">A faturar</option>
            <option value="FATURADO">Faturado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="CANCELADO">Cancelado</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Cliente">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Nº OS">
          <Input placeholder="Ex: OS-00443" value={numOs} onChange={(e) => setNumOs(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Nº Acordo">
          <Input placeholder="Ex: AC-2024-091" value={numAcordo} onChange={(e) => setNumAcordo(e.target.value)} />
        </Field>
        <Field label="Nº Proposta">
          <Input placeholder="Ex: PROP-0848" value={numProposta} onChange={(e) => setNumProposta(e.target.value)} />
        </Field>
        <Field label="Responsável">
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Selecione...</option>
            {responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Data de início">
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </Field>
        <Field label="Data de fim">
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </Field>
      </div>

      {anoFimUltrapassaAno && (
        <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-2.5">
          ⚡ Data de fim ultrapassa {anoRef}. O sistema criará automaticamente uma linha para o ano seguinte ao salvar.
        </div>
      )}

      <Field label="Descrição — Serviço" className="mb-4">
        <textarea
          className="w-full border border-gray-300 rounded px-2.5 py-[5px] text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-green-primary/40"
          rows={2}
          placeholder="Descreva o escopo..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </Field>

      {/* Seção 2 — Eventos de medição */}
      <ModalSection>2. Eventos de medição <span className="text-gray-400 font-normal text-[10px]">(valores mensais opcionais)</span></ModalSection>

      <div className="space-y-3">
        {subindices.map((s, i) => (
          <SubindiceCard
            key={i}
            indiceBase={isEdit ? editando!.indice : 'CT-???'}
            ordem={i + 1}
            data={s}
            onUpdate={(field, val) => updateSubindice(i, field, val)}
            onUpdateMes={(mes, val) => updateMes(i, mes, val)}
            onRemove={subindices.length > 1 ? () => removeSubindice(i) : undefined}
          />
        ))}
      </div>

      <button
        onClick={addSubindice}
        className="mt-3 w-full border border-dashed border-green-primary text-green-primary text-[12px] py-2 rounded hover:bg-green-light transition-colors"
      >
        + Adicionar evento de medição
      </button>
    </Modal>
  )
}

interface SubindiceCardProps {
  indiceBase: string
  ordem: number
  data: SubIndiceForm
  onUpdate: (field: keyof SubIndiceForm, val: string) => void
  onUpdateMes: (mes: string, val: string) => void
  onRemove?: () => void
}

function SubindiceCard({ indiceBase, ordem, data, onUpdate, onUpdateMes, onRemove }: SubindiceCardProps) {
  return (
    <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-bold text-green-dark">{indiceBase}.{ordem}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-[14px] leading-none">×</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Descrição / Evento">
          <Input placeholder="Ex: Mobilização" value={data.descricao} onChange={(e) => onUpdate('descricao', e.target.value)} />
        </Field>
        <Field label="Valor Total (R$)">
          <Input
            type="number" min="0" step="0.01" placeholder="0,00"
            value={data.valor_total}
            onChange={(e) => onUpdate('valor_total', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <Field label="Período — De">
          <Input type="date" value={data.data_inicio} onChange={(e) => onUpdate('data_inicio', e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={data.data_fim} onChange={(e) => onUpdate('data_fim', e.target.value)} />
        </Field>
        <Field label="Comentários">
          <Input placeholder="Obs..." value={data.comentarios} onChange={(e) => onUpdate('comentarios', e.target.value)} />
        </Field>
      </div>

      {/* Grade mensal */}
      <div className="grid grid-cols-6 gap-1">
        {MESES.map((m, idx) => (
          <div key={m}>
            <p className="text-[9px] text-gray-400 uppercase text-center mb-0.5">{MESES_LABELS[idx]}</p>
            <input
              type="number" min="0" step="0.01"
              placeholder="—"
              value={data.meses[m]}
              onChange={(e) => onUpdateMes(m, e.target.value)}
              className="w-full border border-gray-300 rounded px-1.5 py-[3px] text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-green-primary/40"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
