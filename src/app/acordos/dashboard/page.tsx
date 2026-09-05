'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { MultasIndicador } from '@/components/acordos/MultasIndicador'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { ContratoAvancoPercentualChart } from '@/components/faturamento/ContratoFaturamentoChart'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { FilterBar, FilterField, ClearFiltersButton, filterSelectClass } from '@/components/dashboard/FilterBar'
import { ProgressBar } from '@/components/dashboard/ProgressBar'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const MES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const TREEMAP_COLORS = [
  '#1B5E20','#1565C0','#2E7D32','#BF360C','#C62828','#607D8B',
  '#0277BD','#4527A0','#E65100','#00695C','#F57F17','#37474F',
]

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// Valor por extenso (sem abreviação M/K) — pontos de milhar e vírgula decimal
function fmtM(v: number) {
  return fmt(v)
}

interface MesData {
  mes: number; label: string; previsto: number; valor_fixado: number | null
  faturado: number; percentual: number; resultado: number; consolidado: boolean
}
interface DashData {
  anoAtual: number; mesAtual: number
  totalFaturadoAno: number; prevFaturamentoAno: number; aFaturarAno: number; faturamentoProxAnos: number
  prevMesAtual: number; faturadoMesAtual: number; faturadoUltimoMes: number; prevProxMes: number
  percFaturadoGeral: number
  porRamo:    { ramo: string; valor: number; percentual: number }[]
  porCliente: { nome: string; valor: number; percentual: number }[]
  porMes:     MesData[]
  porResponsavel: { id: number | null; nome: string; contratos: number; valorSobGestao: number; previsto: number; realizado: number; aderencia: number; saldo: number }[]
  ocorrenciasPorResponsavel: { id: number; nome: string; osSobGestao: number; total: number }[]
  clientes: { id: number; nome: string }[]
}

const RAMO_OPTIONS = [
  { value: 'PAPEL_CELULOSE', label: 'Papel e Celulose' },
  { value: 'SIDERURGIA',     label: 'Siderurgia' },
  { value: 'MINERACAO',      label: 'Mineração' },
  { value: 'OLEO_GAS',       label: 'Óleo e Gás' },
  { value: 'OUTROS',         label: 'Outros' },
]

// ══ Gauge (velocímetro) ══
function Gauge({ percent, faturado, previsto }: { percent: number; faturado: number; previsto: number }) {
  const p = Math.min(100, Math.max(0, percent))
  const data = {
    datasets: [{ data: [p, 100 - p], backgroundColor: ['#16A34A', '#E5E7EB'], borderWidth: 0, circumference: 180, rotation: 270 }],
  }
  const opts = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } },
  }
  return (
    <div className="relative mx-auto" style={{ height: 200, maxWidth: 320 }}>
      <Doughnut data={data} options={opts} />
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-[36px] font-bold text-green-primary leading-none">{percent.toFixed(1).replace('.', ',')}%</span>
        <span className="text-[11px] text-gray-400 mt-1">{fmtM(faturado)} de {fmtM(previsto)}</span>
      </div>
    </div>
  )
}

// ══ Tabela — Faturamento por mercado (Mercado / Faturado (R$) / Participação) ══
const MERCADO_COLORS = ['#16A34A', '#1565C0', '#F59E0B', '#8B5CF6', '#DC2626', '#0891B2']

