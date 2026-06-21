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
import type { OrcDashboardData, SolicitacaoAberta } from '@/app/api/dashboard/orcamentos/route'

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

// ── Cards de abertas ─────────────────────────────────────────────────────────
type FiltroAbertas = 'todas' | 'no_prazo' | 'em_atraso'

function CardsAbertas({
  counts,
  filtro,
  onChange,
}: {
  counts: { total: number; no_prazo: number; em_atraso: number }
  filtro: FiltroAbertas
  onChange: (f: FiltroAbertas) => void
}) {
  const cards: { key: FiltroAbertas; label: string; value: number; cor: string; bg: string; borda: string }[] = [
    { key: 'todas',    label: 'Total em Aberto',  value: counts.total,    cor: '#0A6E39', bg: '#E8F5E9', borda: '#0A6E39' },
    { key: 'no_prazo', label: 'No Prazo',         value: counts.no_prazo, cor: '#1E5FA8', bg: '#E3F2FD', borda: '#1E5FA8' },
    { key: 'em_atraso',label: 'Em Atraso',        value: counts.em_atraso,cor: '#C62828', bg: '#FFEBEE', borda: '#C62828' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 8 }}>
      {cards.map((c) => (
        <div
          key={c.key}
          onClick={() => onChange(c.key)}
          style={{
            border: `0.5px solid ${filtro === c.key ? c.borda : '#ccc'}`,
            borderLeft: `3px solid ${c.borda}`,
            borderRadius: 4,
            background: filtro === c.key ? c.bg : '#fff',
            padding: '10px 14px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: filtro === c.key ? `0 0 0 2px ${c.borda}33` : 'none',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <p style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            {c.label}
          </p>
          <p style={{ fontSize: 26, fontWeight: 700, color: c.cor, margin: '2px 0 0', lineHeight: 1 }}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Tabela de solicitações em aberto ─────────────────────────────────────────
const now = new Date()

function fmtDt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diffDias(from: string | null, to?: Date): number {
  if (!from) return 0
  const ms = (to ?? now).getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function DetalheAberta({ s }: { s: SolicitacaoAberta }) {
  const diasComOrc = s.data_atribuicao
    ? (s.prazo_tecnica_enviada && s.prazo_comercial_enviada)
      ? diffDias(s.data_atribuicao, new Date(Math.max(
          s.data_envio_tecnica  ? new Date(s.data_envio_tecnica).getTime()  : 0,
          s.data_envio_comercial? new Date(s.data_envio_comercial).getTime(): 0,
        )))
      : diffDias(s.data_atribuicao)
    : null
  const enviouTodas = s.prazo_tecnica_enviada && s.prazo_comercial_enviada

  const atrasoTec = (!s.prazo_tecnica_enviada && !s.prazo_tecnica_indeterminado && s.prazo_tecnica)
    ? diffDias(s.prazo_tecnica)
    : 0
  const atrasoComercial = (!s.prazo_comercial_enviada && !s.prazo_comercial_indeterminado && s.prazo_comercial)
    ? diffDias(s.prazo_comercial)
    : 0

  const sectionStyle: React.CSSProperties = {
    background: '#f9fafb',
    border: '0.5px solid #e5e7eb',
    borderRadius: 4,
    padding: '10px 14px',
    fontFamily: 'Arial, sans-serif',
    fontSize: 11,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 2,
  }
  const valueStyle: React.CSSProperties = { color: '#111', fontWeight: 500 }
  const atrasadoStyle: React.CSSProperties = { color: '#C62828', fontWeight: 700 }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, padding: '8px 12px 10px', background: '#f0f4f8', borderBottom: '0.5px solid #d1d5db' }}>
      {/* Chegada */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Data de Chegada</p>
        <p style={{ ...valueStyle, margin: 0 }}>{fmtDt(s.data_recebimento)}</p>
      </div>

      {/* Atribuição */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Atribuição ao Orçamentista</p>
        <p style={{ margin: 0, ...valueStyle }}>{fmtDt(s.data_atribuicao)}</p>
        {diasComOrc !== null && (
          <p style={{ margin: '4px 0 0', fontSize: 10, color: enviouTodas ? '#0A6E39' : '#E8A020', fontWeight: 600 }}>
            {enviouTodas ? `${diasComOrc} dias de elaboração` : `${diasComOrc} dias com o orçamentista`}
          </p>
        )}
      </div>

      {/* Proposta Técnica */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Proposta Técnica</p>
        {s.prazo_tecnica_indeterminado ? (
          <p style={{ margin: 0, ...valueStyle }}>Prazo indeterminado</p>
        ) : (
          <>
            <p style={{ margin: 0, color: '#555' }}>
              <span style={{ fontWeight: 600 }}>Prevista: </span>
              <span style={atrasoTec > 0 ? atrasadoStyle : valueStyle}>{fmtDt(s.prazo_tecnica)}</span>
            </p>
            <p style={{ margin: '3px 0 0', color: '#555' }}>
              <span style={{ fontWeight: 600 }}>Envio: </span>
              {s.prazo_tecnica_enviada
                ? <span style={{ color: '#0A6E39', fontWeight: 600 }}>{fmtDt(s.data_envio_tecnica)}</span>
                : <span style={atrasoTec > 0 ? atrasadoStyle : valueStyle}>
                    {atrasoTec > 0 ? `Não enviada — ${atrasoTec} dias de atraso` : 'Não enviada'}
                  </span>
              }
            </p>
          </>
        )}
      </div>

      {/* Proposta Comercial */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Proposta Comercial</p>
        {s.prazo_comercial_indeterminado ? (
          <p style={{ margin: 0, ...valueStyle }}>Prazo indeterminado</p>
        ) : (
          <>
            <p style={{ margin: 0, color: '#555' }}>
              <span style={{ fontWeight: 600 }}>Prevista: </span>
              <span style={atrasoComercial > 0 ? atrasadoStyle : valueStyle}>{fmtDt(s.prazo_comercial)}</span>
            </p>
            <p style={{ margin: '3px 0 0', color: '#555' }}>
              <span style={{ fontWeight: 600 }}>Envio: </span>
              {s.prazo_comercial_enviada
                ? <span style={{ color: '#0A6E39', fontWeight: 600 }}>{fmtDt(s.data_envio_comercial)}</span>
                : <span style={atrasoComercial > 0 ? atrasadoStyle : valueStyle}>
                    {atrasoComercial > 0 ? `Não enviada — ${atrasoComercial} dias de atraso` : 'Não enviada'}
                  </span>
              }
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function TabelaAbertas({ items }: { items: SolicitacaoAberta[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa', fontSize: 12 }}>
        Nenhuma solicitação para exibir.
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    background: '#0A6E39',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '6px 10px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    fontFamily: 'Arial, sans-serif',
  }
  const tdStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '6px 10px',
    borderBottom: '0.5px solid #e5e7eb',
    fontFamily: 'Arial, sans-serif',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ overflowX: 'auto', maxHeight: 440, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: 90 }} />
          <col />{/* Escopo — ocupa o restante */}
          <col style={{ width: '16%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <th style={{ ...thStyle, padding: '6px 4px', textAlign: 'center' }} />
            <th style={thStyle}>Nº</th>
            <th style={thStyle}>Escopo</th>
            <th style={thStyle}>Cliente</th>
            <th style={thStyle}>Cliente Final</th>
            <th style={thStyle}>Orçamentista</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => {
            const expanded = expandedId === s.id
            const bg = i % 2 === 1 ? '#f9fafb' : '#fff'
            return (
              <>
                <tr
                  key={s.id}
                  style={{ background: bg, cursor: 'pointer' }}
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                >
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#6B7280', fontSize: 10 }}>
                    {expanded ? '▲' : '▼'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{s.numero}</td>
                  <td style={{ ...tdStyle, color: s.escopo ? '#111' : '#aaa', fontStyle: s.escopo ? 'normal' : 'italic' }}>
                    <span title={s.escopo ?? ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.escopo ?? 'Sem escopo'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.cliente}</td>
                  <td style={{ ...tdStyle, color: s.cliente_final ? '#111' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.cliente_final ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, color: s.orcamentista ? '#111' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.orcamentista ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                      background: s.situacao === 'em_atraso' ? '#FFEBEE' : '#E8F5E9',
                      color: s.situacao === 'em_atraso' ? '#C62828' : '#0A6E39',
                      border: `0.5px solid ${s.situacao === 'em_atraso' ? '#ef9a9a' : '#a5d6a7'}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {s.situacao === 'em_atraso' ? 'Em Atraso' : 'No Prazo'}
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr key={`${s.id}-detalhe`}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <DetalheAberta s={s} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
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

// ── Novos indicadores (modelo "Indicadores Comercial") ──────────────────────
const NAVY = '#0E2E5C'
const RED  = '#B23B3B'

const MOTIVO_LABELS: Record<string, string> = {
  VOLUME_ADJUDICADO:        'Volume já adjudicado',
  FORA_LINHA_FORNECIMENTO:  'Fora da linha de fornecimento',
  INDISPONIBILIDADE_MO:     'Indisponibilidade de mão de obra',
  SEM_SERVICO_LOCAL:        'Sem serviço no local',
  LIMITACAO_EQUIPAMENTOS:   'Limitação de equipamentos',
  DIFICULDADE_PARCERIA:     'Dificuldade de parceria',
  OUTROS:                   'Outros',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px' }}>{children}</p>
}

function Initials({ nome }: { nome: string }) {
  const ini = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  let h = 0; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 360
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: `hsl(${h},55%,42%)`, color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{ini}</span>
}

// 1 — KPIs de situação geral
function KpiSituacao({ total, aprovadas, reprovadas, em_analise }: { total: number; aprovadas: number; reprovadas: number; em_analise: number }) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const cards = [
    { label: 'Total de solicitações', value: total, color: '#111', sub: 'no período selecionado', bg: '#fff', border: '#e5e7eb' },
    { label: 'Aprovadas', value: aprovadas, color: GREEN, sub: `${pct(aprovadas).toFixed(1).replace('.', ',')}% do total`, bg: '#F0FAF4', border: '#BBE5CC' },
    { label: 'Recusadas / Agradecidas', value: reprovadas, color: '#C62828', sub: `${pct(reprovadas).toFixed(1).replace('.', ',')}% do total`, bg: '#FDF2F2', border: '#F3C9C9' },
    { label: 'Em análise', value: em_analise, color: BLUE, sub: em_analise === 0 ? 'todas já analisadas no período' : `${pct(em_analise).toFixed(1).replace('.', ',')}% do total`, bg: '#EFF5FB', border: '#C7DCEF' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 6, padding: '12px 16px' }}>
          <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>{c.label}</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: c.color, margin: '4px 0 2px', lineHeight: 1 }}>{c.value.toLocaleString('pt-BR')}</p>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

// 2 — Funil de status
function Funil({ total, aprovadas, reprovadas }: { total: number; aprovadas: number; reprovadas: number }) {
  const steps = [
    { label: 'Recebidas', value: total, pct: 100, color: NAVY },
    { label: 'Aprovadas', value: aprovadas, pct: total > 0 ? (aprovadas / total) * 100 : 0, color: '#157A3D' },
    { label: 'Recusadas/Agradecidas', value: reprovadas, pct: total > 0 ? (reprovadas / total) * 100 : 0, color: RED },
  ]
  return (
    <Card title="Funil de Status — Todas as Solicitações">
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ flex: 1, background: s.color, borderRadius: 6, padding: '18px 12px', textAlign: 'center', color: '#fff', minWidth: 0 }}>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1 }}>{s.value.toLocaleString('pt-BR')}</p>
              <p style={{ fontSize: 12, margin: '4px 0 2px', opacity: 0.95 }}>{s.label}</p>
              <p style={{ fontSize: 12, fontWeight: 600, margin: 0, opacity: 0.85 }}>{s.pct.toFixed(1).replace('.', ',')}%</p>
            </div>
            {i < steps.length - 1 && <span style={{ color: '#9CA3AF', fontSize: 20, padding: '0 6px', flexShrink: 0 }}>›</span>}
          </div>
        ))}
      </div>
    </Card>
  )
}

// 4 — Motivos de recusa
function MotivosRecusa({ data }: { data: Array<{ motivo: string; total: number }> }) {
  const totalRecusas = data.reduce((a, m) => a + m.total, 0)
  return (
    <div style={{ border: '0.5px solid #ccc', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: '#A63A2B', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Distribuição dos motivos de recusa — {totalRecusas} {totalRecusas === 1 ? 'caso' : 'casos'}
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.length === 0 ? (
          <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '8px 0' }}>Nenhuma recusa no período.</p>
        ) : data.map((m) => {
          const pct = totalRecusas > 0 ? (m.total / totalRecusas) * 100 : 0
          return (
            <div key={m.motivo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#374151', width: 180, flexShrink: 0 }}>{MOTIVO_LABELS[m.motivo] ?? m.motivo}</span>
              <div style={{ flex: 1, height: 18, background: '#EFEFEF', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, minWidth: 28, height: '100%', background: '#C0492F', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                  <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', width: 28, textAlign: 'right', flexShrink: 0 }}>{m.total}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 5/6 — Tabela de distribuição (interesse / classificação)
function TabelaDist({ titulo, headerColor, colLabel, rows, totalLabel }: {
  titulo: string; headerColor: string; colLabel: string
  rows: Array<{ label: string; qtde: number; badge?: { bg: string; text: string } }>
  totalLabel: string
}) {
  const total = rows.reduce((a, r) => a + r.qtde, 0)
  const td: React.CSSProperties = { padding: '8px 14px', fontSize: 12, borderBottom: '0.5px solid #eee' }
  return (
    <div style={{ border: '0.5px solid #ccc', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: headerColor, color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{titulo}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F8FAF9' }}>
            <th style={{ ...td, textAlign: 'left', color: '#6B7280', fontWeight: 600 }}>{colLabel}</th>
            <th style={{ ...td, textAlign: 'left', color: '#6B7280', fontWeight: 600, width: 90 }}>Qtde</th>
            <th style={{ ...td, textAlign: 'left', color: '#6B7280', fontWeight: 600, width: 110 }}>% do total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={td}>
                {r.badge
                  ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: r.badge.bg, color: r.badge.text }}>{r.label}</span>
                  : <span style={{ color: '#374151' }}>{r.label}</span>}
              </td>
              <td style={{ ...td, color: '#111', fontWeight: 600 }}>{r.qtde}</td>
              <td style={{ ...td, color: '#374151' }}>{total > 0 ? ((r.qtde / total) * 100).toFixed(1).replace('.', ',') : '0,0'}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#F3F4F6' }}>
            <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{totalLabel}</td>
            <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{total}</td>
            <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// 7 — Solicitações por responsável × classificação
function TabelaResponsavel({ data }: { data: OrcDashboardData['por_responsavel'] }) {
  const cols = [
    { key: 'OBRAS' as const, label: 'Obras' },
    { key: 'PARADAS' as const, label: 'Paradas' },
    { key: 'OLEO_GAS' as const, label: 'Óleo e gás' },
    { key: 'FABRICACOES' as const, label: 'Fabricações' },
  ]
  const rowTotal = (r: OrcDashboardData['por_responsavel'][number]) => r.OBRAS + r.PARADAS + r.OLEO_GAS + r.FABRICACOES
  const totCol = (k: typeof cols[number]['key']) => data.reduce((a, r) => a + r[k], 0)
  const totGeral = data.reduce((a, r) => a + rowTotal(r), 0)
  const td: React.CSSProperties = { padding: '9px 14px', fontSize: 12, borderBottom: '0.5px solid #eee' }
  const tdC: React.CSSProperties = { ...td, textAlign: 'center', color: '#374151' }
  return (
    <div style={{ border: '0.5px solid #ccc', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: NAVY, color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Total de solicitações atribuídas, detalhado por classificação
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ background: '#F8FAF9' }}>
              <th style={{ ...td, textAlign: 'left', color: '#6B7280', fontWeight: 600 }}>Responsável</th>
              {cols.map((c) => <th key={c.key} style={{ ...tdC, color: '#6B7280', fontWeight: 600 }}>{c.label}</th>)}
              <th style={{ ...tdC, color: '#157A3D', fontWeight: 700, background: '#EAF6EF' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#aaa' }}>Sem solicitações classificadas no período.</td></tr>
            ) : data.map((r) => (
              <tr key={r.id}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Initials nome={r.nome} /><span style={{ fontWeight: 600, color: '#374151' }}>{r.nome}</span></div></td>
                {cols.map((c) => <td key={c.key} style={tdC}>{r[c.key]}</td>)}
                <td style={{ ...tdC, fontWeight: 700, color: '#157A3D', background: '#EAF6EF' }}>{rowTotal(r)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F3F4F6' }}>
              <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>Total geral</td>
              {cols.map((c) => <td key={c.key} style={{ ...tdC, fontWeight: 700, borderBottom: 'none' }}>{totCol(c.key)}</td>)}
              <td style={{ ...tdC, fontWeight: 700, borderBottom: 'none', background: '#DCEFE3', color: '#0F5A2E' }}>{totGeral}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
type Aba = 'solicitacoes' | 'propostas'

export default function DashboardComercialPage() {
  const [data, setData] = useState<OrcDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])
  const [aba, setAba] = useState<Aba>('solicitacoes')

  const [ano, setAno] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [interesse, setInteresse] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [orcamentistaId, setOrcamentistaId] = useState('')
  const [segmento, setSegmento] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')
  const [filtroAbertas, setFiltroAbertas] = useState<FiltroAbertas>('todas')

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
    setFiltroAbertas('todas')
  }

  const gap = 8

  return (
    <div style={{ padding: 16, background: '#f0f0f0', height: '100%', overflowY: 'auto', fontFamily: 'Arial, sans-serif' }}>
      {/* ── Cabeçalho + Filtros (bloco sticky) ───────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#f0f0f0',
        paddingBottom: 8,
        marginBottom: 4,
        boxShadow: '0 4px 8px rgba(0,0,0,0.06)',
      }}>
        {/* Título */}
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111' }}>Indicadores Comercial</h2>
          <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
            Indicadores consolidados do funil de orçamentos
          </p>
        </div>

        {/* ── Barra de filtros ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap,
          alignItems: 'flex-end',
          background: '#fff',
          border: '0.5px solid #ccc',
          borderRadius: 4,
          padding: '10px 14px',
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
        </div>{/* fim barra filtros */}

        {/* ── Abas ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
          {([
            { key: 'solicitacoes', label: 'Solicitações' },
            { key: 'propostas',    label: 'Propostas' },
          ] as { key: Aba; label: string }[]).map((a) => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'Arial, sans-serif',
                padding: '5px 18px',
                border: 'none',
                borderBottom: aba === a.key ? `2px solid ${HEADER}` : '2px solid transparent',
                background: aba === a.key ? '#fff' : 'transparent',
                color: aba === a.key ? HEADER : '#888',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                transition: 'all 0.15s',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>{/* fim bloco sticky */}

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 13 }}>
          Carregando indicadores...
        </p>
      ) : !data ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 13 }}>
          Nenhum dado disponível.
        </p>
      ) : aba === 'solicitacoes' ? (
        <>
          {/* 1 — Situação geral */}
          <SectionLabel>Situação geral das solicitações</SectionLabel>
          <KpiSituacao total={data.total} aprovadas={data.aprovadas} reprovadas={data.reprovadas} em_analise={data.em_analise} />

          {/* 2 — Funil */}
          <div style={{ marginTop: gap }}>
            <Funil total={data.total} aprovadas={data.aprovadas} reprovadas={data.reprovadas} />
          </div>

          {/* 3 — Solicitações por mês */}
          <SectionLabel>Solicitações por mês</SectionLabel>
          <GraficoMensal porMes={data.por_mes} />

          {/* 4 — Motivos de recusa */}
          <SectionLabel>Motivos de recusa (agradecimento) das solicitações</SectionLabel>
          <MotivosRecusa data={data.por_motivo_recusa} />

          {/* 5/6 — Distribuição por nível de interesse e classificação */}
          <SectionLabel>Distribuição por nível de interesse e classificação</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap }}>
            <TabelaDist
              titulo="Por nível de interesse" headerColor="#157A3D" colLabel="Nível" totalLabel="Total aprovadas"
              rows={[
                { label: 'Alto',  qtde: data.por_interesse.ALTO,  badge: { bg: '#DCFCE7', text: '#15803D' } },
                { label: 'Médio', qtde: data.por_interesse.MEDIO, badge: { bg: '#FEF3C7', text: '#B45309' } },
                { label: 'Baixo', qtde: data.por_interesse.BAIXO, badge: { bg: '#FEE2E2', text: '#B91C1C' } },
              ]}
            />
            <TabelaDist
              titulo="Por classificação" headerColor="#1E5FA8" colLabel="Classificação" totalLabel="Total aprovadas"
              rows={[
                { label: 'Obras',      qtde: data.por_classificacao.OBRAS ?? 0 },
                { label: 'Paradas',    qtde: data.por_classificacao.PARADAS ?? 0 },
                { label: 'Óleo e gás', qtde: data.por_classificacao.OLEO_GAS ?? 0 },
                { label: 'Fabricações',qtde: data.por_classificacao.FABRICACOES ?? 0 },
              ]}
            />
          </div>

          {/* 7 — Por responsável × classificação */}
          <SectionLabel>Solicitações por responsável (Adm Comercial / Analista) — por classificação</SectionLabel>
          <TabelaResponsavel data={data.por_responsavel} />
        </>
      ) : (
        /* ── Aba Propostas ──────────────────────────────────────────────── */
        <Card title="Solicitações em Aberto — Propostas Pendentes">
          <CardsAbertas
            counts={data.abertas_counts}
            filtro={filtroAbertas}
            onChange={setFiltroAbertas}
          />
          <TabelaAbertas
            items={
              filtroAbertas === 'todas'
                ? data.solicitacoes_abertas
                : data.solicitacoes_abertas.filter((s) => s.situacao === filtroAbertas)
            }
          />
        </Card>
      )}
    </div>
  )
}
