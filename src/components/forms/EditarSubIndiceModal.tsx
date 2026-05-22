'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, CurrencyInput } from '@/components/ui/Input'
import type { SubIndiceItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// Snapshot de ano/mês atual para comparação de meses passados
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
  valor_total: string
  meses: Record<string, string>
}

function emptySection(): YearSection {
  return { valor_total: '', meses: Object.fromEntries(MESES.map((m) => [m, ''])) }
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
}

export function EditarSubIndiceModal({ open, onClose, onSuccess, onDelete, subindice, indiceLabel, anoRef, readOnly }: Props) {
  const [descricao, setDescricao] = useState('')
  const [numOs, setNumOs] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [anos, setAnos] = useState<Record<number, YearSection>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Ano do sub-índice atual (determinado pela data_inicio ou pelo fallback)
  const subAno = subindice.data_inicio
    ? parseInt(subindice.data_inicio.substring(0, 4), 10)
    : anoRef

  // Detecta se algum mês passado foi alterado em relação ao valor original
  const hasPastMonthChanges = useMemo(() => {
    for (const anoStr of Object.keys(anos)) {
      const ano = Number(anoStr)
      const section = anos[ano]
      if (!section) continue
      for (let mi = 0; mi < MESES.length; mi++) {
        if (!isMesPast(ano, mi)) continue
        const m = MESES[mi]
        const current = section.meses[m] ? Number(section.meses[m]) : 0
        if (ano === subAno) {
          // Para o ano do registro existente: compara com o valor original
          const original = Number((subindice as unknown as Record<string, unknown>)[m] ?? 0)
          if (Math.abs(original - current) > 0.01) return true
        } else {
          // Para anos extras (novos registros): qualquer valor > 0 em mês passado
          if (current > 0.01) return true
        }
      }
    }
    return false
  }, [anos, subAno, subindice])

  useEffect(() => {
    if (open && subindice) {
      const ini = subindice.data_inicio ? subindice.data_inicio.substring(0, 10) : ''
      const fim = subindice.data_fim ? subindice.data_fim.substring(0, 10) : ''
      setDescricao(subindice.descricao)
      setNumOs(subindice.num_os ?? '')
      setDataInicio(ini)
      setDataFim(fim)
      setComentarios(subindice.comentarios ?? '')
      setAnos({
        [subAno]: {
          valor_total: String(subindice.valor_total),
          meses: Object.fromEntries(MESES.map((m) => [m, subindice[m] != null ? String(subindice[m]) : ''])),
        },
      })
      setConfirmDelete(false)
      setError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subindice])

  // Quando as datas mudam, recalcula seções de ano preservando dados já preenchidos
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

  const updateAnoField = (ano: number, val: string) =>
    setAnos((prev) => ({ ...prev, [ano]: { ...prev[ano], valor_total: val } }))

  const updateMes = (ano: number, mes: string, val: string) =>
    setAnos((prev) => ({
      ...prev,
      [ano]: { ...prev[ano], meses: { ...prev[ano]?.meses, [mes]: val } },
    }))

  const handleSave = async () => {
    if (!descricao.trim()) { setError('Descrição obrigatória'); return }
    if (hasPastMonthChanges && !comentarios.trim()) {
      setError('Informe o motivo da alteração em meses passados no campo "Motivo da alteração"')
      return
    }

    const anosOrdenados = getAnosFromDates(dataInicio, dataFim, subAno)
    for (let idx = 0; idx < anosOrdenados.length; idx++) {
      const a = anosOrdenados[idx]
      const vt = anos[a]?.valor_total
      if (!vt || isNaN(Number(vt))) {
        setError(`Valor total inválido para ${a}`)
        return
      }
      const vtNum = Number(vt)
      const jaFaturado = idx === 0 ? subindice.total_faturado : 0
      if (idx === 0 && vtNum < jaFaturado - 0.01) {
        setError(`O valor total (R$ ${fmt(vtNum)}) não pode ser menor que o já faturado (R$ ${fmt(jaFaturado)})`); return
      }
      const disponivel = vtNum - jaFaturado
      const section = anos[a]
      if (section) {
        const filled = MESES.filter((m) => section.meses[m] && Number(section.meses[m]) > 0)
        if (filled.length > 0) {
          const soma = filled.reduce((acc, m) => acc + Number(section.meses[m]), 0)
          if (Math.abs(soma - disponivel) > 0.01) {
            const label = anosOrdenados.length > 1 ? ` (${a})` : ''
            if (idx === 0 && jaFaturado > 0) {
              setError(`A soma dos meses${label} (R$ ${fmt(soma)}) deve ser igual ao disponível para previsão (R$ ${fmt(disponivel)})`); return
            } else {
              setError(`A soma dos meses${label} (R$ ${fmt(soma)}) deve ser igual ao valor total (R$ ${fmt(vtNum)})`); return
            }
          }
        }
      }
    }

    setLoading(true); setError(null)
    try {
      // Primeiro ano → atualiza o registro existente
      const primeiroAno = anosOrdenados[0]
      const primeiraSecao = anos[primeiroAno] ?? emptySection()
      const isFirst = true
      const isLastFirst = anosOrdenados.length === 1

      const putRes = await fetch(`/api/faturamento/subindices/${subindice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          num_os: numOs.trim() || null,
          valor_total: Number(primeiraSecao.valor_total) || 0,
          data_inicio: isFirst && dataInicio ? dataInicio : `${primeiroAno}-01-01`,
          data_fim: isLastFirst && dataFim ? dataFim : `${primeiroAno}-12-31`,
          comentarios: comentarios || null,
          ...Object.fromEntries(MESES.map((m) => [m, primeiraSecao.meses[m] ? Number(primeiraSecao.meses[m]) : null])),
        }),
      })
      const putJson = await putRes.json()
      if (!putRes.ok || putJson.error) { setError(putJson.error ?? 'Erro ao salvar'); return }

      // Anos adicionais → cria novos registros
      for (let i = 1; i < anosOrdenados.length; i++) {
        const a = anosOrdenados[i]
        const secao = anos[a] ?? emptySection()
        const isLast = i === anosOrdenados.length - 1

        const postRes = await fetch('/api/faturamento/subindices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contrato_id: subindice.contrato_id,
            descricao,
            num_os: numOs.trim() || null,
            valor_total: Number(secao.valor_total) || 0,
            data_inicio: `${a}-01-01`,
            data_fim: isLast && dataFim ? dataFim : `${a}-12-31`,
            comentarios: comentarios || null,
            ...Object.fromEntries(MESES.map((m) => [m, secao.meses[m] ? Number(secao.meses[m]) : null])),
          }),
        })
        const postJson = await postRes.json()
        if (!postRes.ok || postJson.error) { setError(postJson.error ?? `Erro ao criar sub-índice para ${a}`); return }
      }

      onSuccess(); onClose()
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={readOnly ? `Editar Previsão · ${indiceLabel}` : `Editar Sub-índice · ${indiceLabel}`}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
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
          <Input type="date" value={dataInicio} onChange={(e) => handleDataChange('dataInicio', e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={dataFim} onChange={(e) => handleDataChange('dataFim', e.target.value)} />
        </Field>
      </div>

      {multiAno && (
        <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-3">
          ⚡ Período abrange {anosOrdenados.length} anos. Preencha a previsão e o valor para cada ano separadamente.
          {anosOrdenados.slice(1).length > 0 && (
            <span className="block mt-0.5 text-[10px] opacity-80">
              Serão criados {anosOrdenados.length - 1} novo(s) sub-índice(s) para os anos adicionais.
            </span>
          )}
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

      {anosOrdenados.map((ano, idx) => {
        const jaFaturado = idx === 0 ? subindice.total_faturado : 0
        const vtNum = Number(anos[ano]?.valor_total || 0)
        const disponivel = vtNum - jaFaturado
        const section = anos[ano]
        const filledMeses = section ? MESES.filter((m) => section.meses[m] && Number(section.meses[m]) > 0) : []
        const somaMeses = filledMeses.reduce((acc, m) => acc + Number(section!.meses[m]), 0)
        const mesesOk = filledMeses.length === 0 || Math.abs(somaMeses - disponivel) <= 0.01
        return (
          <div
            key={ano}
            className={multiAno ? 'border border-green-primary/30 rounded-md p-3 mb-3 bg-white' : 'mb-4'}
          >
            {multiAno && (
              <p className="text-[11px] font-bold text-green-dark mb-2.5 border-b border-green-primary/20 pb-1.5">
                Previsão {ano}
                {idx === 0 && <span className="ml-2 text-[10px] font-normal text-gray-400">(este sub-índice)</span>}
                {idx > 0 && <span className="ml-2 text-[10px] font-normal text-[#6A1B9A]">(novo sub-índice)</span>}
              </p>
            )}

            <div className="mb-2.5">
              <Field label="Valor Total (R$) *">
                <CurrencyInput
                  value={anos[ano]?.valor_total ?? ''}
                  onChange={(v) => updateAnoField(ano, v)}
                  disabled={readOnly}
                />
              </Field>
            </div>

            {idx === 0 && subindice.total_faturado > 0 && vtNum > 0 && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] px-3 py-2 rounded mb-2.5 flex gap-4">
                <span>Já faturado: <strong>R$ {fmt(subindice.total_faturado)}</strong></span>
                <span>Disponível para previsão: <strong>R$ {fmt(Math.max(0, disponivel))}</strong></span>
              </div>
            )}

            <div className="grid grid-cols-6 gap-1.5">
              {MESES.map((m, mi) => {
                const ativo = isMesAtivo(ano, mi, dataInicio, dataFim)
                const past = isMesPast(ano, mi)
                const current = Number(anos[ano]?.meses[m] || 0)
                const original = ano === subAno ? Number((subindice as unknown as Record<string, unknown>)[m] ?? 0) : 0
                const pastChanged = ativo && past && Math.abs(original - current) > 0.01
                return (
                  <div key={m}>
                    <p className={`text-[9px] uppercase text-center mb-0.5 ${
                      !ativo ? 'text-gray-200' : pastChanged ? 'text-amber-600 font-semibold' : 'text-gray-400'
                    }`}>
                      {MESES_LABELS[mi]}
                    </p>
                    <CurrencyInput
                      value={anos[ano]?.meses[m] ?? ''}
                      onChange={(v) => updateMes(ano, m, v)}
                      disabled={!ativo}
                      className={`text-center px-1.5 py-[3px] text-[11px] ${
                        !ativo
                          ? 'border-gray-100 bg-gray-50 text-gray-200 cursor-not-allowed'
                          : pastChanged
                          ? 'border-amber-400 bg-amber-50'
                          : ''
                      }`}
                    />
                  </div>
                )
              })}
            </div>

            {filledMeses.length > 0 && (
              <p className={`mt-1.5 text-[10px] text-right ${mesesOk ? 'text-green-600' : 'text-orange-600'}`}>
                Soma meses: R$ {fmt(somaMeses)}{mesesOk ? ' ✓' : ` · ${idx === 0 && jaFaturado > 0 ? 'Disponível' : 'Meta'}: R$ ${fmt(disponivel)}`}
              </p>
            )}
          </div>
        )
      })}

      {/* Zona de exclusão — oculta no modo readOnly */}
      {!readOnly && <div className="border-t border-red-100 pt-3 mt-2">
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
