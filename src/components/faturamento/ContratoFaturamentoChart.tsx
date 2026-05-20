'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { formatCurrency } from '@/lib/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface AnualData {
  ano: number
  previsto: number
  faturado: number
}

interface Props {
  modo: 'mensal' | 'anual'
  previsto: number[]   // 12 values (mensal) ou N values (anual)
  faturado: number[]
  labels?: string[]    // for anual mode
}

export function ContratoFaturamentoChart({ modo, previsto, faturado, labels }: Props) {
  const xLabels = labels ?? MESES_LABELS

  const acumPrevisto = useMemo(() =>
    previsto.reduce((acc, v, i) => { acc.push((acc[i - 1] ?? 0) + v); return acc }, [] as number[]),
    [previsto])

  const acumFaturado = useMemo(() =>
    faturado.reduce((acc, v, i) => { acc.push((acc[i - 1] ?? 0) + v); return acc }, [] as number[]),
    [faturado])

  const data = {
    labels: xLabels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Previsto',
        data: previsto,
        backgroundColor: '#93C5FD',
        borderRadius: 3,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'bar' as const,
        label: 'Faturado',
        data: faturado,
        backgroundColor: '#86EFAC',
        borderRadius: 3,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Acumulado previsto',
        data: acumPrevisto,
        borderColor: '#F97316',
        borderDash: [5, 4],
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#F97316',
        fill: false,
        yAxisID: 'y1',
        order: 1,
        tension: 0.2,
      },
      {
        type: 'line' as const,
        label: 'Acumulado faturado',
        data: acumFaturado,
        borderColor: '#3B82F6',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#3B82F6',
        fill: false,
        yAxisID: 'y1',
        order: 1,
        tension: 0.2,
      },
    ],
  }

  const options = {
    responsive: true,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: { color: '#F3F4F6' },
        ticks: {
          font: { size: 10 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => `R$ ${Number(v) >= 1000000 ? `${(Number(v) / 1000000).toFixed(1)}M` : `${(Number(v) / 1000).toFixed(0)}k`}`,
        },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 10 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => `R$ ${Number(v) >= 1000000 ? `${(Number(v) / 1000000).toFixed(1)}M` : `${(Number(v) / 1000).toFixed(0)}k`}`,
        },
      },
    },
  }

  return <Chart type="bar" data={data} options={options} />
}

export function buildAnualData(
  subindices: { data_inicio: string | null; jan: number | null; fev: number | null; mar: number | null; abr: number | null; mai: number | null; jun: number | null; jul: number | null; ago: number | null; set: number | null; out: number | null; nov: number | null; dez: number | null; notas_fiscais: { ativa: boolean; valor_atribuido: number; data_emissao: string }[] }[],
  anoRef: number,
): AnualData[] {
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
  const anosSet = new Set<number>()
  subindices.forEach((s) => {
    const ano = s.data_inicio ? parseInt(s.data_inicio.substring(0, 4), 10) : anoRef
    anosSet.add(ano)
    s.notas_fiscais.forEach((nf) => anosSet.add(new Date(nf.data_emissao).getFullYear()))
  })
  const anos = Array.from(anosSet).sort()

  return anos.map((ano) => {
    const previsto = subindices
      .filter((s) => (s.data_inicio ? parseInt(s.data_inicio.substring(0, 4), 10) : anoRef) === ano)
      .reduce((a, s) => a + MESES.reduce((b, m) => b + (s[m] ?? 0), 0), 0)

    const faturado = subindices
      .flatMap((s) => s.notas_fiscais)
      .filter((nf) => nf.ativa && new Date(nf.data_emissao).getFullYear() === ano)
      .reduce((a, nf) => a + nf.valor_atribuido, 0)

    return { ano, previsto, faturado }
  })
}
