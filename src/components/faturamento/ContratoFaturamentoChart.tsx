'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend,
  BarController, LineController,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { Context } from 'chartjs-plugin-datalabels'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, BarController, LineController,
  ChartDataLabels,
)

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Power BI color palette
const COLORS = {
  previsto:       '#A8C7E8',  // azul claro
  previstoBorder: '#2D7DD2',
  faturado:       '#5BB974',  // verde
  faturadoBorder: '#107C10',
  acumPrevisto:   '#E8A838',  // laranja/âmbar
  acumFaturado:   '#2D7DD2',  // azul escuro
}

// Valor completo, com separador de milhar e 2 casas decimais (sem abreviação "k"/"M")
function fmtLabel(v: number): string {
  if (v === 0) return ''
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Eixo Y: valor completo, sem abreviação (sem casas decimais para não poluir os ticks)
function fmtAxis(v: number): string {
  return `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function fmtTooltip(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// Índice do último ponto não-nulo de uma série — usado para só rotular o
// último período com dado real de cada linha (não necessariamente o mesmo
// período nas duas linhas, já que Faturamento e HH podem estar em pontos
// diferentes do contrato).
function lastNonNullIndex(arr: (number | null)[]): number {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i
  return -1
}

interface AnualData {
  ano: number
  previsto: number
  faturado: number
}

interface Props {
  previsto: number[]
  faturado: number[]
  labels?: string[]
}

const legendPlugin = {
  position: 'bottom' as const,
  align: 'center' as const,
  labels: {
    boxWidth: 10,
    boxHeight: 10,
    borderRadius: 2,
    useBorderRadius: true,
    font: { size: 11 },
    padding: 16,
    color: '#374151',
  },
}

const tooltipPlugin = {
  backgroundColor: '#1F2937',
  titleColor: '#F9FAFB',
  bodyColor: '#D1D5DB',
  borderColor: '#374151',
  borderWidth: 1,
  padding: 10,
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    label: (ctx: any) => `  ${ctx.dataset.label}: ${fmtTooltip(ctx.parsed.y)}`,
  },
}

const xScale = {
  grid: { display: false },
  border: { display: false },
  ticks: { font: { size: 11 }, color: '#6B7280' },
}

const yScale = {
  type: 'linear' as const,
  position: 'left' as const,
  grid: { color: '#F3F4F6', lineWidth: 1 },
  border: { display: false, dash: [4, 4] as [number, number] },
  ticks: {
    font: { size: 10 },
    color: '#9CA3AF',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (v: any) => fmtAxis(Number(v)),
  },
}

/** Gráfico de colunas: previsto x faturado, mês a mês (ou ano a ano). */
export function ContratoFaturamentoBarChart({ previsto, faturado, labels }: Props) {
  const xLabels = labels ?? MESES_LABELS

  const data = {
    labels: xLabels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Previsto',
        data: previsto,
        backgroundColor: COLORS.previsto,
        borderColor: COLORS.previstoBorder,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        type: 'bar' as const,
        label: 'Faturado',
        data: faturado,
        backgroundColor: COLORS.faturado,
        borderColor: COLORS.faturadoBorder,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index' as const, intersect: false },
    layout: { padding: { top: 8, right: 16, bottom: 0, left: 0 } },
    // Rótulos de dados removidos do Faturamento Mensal
    plugins: { legend: legendPlugin, tooltip: tooltipPlugin, datalabels: { display: false } },
    scales: { x: xScale, y: yScale },
  }

  return <Chart type="bar" data={data} options={options} />
}

/** Gráfico de linhas: acumulado de previsto x faturado, mês a mês (ou ano a ano). */
export function ContratoFaturamentoLineChart({ previsto, faturado, labels }: Props) {
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
        type: 'line' as const,
        label: 'Acum. previsto',
        data: acumPrevisto,
        borderColor: COLORS.acumPrevisto,
        borderDash: [6, 3],
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: COLORS.acumPrevisto,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.3,
        datalabels: {
          display: (ctx: Context) =>
            ctx.dataIndex === acumPrevisto.length - 1,
          anchor: 'center' as const,
          align: 'top' as const,
          offset: 6,
          font: { size: 9, weight: 'bold' as const },
          color: COLORS.acumPrevisto,
          formatter: (v: number) => fmtLabel(v),
        },
      },
      {
        type: 'line' as const,
        label: 'Acum. faturado',
        data: acumFaturado,
        borderColor: COLORS.acumFaturado,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: COLORS.acumFaturado,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.3,
        datalabels: {
          display: (ctx: Context) =>
            ctx.dataIndex === acumFaturado.length - 1,
          anchor: 'center' as const,
          align: 'top' as const,
          offset: 6,
          font: { size: 9, weight: 'bold' as const },
          color: COLORS.acumFaturado,
          formatter: (v: number) => fmtLabel(v),
        },
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index' as const, intersect: false },
    layout: { padding: { top: 48, right: 16, bottom: 0, left: 0 } },
    plugins: { legend: legendPlugin, tooltip: tooltipPlugin },
    scales: { x: xScale, y: yScale },
  }

  return <Chart type="line" data={data} options={options} />
}

interface AvancoPercentualProps {
  /** % acumulado da série A (ex.: faturamento), por período. null = sem dado ainda no período. */
  serieA: (number | null)[]
  /** % acumulado da série B (ex.: HH realizado, meta acumulada), por período. null = sem dado ainda no período. */
  serieB: (number | null)[]
  labelA?: string
  labelB?: string
  corA?: string
  corB?: string
  labels?: string[]
}

const COLOR_FAT_PCT = COLORS.acumFaturado // azul — mesmo tom já usado para "Acum. faturado"
const COLOR_HH_PCT  = '#16A34A'            // verde — mesmo tom já usado para "Realizado" no Controle de HH

/**
 * Avanço % — duas linhas cumulativas em termos relativos (% do total),
 * comparando o ritmo de duas séries ao longo do tempo (ex.: Faturamento x HH
 * num contrato, ou Meta x Faturado nos Indicadores Acordos). Rótulo de dado
 * só no último ponto COM DADO de cada linha (não no último índice do eixo,
 * já que cada série pode ter dado disponível até um período diferente) — ao
 * passar o mouse, o tooltip mostra qualquer ponto normalmente.
 */
export function ContratoAvancoPercentualChart({
  serieA, serieB, labelA = 'Faturamento (%)', labelB = 'HH Realizado (%)',
  corA = COLOR_FAT_PCT, corB = COLOR_HH_PCT, labels,
}: AvancoPercentualProps) {
  const xLabels = labels ?? MESES_LABELS
  const lastA = lastNonNullIndex(serieA)
  const lastB = lastNonNullIndex(serieB)

  const data = {
    labels: xLabels,
    datasets: [
      {
        type: 'line' as const,
        label: labelA,
        data: serieA,
        borderColor: corA,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: corA,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.3,
        spanGaps: false,
        datalabels: {
          display: (ctx: Context) => ctx.dataIndex === lastA,
          anchor: 'center' as const,
          align: 'top' as const,
          offset: 6,
          font: { size: 9, weight: 'bold' as const },
          color: corA,
          formatter: (v: number) => fmtPct(v),
        },
      },
      {
        type: 'line' as const,
        label: labelB,
        data: serieB,
        borderColor: corB,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: corB,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.3,
        spanGaps: false,
        datalabels: {
          display: (ctx: Context) => ctx.dataIndex === lastB,
          anchor: 'center' as const,
          align: 'top' as const,
          offset: 6,
          font: { size: 9, weight: 'bold' as const },
          color: corB,
          formatter: (v: number) => fmtPct(v),
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
        ...tooltipPlugin,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => `  ${ctx.dataset.label}: ${ctx.parsed.y == null ? 'sem dado' : fmtPct(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: xScale,
      y: {
        ...yScale,
        min: 0,
        max: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ticks: { ...yScale.ticks, stepSize: 20, callback: (v: any) => `${v}%` },
      },
    },
  }

  return <Chart type="line" data={data} options={options} />
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
