'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
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
import { Bar } from 'react-chartjs-2'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { OrcDashboardData, SolicitacaoAberta } from '@/app/api/dashboard/orcamentos/route'
import type { ResultadoDashboardData } from '@/app/api/dashboard/orcamentos/resultado/route'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { FilterBar, FilterField, ClearFiltersButton, filterSelectClass } from '@/components/dashboard/FilterBar'
import { ProgressBar } from '@/components/dashboard/ProgressBar'
import {
  DASHBOARD_POSITIVO, DASHBOARD_PREVISTO, DASHBOARD_ATENCAO, DASHBOARD_NEGATIVO,
  dashboardXScale, dashboardTooltipPlugin,
} from '@/lib/dashboardColors'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels)

// ── Paleta semântica (mesma das duas telas de indicadores — src/lib/dashboardColors.ts) ──
// GREEN/AMBER/BLUE/RED mantidos como aliases locais só para não reescrever toda
// referência abaixo — apontam para os hex unificados, não para valores próprios.
const GREEN = DASHBOARD_POSITIVO
const AMBER = DASHBOARD_ATENCAO
const BLUE  = DASHBOARD_PREVISTO
const RED   = DASHBOARD_NEGATIVO
const NEUTRO = '#475569' // cinza-ardósia neutro (mesmo tom usado em "Previsão anos seguintes" no Acordos)
const TEAL  = DASHBOARD_PREVISTO // métricas "informativas" (R$/HH, R$/ton) — mesmo papel semântico do azul

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const TIPO_LABELS: Record<string, string> = {
  OBRAS: 'Obras', PARADAS: 'Paradas', FABRICACOES: 'Fabricações', OLEO_GAS: 'Óleo e Gás',
}

