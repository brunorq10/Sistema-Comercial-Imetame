'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type TooltipItem,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import ChartDataLabels, { type Context as DLContext } from 'chartjs-plugin-datalabels'
import type { OrcDashboardData } from '@/app/api/dashboard/orcamentos/route'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels)

// ── Paleta ──────────────────────────────────────────────────────────────────
const GREEN   = '#0F9850'
const AMBER   = '#E8A020'
const BLUE    = '#1E5FA8'
const TEAL    = '#0F7B6C'
const HEADER  = '#0A6E39'
const GRAY    = '#ddd'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const TIPO_CORES: Record<string, string> = {
  OBRAS: GREEN, PARADAS: AMBER, FABRICACOES: BLUE, OLEO_GAS: TEAL,
}
const TIPO_LABELS: Record<string, string> = {
  OBRAS: 'Obras', PARADAS: 'Paradas', FABRICACOES: 'Fabricações', OLEO_GAS: 'Óleo e Gás',
}
const INTERESSE_CORES: Record<string, string> = {
  ALTO: GREEN, MEDIO: AMBER, BAIXO: '#C62828',
}
const INTERESSE_LABELS: Record<string, string> = {
  ALTO: 'Alto', MEDIO: 'Médio', BAIXO: 'Baixo',
}

// ── Card base ────────────────────────────────────────────────────────────────
function Card({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        border: '0.5px solid #ccc',
        borderRadius: 4,
        overflow: 'hidden',
        background: '#fff',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          background: HEADER,
          color: '#fff',
          padding: '6px 12px',
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

// ── KPI ─────────────────────────────────────────────────────────────────────
function KPI({ label, value, color = '#111' }: { label: string; value: number; color?: string }) {
  return (
    <Card title={label}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.1 }}>
          {value.toLocaleString('pt-BR')}
        </span>
      </div>
    </Card>
  )
}

// ── Gráfico 1: Barras mensais ────────────────────────────────────────────────
function GraficoMensal({ porMes }: { porMes: number[] }) {
  const chartData = {
    labels: MESES,
    datasets: [{
      data: porMes,
      backgroundColor: GREEN,
      borderRadius: 2,
      barThickness: 22,
    }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'bar'>) => `${ctx.parsed.y ?? 0} solicitações` } },
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#444',
        font: { size: 10, weight: 'bold' as const },
        formatter: (v: number) => v > 0 ? v : '',
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } },
      y: { display: false },
    },
    layout: { padding: { top: 16 } },
  } as const

  return (
    <Card title="Solicitações Recebidas por Mês">
      <div style={{ height: 160, position: 'relative' }}>
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  )
}

// ── Gráfico 2: Rosca por tipo ────────────────────────────────────────────────
function GraficoTipo({
  porClassificacao,
  filtroClassificacao,
}: {
  porClassificacao: Record<string, number>
  filtroClassificacao: string
}) {
  const tipos = ['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS']
  const valores = tipos.map((t) => porClassificacao[t] ?? 0)
  const total = valores.reduce((a, b) => a + b, 0)
  const cores = tipos.map((t) =>
    filtroClassificacao && filtroClassificacao !== t ? GRAY : TIPO_CORES[t],
  )

  const chartData = {
    labels: tipos.map((t) => TIPO_LABELS[t]),
    datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0 }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => {
            const v = ctx.parsed as number
            return `${ctx.label}: ${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`
          },
        },
      },
      datalabels: {
        color: '#fff',
        font: { size: 11, weight: 'bold' as const },
        formatter: (v: number) => total > 0 && v > 0 ? `${Math.round((v / total) * 100)}%` : '',
      },
    },
  } as const

  return (
    <Card title="Solicitações por Tipo de Orçamento">
      {/* Legenda */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, justifyContent: 'center' }}>
        {tipos.map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2, display: 'inline-block',
              background: filtroClassificacao && filtroClassificacao !== t ? GRAY : TIPO_CORES[t],
            }} />
            {TIPO_LABELS[t]}
          </div>
        ))}
      </div>
      <div style={{ height: 140, position: 'relative' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </Card>
  )
}

