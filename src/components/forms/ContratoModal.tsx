'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, CurrencyInput } from '@/components/ui/Input'
import { maskOS } from '@/lib/utils'
import type { ContratoItem } from '@/types'
import { CLASSIFICACAO_LABELS, RAMO_ATUACAO_LABELS } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface SubIndiceYearSection {
  meses: Record<string, string>
  id?: number   // id do sub-índice existente (cada ano = uma linha no banco)
}

interface SubIndiceForm {
  descricao: string
  num_os: string
  valor_total: string
  data_inicio: string
  data_fim: string
  comentarios: string
  anos: Record<number, SubIndiceYearSection>
}

function emptySection(): SubIndiceYearSection {
  return { meses: Object.fromEntries(MESES.map((m) => [m, ''])) }
}

function emptySubindice(defaultAno: number): SubIndiceForm {
  return { descricao: '', num_os: '', valor_total: '', data_inicio: '', data_fim: '', comentarios: '', anos: { [defaultAno]: emptySection() } }
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

  const [clientes, setClientes] = useState<{
    id: number
    nome: string
    ramo_atuacao?: string | null
    cidade: string | null
    estado: string | null
    segmento?: string | null
    filiais: { id: number; nome: string | null; cidade: string; estado: string }[]
  }[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: number; nome: string }[]>([])
  const [propostasCliente, setPropostasCliente] = useState<{ id: number; numero: string }[]>([])

  const [anoRef, setAnoRef] = useState(String(anoAtual))
  const [status, setStatus] = useState('A_FATURAR')
  const [clienteId, setClienteId] = useState('')
  const [clienteFinalId, setClienteFinalId] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [numAcordo, setNumAcordo] = useState('')
  const [numProposta, setNumProposta] = useState('')
  const [numOs, setNumOs] = useState('')   // OS a nível de contrato (item macro)
  const [responsavelId, setResponsavelId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [descricao, setDescricao] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [valorContrato, setValorContrato] = useState('')
  const [subindices, setSubindices] = useState<SubIndiceForm[]>([emptySubindice(anoAtual)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedRef = useRef(false)
  const savingDraftRef = useRef(false)
  const prevClienteFinalRef = useRef('')

  useEffect(() => {
    fetch('/api/clientes').then((r) => r.json()).then((j) => setClientes(j.data ?? []))
    fetch('/api/users/acordos').then((r) => r.json()).then((j) => setResponsaveis(j.data ?? []))
  }, [])

  // Ajuste 1: lista de propostas (Solicitacao.numero) do cliente selecionado, para vincular ao contrato
  useEffect(() => {
    if (!clienteId) { setPropostasCliente([]); return }
    fetch(`/api/solicitacoes?modo=autocomplete&cliente_id=${clienteId}`)
      .then((r) => r.json())
      .then((j) => setPropostasCliente((j.data ?? []).map((r: { id: number; numero: string }) => ({ id: r.id, numero: r.numero }))))
      .catch(() => setPropostasCliente([]))
  }, [clienteId])

  useEffect(() => {
    if (!open) return
    savedRef.current = false
    savingDraftRef.current = false
    if (editando) {
      const initCFId = editando.cliente_final ? String(editando.cliente_final.id) : ''
      prevClienteFinalRef.current = initCFId
      setAnoRef(String(editando.ano_referencia))
      setStatus(editando.status)
      setClienteId(String(editando.cliente.id))
      setClienteFinalId(initCFId)
      setCidade(editando.cidade ?? '')
      setEstado(editando.estado ?? '')
      setNumAcordo(editando.num_acordo ?? '')
      setNumProposta(editando.num_proposta ?? '')
      // OS no contrato; fallback p/ dados antigos que tinham OS no sub-índice
      setNumOs(editando.num_os ?? (editando.subindices?.find((s) => s.num_os)?.num_os ?? ''))
      setResponsavelId(editando.responsavel ? String(editando.responsavel.id) : '')
      setDataInicio(editando.data_inicio ? editando.data_inicio.substring(0, 10) : '')
      setDataFim(editando.data_fim ? editando.data_fim.substring(0, 10) : '')
      setDescricao(editando.descricao ?? '')
      setClassificacao(editando.classificacao ?? '')
      setValorContrato(editando.valor_contrato ? String(editando.valor_contrato) : '')
      // DB stores one row per year for multi-year events; group them back into one SubIndiceForm per logical event.
      const grouped: SubIndiceForm[] = []
      for (const s of editando.subindices) {
        const sAno = s.data_inicio
          ? parseInt(s.data_inicio.substring(0, 4), 10)
          : editando.ano_referencia
        // Merge into an existing group with same descricao + num_os that doesn't yet have this year
        const existing = grouped.find(
          (g) => g.descricao === s.descricao && g.num_os === (s.num_os ?? '') && !g.anos[sAno],
        )
        if (existing) {
          existing.anos[sAno] = { id: s.id, meses: Object.fromEntries(MESES.map((m) => [m, s[m] != null ? String(s[m]) : ''])) }
          if (s.data_inicio && (!existing.data_inicio || s.data_inicio < existing.data_inicio))
            existing.data_inicio = s.data_inicio.substring(0, 10)
          if (s.data_fim && (!existing.data_fim || s.data_fim > existing.data_fim))
            existing.data_fim = s.data_fim.substring(0, 10)
          existing.valor_total = String(Number(existing.valor_total) + Number(s.valor_total))
        } else {
          grouped.push({
            descricao: s.descricao,
            num_os: s.num_os ?? '',
            valor_total: String(s.valor_total),
            data_inicio: s.data_inicio ? s.data_inicio.substring(0, 10) : '',
            data_fim: s.data_fim ? s.data_fim.substring(0, 10) : '',
            comentarios: s.comentarios ?? '',
            anos: { [sAno]: { id: s.id, meses: Object.fromEntries(MESES.map((m) => [m, s[m] != null ? String(s[m]) : ''])) } },
          })
        }
      }
      setSubindices(grouped)
    } else {
      prevClienteFinalRef.current = ''
      setAnoRef(String(anoAtual)); setStatus('A_FATURAR'); setClienteId('')
      setClienteFinalId(''); setCidade(''); setEstado('')
      setNumAcordo(''); setNumProposta(''); setNumOs(''); setResponsavelId('')
      setDataInicio(''); setDataFim(''); setDescricao(''); setClassificacao(''); setValorContrato('')
      setSubindices([emptySubindice(anoAtual)])
    }
    setError(null)
  }, [open, editando, anoAtual])

  // Reset cidade/estado when cliente_final changes (skip initial load via ref)
  useEffect(() => {
    if (prevClienteFinalRef.current === clienteFinalId) return
    prevClienteFinalRef.current = clienteFinalId
    setCidade('')
    setEstado('')
  }, [clienteFinalId])

  // Auto-fill estado from selected cidade's filial
  useEffect(() => {
    if (!cidade) { setEstado(''); return }
    const cf = clientes.find((c) => String(c.id) === clienteFinalId)
    if (!cf) return
    const filiais = cf.filiais.length > 0
      ? cf.filiais
      : (cf.cidade ? [{ id: 0, nome: null, cidade: cf.cidade, estado: cf.estado ?? '' }] : [])
    const filial = filiais.find((f) => f.cidade === cidade)
    if (filial) setEstado(filial.estado)
  }, [cidade, clienteFinalId, clientes])

  const saveDraft = async () => {
    if (savingDraftRef.current || savedRef.current || isEdit) return
    savingDraftRef.current = true
    try {
      const body = {
        ano_referencia: Number(anoRef) || new Date().getFullYear(),
        cliente_id: clienteId ? Number(clienteId) : 0,
        rascunho: true,
        descricao: descricao || undefined,
        num_acordo: numAcordo || undefined,
        num_proposta: numProposta || undefined,
        num_os: numOs || undefined,
        responsavel_id: responsavelId ? Number(responsavelId) : undefined,
        valor_contrato: valorContrato ? Number(valorContrato) : undefined,
        subindices: subindices
          .filter((s) => s.descricao.trim())
          .flatMap((s) => {
            const anos = getAnosFromDates(s.data_inicio, s.data_fim, Number(anoRef))
            return anos.map((ano, idx) => {
              const section = s.anos[ano] ?? emptySection()
              const isFirst = idx === 0; const isLast = idx === anos.length - 1
              const vtAno = Number(s.valor_total) || 0
              return {
                descricao: s.descricao,
                valor_total: vtAno,
                data_inicio: isFirst && s.data_inicio ? s.data_inicio : `${ano}-01-01`,
                data_fim: isLast && s.data_fim ? s.data_fim : `${ano}-12-31`,
              }
            })
          }),
      }
      if (!body.cliente_id) return
      await fetch('/api/faturamento/contratos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch { /* silent */ } finally { savingDraftRef.current = false }
  }

  const handleClose = async () => {
    const hasData = clienteId && subindices.some((s) => s.descricao.trim())
    if (!isEdit && !savedRef.current && hasData) {
      await saveDraft()
    }
    onClose()
  }

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

  const updateMes = (i: number, ano: number, mes: string, value: string) =>
    setSubindices((prev) => prev.map((s, idx) =>
      idx !== i ? s : {
        ...s,
        anos: { ...s.anos, [ano]: { ...s.anos[ano], meses: { ...s.anos[ano]?.meses, [mes]: value } } },
      }
    ))

  const clienteFinalObj = useMemo(
    () => clientes.find((c) => String(c.id) === clienteFinalId) ?? null,
    [clientes, clienteFinalId],
  )
  const filiaisDisponiveis = useMemo(() => {
    if (!clienteFinalObj) return []
    if (clienteFinalObj.filiais.length > 0) return clienteFinalObj.filiais
    if (clienteFinalObj.cidade) return [{ id: 0, nome: null, cidade: clienteFinalObj.cidade, estado: clienteFinalObj.estado ?? '' }]
    return []
  }, [clienteFinalObj])

  const handleSubmit = async () => {
    if (!clienteId) { setError('Selecione o cliente'); return }
    if (!clienteFinalId) { setError('Selecione o cliente final'); return }
    if (!anoRef) { setError('Ano de referência obrigatório'); return }
    if (!valorContrato || isNaN(Number(valorContrato)) || Number(valorContrato) <= 0) {
      setError('Valor total do contrato é obrigatório'); return
    }
    for (let i = 0; i < subindices.length; i++) {
      const s = subindices[i]
      if (!s.descricao.trim()) { setError(`Evento ${i + 1}: descrição obrigatória`); return }
      if (!s.valor_total || isNaN(Number(s.valor_total))) {
        setError(`Evento ${i + 1}: valor total obrigatório`); return
      }
      const vtNum = Number(s.valor_total)
      const anos = getAnosFromDates(s.data_inicio, s.data_fim, Number(anoRef))
      const allFilled: number[] = []
      for (const ano of anos) {
        const section = s.anos[ano]
        if (section) {
          for (const m of MESES) {
            if (section.meses[m] && Number(section.meses[m]) > 0) allFilled.push(Number(section.meses[m]))
          }
        }
      }
      if (allFilled.length > 0) {
        const somaTodos = allFilled.reduce((a, b) => a + b, 0)
        if (Math.abs(somaTodos - vtNum) > 0.01) {
          setError(`Evento ${i + 1}: soma dos meses (R$ ${fmt(somaTodos)}) deve ser igual ao valor total (R$ ${fmt(vtNum)})`); return
        }
      }
    }

    setLoading(true); setError(null)
    try {
      const body = {
        ano_referencia: Number(anoRef),
        status,
        cliente_id: Number(clienteId),
        cliente_final_id: clienteFinalId ? Number(clienteFinalId) : undefined,
        cidade: cidade || undefined,
        estado: estado || undefined,
        num_acordo: numAcordo || undefined,
        num_proposta: numProposta || undefined,
        num_os: numOs || undefined,
        responsavel_id: responsavelId ? Number(responsavelId) : undefined,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        descricao: descricao || undefined,
        classificacao: classificacao || undefined,
        valor_contrato: valorContrato ? Number(valorContrato) : undefined,
        subindices: subindices.flatMap((s) => {
          const anos = getAnosFromDates(s.data_inicio, s.data_fim, Number(anoRef))
          const vtTotal = Number(s.valor_total) || 0
          return anos.map((ano, idx) => {
            const section = s.anos[ano] ?? emptySection()
            const isFirst = idx === 0
            const isLast = idx === anos.length - 1
            const sumMeses = MESES.reduce((acc, m) => acc + (section.meses[m] ? Number(section.meses[m]) : 0), 0)
            const vtAno = sumMeses > 0 ? sumMeses : (isFirst ? vtTotal : 0)
            return {
              id: section.id,   // existente → atualiza; ausente → cria
              descricao: s.descricao,
              valor_total: vtAno,
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
      savedRef.current = true
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      confirmClose
      title={isEdit ? `Editar Contrato · ${editando!.indice}` : 'Novo Lançamento — Contrato'}
      wide
      footer={
        <>
          <ModalCancelButton disabled={loading} />
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
        <Field label="Cliente *">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Cliente Final *">
          <Select value={clienteFinalId} onChange={(e) => setClienteFinalId(e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Cidade *">
          <Select value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={!clienteFinalId}>
            <option value="">{clienteFinalId ? 'Selecione...' : 'Selecione o cliente final primeiro'}</option>
            {filiaisDisponiveis.map((f, i) => (
              <option key={`${f.cidade}-${i}`} value={f.cidade}>{f.cidade}</option>
            ))}
          </Select>
        </Field>
        <Field label="UF">
          <div className="border border-gray-200 bg-[#EEF7EE] rounded px-2.5 py-[5px] text-[12px] text-[#1565C0] font-medium min-h-[30px]">
            {estado || <span className="text-gray-300">—</span>}
          </div>
        </Field>
        <Field label="Classificação">
          <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value)}>
            <option value="">Selecione...</option>
            {(Object.entries(CLASSIFICACAO_LABELS) as [string, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Ramo de atuação (do cliente)" className="mb-2.5">
        <div className="border border-gray-200 bg-gray-50 rounded px-2.5 py-[5px] text-[12px] text-gray-500 min-h-[30px]">
          {clienteId
            ? (RAMO_ATUACAO_LABELS[(clientes.find((c) => String(c.id) === clienteId)?.ramo_atuacao ?? '') as keyof typeof RAMO_ATUACAO_LABELS] ?? '—')
            : <span className="text-gray-300">Selecione o cliente</span>}
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Nº OS">
          <Input placeholder="Ex: 0798.02.003" value={numOs} onChange={(e) => setNumOs(maskOS(e.target.value))} />
        </Field>
        <Field label="Nº Acordo">
          <Input placeholder="Ex: AC-2024-091" value={numAcordo} onChange={(e) => setNumAcordo(e.target.value)} />
        </Field>
        <Field label="Nº Proposta">
          <Select value={numProposta} onChange={(e) => setNumProposta(e.target.value)} disabled={!clienteId}>
            <option value="">{clienteId ? 'Selecione...' : 'Selecione o cliente primeiro'}</option>
            {numProposta && !propostasCliente.some((p) => p.numero === numProposta) && (
              <option value={numProposta}>{numProposta}</option>
            )}
            {propostasCliente.map((p) => <option key={p.id} value={p.numero}>{p.numero}</option>)}
          </Select>
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
            onUpdateMes={(ano, mes, val) => updateMes(i, ano, mes, val)}
            onRemove={subindices.length > 1 ? () => removeSubindice(i) : undefined}
          />
        ))}
      </div>

      {(() => {
        const totalSubs = subindices.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0)
        const vc = valorContrato ? Number(valorContrato) : 0
        if (vc <= 0) return null
        const diff = totalSubs - vc
        const ok = Math.abs(diff) <= 0.01
        const over = diff > 0.01
        return (
          <div className={`mt-3 rounded px-3 py-2 text-[11px] flex items-center gap-3 ${ok ? 'bg-green-50 border border-green-200 text-green-700' : over ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-orange-50 border border-orange-200 text-orange-700'}`}>
            <span>Total dos eventos: <strong>R$ {fmt(totalSubs)}</strong></span>
            <span className="text-gray-300">|</span>
            <span>Valor contrato: <strong>R$ {fmt(vc)}</strong></span>
            <span className="ml-auto font-semibold">{ok ? '✓ Conferido' : over ? `Excede R$ ${fmt(diff)}` : `Faltam R$ ${fmt(-diff)}`}</span>
          </div>
        )
      })()}

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
  onUpdateMes: (ano: number, mes: string, val: string) => void
  onRemove?: () => void
}

function SubindiceCard({ indiceBase, ordem, anoRef, data, onUpdate, onUpdateMes, onRemove }: SubindiceCardProps) {
  const anos = getAnosFromDates(data.data_inicio, data.data_fim, anoRef)
  const multiAno = anos.length > 1
  const vtNum = Number(data.valor_total || 0)

  const somaTodos = anos.reduce((acc, ano) => {
    const section = data.anos[ano]
    if (!section) return acc
    return acc + MESES.reduce((a, m) => a + (section.meses[m] ? Number(section.meses[m]) : 0), 0)
  }, 0)
  const anyMonthFilled = somaTodos > 0
  const totalOk = vtNum > 0 && Math.abs(somaTodos - vtNum) <= 0.01

  return (
    <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-bold text-green-dark">{indiceBase}.{ordem}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-[14px] leading-none">×</button>
        )}
      </div>

      <div className="mb-2">
        <Field label="Descrição / Evento">
          <Input placeholder="Ex: Mobilização" value={data.descricao} onChange={(e) => onUpdate('descricao', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
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

      <div className="mb-3">
        <Field label="Valor Total (R$)">
          <CurrencyInput value={data.valor_total} onChange={(v) => onUpdate('valor_total', v)} />
        </Field>
      </div>

      {multiAno && (
        <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-3">
          ⚡ Período abrange {anos.length} anos. Distribua a previsão mensal entre os anos. O valor total do subitem é único.
        </div>
      )}

      {anos.map((ano) => {
        const section = data.anos[ano]
        const somaAno = section
          ? MESES.reduce((a, m) => a + (section.meses[m] ? Number(section.meses[m]) : 0), 0)
          : 0
        return (
          <div
            key={ano}
            className={multiAno ? 'border border-green-primary/30 rounded-md p-2.5 mb-2.5 bg-white' : ''}
          >
            {multiAno && (
              <p className="text-[11px] font-bold text-green-dark mb-2 border-b border-green-primary/20 pb-1.5">
                Previsão {ano}
              </p>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
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

            {multiAno && somaAno > 0 && (
              <p className="mt-1 text-[10px] text-right text-gray-400">
                Subtotal {ano}: R$ {fmt(somaAno)}
              </p>
            )}
          </div>
        )
      })}

      {anyMonthFilled && (
        <p className={`mt-1 text-[10px] text-right ${totalOk ? 'text-green-600' : 'text-orange-600'}`}>
          Total previsto: R$ {fmt(somaTodos)}{totalOk ? ' ✓' : vtNum > 0 ? ` · Meta: R$ ${fmt(vtNum)}` : ''}
        </p>
      )}
    </div>
  )
}
