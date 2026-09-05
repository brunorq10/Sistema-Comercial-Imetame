'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement, PointElement,
  Tooltip, Legend, LineController,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { Context } from 'chartjs-plugin-datalabels'
import { Chart } from 'react-chartjs-2'
import { formatDate } from '@/lib/utils'
import { ETAPA_LABEL, ETAPA_COR, type Etapa, type ParadaHhRow } from '@/lib/paradaHh'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, LineController, ChartDataLabels)

const COR_PREVISTO  = '#2D7DD2'
const COR_REALIZADO = '#16A34A'

const fmtHH = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const fmtDataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function lastNonNullIndex(arr: (number | null)[]): number {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i
  return -1
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface Banda { etapa: Etapa; startIdx: number; endIdx: number; label: string; color: string; textColor: string }

function buildBandas(rows: ParadaHhRow[]): Banda[] {
  const out: Banda[] = []
  rows.forEach((r, i) => {
    const last = out[out.length - 1]
    if (last && last.etapa === r.etapa) last.endIdx = i
    else out.push({ etapa: r.etapa, startIdx: i, endIdx: i, label: ETAPA_LABEL[r.etapa], color: hexToRgba(ETAPA_COR[r.etapa], 0.07), textColor: ETAPA_COR[r.etapa] })
  })
  return out
}

// Plugin custom (sem dependência extra) — pinta uma faixa de fundo por fase e
// escreve o nome da fase no topo, marcando visualmente a divisão entre
// Preparativo / Parada / Pós Parada no gráfico acumulado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFaseBandsPlugin(bandas: Banda[]): any {
  return {
    id: 'paradaFaseBands',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeDraw(chart: any) {
      const { ctx, chartArea, scales: { x } } = chart
      if (!chartArea) return
      ctx.save()
      bandas.forEach((b) => {
        const xStart = x.getPixelForValue(b.startIdx - 0.5)
        const xEnd = x.getPixelForValue(b.endIdx + 0.5)
        ctx.fillStyle = b.color
        ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top)
      })
      ctx.strokeStyle = '#CBD5E1'
      ctx.setLineDash([3, 3])
      bandas.slice(1).forEach((b) => {
        const xPos = x.getPixelForValue(b.startIdx - 0.5)
        ctx.beginPath(); ctx.moveTo(xPos, chartArea.top); ctx.lineTo(xPos, chartArea.bottom); ctx.stroke()
      })
      ctx.restore()
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDraw(chart: any) {
      const { ctx, chartArea, scales: { x } } = chart
      if (!chartArea) return
      ctx.save()
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      bandas.forEach((b) => {
        const xMid = (x.getPixelForValue(b.startIdx) + x.getPixelForValue(b.endIdx)) / 2
        ctx.fillStyle = b.textColor
        ctx.fillText(b.label, xMid, chartArea.top + 12)
      })
      ctx.restore()
    },
  }
}

const legendPlugin = {
  position: 'bottom' as const,
  align: 'center' as const,
  labels: { boxWidth: 10, boxHeight: 10, borderRadius: 2, useBorderRadius: true, font: { size: 11 }, padding: 16, color: '#374151' },
}

/** Substitui o gráfico "Avanço %" quando o contrato é uma Parada. */
export function ParadaHhChart({ rows }: { rows: ParadaHhRow[] }) {
  const labels = useMemo(() => rows.map((r) => fmtDataCurta(r.data)), [rows])
  const previstoAcum = useMemo(() => rows.map((r) => r.previstoAcum), [rows])
  const realizadoAcum = useMemo(() => rows.map((r) => r.realizadoAcum), [rows])
  const lastReal = lastNonNullIndex(realizadoAcum)
  const bandas = useMemo(() => buildBandas(rows), [rows])
  const faseBandsPlugin = useMemo(() => buildFaseBandsPlugin(bandas), [bandas])

  if (rows.length === 0) {
    return (
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">∿ HH Previsto x Realizado — Parada</h2>
        <p className="text-sm text-gray-400 text-center py-6">Nenhum lançamento de HH diário registrado para esta Parada.</p>
      </section>
    )
  }

  const data = {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Previsto acumulado',
        data: previstoAcum,
        borderColor: COR_PREVISTO,
        borderDash: [6, 3],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: COR_PREVISTO,
        fill: false,
        tension: 0.25,
        spanGaps: true,
        datalabels: {
          display: (ctx: Context) => ctx.dataIndex === previstoAcum.length - 1,
          anchor: 'center' as const, align: 'top' as const, offset: 6,
          font: { size: 9, weight: 'bold' as const }, color: COR_PREVISTO,
          formatter: (v: number) => `${fmtHH(v)} h`,
        },
      },
      {
        type: 'line' as const,
        label: 'Realizado acumulado',
        data: realizadoAcum,
        borderColor: COR_REALIZADO,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: COR_REALIZADO,
        fill: false,
        tension: 0.25,
        spanGaps: false,
        datalabels: {
          display: (ctx: Context) => ctx.dataIndex === lastReal,
          anchor: 'center' as const, align: 'top' as const, offset: 6,
          font: { size: 9, weight: 'bold' as const }, color: COR_REALIZADO,
          formatter: (v: number) => `${fmtHH(v)} h`,
        },
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index' as const, intersect: false },
    layout: { padding: { top: 48, right: 16, bottom: 0, left: 0 } },
    plugins: {
      legend: legendPlugin,
      tooltip: {
        backgroundColor: '#1F2937', titleColor: '#F9FAFB', bodyColor: '#D1D5DB',
        borderColor: '#374151', borderWidth: 1, padding: 10,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (items: any[]) => {
            const idx = items[0]?.dataIndex ?? 0
            const r = rows[idx]
            return r ? `${ETAPA_LABEL[r.etapa]} — ${formatDate(r.data)}` : ''
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const v = ctx.parsed.y
            if (ctx.dataset.label === 'Realizado acumulado' && v == null) return '  Realizado: não lançado'
            if (v == null) return ''
            return `  ${ctx.dataset.label}: ${fmtHH(v)} h`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, color: '#6B7280', autoSkip: true, maxRotation: 0 } },
      y: {
        grid: { color: '#F3F4F6' },
        border: { display: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ticks: { font: { size: 10 }, color: '#9CA3AF', callback: (v: any) => Number(v).toLocaleString('pt-BR') },
      },
    },
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">∿ HH Previsto x Realizado — Parada</h2>
      <Chart type="line" data={data} options={options} plugins={[faseBandsPlugin]} />
    </section>
  )
}
