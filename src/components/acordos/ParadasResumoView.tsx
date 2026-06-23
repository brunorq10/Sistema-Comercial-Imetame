'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { cn, formatCurrency } from '@/lib/utils'
import { useFilterOptions, HhFilters as Filters, applyFilters, type FilterState } from '@/components/acordos/HhFilters'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels)

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmtHh = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtRsHh = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function barColors(pct: number) {
  if (pct > 100) return { text: '#DC2626', bg: '#EF4444' }
  if (pct >= 90) return { text: '#CA8A04', bg: '#EAB308' }
  return { text: '#16A34A', bg: '#22C55E' }
}

interface FaseVal { prev: number; real: number }
interface MesHh { ano: number; mes: number; prev: number; real: number }
interface ParadaResumo {
  id: number
  indice: string
  num_os: string | null
  ano_referencia?: number | null
  cliente: { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
  responsavel: { id: number; nome: string } | null
  descricao: string | null
  fases: { mob: FaseVal; integ: FaseVal; prep: FaseVal; parada: FaseVal; acomp: FaseVal; desmob: FaseVal; folga: FaseVal }
  hh_prev: number
  hh_real: number
  meses: MesHh[]
  valor_orcado: number
  valor_faturado: number
  ase: number
}

const FASES: { key: keyof ParadaResumo['fases']; label: string }[] = [
  { key: 'mob',    label: 'Mobilização' },
  { key: 'integ',  label: 'Integração' },
  { key: 'prep',   label: 'Preparativo' },
  { key: 'parada', label: 'Parada' },
  { key: 'acomp',  label: 'Pós Parada' },
  { key: 'desmob', label: 'Desmobilização' },
  { key: 'folga',  label: 'Folga' },
]

export function ParadasResumoView() {
  const [linhas, setLinhas] = useState<ParadaResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>({})
  const setFilter = (k: string, v: string[]) => setFilters((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    setLoading(true)
    fetch('/api/acordos/hh/paradas/resumo')
      .then((r) => r.json()).then((j) => setLinhas(j.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const opts = useFilterOptions(linhas)
  const filtradas = useMemo(() => applyFilters(linhas, filters), [linhas, filters])

  const agg = useMemo(() => {
    const fases = Object.fromEntries(FASES.map((f) => [f.key, { prev: 0, real: 0 }])) as ParadaResumo['fases']
    let hhPrev = 0, hhReal = 0, orcado = 0, faturado = 0, ase = 0
    const mesesMap = new Map<string, MesHh>()
    for (const l of filtradas) {
      for (const f of FASES) { fases[f.key].prev += l.fases[f.key].prev; fases[f.key].real += l.fases[f.key].real }
      hhPrev += l.hh_prev; hhReal += l.hh_real
      orcado += l.valor_orcado; faturado += l.valor_faturado; ase += l.ase
      for (const m of l.meses ?? []) {
        const k = `${m.ano}-${m.mes}`
        if (!mesesMap.has(k)) mesesMap.set(k, { ano: m.ano, mes: m.mes, prev: 0, real: 0 })
        const e = mesesMap.get(k)!
        e.prev += m.prev; e.real += m.real
      }
    }
    const meses = Array.from(mesesMap.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    return { fases, hhPrev, hhReal, orcado, faturado, ase, meses }
  }, [filtradas])

  if (loading) return <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>

  const desvio = agg.hhReal - agg.hhPrev
  const desvioPct = agg.hhPrev > 0 ? (desvio / agg.hhPrev) * 100 : 0
  const pctFatOrc = agg.orcado > 0 ? (agg.faturado / agg.orcado) * 100 : 0
  const rsHhOrcado = agg.hhPrev > 0 ? agg.orcado / agg.hhPrev : null
  const rsHhReal = agg.hhReal > 0 ? agg.faturado / agg.hhReal : null
  const pctAseFat = agg.faturado > 0 ? (agg.ase / agg.faturado) * 100 : null
  const desvCor = (v: number) => (v <= 0 ? '#16A34A' : '#DC2626')

  const chartData = {
    labels: agg.meses.map((m) => `${MESES_LABELS[m.mes]}/${String(m.ano).slice(2)}`),
    datasets: [
      { label: 'Previsto', data: agg.meses.map((m) => m.prev), backgroundColor: '#185FA5' },
      { label: 'Realizado', data: agg.meses.map((m) => m.real), backgroundColor: '#16A34A' },
    ],
  }
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 10 } },
      tooltip: { callbacks: { label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => `${ctx.dataset.label}: ${fmtHh(ctx.parsed.y ?? 0)}` } },
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#444',
        font: { size: 10, weight: 'bold' as const },
        formatter: (v: number) => v > 0 ? Math.round(v).toLocaleString('pt-BR') : '',
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 }, callback: (v: string | number) => typeof v === 'number' ? v.toLocaleString('pt-BR') : v } },
    },
    layout: { padding: { top: 20 } },
  }

  return (
    <div className="space-y-4">
      {linhas.length > 0 && <Filters opts={opts} filters={filters} onChange={setFilter} />}

      {/* Cards principais de HH */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="HHT Total Previsto" value={fmtHh(agg.hhPrev)} color="#185FA5" />
        <KpiCard label="HHT Total Realizado" value={fmtHh(agg.hhReal)} color="#16A34A" />
        <KpiCard label="Desvio Acumulado"
          value={`${fmtHh(desvio)} (${desvioPct >= 0 ? '+' : ''}${desvioPct.toFixed(1)}%)`}
          color={desvCor(desvio)} />
      </div>

      {/* Cards financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Valor Total Orçado" value={formatCurrency(agg.orcado)} color="#185FA5" small />
        <FaturadoCard orcado={agg.orcado} faturado={agg.faturado} pct={pctFatOrc} />
        <KpiCard label="Serviço Extra (ASE)" value={formatCurrency(agg.ase)} color="#6A1B9A" small
          sub={pctAseFat != null ? `${pctAseFat.toFixed(1)}% do faturado` : 'sem faturamento'} />
        <KpiCard label="R$/HH Orçado" value={fmtRsHh(rsHhOrcado)} color="#185FA5" small />
        <KpiCard label="R$/HH Realizado" value={fmtRsHh(rsHhReal)} color="#16A34A" small />
      </div>

      {/* Gráfico HH previsto x realizado mês a mês */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Total — Previsto x Realizado</p>
        <p className="text-[11px] text-gray-400 mb-3">Distribuição mês a mês</p>
        {agg.meses.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">Sem HH lançado para exibir.</p>
        ) : (
          <div style={{ height: 280 }}><Bar data={chartData} options={chartOpts} /></div>
        )}
      </div>

      {/* Total Geral de HH por fase */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-green-primary text-white px-4 py-2.5 text-[13px] font-bold">Total Geral de HH</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-[11px]">
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Fase</th>
                <th className="px-4 py-2 text-right font-semibold text-[#185FA5]">HH Previsto</th>
                <th className="px-4 py-2 text-right font-semibold text-[#16A34A]">HH Realizado</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Desvio HH</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Desvio %</th>
              </tr>
            </thead>
            <tbody>
              {FASES.map((f) => {
                const { prev, real } = agg.fases[f.key]
                const dv = real - prev
                const dvPct = prev > 0 ? (dv / prev) * 100 : null
                const vazio = prev === 0 && real === 0
                return (
                  <tr key={f.key} className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-medium text-gray-700">{f.label}</td>
                    {vazio ? (
                      <>
                        <td className="px-4 py-2.5 text-right text-gray-300">–</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">–</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">–</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">–</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-right text-[#185FA5]">{fmtHh(prev)}</td>
                        <td className="px-4 py-2.5 text-right text-[#16A34A]">{fmtHh(real)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: desvCor(dv) }}>{fmtHh(dv)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: desvCor(dv) }}>{dvPct != null ? `${dvPct >= 0 ? '+' : ''}${dvPct.toFixed(1)}%` : '–'}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-green-primary text-white text-[12px] font-bold">
                <td className="px-4 py-3">Total Geral</td>
                <td className="px-4 py-3 text-right">{fmtHh(agg.hhPrev)}</td>
                <td className="px-4 py-3 text-right">{fmtHh(agg.hhReal)}</td>
                <td className="px-4 py-3 text-right">{fmtHh(desvio)}</td>
                <td className="px-4 py-3 text-right">{`${desvioPct >= 0 ? '+' : ''}${desvioPct.toFixed(1)}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, small, sub }: { label: string; value: string; color: string; small?: boolean; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('font-bold leading-none tracking-tight', small ? 'text-[18px]' : 'text-[28px]')} style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  )
}

function FaturadoCard({ orcado, faturado, pct }: { orcado: number; faturado: number; pct: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Valor Total Faturado</p>
      <p className="text-[18px] font-bold leading-none tracking-tight text-[#16A34A]">{formatCurrency(faturado)}</p>
      {orcado > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">% do Orçado</span>
            <span className="text-[11px] font-bold" style={{ color: barColors(pct).text }}>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColors(pct).bg }} />
          </div>
        </div>
      )}
    </div>
  )
}
