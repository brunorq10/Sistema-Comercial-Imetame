'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { ProporAlteracaoModal } from '@/components/forms/ProporAlteracaoModal'
import { cn, formatCurrency } from '@/lib/utils'
import type { SubIndiceItem, PrevisaoAlteracaoItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
type MesKey = typeof MESES[number]
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Column widths ─────────────────────────────────────────────────────────────
const W = {
  indice: 110, cliente: 120, descricao: 235,
  os: 100, ano: 65, acordo: 115,
  responsavel: 130, status: 90,
  vlrTotal: 145, faturado: 135, disponivel: 135,
  mes: 105, acoes: 100,
}
const L = { indice: 0, cliente: W.indice, descricao: W.indice + W.cliente }
const FROZEN_W = L.descricao + W.descricao
const MIN_W = FROZEN_W + W.os + W.ano + W.acordo + W.responsavel + W.status +
  W.vlrTotal + W.faturado + W.disponivel + 12 * W.mes + W.acoes

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubIndiceComAlteracao extends SubIndiceItem {
  alteracao_pendente: PrevisaoAlteracaoItem | null
}

interface ContratoComAlteracoes {
  id: number
  indice: string
  ano_referencia: number
  status: string
  descricao: string | null
  num_os: string | null
  num_acordo: string | null
  num_proposta: string | null
  valor_contrato: number | null
  data_inicio: string | null
  data_fim: string | null
  prev_anos_seguintes: number
  cliente: { id: number; nome: string }
  responsavel: { id: number; nome: string } | null
  subindices: SubIndiceComAlteracao[]
}

interface Responsavel { id: number; nome: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSubAno(dataInicio: string | null, fallback: number) {
  if (!dataInicio) return fallback
  return parseInt(dataInicio.substring(0, 4), 10) || fallback
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    A_FATURAR: { label: 'A faturar', cls: 'text-orange-600 font-semibold' },
    FATURADO:  { label: 'Faturado',  cls: 'text-green-700 font-semibold' },
    PARCIAL:   { label: 'Parcial',   cls: 'text-blue-600 font-semibold' },
    CANCELADO: { label: 'Cancelado', cls: 'text-gray-400' },
  }
  const m = map[status] ?? map['A_FATURAR']
  return <span className={cn('text-[11px]', m.cls)}>{m.label}</span>
}

// ── MetricCard — mesmo estilo do Dashboard Acordos ────────────────────────────
function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <div className="bg-green-dark px-3.5 py-2">
        <p className="text-[10px] font-semibold text-white/85 leading-snug uppercase tracking-[0.04em]">
          {label}{sub && <span className="text-white/50 font-normal normal-case"> · {sub}</span>}
        </p>
      </div>
      <div className="bg-white px-3.5 py-3">
        <p className="text-[20px] font-bold text-gray-900 leading-none">{value}</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MeuPainelAcordosPage() {
  const { data: session } = useSession()
  const perfil = session?.user?.perfil
  const isGestao = perfil === 'GESTAO_ACORDOS'
  const userId = session?.user?.id ? Number(session.user.id) : null

  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [responsavelId, setResponsavelId] = useState<string>('')
  const [contratos, setContratos] = useState<ContratoComAlteracoes[]>([])
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filtroClienteId, setFiltroClienteId] = useState('')
  const [filtroNumOs, setFiltroNumOs] = useState('')

  const [modalPropor, setModalPropor] = useState<{ subindice: SubIndiceItem; indiceLabel: string } | null>(null)

  useEffect(() => {
    if (!isGestao) return
    fetch('/api/faturamento/filtros')
      .then((r) => r.json())
      .then((j) => { if (j.data?.responsaveis) setResponsaveis(j.data.responsaveis) })
  }, [isGestao])

  useEffect(() => {
    if (userId && !isGestao) setResponsavelId(String(userId))
  }, [userId, isGestao])

  const fetchContratos = useCallback(async () => {
    if (!responsavelId && !isGestao) return
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (responsavelId) params.set('responsavel_id', responsavelId)
      else if (isGestao) params.set('todos', '1')
      const res = await fetch(`/api/faturamento/painel-acordos?${params.toString()}`)
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      const data: ContratoComAlteracoes[] = json.data ?? []
      setContratos(data)
      setExpandidos(new Set(data.map((c) => c.id)))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [responsavelId, isGestao])

  useEffect(() => { fetchContratos() }, [fetchContratos])

  const toggleExpand = (id: number) =>
    setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Options derived from loaded data
  const clienteOptions = useMemo(() => {
    const seen = new Set<string>()
    return contratos
      .filter((c) => { const k = String(c.cliente.id); if (seen.has(k)) return false; seen.add(k); return true })
      .map((c) => ({ value: String(c.cliente.id), label: c.cliente.nome }))
  }, [contratos])

  const osOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    contratos.forEach((c) =>
      c.subindices.forEach((s) => {
        if (s.num_os && !seen.has(s.num_os)) { seen.add(s.num_os); opts.push({ value: s.num_os, label: s.num_os }) }
      })
    )
    return opts
  }, [contratos])

  const filteredContratos = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroClienteId && String(c.cliente.id) !== filtroClienteId) return false
      if (filtroNumOs && !c.subindices.some((s) => s.num_os === filtroNumOs)) return false
      return true
    })
  }, [contratos, filtroClienteId, filtroNumOs])

  const { totalContratos, totalSubindices, prevPassado, prevAtual, prevProximo,
          mesPassadoLabel, mesAtualLabel, mesProximoLabel } = useMemo(() => {
    const allSubs = filteredContratos.flatMap((c) => c.subindices)
    const m = new Date().getMonth()
    const mp = m === 0 ? 11 : m - 1
    const mn = m === 11 ? 0 : m + 1
    const sumMes = (idx: number) => allSubs.reduce((acc, s) => acc + (Number(s[MESES[idx] as MesKey]) || 0), 0)
    return {
      totalContratos: filteredContratos.length,
      totalSubindices: allSubs.length,
      prevPassado: sumMes(mp),
      prevAtual:   sumMes(m),
      prevProximo: sumMes(mn),
      mesPassadoLabel: MESES_LABELS[mp],
      mesAtualLabel:   MESES_LABELS[m],
      mesProximoLabel: MESES_LABELS[mn],
    }
  }, [filteredContratos])

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'

  return (
    <div className="flex flex-col h-full">

      {/* ── Zona congelada ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4">

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">Meu Painel — Acordos</h2>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <MetricCard label="Total de contratos" value={String(totalContratos)} />
          <MetricCard label={`Previsão ${mesPassadoLabel}.`} sub="mês passado" value={formatCurrency(prevPassado)} />
          <MetricCard label={`Previsão ${mesAtualLabel}.`}   sub="mês atual"   value={formatCurrency(prevAtual)} />
          <MetricCard label={`Previsão ${mesProximoLabel}.`} sub="próximo mês" value={formatCurrency(prevProximo)} />
        </div>

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 mb-3 flex gap-1.5 items-end">
          {isGestao && (
            <div className="flex-1 min-w-0">
              <label className={fLbl}>Responsável</label>
              <SearchableSelect
                value={responsavelId}
                onChange={setResponsavelId}
                options={responsaveis.map((r) => ({ value: String(r.id), label: r.nome }))}
                emptyLabel="Todos os responsáveis"
              />
            </div>
          )}
          <div className="flex-[2] min-w-0">
            <label className={fLbl}>Cliente</label>
            <SearchableSelect
              value={filtroClienteId}
              onChange={setFiltroClienteId}
              options={clienteOptions}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className={fLbl}>Nº OS</label>
            <SearchableSelect
              value={filtroNumOs}
              onChange={setFiltroNumOs}
              options={osOptions}
              emptyLabel="Todas"
            />
          </div>
          <div className="flex-shrink-0 flex items-end">
            <button
              onClick={() => { setFiltroClienteId(''); setFiltroNumOs('') }}
              className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-2">{error}</div>
        )}

        {!loading && (
          <p className="text-[11px] text-gray-500 mb-2">
            {totalContratos} contrato{totalContratos !== 1 ? 's' : ''} · {totalSubindices} sub-índice{totalSubindices !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
        ) : filteredContratos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {isGestao && !responsavelId
              ? 'Selecione um responsável ou aguarde o carregamento de todos os contratos.'
              : 'Nenhum contrato vinculado a este responsável.'}
          </div>
        ) : (
          <PainelTable
            contratos={filteredContratos}
            expandidos={expandidos}
            onToggle={toggleExpand}
            isGestao={isGestao}
            onPropor={(sub, label) => setModalPropor({ subindice: sub, indiceLabel: label })}
          />
        )}
      </div>

      {modalPropor && (
        <ProporAlteracaoModal
          open={true}
          onClose={() => setModalPropor(null)}
          onSuccess={() => fetchContratos()}
          subindice={modalPropor.subindice}
          indiceLabel={modalPropor.indiceLabel}
        />
      )}
    </div>
  )
}

// ── Tabela ────────────────────────────────────────────────────────────────────

interface PainelTableProps {
  contratos: ContratoComAlteracoes[]
  expandidos: Set<number>
  onToggle: (id: number) => void
  isGestao: boolean
  onPropor: (sub: SubIndiceItem, indiceLabel: string) => void
}

function PainelTable({ contratos, expandidos, onToggle, isGestao, onPropor }: PainelTableProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hoveredKey,  setHoveredKey]  = useState<string | null>(null)

  const TH  = 'sticky top-[42px] bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap select-none border-b border-green-dark'
  const thF = (shadow?: boolean) => cn(TH, 'z-[20]', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
  const thS = cn(TH, 'z-[10]')

  // Totalizadores
  const totVlrTotal   = contratos.reduce((a, c) => a + (c.valor_contrato ?? 0), 0)
  const totFaturado   = contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => b + s.total_faturado, 0), 0)
  const totDisponivel = contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => b + Math.max(0, s.valor_total - s.total_faturado), 0), 0)
  const totMeses = MESES.map((m) =>
    contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => b + (Number(s[m as MesKey]) || 0), 0), 0)
  )

  const rowBgContract = (key: string) =>
    selectedKey === key ? '#E0E0E0' : hoveredKey === key ? '#C8E6C9' : '#EAF4EA'
  const rowBgSub = (key: string) =>
    selectedKey === key ? '#EEEEEE' : hoveredKey === key ? '#F0F4F0' : '#ffffff'

  return (
    <div className="border border-gray-200 rounded-md h-full" style={{ overflow: 'auto' }}>
      <table className="border-collapse text-[11px]" style={{ minWidth: `${MIN_W}px`, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: W.indice }} /><col style={{ width: W.cliente }} /><col style={{ width: W.descricao }} />
          <col style={{ width: W.os }} /><col style={{ width: W.ano }} /><col style={{ width: W.acordo }} />
          <col style={{ width: W.responsavel }} /><col style={{ width: W.status }} />
          <col style={{ width: W.vlrTotal }} /><col style={{ width: W.faturado }} /><col style={{ width: W.disponivel }} />
          {MESES.map((m) => <col key={m} style={{ width: W.mes }} />)}
          <col style={{ width: W.acoes }} />
        </colgroup>

        <thead>
          {/* ── Linha TOTAIS ── */}
          {(() => {
            const TC  = 'sticky top-0 z-[30] px-2 py-[4px] bg-[#C8E6C9] text-[11px] whitespace-nowrap border-b-2 border-green-primary'
            const tcF = (shadow?: boolean) => cn(TC, 'z-[40] font-bold', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
            return (
              <tr>
                <td className={tcF()} style={{ left: L.indice }}>TOTAIS</td>
                <td className={tcF()} style={{ left: L.cliente }}></td>
                <td className={tcF(true)} style={{ left: L.descricao }}></td>
                {/* os, ano, acordo, responsavel, status */}
                {Array.from({ length: 5 }, (_, i) => <td key={i} className={TC}></td>)}
                <td className={TC}><span className="font-bold text-[#1565C0]">{formatCurrency(totVlrTotal)}</span></td>
                <td className={TC}><span className="font-bold text-green-700">{formatCurrency(totFaturado)}</span></td>
                <td className={TC}><span className="font-bold text-orange-600">{formatCurrency(totDisponivel)}</span></td>
                {totMeses.map((v, mi) => (
                  <td key={mi} className={TC}>
                    {v > 0
                      ? <span className="font-semibold text-[#1565C0] text-[10px]">{formatCurrency(v)}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                ))}
                <td className={TC}></td>
              </tr>
            )
          })()}

          {/* ── Cabeçalhos ── */}
          <tr>
            <th className={thF()} style={{ left: L.indice }}>Índice</th>
            <th className={thF()} style={{ left: L.cliente }}>Cliente</th>
            <th className={thF(true)} style={{ left: L.descricao }}>Descrição / Evento</th>
            <th className={thS}>Nº OS</th>
            <th className={thS}>Ano</th>
            <th className={thS}>Nº Acordo</th>
            <th className={thS}>Responsável</th>
            <th className={thS}>Status Fat.</th>
            <th className={thS}>Valor Total</th>
            <th className={thS}>Faturado</th>
            <th className={thS}>Disponível</th>
            {MESES_LABELS.map((m) => <th key={m} className={thS}>{m}</th>)}
            <th className={thS}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {contratos.map((contrato) => {
            const expanded = expandidos.has(contrato.id)
            const ctKey    = `ct-${contrato.id}`
            const ctBg     = rowBgContract(ctKey)

            const ctVlrTotal   = contrato.valor_contrato ?? 0
            const ctFaturado   = contrato.subindices.reduce((a, s) => a + s.total_faturado, 0)
            const ctDisponivel = Math.max(0, ctVlrTotal - ctFaturado)

            const mF = (shadow?: boolean) =>
              cn('px-2 py-[5px] font-semibold text-[11px] whitespace-nowrap sticky z-[5] cursor-pointer',
                shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.10)]')
            const mBase = 'px-2 py-[5px] font-semibold text-[11px] whitespace-nowrap cursor-pointer'

            const trProps = {
              onClick:      () => setSelectedKey((p) => p === ctKey ? null : ctKey),
              onMouseEnter: () => setHoveredKey(ctKey),
              onMouseLeave: () => setHoveredKey(null),
            }

            return [
              /* ── Linha do contrato ── */
              <tr key={ctKey} className="border-b border-gray-200" {...trProps}>
                <td className={mF()} style={{ left: L.indice, background: ctBg }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggle(contrato.id) }}
                    className="flex items-center gap-1 font-bold text-green-dark hover:text-green-primary"
                  >
                    <span className="text-[9px]">{expanded ? '▼' : '▶'}</span>
                    {contrato.indice}
                  </button>
                </td>
                <td className={mF()} style={{ left: L.cliente, background: ctBg }}>
                  <span className="font-semibold text-blue-700 truncate block" style={{ maxWidth: W.cliente - 16 }}>
                    {contrato.cliente.nome}
                  </span>
                </td>
                <td className={mF(true)} style={{ left: L.descricao, background: ctBg }}>
                  <span className="line-clamp-2 whitespace-normal" title={contrato.descricao ?? ''}>
                    {contrato.descricao ?? '—'}
                  </span>
                </td>
                <td className={mBase} style={{ background: ctBg }}>—</td>
                <td className={mBase} style={{ background: ctBg }}>
                  <span className="bg-gray-200 text-gray-700 rounded px-1 text-[10px]">{contrato.ano_referencia}</span>
                </td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.num_acordo ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.responsavel?.nome ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}><StatusBadge status={contrato.status} /></td>
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrTotal > 0
                    ? <span className="font-bold text-[#1565C0]">{formatCurrency(ctVlrTotal)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {ctFaturado > 0
                    ? <span className="font-bold text-green-700">{formatCurrency(ctFaturado)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrTotal > 0
                    ? <span className="font-bold text-orange-600">{formatCurrency(ctDisponivel)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                {MESES.map((m) => {
                  const prev = contrato.subindices.reduce((a, s) => a + (Number(s[m as MesKey]) || 0), 0)
                  return (
                    <td key={m} className={mBase} style={{ background: ctBg }}>
                      {prev > 0
                        ? <span className="text-[10px] text-[#1565C0]">{formatCurrency(prev)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )
                })}
                <td className={mBase} style={{ background: ctBg }}></td>
              </tr>,

              /* ── Linhas de sub-índices ── */
              ...(expanded ? contrato.subindices.map((sub) => {
                const indiceLabel = `${contrato.indice}.${sub.ordem}`
                const subKey      = `sub-${sub.id}`
                const subBg       = rowBgSub(subKey)
                const subAno      = getSubAno(sub.data_inicio, contrato.ano_referencia)
                const subDisponivel = Math.max(0, sub.valor_total - sub.total_faturado)

                const sF = (shadow?: boolean) =>
                  cn('px-2 py-[4px] text-[11px] whitespace-nowrap sticky z-[5] cursor-pointer',
                    shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.07)]')
                const sBase = 'px-2 py-[4px] text-[11px] whitespace-nowrap cursor-pointer'

                return (
                  <tr key={subKey} className="border-b border-gray-100"
                    onClick={() => setSelectedKey((p) => p === subKey ? null : subKey)}
                    onMouseEnter={() => setHoveredKey(subKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    <td className={sF()} style={{ left: L.indice, background: subBg }}>
                      <span className="pl-4 text-[10px] text-gray-500">{indiceLabel}</span>
                    </td>
                    <td className={sF()} style={{ left: L.cliente, background: subBg }}>
                      <span className="text-gray-500 truncate block" style={{ maxWidth: W.cliente - 16 }}>
                        {contrato.cliente.nome}
                      </span>
                    </td>
                    <td className={sF(true)} style={{ left: L.descricao, background: subBg }}>
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="line-clamp-2 whitespace-normal flex-1" title={sub.descricao}>
                          {sub.descricao}
                        </span>
                        {sub.alteracao_pendente && (
                          <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap shrink-0">
                            Prop. pendente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="text-gray-600">{sub.num_os ?? '—'}</span>
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="bg-gray-100 text-gray-400 rounded px-1 text-[10px]">{subAno}</span>
                    </td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={sBase} style={{ background: subBg }}>
                      <StatusBadge status={sub.status_faturamento} />
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="text-[#1565C0]">{formatCurrency(sub.valor_total)}</span>
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      {sub.total_faturado > 0
                        ? <span className="text-green-700">{formatCurrency(sub.total_faturado)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="text-orange-600">{formatCurrency(subDisponivel)}</span>
                    </td>
                    {MESES.map((m) => {
                      const v = Number(sub[m as MesKey]) || 0
                      const alt = sub.alteracao_pendente
                      const hasPendingChange = alt != null &&
                        (alt[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null) !==
                        (alt[`${m}_de`  as keyof PrevisaoAlteracaoItem] as number | null)
                      return (
                        <td key={m} className={sBase} style={{ background: subBg }}>
                          {v > 0
                            ? <span className={cn('text-[10px]', hasPendingChange ? 'text-amber-600 font-semibold' : 'text-[#1565C0]')}>
                                {formatCurrency(v)}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      )
                    })}
                    <td className={sBase} style={{ background: subBg }} onClick={(e) => e.stopPropagation()}>
                      {!isGestao && (
                        <button
                          onClick={() => onPropor(sub, indiceLabel)}
                          className="bg-green-primary text-white rounded px-1.5 py-0.5 text-[10px] hover:bg-green-dark whitespace-nowrap"
                        >
                          Editar prev.
                        </button>
                      )}
                    </td>
                  </tr>
                )
              }) : []),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
