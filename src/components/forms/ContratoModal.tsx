'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, CurrencyInput } from '@/components/ui/Input'
import type { ContratoItem } from '@/types'
import { CLASSIFICACAO_LABELS, RAMO_ATUACAO_LABELS } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

interface SubIndiceYearSection {
  valor_total: string
  meses: Record<string, string>
}

interface SubIndiceForm {
  descricao: string
  data_inicio: string
  data_fim: string
  comentarios: string
  anos: Record<number, SubIndiceYearSection>
}

function emptySection(): SubIndiceYearSection {
  return { valor_total: '', meses: Object.fromEntries(MESES.map((m) => [m, ''])) }
}

function emptySubindice(defaultAno: number): SubIndiceForm {
  return { descricao: '', data_inicio: '', data_fim: '', comentarios: '', anos: { [defaultAno]: emptySection() } }
}

function getAnosFromDates(inicio: string, fim: string, fallback: number): number[] {
  if (!inicio || !fim) return [fallback]
  const a1 = parseInt(inicio.split('-')[0], 10)
  const a2 = parseInt(fim.split('-')[0], 10)
  if (isNaN(a1) || isNaN(a2) || a1 > a2) return [isNaN(a1) ? fallback : a1]
  return Array.from({ length: a2 - a1 + 1 }, (_, i) => a1 + i)
}

