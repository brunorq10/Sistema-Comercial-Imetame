'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { SearchableSelect, SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { AcoesMenu } from '@/components/ui/AcoesMenu'
import { EditarSubIndiceModal } from '@/components/forms/EditarSubIndiceModal'
import { HistoricoFaturamentoModal } from '@/components/forms/HistoricoFaturamentoModal'
import { LancarNFContratoModal } from '@/components/forms/LancarNFContratoModal'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { SubIndiceItem, PrevisaoAlteracaoItem, ContratoItem } from '@/types'
import { CLASSIFICACAO_LABELS, RAMO_ATUACAO_LABELS } from '@/types'
import { compareContratos, nextSort, sortIndicator, type SortState } from '@/lib/sortContratos'

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
type MesKey = typeof MESES[number]

// ── Column widths (mirrors FaturamentoContratoTable) ─────────────────────────
const W = {
  indice: 120, cliente: 125, cliente_final: 130, cidade: 110, descricao: 240,
  classificacao: 110, ramo: 140, os: 110, anoRef: 70, acordo: 120, proposta: 110,
  dtInicio: 90, dtFim: 90, statusFat: 90,
  vlrTotal: 155, vlrFat: 150, saldo: 145,
  responsavel: 130, comentarios: 140,
  mes: 130, prevAnos: 130, acoes: 64,
}
const L = {
  indice: 0,
  cliente: W.indice,
  cliente_final: W.indice + W.cliente,
  cidade: W.indice + W.cliente + W.cliente_final,
  descricao: W.indice + W.cliente + W.cliente_final + W.cidade,
}
const FROZEN_TOTAL = L.descricao + W.descricao
const MIN_W = FROZEN_TOTAL + W.classificacao + W.ramo + W.os + W.anoRef + W.acordo + W.proposta +
              W.dtInicio + W.dtFim + W.statusFat + W.vlrTotal + W.vlrFat + W.saldo +
              W.responsavel + W.comentarios + 12 * W.mes + W.prevAnos + W.acoes

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
  classificacao: string | null
  cidade: string | null
  estado: string | null
  cliente: { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
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

// Valor por extenso (sem abreviação M/K)
function fmtM(v: number) {
  return formatCurrency(v)
}

// ── Cards no estilo "Indicadores Acordos" — Visão consolidada do ano ──────────
function BigCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-[22px] font-bold leading-none tracking-tight" style={{ color: accent }}>{fmtM(value)}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  )
}
function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3.5 py-2.5">
      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-[15px] font-bold text-gray-800 leading-none">{fmtM(value)}</p>
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

  const [filtroNumOs,          setFiltroNumOs]          = useState<string[]>([])
  const [filtroClienteId,      setFiltroClienteId]      = useState<string[]>([])
  const [filtroClienteFinalId, setFiltroClienteFinalId] = useState<string[]>([])
  const [filtroStatusFat,      setFiltroStatusFat]      = useState<string[]>([])
  const [filtroRamo,           setFiltroRamo]           = useState<string[]>([])

  const [modalEditar, setModalEditar] = useState<{
    subindice: SubIndiceItem; indiceLabel: string; anoRef: number
  } | null>(null)
  const [modalHistorico, setModalHistorico] = useState<{
    tipo: 'contrato' | 'subindice'; id: number; titulo: string
  } | null>(null)
  const [lancarFat, setLancarFat] = useState<{ contrato: ContratoComAlteracoes; subindice: SubIndiceComAlteracao } | null>(null)

  useEffect(() => {
    fetch('/api/faturamento/filtros')
      .then((r) => r.json())
      .then((j) => { if (j.data?.responsaveis) setResponsaveis(j.data.responsaveis) })
  }, [])

  // Perfil ACORDOS abre no próprio painel; demais perfis (visualização livre)
  // abrem em "Todos os responsáveis".
  useEffect(() => {
    if (userId && perfil === 'ACORDOS') setResponsavelId(String(userId))
  }, [userId, perfil])

  const fetchContratos = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (responsavelId) params.set('responsavel_id', responsavelId)
      else params.set('todos', '1')
      const res = await fetch(`/api/faturamento/painel-acordos?${params.toString()}`)
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      const data: ContratoComAlteracoes[] = json.data ?? []
      setContratos(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [responsavelId])

  useEffect(() => { fetchContratos() }, [fetchContratos])

  // Ao trocar de responsável (troca de contexto) recolhe tudo; salvar mantém a expansão
  useEffect(() => { setExpandidos(new Set()) }, [responsavelId])

  const toggleExpand = (id: number) =>
    setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const clienteOptions = useMemo(() => {
    const seen = new Set<string>()
    return contratos
      .filter((c) => { const k = String(c.cliente.id); if (seen.has(k)) return false; seen.add(k); return true })
      .map((c) => ({ value: String(c.cliente.id), label: c.cliente.nome }))
  }, [contratos])

  const osOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    contratos.forEach((c) => {
      const os = (c as ContratoComAlteracoes).num_os
      if (os && !seen.has(os)) { seen.add(os); opts.push({ value: os, label: os }) }
    })
    return opts
  }, [contratos])

  const clienteFinalOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    contratos.forEach((c) => {
      const cf = (c as ContratoComAlteracoes).cliente_final
      if (cf) {
        const k = String(cf.id)
        if (!seen.has(k)) { seen.add(k); opts.push({ value: k, label: cf.nome }) }
      }
    })
    return opts
  }, [contratos])

  const ramoOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    contratos.forEach((c) => {
      const r = c.cliente.ramo_atuacao
      if (r && !seen.has(r)) {
        seen.add(r)
        const labels: Record<string, string> = {
          PAPEL_CELULOSE: 'Papel e Celulose', SIDERURGIA: 'Siderurgia',
          MINERACAO: 'Mineração', OLEO_GAS: 'Óleo e Gás', OUTROS: 'Outros',
        }
        opts.push({ value: r, label: labels[r] ?? r })
      }
    })
    return opts
  }, [contratos])

  const filteredContratos = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroClienteId.length      && !filtroClienteId.includes(String(c.cliente.id))) return false
      const os = (c as ContratoComAlteracoes).num_os
      if (filtroNumOs.length          && !(os && filtroNumOs.includes(os))) return false
      const cf = (c as ContratoComAlteracoes).cliente_final
      if (filtroClienteFinalId.length && !filtroClienteFinalId.includes(String(cf?.id ?? ''))) return false
      if (filtroStatusFat.length      && !c.subindices.some((s) => filtroStatusFat.includes(s.status_faturamento))) return false
      if (filtroRamo.length           && !(c.cliente.ramo_atuacao && filtroRamo.includes(c.cliente.ramo_atuacao))) return false
      return true
    })
  }, [contratos, filtroClienteId, filtroNumOs, filtroClienteFinalId, filtroStatusFat, filtroRamo])

  const indicators = useMemo(() => {
    const allSubs = filteredContratos.flatMap((c) => c.subindices)
    const allNFs  = allSubs.flatMap((s) => s.notas_fiscais ?? [])

    const now = new Date()
    const m   = now.getMonth()
    const mp  = m === 0 ? 11 : m - 1
    const mn  = m === 11 ? 0 : m + 1
    const anoAtual   = now.getFullYear()
    const anoProximo = anoAtual + 1
    const anoMpYear  = m === 0 ? anoAtual - 1 : anoAtual
    const anoMnYear  = m === 11 ? anoProximo  : anoAtual

    const subsAnoAtual   = allSubs.filter((s) => getSubAno(s.data_inicio, anoAtual) === anoAtual)
    const subsAnoProximo = allSubs.filter((s) => getSubAno(s.data_inicio, anoProximo) === anoProximo)
    const subsProxMes    = m === 11 ? subsAnoProximo : subsAnoAtual

    const sumMes = (subs: typeof allSubs, idx: number) =>
      subs.reduce((a, s) => a + (Number(s[MESES[idx] as MesKey]) || 0), 0)
    const sumAno = (subs: typeof allSubs) =>
      subs.reduce((a, s) => a + MESES.reduce((b, mk) => b + (Number(s[mk as MesKey]) || 0), 0), 0)
    const sumNFMes = (mesIdx: number, ano: number) =>
      allNFs
        .filter((nf) => { const d = new Date(nf.data_emissao); return d.getFullYear() === ano && d.getMonth() === mesIdx })
        .reduce((a, nf) => a + nf.valor_atribuido, 0)
    const sumNFAno = (ano: number) =>
      allNFs
        .filter((nf) => new Date(nf.data_emissao).getFullYear() === ano)
        .reduce((a, nf) => a + nf.valor_atribuido, 0)

    return {
      totalContratos:       filteredContratos.length,
      totalSubindices:      allSubs.length,
      valorTotalContratado: filteredContratos.reduce((a, c) => a + (c.valor_contrato ?? 0), 0),
      prevMesAtual:  sumMes(subsAnoAtual, m),
      fatMesAtual:   sumNFMes(m, anoAtual),
      fatUltimoMes:  sumNFMes(mp, anoMpYear),
      prevProxMes:   sumMes(subsProxMes, mn),
      prevAnoAtual:  sumAno(subsAnoAtual),
      fatAnoAtual:   sumNFAno(anoAtual),
      prevProxAno:   sumAno(subsAnoProximo),
      prevAnosSeguintes: filteredContratos.reduce((a, c) => a + (c.prev_anos_seguintes ?? 0), 0),
      mesAtualLabel:  MESES_LABELS[m],
      mesPassadoLabel: MESES_LABELS[mp],
      mesProximoLabel: MESES_LABELS[mn],
      anoAtual,
      anoProximo,
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

        {/* Indicadores — Visão consolidada do ano */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BigCard label={`Total faturado no ano (${indicators.anoAtual})`} value={indicators.fatAnoAtual} accent="#16A34A"
              sub={`${(indicators.prevAnoAtual > 0 ? (indicators.fatAnoAtual / indicators.prevAnoAtual) * 100 : 0).toFixed(1).replace('.', ',')}% da previsão`} />
            <BigCard label="Previsão de faturamento no ano" value={indicators.prevAnoAtual} accent="#1565C0" sub="meta anual de receita" />
            <BigCard label="Falta faturar no ano" value={Math.max(0, indicators.prevAnoAtual - indicators.fatAnoAtual)} accent="#D97706" sub="saldo até dezembro" />
            <BigCard label="Previsão anos seguintes" value={indicators.prevAnosSeguintes} accent="#475569" sub="contratos multi-ano" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniCard label={`Previsão mês atual (${indicators.mesAtualLabel})`} value={indicators.prevMesAtual} />
            <MiniCard label={`Faturado mês atual (${indicators.mesAtualLabel})`} value={indicators.fatMesAtual} />
            <MiniCard label={`Faturado último mês (${indicators.mesPassadoLabel})`} value={indicators.fatUltimoMes} />
            <MiniCard label={`Previsão próximo mês (${indicators.mesProximoLabel})`} value={indicators.prevProxMes} />
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 mb-3 flex gap-1.5 items-end flex-wrap">
          <div className="flex-1 min-w-[130px]">
            <label className={fLbl}>Responsável</label>
            <SearchableSelect
              value={responsavelId}
              onChange={setResponsavelId}
              options={responsaveis.map((r) => ({ value: String(r.id), label: r.nome }))}
              emptyLabel="Todos os responsáveis"
            />
          </div>
          <div className="flex-1 min-w-[110px]">
            <label className={fLbl}>Nº OS</label>
            <SearchableMultiSelect values={filtroNumOs} onChange={setFiltroNumOs} options={osOptions} emptyLabel="Todas" />
          </div>
          <div className="flex-[2] min-w-[130px]">
            <label className={fLbl}>Cliente</label>
            <SearchableMultiSelect values={filtroClienteId} onChange={setFiltroClienteId} options={clienteOptions} />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className={fLbl}>Cliente Final</label>
            <SearchableMultiSelect values={filtroClienteFinalId} onChange={setFiltroClienteFinalId} options={clienteFinalOptions} />
          </div>
          <div className="flex-1 min-w-[110px]">
            <label className={fLbl}>Status Fat.</label>
            <SearchableMultiSelect
              values={filtroStatusFat}
              onChange={setFiltroStatusFat}
              options={[
                { value: 'A_FATURAR', label: 'A faturar' },
                { value: 'FATURADO',  label: 'Faturado' },
                { value: 'PARCIAL',   label: 'Parcial' },
                { value: 'CANCELADO', label: 'Cancelado' },
              ]}
            />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className={fLbl}>Ramo</label>
            <SearchableMultiSelect values={filtroRamo} onChange={setFiltroRamo} options={ramoOptions} />
          </div>
          <div className="flex-shrink-0 flex items-end">
            <button
              onClick={() => { setFiltroClienteId([]); setFiltroNumOs([]); setFiltroClienteFinalId([]); setFiltroStatusFat([]); setFiltroRamo([]) }}
              className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] hover:bg-gray-100 transition-colors"
            >✕ Limpar</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-2">{error}</div>
        )}

        {!loading && (
          <p className="text-[11px] text-gray-500 mb-2">
            {indicators.totalContratos} contrato{indicators.totalContratos !== 1 ? 's' : ''} · {indicators.totalSubindices} sub-índice{indicators.totalSubindices !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        {loading && contratos.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
        ) : filteredContratos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {!responsavelId
              ? 'Nenhum contrato encontrado.'
              : 'Nenhum contrato vinculado a este responsável.'}
          </div>
        ) : (
          <PainelTable
            contratos={filteredContratos}
            expandidos={expandidos}
            onToggle={toggleExpand}
            canEdit={isGestao || responsavelId === String(userId)}
            onEditar={(sub, label, anoRef) => setModalEditar({ subindice: sub, indiceLabel: label, anoRef })}
            onHistorico={(tipo, id, titulo) => setModalHistorico({ tipo, id, titulo })}
            onLancarFaturamento={(contrato, sub) => setLancarFat({ contrato, subindice: sub })}
          />
        )}
      </div>

      {modalEditar && (
        <EditarSubIndiceModal
          open={true}
          onClose={() => setModalEditar(null)}
          onSuccess={() => { fetchContratos(); setModalEditar(null) }}
          onDelete={() => { fetchContratos(); setModalEditar(null) }}
          subindice={modalEditar.subindice}
          indiceLabel={modalEditar.indiceLabel}
          anoRef={modalEditar.anoRef}
          readOnly={!isGestao}
          blockPastMonths={!isGestao}
          useApprovalFlow={!isGestao && responsavelId === String(userId)}
        />
      )}
      {modalHistorico && (
        <HistoricoFaturamentoModal
          open={true}
          onClose={() => setModalHistorico(null)}
          tipo={modalHistorico.tipo}
          itemId={modalHistorico.id}
          titulo={modalHistorico.titulo}
        />
      )}
      {lancarFat && (
        <LancarNFContratoModal
          open={true}
          onClose={() => setLancarFat(null)}
          onSuccess={() => fetchContratos()}
          contrato={lancarFat.contrato as unknown as ContratoItem}
          subindice={lancarFat.subindice}
          approvalFlow={!isGestao}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function nfFaturadoMes(notas: SubIndiceItem['notas_fiscais'], mesIdx: number, ano: number): number {
  return notas
    .filter((nf) => nf.ativa)
    .filter((nf) => { const d = new Date(nf.data_emissao); return d.getFullYear() === ano && d.getMonth() === mesIdx })
    .reduce((acc, nf) => acc + nf.valor_atribuido, 0)
}
function nfFaturadoAnual(notas: SubIndiceItem['notas_fiscais']): number {
  return notas.filter((nf) => nf.ativa).reduce((acc, nf) => acc + nf.valor_atribuido, 0)
}
function fatColorClass(fat: number, prev: number) { return fat < prev ? 'text-red-400' : 'text-green-500' }
function SaldoCell({ saldo, className }: { saldo: number; className?: string }) {
  if (saldo > 0.01) return <span className={cn('text-orange-600 font-bold', className)}>{formatCurrency(saldo)}</span>
  if (saldo < -0.01) return <span className={cn('text-blue-600 font-bold', className)}>{formatCurrency(Math.abs(saldo))} acima</span>
  return <span className={cn('text-green-600 font-bold', className)}>{formatCurrency(0)}</span>
}

// ── Tabela ────────────────────────────────────────────────────────────────────

interface PainelTableProps {
  contratos: ContratoComAlteracoes[]
  expandidos: Set<number>
  onToggle: (id: number) => void
  canEdit: boolean
  onEditar: (sub: SubIndiceItem, indiceLabel: string, anoRef: number) => void
  onHistorico: (tipo: 'contrato' | 'subindice', id: number, titulo: string) => void
  onLancarFaturamento: (contrato: ContratoComAlteracoes, sub: SubIndiceComAlteracao) => void
}

function PainelTable({ contratos, expandidos, onToggle, canEdit, onEditar, onHistorico, onLancarFaturamento }: PainelTableProps) {
  const router = useRouter()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hoveredKey,  setHoveredKey]  = useState<string | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const contratosOrd = useMemo(
    () => (sort ? [...contratos].sort((a, b) => compareContratos(a, b, sort)) : contratos),
    [contratos, sort],
  )

  // Altura real da linha TOTAIS para grudar o cabeçalho de colunas exatamente
  // abaixo dela (evita faixa vazia com conteúdo aparecendo por baixo no scroll).
  const totalsRef = useRef<HTMLTableRowElement>(null)
  const [totalsH, setTotalsH] = useState(42)
  useEffect(() => {
    const el = totalsRef.current
    if (!el) return
    const update = () => setTotalsH(el.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const TH   = 'sticky bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap select-none border-b border-green-dark'
  const thF  = (shadow?: boolean) => cn(TH, 'z-[20]', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
  const thS  = cn(TH, 'z-[10]')
  const thP  = cn(TH, 'bg-[#6A1B9A] z-[10]')

  const sh = (key: string, label: string, opts?: { frozen?: boolean; shadow?: boolean; left?: number }) => (
    <th
      className={cn(opts?.frozen ? thF(opts.shadow) : thS, 'cursor-pointer hover:bg-green-dark')}
      style={{ top: totalsH, left: opts?.frozen ? opts.left : undefined }}
      onClick={() => setSort((s) => nextSort(s, key))}
      title="Clique para ordenar"
    >
      {label}{sortIndicator(sort, key)}
    </th>
  )

  const rowBgContract = (key: string) =>
    selectedKey === key ? '#E0E0E0' : hoveredKey === key ? '#C8E6C9' : '#EAF4EA'
  const rowBgSub = (key: string) =>
    selectedKey === key ? '#EEEEEE' : hoveredKey === key ? '#F0F4F0' : '#ffffff'

  // ── Totalizadores ──────────────────────────────────────────────────────────
  const totVlrTotal = contratos.reduce((a, c) => a + (c.valor_contrato ?? 0), 0)
  const totVlrFat   = contratos.reduce((a, c) =>
    a + c.subindices.reduce((b, s) => b + nfFaturadoAnual(s.notas_fiscais), 0), 0)
  const totMeses = MESES.map((m, mi) => ({
    prev: contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => b + (s[m] ?? 0), 0), 0),
    fat:  contratos.reduce((a, c) => a + c.subindices.reduce((b, s) =>
      b + nfFaturadoMes(s.notas_fiscais, mi, getSubAno(s.data_inicio, c.ano_referencia)), 0), 0),
  }))

  return (
    <div className="border border-gray-200 rounded-md h-full" style={{ overflow: 'auto' }}>
      <table className="border-collapse text-[11px]" style={{ minWidth: `${MIN_W}px`, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: W.indice }} /><col style={{ width: W.cliente }} /><col style={{ width: W.cliente_final }} /><col style={{ width: W.cidade }} /><col style={{ width: W.descricao }} />
          <col style={{ width: W.classificacao }} /><col style={{ width: W.ramo }} /><col style={{ width: W.os }} />
          <col style={{ width: W.anoRef }} /><col style={{ width: W.acordo }} /><col style={{ width: W.proposta }} />
          <col style={{ width: W.dtInicio }} /><col style={{ width: W.dtFim }} /><col style={{ width: W.statusFat }} />
          <col style={{ width: W.vlrTotal }} /><col style={{ width: W.vlrFat }} /><col style={{ width: W.saldo }} />
          <col style={{ width: W.responsavel }} /><col style={{ width: W.comentarios }} />
          {MESES.map((m) => <col key={m} style={{ width: W.mes }} />)}
          <col style={{ width: W.prevAnos }} /><col style={{ width: W.acoes }} />
        </colgroup>

        <thead>
          {/* ── Linha totalizadora ── */}
          {(() => {
            const TC  = 'sticky top-0 z-[30] px-2 py-[4px] bg-[#C8E6C9] text-[11px] whitespace-nowrap border-b-2 border-green-primary'
            const tcF = (shadow?: boolean) => cn(TC, 'z-[40] font-bold', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
            return (
              <tr ref={totalsRef}>
                <td className={tcF()} style={{ left: L.indice }}>TOTAIS</td>
                <td className={tcF()} style={{ left: L.cliente }}></td>
                <td className={tcF()} style={{ left: L.cliente_final }}></td>
                <td className={tcF()} style={{ left: L.cidade }}></td>
                <td className={tcF(true)} style={{ left: L.descricao }}></td>
                {Array.from({ length: 9 }, (_, i) => <td key={i} className={TC}></td>)}
                <td className={TC}><span className="font-bold text-[#1565C0]">{formatCurrency(totVlrTotal)}</span></td>
                <td className={TC}><span className="font-bold text-green-700">{formatCurrency(totVlrFat)}</span></td>
                <td className={TC}><SaldoCell saldo={totVlrTotal - totVlrFat} /></td>
                <td className={TC}></td><td className={TC}></td>
                {totMeses.map(({ prev, fat }, mi) => (
                  <td key={mi} className={TC}>
                    {prev === 0 && fat === 0 ? <span className="text-gray-400">—</span> : (
                      <div className="flex flex-col gap-0.5">
                        {prev > 0 && <span className="text-[10px] text-[#1565C0] font-semibold">P {formatCurrency(prev)}</span>}
                        {fat  > 0 && <span className={cn('text-[10px] font-semibold', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                      </div>
                    )}
                  </td>
                ))}
                <td className={TC}>
                  {(() => { const t = contratos.reduce((a, c) => a + c.prev_anos_seguintes, 0); return t > 0 ? <span className="text-[#6A1B9A] font-semibold">{formatCurrency(t)}</span> : <span className="text-gray-400">—</span> })()}
                </td>
                <td className={TC}></td>
              </tr>
            )
          })()}

          {/* ── Cabeçalhos ── */}
          <tr>
            {sh('indice', 'Índice', { frozen: true, left: L.indice })}
            {sh('cliente', 'Cliente', { frozen: true, left: L.cliente })}
            {sh('cliente_final', 'Cliente Final', { frozen: true, left: L.cliente_final })}
            {sh('cidade', 'Cidade/UF', { frozen: true, left: L.cidade })}
            <th className={thF(true)} style={{ top: totalsH, left: L.descricao }}>Descrição / Evento</th>
            {sh('classificacao', 'Classificação')}
            {sh('ramo', 'Ramo')}
            {sh('num_os', 'Nº OS')}
            {sh('ano', 'Ano')}
            {sh('num_acordo', 'Nº Acordo')}
            {sh('num_proposta', 'Nº Proposta')}
            {sh('data_inicio', 'Dt. Início')}
            {sh('data_fim', 'Dt. Fim')}
            {sh('status', 'Status Fat.')}
            {sh('valor_total', 'Valor Total Contrato')}
            {sh('valor_faturado', 'Valor Total Faturado')}
            {sh('saldo', 'Saldo a Faturar')}
            {sh('responsavel', 'Responsável')}
            <th className={thS} style={{ top: totalsH }}>Comentários</th>
            {MESES_LABELS.map((m) => <th key={m} className={thS} style={{ top: totalsH }}>{m}</th>)}
            <th className={thP} style={{ top: totalsH }}>Previsão prox. anos</th>
            <th className={thS} style={{ top: totalsH }}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {contratosOrd.map((contrato) => {
            const expanded = expandidos.has(contrato.id)
            const ctKey    = `ct-${contrato.id}`
            const ctBg     = rowBgContract(ctKey)

            const ctVlrFat = contrato.subindices.reduce((a, s) => a + nfFaturadoAnual(s.notas_fiscais), 0)
            const ctVlrTotal = contrato.valor_contrato ?? 0
            const ctSaldo = ctVlrTotal - ctVlrFat

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
                  <button onClick={(e) => { e.stopPropagation(); onToggle(contrato.id) }}
                    className="flex items-center gap-1 font-bold text-green-dark hover:text-green-primary">
                    <span className="text-[9px]">{expanded ? '▼' : '▶'}</span>
                    {contrato.indice}
                  </button>
                </td>
                <td className={mF()} style={{ left: L.cliente, background: ctBg }}>
                  <span className="font-semibold text-blue-700 truncate block" style={{ maxWidth: W.cliente - 16 }}>{contrato.cliente.nome}</span>
                </td>
                <td className={mF()} style={{ left: L.cliente_final, background: ctBg }}>
                  <span className="text-gray-600 truncate block" style={{ maxWidth: W.cliente_final - 16 }}>{contrato.cliente_final?.nome ?? '—'}</span>
                </td>
                <td className={mF()} style={{ left: L.cidade, background: ctBg }}>
                  <span className="text-gray-600 text-[10px]">{[contrato.cidade, contrato.estado].filter(Boolean).join(' / ') || '—'}</span>
                </td>
                <td className={mF(true)} style={{ left: L.descricao, background: ctBg }}>
                  <span className="line-clamp-2 whitespace-normal" title={contrato.descricao ?? ''}>{contrato.descricao ?? '—'}</span>
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {contrato.classificacao
                    ? <span className="bg-blue-50 text-blue-700 rounded px-1.5 text-[10px] font-semibold">{CLASSIFICACAO_LABELS[contrato.classificacao as keyof typeof CLASSIFICACAO_LABELS]}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {contrato.cliente.ramo_atuacao
                    ? <span className="text-gray-600 text-[10px]">{RAMO_ATUACAO_LABELS[contrato.cliente.ramo_atuacao as keyof typeof RAMO_ATUACAO_LABELS] ?? contrato.cliente.ramo_atuacao}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {contrato.num_os ? <span className="text-gray-700 font-mono text-[10px]">{contrato.num_os}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  <span className="bg-gray-200 text-gray-700 rounded px-1 text-[10px]">{contrato.ano_referencia}</span>
                </td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.num_acordo ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.num_proposta ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>{formatDate(contrato.data_inicio)}</td>
                <td className={mBase} style={{ background: ctBg }}>{formatDate(contrato.data_fim)}</td>
                <td className={mBase} style={{ background: ctBg }}><StatusBadge status={contrato.status} /></td>
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrTotal > 0 ? <span className="font-bold text-[#1565C0]">{formatCurrency(ctVlrTotal)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrFat > 0 ? <span className="font-bold text-green-700">{formatCurrency(ctVlrFat)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrTotal > 0 ? <SaldoCell saldo={ctSaldo} /> : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.responsavel?.nome ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>—</td>
                {MESES.map((m, mi) => {
                  const prev = contrato.subindices.reduce((a, s) => a + (s[m] ?? 0), 0)
                  const fat  = contrato.subindices.reduce((a, s) =>
                    a + nfFaturadoMes(s.notas_fiscais, mi, getSubAno(s.data_inicio, contrato.ano_referencia)), 0)
                  return (
                    <td key={m} className={mBase} style={{ background: ctBg }}>
                      {prev === 0 && fat === 0 ? <span className="text-gray-300">—</span> : (
                        <div className="flex flex-col gap-0.5">
                          {prev > 0 && <span className="text-[10px] text-[#1565C0]">P {formatCurrency(prev)}</span>}
                          {fat  > 0 && <span className={cn('text-[10px]', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-[5px] font-semibold text-[11px] whitespace-nowrap cursor-pointer" style={{ background: '#F3E5F5' }}>
                  {contrato.prev_anos_seguintes > 0
                    ? <span className="text-[#6A1B9A] font-bold">{formatCurrency(contrato.prev_anos_seguintes)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <AcoesMenu items={[
                    { label: 'Visão geral', icon: '👁', destaque: true, onClick: () => router.push(`/acordos/faturamento/${contrato.id}?from=painel`) },
                    { label: 'Ver histórico', icon: '🕘', onClick: () => onHistorico('contrato', contrato.id, contrato.indice) },
                  ]} />
                </td>
              </tr>,

              /* ── Linhas de sub-índices ── */
              ...(expanded ? contrato.subindices.map((sub) => {
                const indiceLabel = `${contrato.indice}.${sub.ordem}`
                const subKey      = `sub-${sub.id}`
                const subBg       = rowBgSub(subKey)
                const subAno      = getSubAno(sub.data_inicio, contrato.ano_referencia)
                const subVlrFat   = nfFaturadoAnual(sub.notas_fiscais)
                const subSaldo    = sub.valor_total - subVlrFat

                const sF = (shadow?: boolean) =>
                  cn('px-2 py-[4px] text-[11px] whitespace-nowrap sticky z-[5]',
                    shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.07)]')
                const sBase = 'px-2 py-[4px] text-[11px] whitespace-nowrap'

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
                      <span className="text-gray-500 truncate block" style={{ maxWidth: W.cliente - 16 }}>{contrato.cliente.nome}</span>
                    </td>
                    <td className={sF()} style={{ left: L.cliente_final, background: subBg }}>
                      <span className="text-gray-400 truncate block" style={{ maxWidth: W.cliente_final - 16 }}>{contrato.cliente_final?.nome ?? '—'}</span>
                    </td>
                    <td className={sF()} style={{ left: L.cidade, background: subBg }}>
                      <span className="text-gray-400 text-[10px]">{[contrato.cidade, contrato.estado].filter(Boolean).join(' / ') || '—'}</span>
                    </td>
                    <td className={sF(true)} style={{ left: L.descricao, background: subBg }}>
                      <div className="flex items-start gap-1.5">
                        <span className="line-clamp-2 whitespace-normal flex-1" title={sub.descricao}>{sub.descricao}</span>
                        {sub.alteracao_pendente && (
                          <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap shrink-0">
                            Em aprovação
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      {contrato.classificacao
                        ? <span className="text-blue-400 text-[10px]">{CLASSIFICACAO_LABELS[contrato.classificacao as keyof typeof CLASSIFICACAO_LABELS]}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      {contrato.cliente.ramo_atuacao
                        ? <span className="text-gray-400 text-[10px]">{RAMO_ATUACAO_LABELS[contrato.cliente.ramo_atuacao as keyof typeof RAMO_ATUACAO_LABELS] ?? contrato.cliente.ramo_atuacao}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-gray-600">{sub.num_os ?? '—'}</span></td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="bg-gray-100 text-gray-400 rounded px-1 text-[10px]">{subAno}</span>
                    </td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-gray-400">{formatDate(sub.data_inicio)}</span></td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-gray-400">{formatDate(sub.data_fim)}</span></td>
                    <td className={sBase} style={{ background: subBg }}><StatusBadge status={sub.status_faturamento} /></td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-[#1565C0]">{formatCurrency(sub.valor_total)}</span></td>
                    <td className={sBase} style={{ background: subBg }}>
                      {subVlrFat > 0 ? <span className="text-green-700">{formatCurrency(subVlrFat)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}><SaldoCell saldo={subSaldo} className="!font-normal" /></td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="text-gray-400 text-[11px]">{sub.comentarios ?? '—'}</span>
                    </td>
                    {MESES.map((m, mi) => {
                      const prev = sub[m] ?? 0
                      const fat  = nfFaturadoMes(sub.notas_fiscais, mi, subAno)
                      return (
                        <td key={m} className={sBase} style={{ background: subBg }}>
                          {prev === 0 && fat === 0 ? <span className="text-gray-300">—</span> : (
                            <div className="flex flex-col gap-0.5">
                              {prev > 0 && <span className="text-[10px] text-[#1565C0]">P {formatCurrency(prev)}</span>}
                              {fat  > 0 && <span className={cn('text-[10px]', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ background: '#F3E5F5' }} className="px-2 py-[4px] text-[11px] whitespace-nowrap cursor-pointer">
                      {sub.prev_anos_seguintes > 0
                        ? <span className="text-[#6A1B9A]">{formatCurrency(sub.prev_anos_seguintes)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <AcoesMenu items={[
                        { label: canEdit ? 'Editar previsão' : 'Ver previsão', icon: '✎', destaque: true, onClick: () => onEditar(sub, indiceLabel, contrato.ano_referencia) },
                        { label: 'Movimentações Financeiras', icon: '$', visivel: canEdit && contrato.status !== 'CANCELADO', onClick: () => onLancarFaturamento(contrato, sub) },
                        { label: 'Ver histórico', icon: '🕘', onClick: () => onHistorico('subindice', sub.id, indiceLabel) },
                      ]} />
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
