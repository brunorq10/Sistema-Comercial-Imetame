'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { MultasIndicador } from '@/components/acordos/MultasIndicador'

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
  projecaoMultiAno: { ano: number; realizado: number; aFaturar: number }[]
  porResponsavel: { id: number | null; nome: string; contratos: number; valorSobGestao: number; previsto: number; realizado: number; aderencia: number; saldo: number }[]
  ocorrenciasPorResponsavel: { id: number; nome: string; osSobGestao: number; total: number }[]
  contratosAtivos: { id: number; indice: string; cliente: string; valorTotal: number; faturado: number; pct: number }[]
  clientes: { id: number; nome: string }[]
}

const RAMO_OPTIONS = [
  { value: 'PAPEL_CELULOSE', label: 'Papel e Celulose' },
  { value: 'SIDERURGIA',     label: 'Siderurgia' },
  { value: 'MINERACAO',      label: 'Mineração' },
  { value: 'OLEO_GAS',       label: 'Óleo e Gás' },
  { value: 'OUTROS',         label: 'Outros' },
]

// ══ Seção título ══
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] mt-5 mb-2">{children}</h3>
}

// ══ Card grande (Visão consolidada) ══
function BigCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-[24px] font-bold leading-none tracking-tight" style={{ color: accent }}>{fmtM(value)}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  )
}
function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3.5 py-2.5">
      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-[16px] font-bold text-gray-800 leading-none">{fmtM(value)}</p>
    </div>
  )
}

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

// ══ Barras horizontais por mercado ══
function BarrasMercado({ data }: { data: { ramo: string; percentual: number; valor: number }[] }) {
  if (data.length === 0) return <p className="text-[11px] text-gray-400 py-6 text-center">Sem dados</p>
  const max = Math.max(...data.map((d) => d.percentual), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((item) => (
        <div key={item.ramo} className="flex items-center gap-3">
          <span className="text-[11px] text-gray-700 font-medium w-40 flex-shrink-0 truncate" title={item.ramo}>{item.ramo}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden relative">
            <div className="h-full bg-[#1565C0] rounded flex items-center justify-end pr-1.5" style={{ width: `${(item.percentual / max) * 100}%`, minWidth: 22 }}>
              <span className="text-[10px] font-bold text-white">{item.percentual.toFixed(0)}%</span>
            </div>
          </div>
          <span className="text-[11px] text-gray-600 font-semibold w-20 text-right flex-shrink-0">{fmtM(item.valor)}</span>
        </div>
      ))}
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
function progColor(p: number) { return p >= 70 ? '#16A34A' : p >= 40 ? '#D97706' : '#DC2626' }

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i)

