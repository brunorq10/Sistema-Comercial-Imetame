'use client'

import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MesSerieHh { label: string; previsto: number; planejado: number; realizado: number | null }

interface HhComportamentoChartProps {
  variant: 'resumo' | 'contrato'
  mesData: MesSerieHh[]
  titulo?: string
}

// ─── Cores fixas deste gráfico (não usadas em cards/tabela) ──────────────────

const COR_PREVISTO  = '#1E3A5F'
const COR_PLANEJADO = '#DC2626'
const COR_REALIZADO = '#16A34A'

const HEIGHT = 230

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtInt = (n: number) => Math.round(n).toLocaleString('pt-BR')

function fmtAbbrev(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
  return n.toLocaleString('pt-BR')
}

/** Ticks "redondos" (passo 1/2/5 × 10ⁿ), sempre começando em 0. */
function niceTicks(maxValue: number, targetCount = 4): number[] {
  if (maxValue <= 0) return [0]
  const rawStep = maxValue / targetCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  const step = residual > 5 ? 10 * magnitude : residual > 2 ? 5 * magnitude : residual > 1 ? 2 * magnitude : magnitude
  const ticks: number[] = []
  let t = 0
  while (t < maxValue) { ticks.push(t); t += step }
  ticks.push(t)
  return ticks
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function HhComportamentoChart({ variant, mesData, titulo }: HhComportamentoChartProps) {
  const totPrevisto  = mesData.reduce((s, m) => s + m.previsto, 0)
  const totPlanejado = mesData.reduce((s, m) => s + m.planejado, 0)
  const temRealizado = mesData.some(m => m.realizado != null)
  const totRealizado = temRealizado ? mesData.reduce((s, m) => s + (m.realizado ?? 0), 0) : null

  const barras = [
    { label: 'Orçado',    valor: totPrevisto,  cor: COR_PREVISTO },
    { label: 'Planejado', valor: totPlanejado, cor: COR_PLANEJADO },
    { label: 'Realizado', valor: totRealizado, cor: COR_REALIZADO },
  ]

  const ticks = niceTicks(Math.max(totPrevisto, totPlanejado, totRealizado ?? 0))
  const eixoMax = ticks[ticks.length - 1]

  const blocoBarras = (
    <div className="w-full lg:flex-1 min-w-0 flex flex-col">
      <p className="text-[13px] font-bold text-gray-700 mb-0.5">{titulo ?? (variant === 'contrato' ? 'Total do contrato' : 'Total selecionado')}</p>
      <p className="text-[11px] text-gray-400 mb-3">Orçado x Planejado x Realizado</p>
      <div style={{ height: HEIGHT }} className="flex flex-col">
        <div className="flex-1 flex flex-col justify-evenly">
          {barras.map(b => {
            const pct = eixoMax > 0 && b.valor != null ? (b.valor / eixoMax) * 100 : 0
            const dentro = pct > 20
            return (
              <div key={b.label}>
                <p className="text-[10px] font-semibold text-gray-500 mb-1">{b.label}</p>
                <div className="h-7 bg-slate-100 rounded-md relative overflow-visible">
                  <div className="h-full rounded-md overflow-hidden flex items-center justify-end" style={{ width: `${pct}%`, backgroundColor: b.cor }}>
                    {dentro && <span className="pr-2 text-[11px] font-bold text-white whitespace-nowrap">{b.valor != null ? fmtInt(b.valor) : '—'}</span>}
                  </div>
                  {!dentro && (
                    <span className="absolute top-0 h-full flex items-center text-[11px] font-bold whitespace-nowrap" style={{ left: `calc(${pct}% + 8px)`, color: b.cor }}>
                      {b.valor != null ? fmtInt(b.valor) : '—'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ height: 22 }} className="relative border-t border-slate-100 mt-1">
          {ticks.map((t, i) => (
            <span key={t} className="absolute top-1 text-[9px] text-gray-400" style={{
              left: `${eixoMax > 0 ? (t / eixoMax) * 100 : 0}%`,
              transform: i === 0 ? 'translateX(0)' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}>{fmtInt(t)}</span>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Curva acumulada (sempre exibida, junto com as barras) ──
  const labels = mesData.map(m => m.label)
  const cumPrevisto  = mesData.reduce<number[]>((acc, m) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + m.previsto] }, [])
  const cumPlanejado = mesData.reduce<number[]>((acc, m) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + m.planejado] }, [])
  let parou = false
  const cumRealizado = mesData.reduce<(number | null)[]>((acc, m) => {
    if (parou || m.realizado == null) { parou = true; return [...acc, null] }
    const l = acc.length ? (acc[acc.length - 1] ?? 0) : 0
    return [...acc, l + m.realizado]
  }, [])

  const chartData = {
    labels,
    datasets: [
      { label: 'Orçado',    data: cumPrevisto,  borderColor: COR_PREVISTO,  backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 3], tension: 0.35, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: COR_PREVISTO,  spanGaps: true },
      { label: 'Planejado', data: cumPlanejado, borderColor: COR_PLANEJADO, backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 2], tension: 0.35, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: COR_PLANEJADO, spanGaps: true },
      { label: 'Realizado', data: cumRealizado, borderColor: COR_REALIZADO, backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: COR_REALIZADO, spanGaps: false },
    ],
  }

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const v = ctx.parsed.y
            if (ctx.dataset.label === 'Realizado' && v == null) return 'Realizado: não lançado'
            if (v == null) return ''
            return `${ctx.dataset.label}: ${v.toLocaleString('pt-BR')}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        ticks: { font: { size: 10 }, callback: (value: string | number) => typeof value === 'number' ? fmtAbbrev(value) : value },
        grid: { color: '#f0f0f0' },
      },
    },
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {blocoBarras}
        <div className="w-full lg:flex-1 min-w-0 flex flex-col">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">Evolução acumulada</p>
          <p className="text-[11px] text-gray-400 mb-3">
            {variant === 'contrato' ? 'Progressão acumulada ao longo do contrato' : 'Progressão acumulada ao longo do período selecionado'}
          </p>
          <div style={{ height: HEIGHT }}><Line data={chartData} options={chartOpts} /></div>
        </div>
      </div>
      <Legenda />
    </div>
  )
}

// ─── Legenda ─────────────────────────────────────────────────────────────────

function Legenda() {
  const itens: [string, string, string][] = [
    [COR_PREVISTO,  'Orçado/Previsto', 'dashed'],
    [COR_PLANEJADO, 'Planejado',       'dashed'],
    [COR_REALIZADO, 'Realizado',       'solid'],
  ]
  return (
    <div className="flex items-center justify-center gap-5">
      {itens.map(([c, l, style]) => (
        <span key={l} className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-block w-5 h-0.5" style={{
            background: style === 'solid' ? c
              : `repeating-linear-gradient(90deg,${c} 0,${c} 4px,transparent 4px,transparent 8px)`,
          }} />
          {l}
        </span>
      ))}
    </div>
  )
}
