'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { formatDate, formatCurrency, formatRev } from '@/lib/utils'
import { cn } from '@/lib/utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoricoData {
  id: number
  numero: string
  created_at: string
  data_recebimento: string | null
  cliente: string
  cliente_final: string | null
  cidade: string | null
  estado: string | null
  escopo: string | null
  orcamentista: string | null
  as_sold: boolean
  propostas_tecnicas: {
    id: number
    versao: number
    hh_direto: number | null
    hh_indireto: number | null
    hh_total: number | null
    efetivo_pico: number | null
    dias_parada: number | null
    turno: string | null
    data_envio: string | null
  }[]
  propostas_comerciais: {
    id: number
    versao: number
    valor_total: string | null
    valor_terceiros: string | null
    data_envio: string | null
    resultado: string | null
    proposta_tecnica_id: number
  }[]
}

interface RevisionData {
  versao: number
  label: string
  tec: HistoricoData['propostas_tecnicas'][0]
  com: HistoricoData['propostas_comerciais'][0] | null
  hhTotal: number | null
  valorTotal: number | null
  rhh: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctVar(curr: number | null, prev: number | null): { text: string; positive: boolean } | null {
  if (curr == null || prev == null || prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  return { text: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', positive: pct > 0 }
}

function fmtNum(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function fmtDelta(curr: number | null, prev: number | null): { text: string; cls: string } {
  if (curr == null || prev == null) return { text: '—', cls: 'text-gray-400' }
  const diff = curr - prev
  if (diff === 0) return { text: '—', cls: 'text-gray-500' }
  const pct = prev !== 0 ? (diff / prev) * 100 : 0
  const sign = diff > 0 ? '+' : ''
  const text = `${sign}${diff.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} (${sign}${pct.toFixed(1)}%)`
  const cls = diff < 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'
  return { text, cls }
}

function getTimelineStatus(rev: RevisionData) {
  if (!rev.com) return { label: 'Sem comercial', bg: 'bg-gray-100', text: 'text-gray-500' }
  if (rev.com.resultado === 'GANHOU') return { label: 'Aprovada', bg: 'bg-green-100', text: 'text-green-700' }
  if (rev.com.resultado === 'PERDEU') return { label: 'Perdida', bg: 'bg-red-100', text: 'text-red-700' }
  return { label: 'Aguardando', bg: 'bg-amber-100', text: 'text-amber-700' }
}

function getSituacao(revisions: RevisionData[], asSold: boolean) {
  if (!revisions.length) return { label: '—', color: 'text-gray-500' }
  const latest = revisions[revisions.length - 1]
  if (asSold) return { label: 'As Sold. ✓', color: 'text-green-700' }
  if (!latest.com) return { label: 'Em elaboração', color: 'text-blue-700' }
  if (latest.com.resultado === 'GANHOU') return { label: 'Aprovada', color: 'text-green-700' }
  if (latest.com.resultado === 'PERDEU') return { label: 'Perdida', color: 'text-red-700' }
  return { label: 'Aguardando', color: 'text-amber-700' }
}

function percIndireta(tec: HistoricoData['propostas_tecnicas'][0]): number | null {
  const total = tec.hh_total ?? ((tec.hh_direto != null && tec.hh_indireto != null) ? tec.hh_direto + tec.hh_indireto : null)
  if (!total || !tec.hh_indireto) return null
  return (tec.hh_indireto / total) * 100
}

const baseChartOpts = (fmt?: 'currency') => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          fmt === 'currency' ? formatCurrency(ctx.parsed.y) : fmtNum(ctx.parsed.y),
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: false, grid: { color: '#f0f0f0' } },
  },
})