export default function IndicadoresAcordosPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [clienteId, setClienteId] = useState('')
  const [ramo, setRamo] = useState('')
  const [abaInd, setAbaInd] = useState<'geral' | 'responsavel'>('geral')

  const fetchData = useCallback(() => {
    setLoading(true); setError(null)
    const params = new URLSearchParams()
    if (ano && ano !== String(ANO_ATUAL)) params.set('ano', ano)
    if (clienteId) params.set('clienteId', clienteId)
    if (ramo) params.set('ramo', ramo)
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

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em]'
  const selectCls = 'w-full px-2 py-[5px] border border-gray-300 rounded text-[11px] text-gray-800 bg-white outline-none focus:border-green-primary transition-colors'

  // Chart configs
  const yTick = (v: string | number) => typeof v === 'number' ? `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : v
  const mesChart = data && {
    labels: MES_LABEL,
    datasets: [
      { label: 'Previsto', data: data.porMes.map((m) => m.previsto), backgroundColor: '#1565C0', borderRadius: 3 },
      { label: 'Realizado', data: data.porMes.map((m) => m.faturado), backgroundColor: '#16A34A', borderRadius: 3 },
    ],
  }
  const mesOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 10 } }, datalabels: { display: false }, tooltip: { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number | null } }) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 }, callback: yTick } } },
  }
  const projChart = data && {
    labels: data.projecaoMultiAno.map((p) => String(p.ano)),
    datasets: [
      { label: 'Realizado', data: data.projecaoMultiAno.map((p) => p.realizado), backgroundColor: '#1B5E20', stack: 's', borderRadius: 3 },
      { label: 'A faturar (contratado)', data: data.projecaoMultiAno.map((p) => p.aFaturar), backgroundColor: '#A5D6A7', stack: 's', borderRadius: 3 },
    ],
  }
  const projOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 10 } }, datalabels: { display: false }, tooltip: { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number | null } }) => `${c.dataset.label}: ${fmt(c.parsed.y ?? 0)}` } } },
    scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { stacked: true, grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 }, callback: yTick } } },
  }

  return (
    <div className="p-4 space-y-1 h-full overflow-y-auto bg-gray-50">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Indicadores Acordos</h2>
        {data && <span className="text-[11px] text-gray-400">{mesLabel} / {data.anoAtual}</span>}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 flex flex-wrap gap-2.5 items-end !mt-3">
        <div className="min-w-[90px]">
          <label className={fLbl}>Ano</label>
          <select value={ano} onChange={(e) => setAno(e.target.value)} className={selectCls}>{ANOS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className={fLbl}>Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={selectCls}><option value="">Todos</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </div>
        <div className="min-w-[150px]">
          <label className={fLbl}>Mercado</label>
          <select value={ramo} onChange={(e) => setRamo(e.target.value)} className={selectCls}><option value="">Todos</option>{RAMO_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </div>
        <button onClick={() => { setAno(String(ANO_ATUAL)); setClienteId(''); setRamo('') }} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] hover:bg-gray-100 transition-colors">✕ Limpar</button>
      </div>

      {loading && <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>}
      {error && <p className="text-center text-red-500 py-8 text-sm">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Abas de indicadores */}
          <div className="flex items-center gap-1 border-b border-gray-200 !mt-3 overflow-x-auto">
            {([['geral', 'Indicadores Gerais'], ['responsavel', 'Por Responsável / Multas']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setAbaInd(val)}
                className={
                  'text-[12px] font-semibold px-3 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors ' +
                  (abaInd === val ? 'border-green-primary text-green-primary' : 'border-transparent text-gray-400 hover:text-gray-600')
                }
              >
                {label}
              </button>
            ))}
          </div>

          {abaInd === 'geral' && (<>
          {/* 1 — Visão consolidada do ano */}
          <SectionTitle>Visão consolidada do ano</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BigCard label="Total faturado no ano" value={data.totalFaturadoAno} accent="#16A34A" sub={`${data.percFaturadoGeral.toFixed(1).replace('.', ',')}% da previsão`} />
            <BigCard label="Previsão de faturamento no ano" value={data.prevFaturamentoAno} accent="#1565C0" sub="meta anual de receita" />
            <BigCard label="Falta faturar no ano" value={data.aFaturarAno} accent="#D97706" sub="saldo até dezembro" />
            <BigCard label="Previsão anos seguintes" value={data.faturamentoProxAnos} accent="#475569" sub="contratos multi-ano" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 !mt-3">
            <MiniCard label={`Previsão mês atual (${mesLabel})`} value={data.prevMesAtual} />
            <MiniCard label={`Faturado mês atual (${mesLabel})`} value={data.faturadoMesAtual} />
            <MiniCard label={`Faturado último mês (${mesAntLabel})`} value={data.faturadoUltimoMes} />
            <MiniCard label={`Previsão próximo mês (${mesProxLabel})`} value={data.prevProxMes} />
          </div>

          {/* 2/3 — Faturamento por mercado + Gauge */}
          <SectionTitle>Faturamento por mercado · % faturado geral do ano</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-[12px] font-bold text-gray-700 mb-3">Faturamento por mercado</p>
              <BarrasMercado data={data.porRamo} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-[12px] font-bold text-gray-700 mb-3">% faturado geral do ano</p>
              <Gauge percent={data.percFaturadoGeral} faturado={data.totalFaturadoAno} previsto={data.prevFaturamentoAno} />
            </div>
          </div>

          {/* 4 — Faturamento mês a mês */}
          <SectionTitle>Faturamento mês a mês — previsto vs realizado</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div style={{ height: 300 }}>{mesChart && <Bar data={mesChart} options={mesOpts} />}</div>
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

          {/* 7 — Projeção multi-ano */}
          <SectionTitle>Projeção de faturamento multi-ano (carteira contratada)</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            {data.projecaoMultiAno.length === 0
              ? <p className="text-center text-gray-400 py-10 text-sm">Sem carteira para projetar.</p>
              : <div style={{ height: 280 }}>{projChart && <Bar data={projChart} options={projOpts} />}</div>}
          </div>
          </>)}

          {abaInd === 'responsavel' && (<>
          {/* 8 — Aderência por responsável */}
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
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(r.aderencia, 100)}%`, backgroundColor: c.text }} /></div>
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

          {/* Multas / Penalidades recebidas */}
          <SectionTitle>Multas / Penalidades recebidas</SectionTitle>
          <MultasIndicador />
          </>)}

          {abaInd === 'geral' && (<>
          {/* 9 — Contratos ativos */}
          <SectionTitle>Contratos ativos — progresso de faturamento</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            {data.contratosAtivos.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Sem contratos ativos.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.contratosAtivos.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-700 font-medium w-52 flex-shrink-0 truncate" title={`${c.indice} · ${c.cliente}`}>{c.indice} · {c.cliente}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded flex items-center justify-end pr-1.5" style={{ width: `${Math.min(Math.max(c.pct, 6), 100)}%`, backgroundColor: progColor(c.pct) }}>
                        <span className="text-[10px] font-bold text-white">{c.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-600 font-semibold w-20 text-right flex-shrink-0">{fmtM(c.faturado)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>)}
        </>
      )}
    </div>
  )
}