// ── Gráfico 3: Funil de interesse ────────────────────────────────────────────
function GraficoInteresse({
  porInteresse,
  filtroInteresse,
}: {
  porInteresse: { ALTO: number; MEDIO: number; BAIXO: number }
  filtroInteresse: string
}) {
  const total = porInteresse.ALTO + porInteresse.MEDIO + porInteresse.BAIXO || 1
  const keys: (keyof typeof porInteresse)[] = ['ALTO', 'MEDIO', 'BAIXO']

  return (
    <Card title="Nível de Interesse">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {keys.map((k) => {
          const v = porInteresse[k]
          const pct = Math.round((v / total) * 100)
          const isGray = filtroInteresse && filtroInteresse !== k
          return (
            <div key={k}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, marginBottom: 3, color: '#555',
              }}>
                <span style={{ fontWeight: 600 }}>{INTERESSE_LABELS[k]}</span>
                <span>{v} solicitações</span>
              </div>
              <div style={{ background: '#E8F5EE', borderRadius: 3, height: 22, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: isGray ? '#ccc' : INTERESSE_CORES[k],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 6,
                  transition: 'width 0.4s',
                  borderRadius: 3,
                  minWidth: pct > 0 ? 24 : 0,
                }}>
                  {pct > 0 && (
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{pct}%</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Gráfico 4: Rosca situação da carteira ────────────────────────────────────
function GraficoCarteira({
  situacao,
}: {
  situacao: { no_prazo: number; atrasada: number; atendida: number }
}) {
  const labels = ['No Prazo', 'Atrasada', 'Atendida']
  const valores = [situacao.no_prazo, situacao.atrasada, situacao.atendida]
  const cores = [GREEN, AMBER, BLUE]

  const chartData = {
    labels,
    datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0 }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'doughnut'>) => `${ctx.label}: ${ctx.parsed as number}` } },
      datalabels: {
        color: '#fff',
        font: { size: 11, weight: 'bold' as const },
        formatter: (v: number, ctx: DLContext) => {
          const total = (ctx.chart.data.datasets[0].data as number[]).reduce((a: number, b) => a + (b as number), 0)
          return total > 0 && v > 0 ? `${Math.round((v / total) * 100)}%` : ''
        },
      },
    },
  } as const

  const temDados = valores.some((v) => v > 0)

  return (
    <Card title="Situação da Carteira">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, justifyContent: 'center' }}>
        {labels.map((l, i) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, display: 'inline-block', background: cores[i] }} />
            {l}
          </div>
        ))}
      </div>
      {temDados ? (
        <div style={{ height: 140, position: 'relative' }}>
          <Doughnut data={chartData} options={options} />
        </div>
      ) : (
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>
            Nenhuma solicitação aprovada no período.
          </p>
        </div>
      )}
    </Card>
  )
}

// ── Gráfico 5: Barras horizontais por orçamentista ───────────────────────────
function GraficoOrcamentistas({ porOrc }: { porOrc: Array<{ nome: string; total: number }> }) {
  if (porOrc.length === 0) {
    return (
      <Card title="Total por Orçamentista">
        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', padding: '16px 0' }}>
          Nenhuma solicitação atribuída.
        </p>
      </Card>
    )
  }

  const altura = porOrc.length * 40 + 60
  const chartData = {
    labels: porOrc.map((o) => o.nome),
    datasets: [{
      data: porOrc.map((o) => o.total),
      backgroundColor: GREEN,
      borderRadius: 2,
      barThickness: 18,
    }],
  }
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'bar'>) => `${ctx.parsed.x ?? 0} solicitações` } },
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#444',
        font: { size: 11, weight: 'bold' as const },
        formatter: (v: number) => v > 0 ? v : '',
      },
    },
    scales: {
      x: { display: false },
      y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 } } },
    },
    layout: { padding: { right: 24 } },
  } as const

  return (
    <Card title="Total de Solicitações por Orçamentista">
      <div style={{ height: altura, position: 'relative' }}>
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  )
}