function isMesAtivo(ano: number, mesIdx: number, inicio: string, fim: string): boolean {
  if (!inicio || !fim) return true
  const mesNum = mesIdx + 1
  const [iniY, iniM] = inicio.split('-').map(Number)
  const [fimY, fimM] = fim.split('-').map(Number)
  if (ano > fimY || ano < iniY) return false
  if (ano === fimY && mesNum > fimM) return false
  if (ano === iniY && mesNum < iniM) return false
  return true
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

  const [clientes, setClientes] = useState<{ id: number; nome: string; ramo_atuacao?: string | null }[]>([])
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
  const [classificacao, setClassificacao] = useState('')
  const [valorContrato, setValorContrato] = useState('')
  const [subindices, setSubindices] = useState<SubIndiceForm[]>([emptySubindice(anoAtual)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setClassificacao(editando.classificacao ?? '')
      setValorContrato(editando.valor_contrato ? String(editando.valor_contrato) : '')
      setSubindices(editando.subindices.map((s) => {
        const ano = s.data_inicio
          ? parseInt(s.data_inicio.substring(0, 4), 10)
          : editando.ano_referencia
        return {
          descricao: s.descricao,
          data_inicio: s.data_inicio ? s.data_inicio.substring(0, 10) : '',
          data_fim: s.data_fim ? s.data_fim.substring(0, 10) : '',
          comentarios: s.comentarios ?? '',
          anos: {
            [ano]: {
              valor_total: String(s.valor_total),
              meses: Object.fromEntries(MESES.map((m) => [m, s[m] != null ? String(s[m]) : ''])),
            },
          },
        }
      }))
    } else {
      setAnoRef(String(anoAtual)); setStatus('A_FATURAR'); setClienteId('')
      setNumOs(''); setNumAcordo(''); setNumProposta(''); setResponsavelId('')
      setDataInicio(''); setDataFim(''); setDescricao(''); setClassificacao(''); setValorContrato('')
      setSubindices([emptySubindice(anoAtual)])
    }
    setError(null)
  }, [open, editando, anoAtual])

  const addSubindice = () =>
    setSubindices((prev) => [...prev, emptySubindice(Number(anoRef))])

  const removeSubindice = (i: number) =>
    setSubindices((prev) => prev.filter((_, idx) => idx !== i))

  const updateSubindice = (i: number, field: keyof Omit<SubIndiceForm, 'anos'>, value: string) =>
    setSubindices((prev) => prev.map((s, idx) => {
      if (idx !== i) return s
      const updated = { ...s, [field]: value }
      if (field === 'data_inicio' || field === 'data_fim') {
        const inicio = field === 'data_inicio' ? value : s.data_inicio
        const fim = field === 'data_fim' ? value : s.data_fim
        const newAnos = getAnosFromDates(inicio, fim, Number(anoRef))
        const novosAnosMap: Record<number, SubIndiceYearSection> = {}
        for (const ano of newAnos) novosAnosMap[ano] = s.anos[ano] ?? emptySection()
        return { ...updated, anos: novosAnosMap }
      }
      return updated
    }))

  const updateAnoField = (i: number, ano: number, value: string) =>
    setSubindices((prev) => prev.map((s, idx) =>
      idx !== i ? s : { ...s, anos: { ...s.anos, [ano]: { ...s.anos[ano], valor_total: value } } }
    ))

  const updateMes = (i: number, ano: number, mes: string, value: string) =>
    setSubindices((prev) => prev.map((s, idx) =>
      idx !== i ? s : {
        ...s,
        anos: { ...s.anos, [ano]: { ...s.anos[ano], meses: { ...s.anos[ano]?.meses, [mes]: value } } },
      }
    ))

  const handleSubmit = async () => {
    if (!clienteId) { setError('Selecione o cliente'); return }
    if (!anoRef) { setError('Ano de referência obrigatório'); return }
    for (let i = 0; i < subindices.length; i++) {
      const s = subindices[i]
      if (!s.descricao.trim()) { setError(`Evento ${i + 1}: descrição obrigatória`); return }
      const anos = getAnosFromDates(s.data_inicio, s.data_fim, Number(anoRef))
      for (const ano of anos) {
        const vt = s.anos[ano]?.valor_total
        if (!vt || isNaN(Number(vt))) {
          setError(`Evento ${i + 1}: valor total inválido para ${ano}`); return
        }
      }
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
        classificacao: classificacao || undefined,
        valor_contrato: valorContrato ? Number(valorContrato) : undefined,
        subindices: subindices.flatMap((s) => {
          const anos = getAnosFromDates(s.data_inicio, s.data_fim, Number(anoRef))
          return anos.map((ano, idx) => {
            const section = s.anos[ano] ?? emptySection()
            const isFirst = idx === 0
            const isLast = idx === anos.length - 1
            return {
              descricao: s.descricao,
              valor_total: Number(section.valor_total) || 0,
              data_inicio: isFirst && s.data_inicio ? s.data_inicio : `${ano}-01-01`,
              data_fim: isLast && s.data_fim ? s.data_fim : `${ano}-12-31`,
              comentarios: s.comentarios || undefined,
              ...Object.fromEntries(
                MESES.map((m) => [m, section.meses[m] ? Number(section.meses[m]) : undefined])
              ),
            }
          })
        }),
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

      <ModalSection>1. Dados cadastrais</ModalSection>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Índice (automático)">
          <div className="border border-gray-200 bg-green-light rounded px-2.5 py-[5px] text-[12px] font-bold text-green-dark text-center">
            {isEdit ? editando!.indice : 'CT-???'}
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

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Classificação">
          <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value)}>
            <option value="">Selecione...</option>
            {(Object.entries(CLASSIFICACAO_LABELS) as [string, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Ramo de atuação (do cliente)">
          <div className="border border-gray-200 bg-gray-50 rounded px-2.5 py-[5px] text-[12px] text-gray-500 min-h-[30px]">
            {clienteId
              ? (RAMO_ATUACAO_LABELS[(clientes.find((c) => String(c.id) === clienteId)?.ramo_atuacao ?? '') as keyof typeof RAMO_ATUACAO_LABELS] ?? '—')
              : <span className="text-gray-300">Selecione o cliente</span>}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Nº Acordo">
          <Input placeholder="Ex: AC-2024-091" value={numAcordo} onChange={(e) => setNumAcordo(e.target.value)} />
        </Field>
        <Field label="Nº Proposta">
          <Input placeholder="Ex: PROP-0848" value={numProposta} onChange={(e) => setNumProposta(e.target.value)} />
        </Field>
        <Field label="Valor total do contrato (R$)">
          <CurrencyInput value={valorContrato} onChange={setValorContrato} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Responsável">
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Selecione...</option>
            {responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        </Field>
        <Field label="Data de início">
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </Field>
        <Field label="Data de fim">
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </Field>
      </div>

      <Field label="Descrição — Serviço" className="mb-4">
        <textarea
          className="w-full border border-gray-300 rounded px-2.5 py-[5px] text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-green-primary/40"
          rows={2}
          placeholder="Descreva o escopo..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </Field>

      <ModalSection>2. Eventos de medição <span className="text-gray-400 font-normal text-[10px]">(valores mensais opcionais)</span></ModalSection>

      <div className="space-y-3">
        {subindices.map((s, i) => (
          <SubindiceCard
            key={i}
            indiceBase={isEdit ? editando!.indice : 'CT-???'}
            ordem={i + 1}
            anoRef={Number(anoRef)}
            data={s}
            onUpdate={(field, val) => updateSubindice(i, field, val)}
            onUpdateAno={(ano, val) => updateAnoField(i, ano, val)}
            onUpdateMes={(ano, mes, val) => updateMes(i, ano, mes, val)}
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
  anoRef: number
  data: SubIndiceForm
  onUpdate: (field: keyof Omit<SubIndiceForm, 'anos'>, val: string) => void
  onUpdateAno: (ano: number, val: string) => void
  onUpdateMes: (ano: number, mes: string, val: string) => void
  onRemove?: () => void
}

function SubindiceCard({ indiceBase, ordem, anoRef, data, onUpdate, onUpdateAno, onUpdateMes, onRemove }: SubindiceCardProps) {
  const anos = getAnosFromDates(data.data_inicio, data.data_fim, anoRef)
  const multiAno = anos.length > 1

  return (
    <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-bold text-green-dark">{indiceBase}.{ordem}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-[14px] leading-none">×</button>
        )}
      </div>

      <div className={`grid gap-2 mb-2 ${multiAno ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <Field label="Descrição / Evento">
          <Input placeholder="Ex: Mobilização" value={data.descricao} onChange={(e) => onUpdate('descricao', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
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

      {multiAno && (
        <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-3">
          ⚡ Período abrange {anos.length} anos. Preencha a previsão e o valor para cada ano separadamente.
        </div>
      )}

      {anos.map((ano) => (
        <div
          key={ano}
          className={multiAno ? 'border border-green-primary/30 rounded-md p-2.5 mb-2.5 bg-white' : ''}
        >
          {multiAno && (
            <p className="text-[11px] font-bold text-green-dark mb-2.5 border-b border-green-primary/20 pb-1.5">
              Previsão {ano}
            </p>
          )}

          <div className="mb-2.5">
            <Field label="Valor Total (R$)">
              <CurrencyInput
                value={data.anos[ano]?.valor_total ?? ''}
                onChange={(v) => onUpdateAno(ano, v)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {MESES.map((m, mi) => {
              const ativo = isMesAtivo(ano, mi, data.data_inicio, data.data_fim)
              return (
                <div key={m}>
                  <p className={`text-[9px] uppercase text-center mb-0.5 ${ativo ? 'text-gray-400' : 'text-gray-200'}`}>
                    {MESES_LABELS[mi]}
                  </p>
                  <CurrencyInput
                    value={data.anos[ano]?.meses[m] ?? ''}
                    onChange={(v) => onUpdateMes(ano, m, v)}
                    disabled={!ativo}
                    className={`text-center px-1.5 py-[3px] text-[11px] ${
                      ativo
                        ? ''
                        : 'border-gray-100 bg-gray-50 text-gray-200 cursor-not-allowed'
                    }`}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