function TabelaMercado({ data }: { data: { ramo: string; percentual: number; valor: number }[] }) {
  if (data.length === 0) return <p className="text-[11px] text-gray-400 py-6 text-center">Sem dados</p>
  const max = Math.max(...data.map((d) => d.valor), 1)
  const totalValor = data.reduce((s, d) => s + d.valor, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="text-left text-[11px] text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-3 font-semibold">Mercado</th>
            <th className="py-2 px-3 font-semibold">Faturado (R$)</th>
            <th className="py-2 pl-3 font-semibold text-right">Participação</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => {
            const color = MERCADO_COLORS[i % MERCADO_COLORS.length]
            return (
              <tr key={item.ramo} className="border-b border-gray-50">
                <td className="py-2.5 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-gray-700 font-medium">{item.ramo}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={(item.valor / max) * 100} color={color} size="sm" className="max-w-[140px]" />
                    <span className="text-gray-700 font-semibold whitespace-nowrap">{fmtM(item.valor)}</span>
                  </div>
                </td>
                <td className="py-2.5 pl-3 text-right text-gray-600 font-semibold whitespace-nowrap">{item.percentual.toFixed(1).replace('.', ',')}%</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 font-bold">
            <td className="py-2.5 pr-3 text-gray-800">Total</td>
            <td className="py-2.5 px-3 text-gray-800 whitespace-nowrap">{fmtM(totalValor)}</td>
            <td className="py-2.5 pl-3 text-right text-gray-800">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ══ Treemap (squarify) ══
type TRect = { nome: string; valor: number; percentual: number; x: number; y: number; w: number; h: number }
function worstRatio(areas: number[], rowArea: number, short: number): number {
  const maxA = Math.max(...areas), minA = Math.min(...areas)
  return Math.max((short * short * maxA) / (rowArea * rowArea), (rowArea * rowArea) / (short * short * minA))
}
function squarify(items: { nome: string; valor: number; percentual: number }[], x: number, y: number, w: number, h: number): TRect[] {
  if (items.length === 0) return []
  const total = items.reduce((s, i) => s + i.valor, 0)
  const totalArea = w * h
  const data = items.map((i) => ({ ...i, area: (i.valor / total) * totalArea }))
  const result: TRect[] = []
  let remaining = [...data]
  let rx = x, ry = y, rw = w, rh = h
  while (remaining.length > 0) {
    if (remaining.length === 1) { const r = remaining[0]; result.push({ nome: r.nome, valor: r.valor, percentual: r.percentual, x: rx, y: ry, w: rw, h: rh }); break }
    const short = Math.min(rw, rh)
    let row = [remaining[0]], rowArea = remaining[0].area
    for (let i = 1; i < remaining.length; i++) {
      const cand = remaining[i], newRow = [...row, cand], newRowArea = rowArea + cand.area
      const curr = worstRatio(row.map((r) => r.area), rowArea, short)
      const next = worstRatio(newRow.map((r) => r.area), newRowArea, short)
      if (next <= curr) { row = newRow; rowArea = newRowArea } else break
    }
    if (rw <= rh) {
      const stripH = rowArea / rw; let lx = rx
      for (const item of row) { result.push({ nome: item.nome, valor: item.valor, percentual: item.percentual, x: lx, y: ry, w: rw * (item.area / rowArea), h: stripH }); lx += rw * (item.area / rowArea) }
      ry += stripH; rh -= stripH
    } else {
      const stripW = rowArea / rh; let ly = ry
      for (const item of row) { result.push({ nome: item.nome, valor: item.valor, percentual: item.percentual, x: rx, y: ly, w: stripW, h: rh * (item.area / rowArea) }); ly += rh * (item.area / rowArea) }
      rx += stripW; rw -= stripW
    }
    remaining = remaining.slice(row.length)
  }
  return result
}
function Treemap({ data }: { data: { nome: string; valor: number; percentual: number }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current; if (!el) return
    const update = () => { const r = el.getBoundingClientRect(); setDims({ w: r.width, h: r.height }) }
    update(); const ro = new ResizeObserver(update); ro.observe(el); return () => ro.disconnect()
  }, [])
  if (data.length === 0) return <p className="text-[11px] text-gray-400 py-6 text-center">Sem dados</p>
  const rects = dims.w > 0 ? squarify(data, 0, 0, dims.w, dims.h) : []
  return (
    <div ref={ref} className="relative w-full" style={{ height: 340 }}>
      {rects.map((rect, i) => {
        const cellW = Math.max(0, rect.w - 3), cellH = Math.max(0, rect.h - 3)
        return (
          <div key={rect.nome} className="absolute flex flex-col items-center justify-center rounded text-center px-1"
            style={{ left: rect.x + 1.5, top: rect.y + 1.5, width: cellW, height: cellH, backgroundColor: TREEMAP_COLORS[i % TREEMAP_COLORS.length] }}>
            <span className="text-white font-bold leading-tight" style={{ fontSize: cellW < 80 ? 10 : 13, textShadow: '0 1px 2px rgba(0,0,0,0.4)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rect.nome}</span>
            <span className="text-white font-bold mt-0.5" style={{ fontSize: cellW < 80 ? 10 : 12, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{rect.percentual.toFixed(1).replace('.', ',')}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ══ Tabela Previsão x Realizado por Mês ══
function TabelaMensal({ data, ano }: { data: MesData[]; ano: number }) {
  const totPrev = data.reduce((s, d) => s + d.previsto, 0)
  const totFat = data.reduce((s, d) => s + d.faturado, 0)
  const totRes = data.reduce((s, d) => s + d.resultado, 0)
  const totFixed = data.reduce((s, d) => s + (d.valor_fixado ?? 0), 0)
  const totPct = totPrev > 0 ? (totFat / totPrev) * 100 : 0
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-green-primary px-4 py-2.5 text-center">
        <h3 className="text-[12px] font-semibold text-white uppercase tracking-wide">Previsão x Realizado por Mês — {ano}</h3>
        <p className="text-[9px] text-white/70 mt-0.5">Verde = mês com consolidado gerado · Valor Fixado = snapshot do consolidado</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
              <th className="text-left px-4 py-2 font-semibold w-32">Mês</th>
              <th className="text-right px-4 py-2 font-semibold">Valor Fixado</th>
              <th className="text-right px-4 py-2 font-semibold">Previsto {ano}</th>
              <th className="text-right px-4 py-2 font-semibold">Valor Total Faturado {ano}</th>
              <th className="text-center px-4 py-2 font-semibold w-32">% Fat. / Previsto</th>
              <th className="text-right px-4 py-2 font-semibold">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.mes} className={[row.consolidado ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50', 'border-b border-gray-100'].join(' ')}>
                <td className={`px-4 py-2 font-medium ${row.consolidado ? 'text-green-800' : 'text-gray-700'}`}>
                  {row.label}
                  {row.consolidado && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle" />}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.valor_fixado != null ? <span className="text-[#6A1B9A] font-semibold">{fmt(row.valor_fixado)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right text-[#1565C0] tabular-nums">{fmt(row.previsto)}</td>
                <td className="px-4 py-2 text-right text-gray-700 tabular-nums">{fmt(row.faturado)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${row.percentual >= 100 ? 'bg-green-100 text-green-800' : 'bg-orange-50 text-orange-700'}`}>
                    {row.percentual.toFixed(1).replace('.', ',')}%
                  </span>
                </td>
                <td className={`px-4 py-2 text-right font-semibold tabular-nums ${row.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(row.resultado)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-primary text-white font-bold text-[12px]">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-purple-100">{totFixed > 0 ? fmt(totFixed) : '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totPrev)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totFat)}</td>
              <td className="px-4 py-2.5 text-center">{totPct.toFixed(1).replace('.', ',')}%</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${totRes >= 0 ? 'text-green-100' : 'text-red-200'}`}>{fmt(totRes)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ══ Avatar de iniciais ══
function Avatar({ nome }: { nome: string }) {
  const ini = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  let h = 0; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 360
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: `hsl(${h},55%,42%)` }}>{ini}</span>
}

function adColor(p: number) { return p >= 70 ? { bg: '#DCFCE7', text: '#15803D' } : p >= 50 ? { bg: '#FEF3C7', text: '#B45309' } : { bg: '#FEE2E2', text: '#B91C1C' } }

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i)

export default function IndicadoresAcordosPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [clienteId, setClienteId] = useState<string[]>([])
  const [ramo, setRamo] = useState<string[]>([])
  const [abaInd, setAbaInd] = useState<'geral' | 'responsavel'>('geral')

  const fetchData = useCallback(() => {
    setLoading(true); setError(null)
    const params = new URLSearchParams()
    if (ano && ano !== String(ANO_ATUAL)) params.set('ano', ano)
    if (clienteId.length) params.set('clienteId', clienteId.join(','))
    if (ramo.length) params.set('ramo', ramo.join(','))
    const qs = params.toString()
    fetch(`/api/acordos/dashboard${qs ? '?' + qs : ''}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setData(j.data) })
      .catch(() => setError('Falha ao carregar dados'))
      .finally(() => setLoading(false))
  }, [ano, clienteId, ramo])
  useEffect(() => { fetchData() }, [fetchData])

  const anoNum = parseInt(ano, 10) || ANO_ATUAL
  const mesAtual = data?.mesAtual ?? (new Date().getMonth() + 1)
  const mesLabel = MES_LABEL[mesAtual - 1]
  const mesAntLabel = MES_LABEL[mesAtual === 1 ? 11 : mesAtual - 2]
  const mesProxLabel = MES_LABEL[mesAtual === 12 ? 0 : mesAtual]
  const clientes = data?.clientes ?? []

  // Meta de faturamento acumulada (%) x Faturado acumulado (%) — ambas em
  // relação ao total previsto do ano. A meta é conhecida para o ano inteiro
  // (orçamento fechado); o faturado só é conhecido até o mês corrente do ano
  // selecionado (meses futuros ficam null — sem dado, não "zero").
  const totalPrevistoAno = data ? data.porMes.reduce((a, m) => a + m.previsto, 0) : 0
  const mesConhecidoAte = !data ? 0
    : anoNum < data.anoAtual ? 12
    : anoNum === data.anoAtual ? data.mesAtual
    : 0
  const metaAcumPct = data
    ? (() => { let acc = 0; return data.porMes.map((m) => { acc += m.previsto; return totalPrevistoAno > 0 ? (acc / totalPrevistoAno) * 100 : null }) })()
    : []
  const faturadoAcumPct = data
    ? (() => { let acc = 0; return data.porMes.map((m) => {
        acc += m.faturado
        return m.mes <= mesConhecidoAte && totalPrevistoAno > 0 ? (acc / totalPrevistoAno) * 100 : null
      }) })()
    : []

  return (
    <div className="p-4 space-y-1 h-full overflow-y-auto bg-gray-50">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Indicadores Acordos</h2>
        {data && <span className="text-[11px] text-gray-400">{mesLabel} / {data.anoAtual}</span>}
      </div>

      {/* Filtros */}
      <FilterBar className="!mt-3">
        <FilterField label="Ano" className="min-w-[90px]">
          <select value={ano} onChange={(e) => setAno(e.target.value)} className={filterSelectClass}>{ANOS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </FilterField>
        <FilterField label="Cliente" className="min-w-[180px] flex-1">
          <SearchableMultiSelect values={clienteId} onChange={setClienteId} options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))} />
        </FilterField>
        <FilterField label="Mercado" className="min-w-[150px]">
          <SearchableMultiSelect values={ramo} onChange={setRamo} options={RAMO_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} emptyLabel="Todos" />
        </FilterField>
        <ClearFiltersButton onClick={() => { setAno(String(ANO_ATUAL)); setClienteId([]); setRamo([]) }} />
      </FilterBar>

      {loading && <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>}
      {error && <p className="text-center text-red-500 py-8 text-sm">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Abas de indicadores */}
          <DashboardTabs
            tabs={[{ key: 'geral', label: 'Indicadores Gerais' }, { key: 'responsavel', label: 'Eventos Contratuais' }]}
            active={abaInd}
            onChange={setAbaInd}
          />

          {abaInd === 'geral' && (<>
          {/* 1 — Visão consolidada do ano */}
          <SectionTitle>Visão consolidada do ano</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total faturado no ano" value={fmtM(data.totalFaturadoAno)} accent="#16A34A" sub={`${data.percFaturadoGeral.toFixed(1).replace('.', ',')}% da previsão`} />
            <KpiCard label="Previsão de faturamento no ano" value={fmtM(data.prevFaturamentoAno)} accent="#1565C0" sub="meta anual de receita" />
            <KpiCard label="Falta faturar no ano" value={fmtM(data.aFaturarAno)} accent="#D97706" sub="saldo até dezembro" />
            <KpiCard label="Previsão anos seguintes" value={fmtM(data.faturamentoProxAnos)} accent="#475569" sub="contratos multi-ano" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 !mt-3">
            <KpiCard label={`Faturado mês atual (${mesLabel})`} value={fmtM(data.faturadoMesAtual)} accent="#16A34A" />
            <KpiCard label={`Previsão mês atual (${mesLabel})`} value={fmtM(data.prevMesAtual)} accent="#1565C0" />
            <KpiCard label={`Faturado último mês (${mesAntLabel})`} value={fmtM(data.faturadoUltimoMes)} accent="#16A34A" />
            <KpiCard label={`Previsão próximo mês (${mesProxLabel})`} value={fmtM(data.prevProxMes)} accent="#1565C0" />
          </div>

          {/* 2/3 — Faturamento por mercado + Gauge */}
          <SectionTitle>Faturamento por mercado · % faturado geral do ano</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-[12px] font-bold text-gray-700 mb-3">Faturamento por mercado</p>
              <TabelaMercado data={data.porRamo} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-[12px] font-bold text-gray-700 mb-3">% faturado geral do ano</p>
              <Gauge percent={data.percFaturadoGeral} faturado={data.totalFaturadoAno} previsto={data.prevFaturamentoAno} />
            </div>
          </div>

          {/* 4 — Meta acumulada x Faturado acumulado (%) */}
          <SectionTitle>Meta de faturamento acumulada x faturamento real — avanço %</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div style={{ height: 300 }}>
              <ContratoAvancoPercentualChart
                serieA={metaAcumPct} serieB={faturadoAcumPct}
                labelA="Meta acumulada (%)" labelB="Faturado acumulado (%)"
                corA="#1565C0" corB="#16A34A"
                labels={MES_LABEL}
              />
            </div>
          </div>

          {/* 5 — Tabela detalhada */}
          <SectionTitle>Previsão x realizado por mês — detalhamento</SectionTitle>
          <TabelaMensal data={data.porMes} ano={anoNum} />

          {/* 6 — Participação por empresa */}
          <SectionTitle>Participação de cada empresa no faturamento do ano atual</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <Treemap data={data.porCliente} />
            <p className="text-[10px] text-gray-400 mt-2">Área de cada retalho proporcional à participação no faturamento total do ano ({fmtM(data.totalFaturadoAno)}).</p>
          </div>

          {/* 7 — Aderência por responsável */}
          <SectionTitle>Aderência por responsável de Acordos</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-semibold">Responsável</th>
                    <th className="text-center px-4 py-2 font-semibold">Contratos</th>
                    <th className="text-right px-4 py-2 font-semibold">Valor sob gestão</th>
                    <th className="text-right px-4 py-2 font-semibold">Previsto ano</th>
                    <th className="text-right px-4 py-2 font-semibold">Realizado ano</th>
                    <th className="text-left px-4 py-2 font-semibold w-44">Aderência</th>
                    <th className="text-right px-4 py-2 font-semibold">Saldo a faturar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porResponsavel.map((r) => {
                    const c = adColor(r.aderencia)
                    return (
                      <tr key={r.id ?? r.nome} className="border-b border-gray-100">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar nome={r.nome} /><span className="font-medium text-gray-700">{r.nome}</span></div></td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{r.contratos}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{fmtM(r.valorSobGestao)}</td>
                        <td className="px-4 py-2.5 text-right text-[#1565C0] tabular-nums">{fmtM(r.previsto)}</td>
                        <td className="px-4 py-2.5 text-right text-[#16A34A] tabular-nums">{fmtM(r.realizado)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={r.aderencia} color={c.text} size="md" />
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.text }}>{r.aderencia.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{fmtM(r.saldo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-green-primary text-white font-bold text-[12px]">
                    <td className="px-4 py-2.5">Total geral</td>
                    <td className="px-4 py-2.5 text-center">{data.porResponsavel.reduce((s, r) => s + r.contratos, 0)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.porResponsavel.reduce((s, r) => s + r.valorSobGestao, 0))}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.prevFaturamentoAno)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.totalFaturadoAno)}</td>
                    <td className="px-4 py-2.5 text-left pl-4">{data.percFaturadoGeral.toFixed(1).replace('.', ',')}%</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.aFaturarAno)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Ocorrências contratuais lançadas por responsável */}
          <SectionTitle>Ocorrências contratuais lançadas por responsável</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {data.ocorrenciasPorResponsavel.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Nenhuma ocorrência registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
                      <th className="text-left px-4 py-2 font-semibold">Responsável</th>
                      <th className="text-right px-4 py-2 font-semibold w-40">OS sob gestão</th>
                      <th className="text-right px-4 py-2 font-semibold w-44">Ocorrências lançadas (total)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ocorrenciasPorResponsavel.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar nome={r.nome} /><span className="font-medium text-gray-700">{r.nome}</span></div></td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{r.osSobGestao}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-700 tabular-nums">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-primary text-white font-bold text-[12px]">
                      <td className="px-4 py-2.5">Total geral</td>
                      <td className="px-4 py-2.5 text-right">{data.ocorrenciasPorResponsavel.reduce((s, r) => s + r.osSobGestao, 0)}</td>
                      <td className="px-4 py-2.5 text-right">{data.ocorrenciasPorResponsavel.reduce((s, r) => s + r.total, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          </>)}

          {abaInd === 'responsavel' && (<>
          {/* Multas / Penalidades recebidas */}
          <SectionTitle>Multas / Penalidades recebidas</SectionTitle>
          <MultasIndicador />
          </>)}
        </>
      )}
    </div>
  )
}