function mkChartData(labels: string[], vals: (number | null)[], color: string) {
  return {
    labels,
    datasets: [{
      data: vals,
      borderColor: color,
      backgroundColor: color + '18',
      pointBackgroundColor: color,
      pointRadius: 5,
      tension: 0.3,
      fill: true,
    }],
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [data, setData] = useState<HistoricoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/propostas/${params.id}/historico`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setData(j.data) })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
  if (error || !data) return <div className="p-8 text-center text-red-600 text-sm">{error ?? 'Proposta não encontrada'}</div>

  // Build revisions (tecnicas are ASC from API)
  const revisions: RevisionData[] = data.propostas_tecnicas.map((tec, idx) => {
    const isLast = idx === data.propostas_tecnicas.length - 1
    const com = data.propostas_comerciais.find((c) => c.proposta_tecnica_id === tec.id) ?? null
    const hhTotal = tec.hh_total ??
      ((tec.hh_direto != null && tec.hh_indireto != null) ? tec.hh_direto + tec.hh_indireto : null)
    const valorTotal = com?.valor_total != null ? Number(com.valor_total) : null
    const rhh = (hhTotal != null && valorTotal != null && hhTotal > 0) ? valorTotal / hhTotal : null
    const label = data.as_sold && isLast ? 'As Sold.' : formatRev(tec.versao)
    return { versao: tec.versao, label, tec, com, hhTotal, valorTotal, rhh }
  })

  const latest = revisions[revisions.length - 1]
  const prev   = revisions.length >= 2 ? revisions[revisions.length - 2] : null
  const first  = revisions[0]
  const situacao = getSituacao(revisions, data.as_sold)

  const bestRev = [...revisions]
    .filter((r) => r.valorTotal != null)
    .sort((a, b) => a.valorTotal! - b.valorTotal!)[0] ?? null

  const economia =
    first?.valorTotal != null && latest?.valorTotal != null
      ? first.valorTotal - latest.valorTotal
      : null

  const labels = revisions.map((r) => r.label)

  // Rows for the comparative table
  const tecRows: { key: string; vals: (number | null)[]; fmt?: 'pct' | 'num' }[] = [
    { key: 'HH Direto',    vals: revisions.map((r) => r.tec.hh_direto) },
    { key: 'HH Indireto',  vals: revisions.map((r) => r.tec.hh_indireto) },
    { key: 'HH Total',     vals: revisions.map((r) => r.hhTotal) },
    { key: '% Indireto',   vals: revisions.map((r) => percIndireta(r.tec)), fmt: 'pct' },
    { key: 'Efetivo Pico', vals: revisions.map((r) => r.tec.efetivo_pico) },
    { key: 'Dias Parada',  vals: revisions.map((r) => r.tec.dias_parada) },
  ]
  const comRows: { key: string; vals: (number | null)[]; fmt: 'currency' }[] = [
    { key: 'Valor Total', vals: revisions.map((r) => r.valorTotal), fmt: 'currency' },
    { key: 'Terceiros',   vals: revisions.map((r) => r.com?.valor_terceiros != null ? Number(r.com.valor_terceiros) : null), fmt: 'currency' },
    { key: 'R$/HH',       vals: revisions.map((r) => r.rhh), fmt: 'currency' },
  ]

  return (
    <div className="p-4 h-full overflow-y-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <button
            onClick={() => router.push('/orcamentos/propostas')}
            className="text-[11px] text-gray-400 hover:text-gray-700 mb-1.5 flex items-center gap-1"
          >
            ← Voltar às Propostas
          </button>
          <h2 className="text-[16px] font-bold">{data.numero} — Histórico de Revisões</h2>
          <p className="text-[12px] text-gray-600 mt-0.5">
            <span className="font-medium">{data.cliente}</span>
            {data.cliente_final && <span className="text-gray-400"> · {data.cliente_final}</span>}
            {(data.cidade || data.estado) && (
              <span className="text-gray-400"> · {[data.cidade, data.estado].filter(Boolean).join('/')}</span>
            )}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {revisions.length} revisão{revisions.length !== 1 ? 'ões' : ''}
            {bestRev && (
              <> · Melhor proposta:{' '}
                <span className="font-semibold text-green-dark">
                  {formatCurrency(bestRev.valorTotal)} ({bestRev.label})
                </span>
              </>
            )}
            {data.orcamentista && <> · Orçamentista: {data.orcamentista}</>}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="shrink-0 border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] hover:bg-gray-100 transition-colors"
        >
          Imprimir
        </button>
      </div>

      {revisions.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">Nenhuma revisão registrada.</p>
      ) : (
        <>
          {/* ── Linha do Tempo ──────────────────────────────────────────────── */}
          <section className="bg-white border border-gray-200 rounded-md p-4 mb-4 overflow-x-auto">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-3">Linha do Tempo</p>
            <div className="flex items-start min-w-max">
              {revisions.map((rev, idx) => {
                const tl = getTimelineStatus(rev)
                const isLast = idx === revisions.length - 1
                return (
                  <div key={rev.versao} className="flex items-start">
                    <div className="flex flex-col items-center w-[130px]">
                      <div className={cn(
                        'text-[11px] font-bold px-3 py-1 rounded-full border-2',
                        isLast
                          ? 'border-green-primary text-green-dark bg-green-light'
                          : 'border-gray-300 text-gray-600 bg-white',
                      )}>
                        {rev.label}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-2 text-center leading-4">
                        <div>Tec: {formatDate(rev.tec.data_envio)}</div>
                        <div>Com: {formatDate(rev.com?.data_envio)}</div>
                      </div>
                      <span className={cn(
                        'text-[9px] font-semibold px-2 py-0.5 rounded-full mt-1.5',
                        tl.bg, tl.text,
                      )}>
                        {tl.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="flex items-center mt-3.5 mx-1 gap-0">
                        <div className="w-8 h-[2px] bg-gray-200" />
                        <span className="text-gray-300 text-[8px] -ml-0.5">▶</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── KPI Cards ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-2.5 mb-4">
            <KpiCard
              label="HH Total (atual)"
              value={fmtNum(latest?.hhTotal ?? null)}
              variant={pctVar(latest?.hhTotal ?? null, prev?.hhTotal ?? null)}
              lowerIsBetter
            />
            <KpiCard
              label="Valor Total (atual)"
              value={formatCurrency(latest?.valorTotal ?? null)}
              variant={pctVar(latest?.valorTotal ?? null, prev?.valorTotal ?? null)}
              lowerIsBetter
            />
            <KpiCard
              label="R$/HH (atual)"
              value={latest?.rhh != null ? formatCurrency(latest.rhh) : '—'}
              variant={pctVar(latest?.rhh ?? null, prev?.rhh ?? null)}
              lowerIsBetter
            />
            <KpiCard
              label="Economia Acumulada"
              value={economia != null ? formatCurrency(Math.abs(economia)) : '—'}
              sub={
                economia != null
                  ? economia > 0
                    ? '↓ redução vs Rev00'
                    : economia < 0
                    ? '↑ aumento vs Rev00'
                    : 'sem variação'
                  : undefined
              }
              positive={economia != null ? economia > 0 : undefined}
            />
            <div className="bg-white border border-gray-200 rounded-md p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.04em] mb-1">Situação Atual</p>
              <p className={cn('text-[15px] font-bold', situacao.color)}>{situacao.label}</p>
            </div>
          </div>

          {/* ── Gráficos ────────────────────────────────────────────────────── */}
          {revisions.length >= 2 && (
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <ChartCard title="Valor Total (R$)">
                <Line
                  data={mkChartData(labels, revisions.map((r) => r.valorTotal), '#2E7D32')}
                  options={baseChartOpts('currency') as never}
                />
              </ChartCard>
              <ChartCard title="HH Total">
                <Line
                  data={mkChartData(labels, revisions.map((r) => r.hhTotal), '#1565C0')}
                  options={baseChartOpts() as never}
                />
              </ChartCard>
              <ChartCard title="R$ por HH">
                <Line
                  data={mkChartData(labels, revisions.map((r) => r.rhh), '#E65100')}
                  options={baseChartOpts('currency') as never}
                />
              </ChartCard>
            </div>
          )}

          {/* ── Tabela Comparativa ──────────────────────────────────────────── */}
          <section className="bg-white border border-gray-200 rounded-md overflow-hidden mb-4">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Tabela Comparativa</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2 text-[9px] text-gray-400 uppercase font-semibold tracking-wide w-[160px]">
                      Campo
                    </th>
                    {revisions.map((r) => (
                      <th key={r.versao} className="text-right px-3 py-2 text-[9px] text-gray-500 font-semibold whitespace-nowrap">
                        {r.label}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 text-[9px] text-gray-500 font-semibold bg-blue-50 border-l border-blue-100 whitespace-nowrap">
                      Δ vs anterior
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Técnica */}
                  <tr>
                    <td colSpan={revisions.length + 2} className="px-4 py-1.5 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-wide border-t border-gray-100">
                      Proposta Técnica
                    </td>
                  </tr>
                  {tecRows.map((row) => {
                    const last = row.vals[row.vals.length - 1]
                    const prevV = row.vals.length >= 2 ? row.vals[row.vals.length - 2] : null
                    const { text: dt, cls } = fmtDelta(last, prevV)
                    return (
                      <tr key={row.key} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-1.5 text-gray-500">{row.key}</td>
                        {row.vals.map((v, i) => (
                          <td key={i} className="px-3 py-1.5 text-right font-medium">
                            {v != null ? (row.fmt === 'pct' ? v.toFixed(1) + '%' : fmtNum(v)) : '—'}
                          </td>
                        ))}
                        <td className={cn('px-3 py-1.5 text-right border-l border-blue-50 bg-blue-50/30', cls)}>{dt}</td>
                      </tr>
                    )
                  })}
                  {/* Turno (string — no delta) */}
                  <tr className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-1.5 text-gray-500">Turno</td>
                    {revisions.map((r) => (
                      <td key={r.versao} className="px-3 py-1.5 text-right font-medium">
                        {r.tec.turno ?? '—'}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right border-l border-blue-50 bg-blue-50/30 text-gray-400">—</td>
                  </tr>

                  {/* Comercial */}
                  <tr>
                    <td colSpan={revisions.length + 2} className="px-4 py-1.5 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-wide border-t border-gray-100">
                      Proposta Comercial
                    </td>
                  </tr>
                  {comRows.map((row) => {
                    const last = row.vals[row.vals.length - 1]
                    const prevV = row.vals.length >= 2 ? row.vals[row.vals.length - 2] : null
                    const { text: dt, cls } = fmtDelta(last, prevV)
                    return (
                      <tr key={row.key} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-1.5 text-gray-500">{row.key}</td>
                        {row.vals.map((v, i) => (
                          <td key={i} className="px-3 py-1.5 text-right font-medium">
                            {v != null ? formatCurrency(v) : '—'}
                          </td>
                        ))}
                        <td className={cn('px-3 py-1.5 text-right border-l border-blue-50 bg-blue-50/30', cls)}>{dt}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, variant, lowerIsBetter, sub, positive,
}: {
  label: string
  value: string
  variant?: { text: string; positive: boolean } | null
  lowerIsBetter?: boolean
  sub?: string
  positive?: boolean
}) {
  const varColor =
    variant == null ? '' :
    (lowerIsBetter ? !variant.positive : variant.positive)
      ? 'text-green-700'
      : 'text-red-700'

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.04em] mb-1">{label}</p>
      <p className="text-[15px] font-bold text-gray-800 truncate">{value}</p>
      {variant && (
        <p className={cn('text-[10px] font-semibold mt-0.5', varColor)}>
          {variant.text} vs anterior
        </p>
      )}
      {sub && (
        <p className={cn('text-[10px] mt-0.5',
          positive === true ? 'text-green-600' :
          positive === false ? 'text-red-600' : 'text-gray-400',
        )}>
          {sub}
        </p>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div style={{ height: 160 }}>{children}</div>
    </div>
  )
}
