'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, CurrencyInput } from '@/components/ui/Input'
import type { SubIndiceItem, PrevisaoAlteracaoItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

const _NOW = new Date()
const CUR_YEAR = _NOW.getFullYear()
const CUR_MONTH_IDX = _NOW.getMonth() // 0-indexed

function isMesPast(ano: number, mesIdx: number): boolean {
  return ano < CUR_YEAR || (ano === CUR_YEAR && mesIdx < CUR_MONTH_IDX)
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface YearSection {
  id?: number                        // id do sub-índice já existente naquele ano (PUT) — ausente = ano novo (POST)
  jaFaturado: number                 // total já faturado daquele ano específico
  original: Record<string, string>   // snapshot dos valores carregados, p/ detectar alteração em meses passados
  meses: Record<string, string>
}

function emptySection(): YearSection {
  return {
    jaFaturado: 0,
    original: Object.fromEntries(MESES.map((m) => [m, ''])),
    meses: Object.fromEntries(MESES.map((m) => [m, ''])),
  }
}

function sectionFromSubindice(s: SubIndiceItem): YearSection {
  const meses = Object.fromEntries(
    MESES.map((m) => [m, (s as unknown as Record<string, unknown>)[m] != null ? String((s as unknown as Record<string, unknown>)[m]) : ''])
  )
  return { id: s.id, jaFaturado: s.total_faturado, original: { ...meses }, meses: { ...meses } }
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
  onDelete: () => void
  subindice: SubIndiceItem
  indiceLabel: string
  anoRef: number
  readOnly?: boolean
  blockPastMonths?: boolean  // RN-CF-09: Responsável não pode editar meses passados
  useApprovalFlow?: boolean  // RN-CF-09/37: Responsável propõe via fluxo de aprovação
}

export function EditarSubIndiceModal({ open, onClose, onSuccess, onDelete, subindice, indiceLabel, anoRef, readOnly, blockPastMonths, useApprovalFlow }: Props) {
  const [descricao, setDescricao] = useState('')
  const [numOs, setNumOs] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [anos, setAnos] = useState<Record<number, YearSection>>({})
  const [loading, setLoading] = useState(false)
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const subAno = subindice.data_inicio
    ? parseInt(subindice.data_inicio.substring(0, 4), 10)
    : anoRef

  // RN-CF-36: alteração pendente para exibir valores "P" nos meses
  const alteracaoPendente: PrevisaoAlteracaoItem | null =
    useApprovalFlow && 'alteracao_pendente' in subindice
      ? (subindice as unknown as { alteracao_pendente: PrevisaoAlteracaoItem | null }).alteracao_pendente
      : null

  const hasPastMonthChanges = useMemo(() => {
    for (const anoStr of Object.keys(anos)) {
      const ano = Number(anoStr)
      const section = anos[ano]
      if (!section) continue
      for (let mi = 0; mi < MESES.length; mi++) {
        if (!isMesPast(ano, mi)) continue
        const m = MESES[mi]
        const current = section.meses[m] ? Number(section.meses[m]) : 0
        const original = section.original[m] ? Number(section.original[m]) : 0
        if (Math.abs(original - current) > 0.01) return true
      }
    }
    return false
  }, [anos])

  // Carrega os dados do sub-índice clicado e, se houver previsão em outros anos (RN-23),
  // busca os sub-índices irmãos (mesma descrição, mesmo contrato) para edição conjunta.
  useEffect(() => {
    if (!open || !subindice) return
    let cancelado = false

    setDescricao(subindice.descricao)
    setNumOs(subindice.num_os ?? '')
    setDataInicio(subindice.data_inicio ? subindice.data_inicio.substring(0, 10) : '')
    setDataFim(subindice.data_fim ? subindice.data_fim.substring(0, 10) : '')
    setComentarios(subindice.comentarios ?? '')
    setValorTotal(String(subindice.valor_total))
    setAnos({ [subAno]: sectionFromSubindice(subindice) })
    setConfirmDelete(false)
    setError(null)

    setLoadingSiblings(true)
    fetch(`/api/faturamento/contratos/${subindice.contrato_id}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelado) return
        const todos: SubIndiceItem[] = json?.data?.subindices ?? []
        const irmaos = todos.filter((s) => s.descricao === subindice.descricao)
        if (irmaos.length <= 1) return

        irmaos.sort((a, b) => (a.data_inicio ?? '').localeCompare(b.data_inicio ?? ''))
        const primeiro = irmaos[0]
        const ultimo = irmaos[irmaos.length - 1]

        const anosMap: Record<number, YearSection> = {}
        let vtSoma = 0
        for (const s of irmaos) {
          const ano = s.data_inicio ? parseInt(s.data_inicio.substring(0, 4), 10) : subAno
          anosMap[ano] = sectionFromSubindice(s)
          vtSoma += s.valor_total
        }

        setDataInicio(primeiro.data_inicio ? primeiro.data_inicio.substring(0, 10) : '')
        setDataFim(ultimo.data_fim ? ultimo.data_fim.substring(0, 10) : '')
        setValorTotal(String(vtSoma))
        setAnos(anosMap)
      })
      .catch(() => { /* mantém apenas o sub-índice atual em caso de erro */ })
      .finally(() => { if (!cancelado) setLoadingSiblings(false) })

    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subindice])

  const handleDataChange = (field: 'dataInicio' | 'dataFim', value: string) => {
    const novoIni = field === 'dataInicio' ? value : dataInicio
    const novoFim = field === 'dataFim' ? value : dataFim
    if (field === 'dataInicio') setDataInicio(value)
    else setDataFim(value)

    const novosAnos = getAnosFromDates(novoIni, novoFim, subAno)
    setAnos((prev) => {
      const next: Record<number, YearSection> = {}
      for (const a of novosAnos) next[a] = prev[a] ?? emptySection()
      return next
    })
  }

  const updateMes = (ano: number, mes: string, val: string) =>
    setAnos((prev) => ({
      ...prev,
      [ano]: { ...prev[ano], meses: { ...prev[ano]?.meses, [mes]: val } },
    }))

  // RN-CF-09/37: salva previsão via fluxo de aprovação (POST /alteracoes)
  const handleSaveApprovalFlow = async () => {
    const section = anos[subAno]
    if (!section) { setError('Seção de ano não encontrada'); return }

    if (hasPastMonthChanges && !comentarios.trim()) {
      setError('Informe o motivo da alteração em meses passados no campo "Motivo da alteração"')
      return
    }

    const hasChanges = MESES.some((m) => {
      const current = section.meses[m] ? Number(section.meses[m]) : 0
      const original = section.original[m] ? Number(section.original[m]) : 0
      return Math.abs(current - original) > 0.01
    })

    if (!hasChanges) {
      setError('Nenhuma alteração detectada. Modifique ao menos um valor mensal antes de enviar.')
      return
    }

    const valores_para = Object.fromEntries(
      MESES.map((m) => [m, section.meses[m] ? Number(section.meses[m]) : null])
    )

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/faturamento/alteracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subindice_id: subindice.id, valores_para }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao enviar proposta'); return }
      onSuccess(); onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const jaFaturadoTotal = useMemo(
    () => Object.values(anos).reduce((acc, s) => acc + (s?.jaFaturado ?? 0), 0),
    [anos],
  )

  const handleSave = async () => {
    if (useApprovalFlow) {
      await handleSaveApprovalFlow()
      return
    }

    if (!descricao.trim()) { setError('Descrição obrigatória'); return }
    if (hasPastMonthChanges && !comentarios.trim()) {
      setError('Informe o motivo da alteração em meses passados no campo "Motivo da alteração"')
      return
    }

    const anosOrdenados = getAnosFromDates(dataInicio, dataFim, subAno)

    if (!valorTotal || isNaN(Number(valorTotal))) {
      setError('Valor total inválido')
      return
    }
    const vtNum = Number(valorTotal)
    if (vtNum < jaFaturadoTotal - 0.01) {
      setError(`O valor total (R$ ${fmt(vtNum)}) não pode ser menor que o já faturado (R$ ${fmt(jaFaturadoTotal)})`); return
    }

    const somaTodosMeses = anosOrdenados.reduce((acc, a) => {
      const section = anos[a]
      if (!section) return acc
      return acc + MESES.reduce((s, m) => s + (section.meses[m] ? Number(section.meses[m]) : 0), 0)
    }, 0)

    if (somaTodosMeses + jaFaturadoTotal > vtNum + 0.01) {
      setError(`A soma da previsão (R$ ${fmt(somaTodosMeses)}) + já faturado (R$ ${fmt(jaFaturadoTotal)}) ultrapassa o valor total (R$ ${fmt(vtNum)})`); return
    }

    setLoading(true); setError(null)
    try {
      for (let idx = 0; idx < anosOrdenados.length; idx++) {
        const ano = anosOrdenados[idx]
        const section = anos[ano] ?? emptySection()
        const isFirstIdx = idx === 0
        const isLastIdx = idx === anosOrdenados.length - 1
        const somaMesesAno = MESES.reduce((s, m) => s + (section.meses[m] ? Number(section.meses[m]) : 0), 0)
        const vtAno = section.jaFaturado + somaMesesAno

        const payload = {
          descricao,
          num_os: numOs.trim() || null,
          valor_total: vtAno,
          data_inicio: isFirstIdx && dataInicio ? dataInicio : `${ano}-01-01`,
          data_fim: isLastIdx && dataFim ? dataFim : `${ano}-12-31`,
          comentarios: comentarios || null,
          ...Object.fromEntries(MESES.map((m) => [m, section.meses[m] ? Number(section.meses[m]) : null])),
        }

        if (section.id) {
          const putRes = await fetch(`/api/faturamento/subindices/${section.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const putJson = await putRes.json()
          if (!putRes.ok || putJson.error) { setError(putJson.error ?? 'Erro ao salvar'); return }
        } else {
          const postRes = await fetch('/api/faturamento/subindices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contrato_id: subindice.contrato_id, ...payload }),
          })
          const postJson = await postRes.json()
          if (!postRes.ok || postJson.error) { setError(postJson.error ?? `Erro ao criar sub-índice para ${ano}`); return }
        }
      }

      onSuccess(); onClose()
    } catch (err) {
      setError(String(err))
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

  const anosOrdenados = getAnosFromDates(dataInicio, dataFim, subAno)
  const multiAno = anosOrdenados.length > 1
  const canSave = !readOnly || useApprovalFlow

  const modalTitle = useApprovalFlow
    ? `Propor Alteração · ${indiceLabel}`
    : readOnly
    ? `Previsão · ${indiceLabel}`
    : `Editar Sub-índice · ${indiceLabel}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {canSave ? 'Cancelar' : 'Fechar'}
          </Button>
          {canSave && (
            <Button onClick={handleSave} disabled={loading || loadingSiblings}>
              {loading
                ? (useApprovalFlow ? 'Enviando...' : 'Salvando...')
                : (useApprovalFlow ? 'Enviar proposta' : 'Salvar')}
            </Button>
          )}
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* RN-CF-36: aviso de proposta pendente */}
      {useApprovalFlow && alteracaoPendente && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-[11px] px-3 py-2.5 rounded mb-3 flex gap-2 items-start">
          <span className="text-[14px] leading-none mt-px">⏳</span>
          <span>
            <strong>Proposta pendente de aprovação.</strong> Enviar uma nova proposta irá substituir a anterior.
          </span>
        </div>
      )}

      {loadingSiblings && (
        <div className="bg-gray-50 border border-gray-200 text-gray-500 text-[11px] px-3 py-2 rounded mb-3">
          Carregando previsão dos demais anos...
        </div>
      )}

      <ModalSection>Dados do evento</ModalSection>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Descrição / Evento *" className="col-span-2">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={readOnly} />
        </Field>
        <Field label="Nº OS">
          <Input placeholder="Ex: OS-0001" value={numOs} onChange={(e) => setNumOs(e.target.value)} disabled={readOnly} />
        </Field>
        <Field label={hasPastMonthChanges ? 'Motivo da alteração *' : 'Comentários'}>
          <Input
            placeholder={hasPastMonthChanges ? 'Obrigatório: informe o motivo da alteração em meses passados' : 'Obs...'}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            disabled={readOnly && !hasPastMonthChanges}
            className={hasPastMonthChanges ? 'border-amber-400 focus:ring-amber-400' : ''}
          />
        </Field>
        <Field label="Período — De">
          <Input type="date" value={dataInicio} onChange={(e) => handleDataChange('dataInicio', e.target.value)} disabled={readOnly} />
        </Field>
        <Field label="Até">
          <Input type="date" value={dataFim} onChange={(e) => handleDataChange('dataFim', e.target.value)} disabled={readOnly} />
        </Field>
      </div>

      {multiAno && (
        <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-3">
          ⚡ Período abrange {anosOrdenados.length} anos. Distribua a previsão mensal entre os anos — o valor total do subitem é único.
        </div>
      )}

      {hasPastMonthChanges && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-[11px] px-3 py-2.5 rounded mb-3 flex gap-2 items-start">
          <span className="text-[14px] leading-none mt-px">⚠</span>
          <span>
            <strong>Alteração em meses passados detectada.</strong> Preencha o campo{' '}
            <strong>Motivo da alteração</strong> antes de salvar.
          </span>
        </div>
      )}

      <ModalSection>Previsão mensal</ModalSection>

      <div className="mb-2.5">
        <Field label="Valor Total (R$) *">
          <CurrencyInput value={valorTotal} onChange={setValorTotal} disabled={readOnly} />
        </Field>
      </div>

      {(() => {
        const vtNum = Number(valorTotal || 0)
        const disponivel = vtNum - jaFaturadoTotal
        return jaFaturadoTotal > 0 && vtNum > 0 && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] px-3 py-2 rounded mb-2.5 flex gap-4">
            <span>Já faturado: <strong>R$ {fmt(jaFaturadoTotal)}</strong></span>
            <span>Disponível para previsão: <strong>R$ {fmt(Math.max(0, disponivel))}</strong></span>
          </div>
        )
      })()}

      {anosOrdenados.map((ano, idx) => {
        const section = anos[ano]
        const filledMeses = section ? MESES.filter((m) => section.meses[m] && Number(section.meses[m]) > 0) : []
        const somaMeses = filledMeses.reduce((acc, m) => acc + Number(section!.meses[m]), 0)
        return (
          <div
            key={ano}
            className={multiAno ? 'border border-green-primary/30 rounded-md p-3 mb-3 bg-white' : 'mb-4'}
          >
            {multiAno && (
              <p className="text-[11px] font-bold text-green-dark mb-2.5 border-b border-green-primary/20 pb-1.5">
                Previsão {ano}
                {idx === 0 && <span className="ml-2 text-[10px] font-normal text-gray-400">(este sub-índice)</span>}
                {idx > 0 && (
                  <span className="ml-2 text-[10px] font-normal text-[#6A1B9A]">
                    {section?.id ? '(existente)' : '(novo sub-índice)'}
                  </span>
                )}
              </p>
            )}

            <div className="grid grid-cols-6 gap-1.5">
              {MESES.map((m, mi) => {
                const ativo = isMesAtivo(ano, mi, dataInicio, dataFim)
                const past = isMesPast(ano, mi)
                const blockedByRole = blockPastMonths && past   // RN-CF-09
                const current = Number(anos[ano]?.meses[m] || 0)
                const original = Number(section?.original[m] || 0)
                const pastChanged = ativo && past && !blockedByRole && Math.abs(original - current) > 0.01
                const cellDisabled = !ativo || blockedByRole
                // RN-CF-36: valor pendente de aprovação para mostrar abaixo da célula
                const pendingRaw = alteracaoPendente && ano === subAno
                  ? (alteracaoPendente as unknown as Record<string, unknown>)[`${m}_para`]
                  : undefined
                const pendingVal = pendingRaw != null ? Number(pendingRaw) : null
                const hasPending = pendingVal != null && Math.abs(pendingVal - original) > 0.01
                return (
                  <div key={m}>
                    <p className={`text-[9px] uppercase text-center mb-0.5 ${
                      !ativo          ? 'text-gray-200'
                      : blockedByRole ? 'text-gray-300'
                      : pastChanged   ? 'text-amber-600 font-semibold'
                      : 'text-gray-400'
                    }`}>
                      {MESES_LABELS[mi]}
                    </p>
                    <CurrencyInput
                      value={anos[ano]?.meses[m] ?? ''}
                      onChange={(v) => updateMes(ano, m, v)}
                      disabled={cellDisabled}
                      className={`text-center px-1.5 py-[3px] text-[11px] ${
                        cellDisabled
                          ? 'border-gray-100 bg-gray-50 text-gray-200 cursor-not-allowed'
                          : pastChanged
                          ? 'border-amber-400 bg-amber-50'
                          : ''
                      }`}
                    />
                    {hasPending && (
                      <p className="text-[9px] text-center text-gray-400 mt-0.5 leading-none" title="Valor pendente de aprovação">
                        P: {fmt(pendingVal!)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {multiAno && filledMeses.length > 0 && (
              <p className="mt-1.5 text-[10px] text-right text-gray-400">
                Subtotal {ano}: R$ {fmt(somaMeses)}
              </p>
            )}
          </div>
        )
      })}

      {(() => {
        const vtNum = Number(valorTotal || 0)
        const disponivel = vtNum - jaFaturadoTotal
        const somaTodosMeses = anosOrdenados.reduce((acc, a) => {
          const section = anos[a]
          if (!section) return acc
          return acc + MESES.reduce((s, m) => s + (section.meses[m] ? Number(section.meses[m]) : 0), 0)
        }, 0)
        const ok = somaTodosMeses === 0 || Math.abs(somaTodosMeses - disponivel) <= 0.01
        if (somaTodosMeses === 0) return null
        return (
          <p className={`mt-1 text-[10px] text-right ${ok ? 'text-green-600' : 'text-orange-600'}`}>
            Soma de todos os meses: R$ {fmt(somaTodosMeses)}{ok ? ' ✓' : ` · Disponível: R$ ${fmt(disponivel)}`}
          </p>
        )
      })()}

      {/* Zona de exclusão — oculta no modo readOnly ou useApprovalFlow */}
      {!readOnly && !useApprovalFlow && <div className="border-t border-red-100 pt-3 mt-2">
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
      </div>}
    </Modal>
  )
}