const fmtPct1 = (v: number) => v.toFixed(1).replace('.', ',')

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
      tooltip: { ...dashboardTooltipPlugin, callbacks: { label: (ctx: TooltipItem<'bar'>) => `${ctx.parsed.y ?? 0} solicitações` } },
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#374151',
        font: { size: 10, weight: 'bold' as const },
        formatter: (v: number) => v > 0 ? v : '',
      },
    },
    scales: {
      x: { ...dashboardXScale },
      y: { display: false },
    },
    layout: { padding: { top: 16 } },
  } as const

  return (
    <ChartCard title="Solicitações Recebidas por Mês">
      <div style={{ height: 160, position: 'relative' }}>
        <Bar data={chartData} options={options} />
      </div>
    </ChartCard>
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
  const cards: { key: FiltroAbertas; label: string; value: number; accent: string }[] = [
    { key: 'todas',     label: 'Total em Aberto', value: counts.total,    accent: NEUTRO },
    { key: 'no_prazo',  label: 'No Prazo',        value: counts.no_prazo, accent: GREEN },
    { key: 'em_atraso', label: 'Em Atraso',       value: counts.em_atraso, accent: RED },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      {cards.map((c) => (
        <KpiCard
          key={c.key}
          label={c.label}
          value={String(c.value)}
          accent={c.accent}
          onClick={() => onChange(c.key)}
          selected={filtro === c.key}
        />
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

// Dias em relação ao prazo (assinado): >0 = atrasado; <0 = ainda no prazo.
function diasPrazo(prazo: string | null): number | null {
  if (!prazo) return null
  return Math.floor((now.getTime() - new Date(prazo).getTime()) / 86_400_000)
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

  const sectionCls = 'bg-white border border-gray-200 rounded px-3.5 py-2.5 text-[11px]'
  const labelCls = 'text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5'
  const valueCls = 'text-gray-800 font-medium'
  const atrasadoCls = 'font-bold'

  return (
    <div className="grid gap-2 p-3 bg-slate-50 border-b border-gray-200" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
      {/* Chegada */}
      <div className={sectionCls}>
        <p className={labelCls}>Data de Chegada</p>
        <p className={cn(valueCls, 'm-0')}>{fmtDt(s.data_recebimento)}</p>
      </div>

      {/* Atribuição */}
      <div className={sectionCls}>
        <p className={labelCls}>Atribuição ao Orçamentista</p>
        <p className={cn(valueCls, 'm-0')}>{fmtDt(s.data_atribuicao)}</p>
        {diasComOrc !== null && (
          <p className="text-[10px] font-semibold mt-1" style={{ color: enviouTodas ? GREEN : AMBER }}>
            {enviouTodas ? `${diasComOrc} dias de elaboração` : `${diasComOrc} dias com o orçamentista`}
          </p>
        )}
      </div>

      {/* Proposta Técnica */}
      <div className={sectionCls}>
        <p className={labelCls}>Proposta Técnica</p>
        {s.prazo_tecnica_indeterminado ? (
          <p className={cn(valueCls, 'm-0')}>Prazo indeterminado</p>
        ) : (
          <>
            <p className="text-gray-500 m-0">
              <span className="font-semibold">Prevista: </span>
              <span className={atrasoTec > 0 ? atrasadoCls : valueCls} style={atrasoTec > 0 ? { color: RED } : undefined}>{fmtDt(s.prazo_tecnica)}</span>
            </p>
            <p className="text-gray-500 mt-0.5">
              <span className="font-semibold">Envio: </span>
              {s.prazo_tecnica_enviada
                ? <span className="font-semibold" style={{ color: GREEN }}>{fmtDt(s.data_envio_tecnica)}</span>
                : <span className={atrasoTec > 0 ? atrasadoCls : valueCls} style={atrasoTec > 0 ? { color: RED } : undefined}>
                    {atrasoTec > 0 ? `Não enviada — ${atrasoTec} dias de atraso` : 'Não enviada'}
                  </span>
              }
            </p>
          </>
        )}
      </div>

      {/* Proposta Comercial */}
      <div className={sectionCls}>
        <p className={labelCls}>Proposta Comercial</p>
        {s.prazo_comercial_indeterminado ? (
          <p className={cn(valueCls, 'm-0')}>Prazo indeterminado</p>
        ) : (
          <>
            <p className="text-gray-500 m-0">
              <span className="font-semibold">Prevista: </span>
              <span className={atrasoComercial > 0 ? atrasadoCls : valueCls} style={atrasoComercial > 0 ? { color: RED } : undefined}>{fmtDt(s.prazo_comercial)}</span>
            </p>
            <p className="text-gray-500 mt-0.5">
              <span className="font-semibold">Envio: </span>
              {s.prazo_comercial_enviada
                ? <span className="font-semibold" style={{ color: GREEN }}>{fmtDt(s.data_envio_comercial)}</span>
                : <span className={atrasoComercial > 0 ? atrasadoCls : valueCls} style={atrasoComercial > 0 ? { color: RED } : undefined}>
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
    return <p className="text-center py-5 text-gray-400 text-[12px]">Nenhuma solicitação para exibir.</p>
  }

  const thCls = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 border-b border-gray-200'
  const tdCls = 'text-[11px] px-3 py-1.5 border-b border-gray-100 align-middle whitespace-nowrap'

  return (
    // Limita a ~10 linhas visíveis; o restante entra na rolagem vertical
    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 348 }}>
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: 90 }} />
          <col />{/* Escopo — ocupa o restante */}
          <col style={{ width: '15%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={cn(thCls, 'text-center px-1')} />
            <th className={thCls}>Nº</th>
            <th className={thCls}>Escopo</th>
            <th className={thCls}>Cliente</th>
            <th className={thCls}>Cliente Final</th>
            <th className={thCls}>Orçamentista</th>
            <th className={cn(thCls, 'text-center')}>Prazo (dias)</th>
            <th className={cn(thCls, 'text-center')}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => {
            const expanded = expandedId === s.id
            return (
              <>
                <tr
                  key={s.id}
                  className={cn('cursor-pointer hover:bg-slate-50/80', i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white')}
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                >
                  <td className={cn(tdCls, 'text-center text-gray-400')}>{expanded ? '▲' : '▼'}</td>
                  <td className={cn(tdCls, 'font-bold text-gray-700')}>{s.numero}</td>
                  <td className={cn(tdCls, s.escopo ? 'text-gray-800' : 'text-gray-400 italic')}>
                    <span title={s.escopo ?? ''} className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {s.escopo ?? 'Sem escopo'}
                    </span>
                  </td>
                  <td className={cn(tdCls, 'text-gray-800 overflow-hidden text-ellipsis')}>{s.cliente}</td>
                  <td className={cn(tdCls, 'overflow-hidden text-ellipsis', s.cliente_final ? 'text-gray-800' : 'text-gray-400')}>
                    {s.cliente_final ?? '—'}
                  </td>
                  <td className={cn(tdCls, 'overflow-hidden text-ellipsis', s.orcamentista ? 'text-gray-800' : 'text-gray-400')}>
                    {s.orcamentista ?? '—'}
                  </td>
                  <td className={cn(tdCls, 'text-center font-bold')}>
                    {(() => {
                      const d = (s.prazo_comercial_indeterminado || !s.prazo_comercial) ? null : diasPrazo(s.prazo_comercial)
                      if (d == null) return <span className="text-gray-400 font-normal">—</span>
                      return <span style={{ color: d > 0 ? RED : GREEN }}>{d > 0 ? `+${d}` : d}</span>
                    })()}
                  </td>
                  <td className={cn(tdCls, 'text-center')}>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap border"
                      style={{
                        background: s.situacao === 'em_atraso' ? '#FEE2E2' : '#DCFCE7',
                        color: s.situacao === 'em_atraso' ? RED : GREEN,
                        borderColor: s.situacao === 'em_atraso' ? '#FCA5A5' : '#86EFAC',
                      }}
                    >
                      {s.situacao === 'em_atraso' ? 'Em Atraso' : 'No Prazo'}
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr key={`${s.id}-detalhe`}>
                    <td colSpan={8} className="p-0">
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

// ── Novos indicadores (modelo "Indicadores Comercial") ──────────────────────
const MOTIVO_LABELS: Record<string, string> = {
  VOLUME_ADJUDICADO:        'Volume já adjudicado',
  FORA_LINHA_FORNECIMENTO:  'Fora da linha de fornecimento',
  INDISPONIBILIDADE_MO:     'Indisponibilidade de mão de obra',
  SEM_SERVICO_LOCAL:        'Sem serviço no local',
  LIMITACAO_EQUIPAMENTOS:   'Limitação de equipamentos',
  DIFICULDADE_PARCERIA:     'Dificuldade de parceria',
  OUTROS:                   'Outros',
}

function Initials({ nome }: { nome: string }) {
  const ini = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  let h = 0; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 360
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: `hsl(${h},55%,42%)` }}>{ini}</span>
}

// 1 — KPIs de situação geral
function KpiSituacao({ total, aprovadas, reprovadas, em_analise }: { total: number; aprovadas: number; reprovadas: number; em_analise: number }) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const cards = [
    { label: 'Total de solicitações', value: total, accent: NEUTRO, sub: 'no período selecionado' },
    { label: 'Aprovadas', value: aprovadas, accent: GREEN, sub: `${fmtPct1(pct(aprovadas))}% do total` },
    { label: 'Recusadas / Agradecidas', value: reprovadas, accent: RED, sub: `${fmtPct1(pct(reprovadas))}% do total` },
    { label: 'Em análise', value: em_analise, accent: BLUE, sub: em_analise === 0 ? 'todas já analisadas no período' : `${fmtPct1(pct(em_analise))}% do total` },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <KpiCard key={c.label} label={c.label} value={c.value.toLocaleString('pt-BR')} accent={c.accent} sub={c.sub} />
      ))}
    </div>
  )
}

// Motivos de recusa
function MotivosRecusa({ data }: { data: Array<{ motivo: string; total: number }> }) {
  const totalRecusas = data.reduce((a, m) => a + m.total, 0)
  return (
    <ChartCard title={`Distribuição dos motivos de recusa — ${totalRecusas} ${totalRecusas === 1 ? 'caso' : 'casos'}`} accent={RED}>
      <div className="flex flex-col gap-2">
        {data.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-2">Nenhuma recusa no período.</p>
        ) : data.map((m) => {
          const pct = totalRecusas > 0 ? (m.total / totalRecusas) * 100 : 0
          return (
            <div key={m.motivo} className="flex items-center gap-2.5">
              <span className="text-[11px] text-gray-600 w-[180px] flex-shrink-0">{MOTIVO_LABELS[m.motivo] ?? m.motivo}</span>
              <ProgressBar pct={pct} color={RED} size="sm" className="flex-1" />
              <span className="text-[11px] font-bold w-9 text-right" style={{ color: RED }}>{pct.toFixed(0)}%</span>
              <span className="text-[12px] font-bold text-gray-700 w-7 text-right flex-shrink-0">{m.total}</span>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

// 5/6 — Tabela de distribuição (interesse / classificação)
function TabelaDist({ titulo, rows, totalLabel }: {
  titulo: string
  rows: Array<{ label: string; qtde: number; badge?: { bg: string; text: string } }>
  totalLabel: string
}) {
  const total = rows.reduce((a, r) => a + r.qtde, 0)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <p className="text-[12px] font-bold text-gray-700 px-4 pt-3.5 pb-2">{titulo}</p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
            <th className="text-left px-4 py-2 font-semibold">{titulo === 'Por nível de interesse' ? 'Nível' : 'Classificação'}</th>
            <th className="text-right px-4 py-2 font-semibold w-24">Qtde</th>
            <th className="text-right px-4 py-2 font-semibold w-28">% do total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-gray-100">
              <td className="px-4 py-2">
                {r.badge
                  ? <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: r.badge.bg, color: r.badge.text }}>{r.label}</span>
                  : <span className="text-gray-700 font-medium">{r.label}</span>}
              </td>
              <td className="px-4 py-2 text-right text-gray-800 font-semibold tabular-nums">{r.qtde}</td>
              <td className="px-4 py-2 text-right text-gray-600 tabular-nums">{total > 0 ? fmtPct1((r.qtde / total) * 100) : '0,0'}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-green-primary text-white font-bold text-[12px]">
            <td className="px-4 py-2.5">{totalLabel}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{total}</td>
            <td className="px-4 py-2.5 text-right">100%</td>
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
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <p className="text-[12px] font-bold text-gray-700 px-4 pt-3.5 pb-2">Total de solicitações atribuídas, detalhado por classificação</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 560 }}>
          <thead>
            <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
              <th className="text-left px-4 py-2 font-semibold">Responsável</th>
              {cols.map((c) => <th key={c.key} className="text-center px-4 py-2 font-semibold">{c.label}</th>)}
              <th className="text-center px-4 py-2 font-semibold" style={{ color: GREEN, background: '#F0FDF4' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-2.5 text-center text-gray-400 text-[12px]">Sem solicitações classificadas no período.</td></tr>
            ) : data.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Initials nome={r.nome} /><span className="font-medium text-gray-700">{r.nome}</span></div></td>
                {cols.map((c) => <td key={c.key} className="px-4 py-2.5 text-center text-gray-600">{r[c.key]}</td>)}
                <td className="px-4 py-2.5 text-center font-bold" style={{ color: GREEN, background: '#F0FDF4' }}>{rowTotal(r)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-primary text-white font-bold text-[12px]">
              <td className="px-4 py-2.5">Total geral</td>
              {cols.map((c) => <td key={c.key} className="px-4 py-2.5 text-center">{totCol(c.key)}</td>)}
              <td className="px-4 py-2.5 text-center">{totGeral}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Aba "Valor e Resultado" ──────────────────────────────────────────────────
const fmtMoney  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtMoneyM = (v: number) => fmtMoney(v)   // sem abreviação M/K — número por extenso
const fmtInt    = (v: number) => v.toLocaleString('pt-BR')

function GraficoGanhosMes({ porMes }: { porMes: number[] }) {
  const chartData = { labels: MESES, datasets: [{ data: porMes, backgroundColor: GREEN, borderRadius: 2, barThickness: 26 }] }
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...dashboardTooltipPlugin, callbacks: { label: (ctx: TooltipItem<'bar'>) => `${ctx.parsed.y ?? 0} contratos` } },
      datalabels: { anchor: 'end' as const, align: 'end' as const, offset: 2, clamp: true, color: '#374151', font: { size: 10, weight: 'bold' as const }, formatter: (v: number) => v > 0 ? v : '' },
    },
    scales: {
      x: { ...dashboardXScale },
      y: { beginAtZero: true, grace: '12%', ticks: { font: { size: 10 }, color: '#9CA3AF', precision: 0 }, grid: { color: '#F3F4F6' } },
    },
    layout: { padding: { top: 28 } },
  } as const
  return <ChartCard title="Contratos Ganhos por Mês"><div style={{ height: 220, position: 'relative' }}><Bar data={chartData} options={options} /></div></ChartCard>
}

function fmtCurto(v: number): string {
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3)}k`
  return v > 0 ? `R$ ${Math.round(v)}` : ''
}

function GraficoValorGanhosMes({ porMes }: { porMes: number[] }) {
  const chartData = { labels: MESES, datasets: [{ data: porMes, backgroundColor: BLUE, borderRadius: 2, barThickness: 26 }] }
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...dashboardTooltipPlugin, callbacks: { label: (ctx: TooltipItem<'bar'>) => fmtMoney(ctx.parsed.y ?? 0) } },
      datalabels: { anchor: 'end' as const, align: 'end' as const, offset: 2, clamp: true, color: '#374151', font: { size: 9, weight: 'bold' as const }, formatter: (v: number) => fmtCurto(v) },
    },
    scales: {
      x: { ...dashboardXScale },
      y: { beginAtZero: true, grace: '14%', ticks: { font: { size: 10 }, color: '#9CA3AF', callback: (v: string | number) => fmtCurto(Number(v)) }, grid: { color: '#F3F4F6' } },
    },
    layout: { padding: { top: 28 } },
  } as const
  return <ChartCard title="Valor dos Contratos Ganhos por Mês"><div style={{ height: 220, position: 'relative' }}><Bar data={chartData} options={options} /></div></ChartCard>
}

function pontBadge(p: number) { return p >= 80 ? { bg: '#DCFCE7', text: '#15803D' } : p >= 60 ? { bg: '#FEF3C7', text: '#B45309' } : { bg: '#FEE2E2', text: '#B91C1C' } }

function TabelaPontualidade({ data }: { data: ResultadoDashboardData['pontualidade'] }) {
  const tot = data.reduce((a, r) => ({ enviadas: a.enviadas + r.enviadas, no_prazo: a.no_prazo + r.no_prazo, atrasadas: a.atrasadas + r.atrasadas, em_elaboracao: a.em_elaboracao + r.em_elaboracao }), { enviadas: 0, no_prazo: 0, atrasadas: 0, em_elaboracao: 0 })
  const totPct = tot.enviadas > 0 ? (tot.no_prazo / tot.enviadas) * 100 : 0
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <p className="text-[12px] font-bold text-gray-700 px-4 pt-3.5 pb-2">Propostas enviadas no prazo combinado, por orçamentista</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 640 }}>
          <thead>
            <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
              <th className="text-left px-4 py-2 font-semibold">Orçamentista</th>
              <th className="text-center px-4 py-2 font-semibold">Enviadas</th>
              <th className="text-center px-4 py-2 font-semibold">No prazo</th>
              <th className="text-center px-4 py-2 font-semibold">Atrasadas</th>
              <th className="text-left px-4 py-2 font-semibold w-44">% Pontualidade</th>
              <th className="text-center px-4 py-2 font-semibold">Em elaboração</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-2.5 text-center text-gray-400 text-[12px]">Sem propostas enviadas no período.</td></tr>
            ) : data.map((r) => {
              const c = pontBadge(r.pct)
              return (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Initials nome={r.nome} /><span className="font-medium text-gray-700">{r.nome}</span></div></td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{r.enviadas}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{r.no_prazo}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{r.atrasadas}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={r.pct} color={c.text} size="sm" className="flex-1" />
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: c.bg, color: c.text }}>{fmtPct1(r.pct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center"><span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: '#E3F0FB', color: BLUE }}>{r.em_elaboracao}</span></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-green-primary text-white font-bold text-[12px]">
              <td className="px-4 py-2.5">Total geral</td>
              <td className="px-4 py-2.5 text-center">{tot.enviadas}</td>
              <td className="px-4 py-2.5 text-center">{tot.no_prazo}</td>
              <td className="px-4 py-2.5 text-center">{tot.atrasadas}</td>
              <td className="px-4 py-2.5">{fmtPct1(totPct)}%</td>
              <td className="px-4 py-2.5 text-center">{tot.em_elaboracao}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function TabelaTicketTipo({ data }: { data: ResultadoDashboardData['ticket_tipo'] }) {
  const order = ['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']
  const rows = order.map((k) => data.find((d) => d.classificacao === k)).filter(Boolean) as ResultadoDashboardData['ticket_tipo']
  const totG = rows.reduce((a, r) => a + r.ganhos, 0)
  const totHh = rows.reduce((a, r) => a + r.hh_total, 0)
  const totV = rows.reduce((a, r) => a + r.valor_total, 0)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <p className="text-[12px] font-bold text-gray-700 px-4 pt-3.5 pb-2">Valor médio dos contratos ganhos, por classificação</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 640 }}>
          <thead>
            <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
              <th className="text-left px-4 py-2 font-semibold">Tipo de serviço</th>
              <th className="text-right px-4 py-2 font-semibold">Contratos ganhos</th>
              <th className="text-right px-4 py-2 font-semibold">HH total</th>
              <th className="text-right px-4 py-2 font-semibold">Valor total</th>
              <th className="text-right px-4 py-2 font-semibold">Ticket médio</th>
              <th className="text-right px-4 py-2 font-semibold">R$/HH</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-2.5 text-center text-gray-400 text-[12px]">Nenhum contrato ganho no período.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.classificacao} className="border-b border-gray-100">
                <td className="px-4 py-2.5 font-medium text-gray-700">{TIPO_LABELS[r.classificacao] ?? r.classificacao}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{r.ganhos}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{fmtInt(r.hh_total)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{fmtMoneyM(r.valor_total)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{fmtMoneyM(r.ticket_medio)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{r.rs_hh != null ? fmtMoney(r.rs_hh) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-primary text-white font-bold text-[12px]">
              <td className="px-4 py-2.5">Total / média geral</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totG}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(totHh)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoneyM(totV)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totG > 0 ? fmtMoneyM(totV / totG) : '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{totHh > 0 ? fmtMoney(totV / totHh) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
type Aba = 'solicitacoes' | 'propostas' | 'resultado'

export default function DashboardComercialPage() {
  const [data, setData] = useState<OrcDashboardData | null>(null)
  const [resultado, setResultado] = useState<ResultadoDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])
  const [aba, setAba] = useState<Aba>('solicitacoes')

  const [ano, setAno] = useState('')
  const [de, setDe] = useState('')   // aba Valor e Resultado: período DE
  const [ate, setAte] = useState('') // aba Valor e Resultado: período ATÉ
  const [classificacao, setClassificacao] = useState<string[]>([])
  const [interesse, setInteresse] = useState<string[]>([])
  const [clienteId, setClienteId] = useState<string[]>([])
  const [orcamentistaId, setOrcamentistaId] = useState<string[]>([])
  const [segmento, setSegmento] = useState<string[]>([])
  const [cidadeUf, setCidadeUf] = useState<string[]>([])
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
      if (ano)                  params.set('ano', ano)
      if (classificacao.length)  params.set('classificacao', classificacao.join(','))
      if (interesse.length)      params.set('interesse', interesse.join(','))
      if (clienteId.length)      params.set('cliente_id', clienteId.join(','))
      if (orcamentistaId.length) params.set('orcamentista_id', orcamentistaId.join(','))
      if (segmento.length)       params.set('segmento', segmento.join(','))
      if (cidadeUf.length)       params.set('cidade', cidadeUf.join(','))
      // Aba "Valor e Resultado" usa período DE/ATÉ no lugar do ano
      const paramsR = new URLSearchParams(params)
      paramsR.delete('ano')
      if (de)  paramsR.set('de', de)
      if (ate) paramsR.set('ate', ate)
      const [res, resR] = await Promise.all([
        fetch(`/api/dashboard/orcamentos?${params}`),
        fetch(`/api/dashboard/orcamentos/resultado?${paramsR}`),
      ])
      const json = await res.json()
      const jsonR = await resR.json()
      setData(json.data ?? null)
      setResultado(jsonR.data ?? null)
    } finally {
      setLoading(false)
    }
  }, [ano, de, ate, classificacao, interesse, clienteId, orcamentistaId, segmento, cidadeUf])

  useEffect(() => { fetchData() }, [fetchData])

  const limpar = () => {
    setAno(''); setDe(''); setAte(''); setClassificacao([]); setInteresse([]); setClienteId([])
    setOrcamentistaId([]); setSegmento([]); setCidadeUf([])
    setFiltroAbertas('todas')
  }

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50">
      {/* Título */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Indicadores Comercial</h2>
        <span className="text-[11px] text-gray-400">Indicadores consolidados do funil de orçamentos</span>
      </div>

      {/* Filtros */}
      <FilterBar className="!mt-3 sticky top-0 z-10">
        {aba === 'resultado' ? (
          <>
            <FilterField label="Período (de)">
              <input type="date" className={filterSelectClass} value={de} onChange={(e) => setDe(e.target.value)} />
            </FilterField>
            <FilterField label="Período (até)">
              <input type="date" className={filterSelectClass} value={ate} onChange={(e) => setAte(e.target.value)} />
            </FilterField>
          </>
        ) : (
          <FilterField label="Ano" className="min-w-[90px]">
            <select className={filterSelectClass} value={ano} onChange={(e) => setAno(e.target.value)}>
              <option value="">Todos</option>
              {(data?.anos_disponiveis ?? []).map((a) => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </FilterField>
        )}

        {[
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
        ].map(({ label, value, onChange, options }) => {
          const empty = options.find((o) => o.value === '')?.label ?? 'Todos'
          const opts = options.filter((o) => o.value !== '')
          return (
            <FilterField key={label} label={label} className="min-w-[130px]">
              <SearchableMultiSelect values={value} onChange={onChange} options={opts} emptyLabel={empty} />
            </FilterField>
          )
        })}

        {/* Cliente */}
        <FilterField label="Cliente" className="min-w-[140px] flex-1">
          <SearchableMultiSelect values={clienteId} onChange={setClienteId} options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))} />
        </FilterField>

        {/* Orçamentista */}
        <FilterField label="Orçamentista" className="min-w-[140px] flex-1">
          <SearchableMultiSelect values={orcamentistaId} onChange={setOrcamentistaId} options={(data?.orcamentistas_disponiveis ?? []).map((o) => ({ value: String(o.id), label: o.nome }))} />
        </FilterField>

        {/* Mercado (Segmento) */}
        <FilterField label="Mercado" className="min-w-[130px]">
          <SearchableMultiSelect values={segmento} onChange={setSegmento} options={[
            { value: 'PAPEL_CELULOSE', label: 'Papel e Celulose' },
            { value: 'SIDERURGIA', label: 'Siderurgia' },
            { value: 'OLEO_GAS', label: 'Óleo e Gás' },
            { value: 'OUTROS', label: 'Outros' },
          ]} />
        </FilterField>

        {/* Cidade / UF */}
        <FilterField label="Cidade / UF" className="min-w-[140px]">
          <SearchableMultiSelect values={cidadeUf} onChange={setCidadeUf} options={(data?.cidades_disponiveis ?? []).map((c) => ({ value: c.cidade, label: `${c.cidade} — ${c.estado}` }))} emptyLabel="Todas" />
        </FilterField>

        <ClearFiltersButton onClick={limpar} />
      </FilterBar>

      {/* Abas */}
      <DashboardTabs
        tabs={[
          { key: 'solicitacoes', label: 'Solicitações' },
          { key: 'resultado', label: 'Valor e Resultado' },
          { key: 'propostas', label: 'Propostas' },
        ]}
        active={aba}
        onChange={setAba}
      />

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando indicadores...</p>
      ) : !data ? (
        <p className="text-center text-gray-400 py-10 text-sm">Nenhum dado disponível.</p>
      ) : aba === 'solicitacoes' ? (
        <>
          {/* 1 — Situação geral */}
          <SectionTitle>Situação geral das solicitações</SectionTitle>
          <KpiSituacao total={data.total} aprovadas={data.aprovadas} reprovadas={data.reprovadas} em_analise={data.em_analise} />

          {/* 2 — Solicitações por mês */}
          <SectionTitle>Solicitações por mês</SectionTitle>
          <GraficoMensal porMes={data.por_mes} />

          {/* 4 — Motivos de recusa */}
          <SectionTitle>Motivos de recusa (agradecimento) das solicitações</SectionTitle>
          <MotivosRecusa data={data.por_motivo_recusa} />

          {/* 5/6 — Distribuição por nível de interesse e classificação */}
          <SectionTitle>Distribuição por nível de interesse e classificação</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TabelaDist
              titulo="Por nível de interesse" totalLabel="Total aprovadas"
              rows={[
                { label: 'Alto',  qtde: data.por_interesse.ALTO,  badge: { bg: '#DCFCE7', text: '#15803D' } },
                { label: 'Médio', qtde: data.por_interesse.MEDIO, badge: { bg: '#FEF3C7', text: '#B45309' } },
                { label: 'Baixo', qtde: data.por_interesse.BAIXO, badge: { bg: '#FEE2E2', text: '#B91C1C' } },
              ]}
            />
            <TabelaDist
              titulo="Por classificação" totalLabel="Total aprovadas"
              rows={[
                { label: 'Obras',      qtde: data.por_classificacao.OBRAS ?? 0 },
                { label: 'Paradas',    qtde: data.por_classificacao.PARADAS ?? 0 },
                { label: 'Óleo e gás', qtde: data.por_classificacao.OLEO_GAS ?? 0 },
                { label: 'Fabricações',qtde: data.por_classificacao.FABRICACOES ?? 0 },
              ]}
            />
          </div>

          {/* 7 — Por responsável × classificação */}
          <SectionTitle>Solicitações por responsável (Adm Comercial / Analista) — por classificação</SectionTitle>
          <TabelaResponsavel data={data.por_responsavel} />
        </>
      ) : aba === 'resultado' ? (
        !resultado ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando indicadores...</p>
        ) : (
          <>
            {/* 1 — KPIs de resultado */}
            <SectionTitle>Resultado comercial do período</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Contratos ganhos" value={fmtInt(resultado.contratos_ganhos)} sub="no período" accent={GREEN} />
              <KpiCard label="Valor total dos contratos" value={fmtMoneyM(resultado.valor_ganhos)} sub="contratos fechados" accent={NEUTRO} />
              <KpiCard label="Ticket médio geral" value={fmtMoneyM(resultado.ticket_medio)} sub="por contrato ganho" accent={BLUE} />
              <KpiCard label="Taxa de conversão" value={`${fmtPct1(resultado.taxa_conversao)}%`} sub="ganhos ÷ enviadas" accent={AMBER} />
            </div>

            {/* 2 — Ganhos por mês (quantidade) */}
            <SectionTitle>Contratos ganhos por mês</SectionTitle>
            <GraficoGanhosMes porMes={resultado.ganhos_por_mes} />

            {/* 2b — Valor dos contratos ganhos por mês */}
            <SectionTitle>Valor dos contratos ganhos por mês</SectionTitle>
            <GraficoValorGanhosMes porMes={resultado.valor_ganhos_por_mes} />

            {/* 3 — Indicadores de propostas */}
            <SectionTitle>Indicadores de propostas</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="R$/HH médio" value={resultado.rs_hh_medio != null ? fmtMoney(resultado.rs_hh_medio) : '—'} sub="propostas do período" accent={TEAL} />
              <KpiCard label="R$/ton médio" value={resultado.rs_ton_medio != null ? fmtMoney(resultado.rs_ton_medio) : '—'} sub="montagem" accent={TEAL} />
              <KpiCard label="HH Total" value={fmtInt(resultado.hh_total)} sub="propostas do período" accent={NEUTRO} />
              <KpiCard label="HH/ton médio" value={resultado.hh_ton_medio != null ? fmtInt(resultado.hh_ton_medio) : '—'} sub="HH por tonelada" accent={BLUE} />
            </div>
          </>
        )
      ) : (
        /* ── Aba Propostas ──────────────────────────────────────────────── */
        <>
          <SectionTitle>Solicitações em Aberto — Propostas Pendentes</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
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
          </div>

          {/* Pontualidade de envio por orçamentista (movida da aba Valor e Resultado) */}
          <SectionTitle>Pontualidade de envio por orçamentista</SectionTitle>
          {resultado
            ? <TabelaPontualidade data={resultado.pontualidade} />
            : <p className="text-center text-gray-400 py-5 text-[12px]">Carregando...</p>}
        </>
      )}
    </div>
  )
}