// ── Filtros ──────────────────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '4px 8px',
  border: '0.5px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  color: '#333',
  fontFamily: 'Arial, sans-serif',
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#666',
  fontWeight: 600,
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: 'Arial, sans-serif',
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function DashboardComercialPage() {
  const [data, setData] = useState<OrcDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])

  const [ano, setAno] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [interesse, setInteresse] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [orcamentistaId, setOrcamentistaId] = useState('')
  const [segmento, setSegmento] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => r.json())
      .then((j) => setClientes(j.data ?? []))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (ano)            params.set('ano', ano)
      if (classificacao)  params.set('classificacao', classificacao)
      if (interesse)      params.set('interesse', interesse)
      if (clienteId)      params.set('cliente_id', clienteId)
      if (orcamentistaId) params.set('orcamentista_id', orcamentistaId)
      if (segmento)       params.set('segmento', segmento)
      if (cidadeUf)       params.set('cidade', cidadeUf)
      const res = await fetch(`/api/dashboard/orcamentos?${params}`)
      const json = await res.json()
      setData(json.data ?? null)
    } finally {
      setLoading(false)
    }
  }, [ano, classificacao, interesse, clienteId, orcamentistaId, segmento, cidadeUf])

  useEffect(() => { fetchData() }, [fetchData])

  const limpar = () => {
    setAno(''); setClassificacao(''); setInteresse(''); setClienteId('')
    setOrcamentistaId(''); setSegmento(''); setCidadeUf('')
  }

  const gap = 8

  return (
    <div style={{ padding: 16, background: '#f0f0f0', height: '100%', overflowY: 'auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111' }}>Dashboard Comercial</h2>
        <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
          Indicadores consolidados do funil de orçamentos
        </p>
      </div>

      {/* ── Barra de filtros ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        alignItems: 'flex-end',
        background: '#fff',
        border: '0.5px solid #ccc',
        borderRadius: 4,
        padding: '10px 14px',
        marginBottom: 12,
      }}>
        {[
          {
            label: 'Ano',
            value: ano,
            onChange: setAno,
            options: [
              { value: '', label: 'Todos' },
              ...(data?.anos_disponiveis ?? []).map((a) => ({ value: String(a), label: String(a) })),
            ],
          },
          {
            label: 'Classificação',
            value: classificacao,
            onChange: setClassificacao,
            options: [
              { value: '', label: 'Todas' },
              { value: 'OBRAS', label: 'Obras' },
              { value: 'PARADAS', label: 'Paradas' },
              { value: 'FABRICACOES', label: 'Fabricações' },
              { value: 'OLEO_GAS', label: 'Óleo e Gás' },
            ],
          },
          {
            label: 'Interesse',
            value: interesse,
            onChange: setInteresse,
            options: [
              { value: '', label: 'Todos' },
              { value: 'ALTO', label: 'Alto' },
              { value: 'MEDIO', label: 'Médio' },
              { value: 'BAIXO', label: 'Baixo' },
            ],
          },
        ].map(({ label, value, onChange, options }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={labelStyle}>{label}</span>
            <select style={selectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}

        {/* Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140, flex: 1 }}>
          <span style={labelStyle}>Cliente</span>
          <select style={selectStyle} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Orçamentista */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140, flex: 1 }}>
          <span style={labelStyle}>Orçamentista</span>
          <select style={selectStyle} value={orcamentistaId} onChange={(e) => setOrcamentistaId(e.target.value)}>
            <option value="">Todos</option>
            {(data?.orcamentistas_disponiveis ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>

        {/* Mercado (Segmento) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>Mercado</span>
          <select style={selectStyle} value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Todos</option>
            <option value="PAPEL_CELULOSE">Papel e Celulose</option>
            <option value="SIDERURGIA">Siderurgia</option>
            <option value="OLEO_GAS">Óleo e Gás</option>
            <option value="OUTROS">Outros</option>
          </select>
        </div>

        {/* Cidade / UF */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
          <span style={labelStyle}>Cidade / UF</span>
          <select style={selectStyle} value={cidadeUf} onChange={(e) => setCidadeUf(e.target.value)}>
            <option value="">Todas</option>
            {(data?.cidades_disponiveis ?? []).map((c) => (
              <option key={`${c.cidade}-${c.estado}`} value={c.cidade}>
                {c.cidade} — {c.estado}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={limpar}
          style={{
            fontSize: 11,
            padding: '4px 12px',
            border: '0.5px solid #ccc',
            borderRadius: 4,
            background: 'none',
            color: '#666',
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          ✕ Limpar
        </button>
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 13 }}>
          Carregando indicadores...
        </p>
      ) : !data ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 13 }}>
          Nenhum dado disponível.
        </p>
      ) : (
        <>
          {/* ── Linha 1: KPIs ───────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap, marginBottom: gap }}>
            <KPI label="Total Solicitações" value={data.total} color="#111" />
            <KPI label="Aprovadas" value={data.aprovadas} color={GREEN} />
            <KPI label="Reprovadas" value={data.reprovadas} color="#C62828" />
            <KPI label="Em Análise" value={data.em_analise} color={AMBER} />
          </div>

          {/* ── Linha 2: Barras mensais (full width) ────────────────────── */}
          <div style={{ marginBottom: gap }}>
            <GraficoMensal porMes={data.por_mes} />
          </div>

          {/* ── Linha 3: Tipo + Interesse + Carteira ────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap, marginBottom: gap }}>
            <GraficoTipo
              porClassificacao={data.por_classificacao}
              filtroClassificacao={classificacao}
            />
            <GraficoInteresse
              porInteresse={data.por_interesse}
              filtroInteresse={interesse}
            />
            <GraficoCarteira situacao={data.situacao_carteira} />
          </div>

          {/* ── Linha 4: Por orçamentista (full width) ──────────────────── */}
          <GraficoOrcamentistas porOrc={data.por_orc} />
        </>
      )}
    </div>
  )
}
