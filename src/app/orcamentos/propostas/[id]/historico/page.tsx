'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Line } from 'react-chartjs-2'
import { formatDate, formatCurrency, formatRev } from '@/lib/utils'
import { cn } from '@/lib/utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, ChartDataLabels)

// ─── Types ───────────────────────────────────────────────────────────────────

interface TecData {
  id: number; versao: number
  hh_direto: number | null; hh_indireto: number | null; hh_total: number | null
  efetivo_pico: number | null; dias_parada: number | null; turno: string | null
  data_envio: string | null
}
interface ComData {
  id: number; versao: number; proposta_tecnica_id: number
  valor_total: string | null; valor_terceiros: string | null
  data_envio: string | null; resultado: string | null
}
interface HistoricoData {
  id: number; numero: string; created_at: string; data_recebimento: string | null
  cliente: string; cliente_final: string | null; cidade: string | null; estado: string | null
  escopo: string | null; orcamentista: string | null; as_sold: boolean
  propostas_tecnicas: TecData[]; propostas_comerciais: ComData[]
}
interface Rev {
  versao: number; label: string; tec: TecData; com: ComData | null
  hhTotal: number | null; valorTotal: number | null; rhh: number | null
  isFirst: boolean; isLast: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revStatus(rev: Rev) {
  if (!rev.com) {
    if (rev.isFirst) return { label: 'Inicial', dotCls: 'bg-yellow-400 border-yellow-500', badgeCls: 'bg-yellow-50 text-yellow-700 border border-yellow-300', textCls: 'text-yellow-700' }
    return { label: 'Pendente', dotCls: 'bg-gray-300 border-gray-400', badgeCls: 'bg-gray-100 text-gray-500 border border-gray-300', textCls: 'text-gray-500' }
  }
  if (rev.com.resultado === 'GANHOU') return { label: 'Aprovada', dotCls: 'bg-green-600 border-green-600', badgeCls: 'bg-green-50 text-green-700 border border-green-300', textCls: 'text-green-700' }
  if (rev.com.resultado === 'PERDEU') return { label: 'Perdeu', dotCls: 'bg-white border-red-500', badgeCls: 'bg-red-50 text-red-700 border border-red-300', textCls: 'text-red-700' }
  return { label: 'Aguardando', dotCls: 'bg-orange-400 border-orange-500', badgeCls: 'bg-orange-50 text-orange-700 border border-orange-300', textCls: 'text-orange-700' }
}

function percInd(tec: TecData): number | null {
  const t = tec.hh_total ?? ((tec.hh_direto != null && tec.hh_indireto != null) ? tec.hh_direto + tec.hh_indireto : null)
  if (!t || !tec.hh_indireto) return null
  return (tec.hh_indireto / t) * 100
}

function fmtN(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function delta(curr: number | null, prev: number | null) {
  if (curr == null || prev == null) return null
  const d = curr - prev
  if (d === 0) return { abs: '0', pct: '0,0%', favorable: null }
  const pct = prev !== 0 ? Math.abs(d / prev) * 100 : 0
  const sign = d > 0 ? '+' : ''
  return {
    abs: `${sign}${d.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
    pct: `${sign}${pct.toFixed(1).replace('.', ',')}%`,
    favorable: d < 0,
  }
}

function fmtCell(v: number | null, fmt?: 'currency' | 'pct') {
  if (v == null) return '—'
  if (fmt === 'currency') return formatCurrency(v)
  if (fmt === 'pct') return v.toFixed(1).replace('.', ',') + '%'
  return fmtN(v)
}

function mkChart(labels: string[], vals: (number | null)[], color: string, fmt: 'currency' | 'num') {
  return {
    data: {
      labels,
      datasets: [{ data: vals, borderColor: color, backgroundColor: color + '12', pointBackgroundColor: color, pointRadius: 5, pointHoverRadius: 7, tension: 0.3, fill: true }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        datalabels: {
          display: true, align: 'top' as const, anchor: 'end' as const, offset: 6,
          font: { size: 9, weight: 'bold' as const }, color: '#374151',
          formatter: (v: number | null) => v != null ? (fmt === 'currency' ? formatCurrency(v) : fmtN(v)) : '',
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: false, grid: { color: '#f3f4f6' },
          ticks: {
            font: { size: 9 },
            callback: (v: string | number) =>
              fmt === 'currency'
                ? new Intl.NumberFormat('pt-BR', { notation: 'compact', currency: 'BRL', style: 'currency' }).format(Number(v))
                : fmtN(Number(v)),
          },
        },
      },
      layout: { padding: { top: 28, right: 12, left: 4 } },
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [raw, setRaw] = useState<HistoricoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/propostas/${params.id}/historico`)
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else setRaw(j.data) })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [params.id])

  const revisions: Rev[] = useMemo(() => {
    if (!raw) return []
    return raw.propostas_tecnicas.map((tec, idx) => {
      const isLast = idx === raw.propostas_tecnicas.length - 1
      const isFirst = idx === 0
      const com = raw.propostas_comerciais.find(c => c.proposta_tecnica_id === tec.id) ?? null
      const hhTotal = tec.hh_total ?? ((tec.hh_direto != null && tec.hh_indireto != null) ? tec.hh_direto + tec.hh_indireto : null)
      const valorTotal = com?.valor_total != null ? Number(com.valor_total) : null
      const rhh = hhTotal && valorTotal && hhTotal > 0 ? valorTotal / hhTotal : null
      const label = raw.as_sold && isLast ? 'As Sold.' : formatRev(tec.versao)
      return { versao: tec.versao, label, tec, com, hhTotal, valorTotal, rhh, isFirst, isLast }
    })
  }, [raw])

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
  if (error || !raw) return <div className="p-8 text-center text-red-600 text-sm">{error ?? 'Não encontrado'}</div>
  if (revisions.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">Nenhuma revisão registrada.</div>

  const first  = revisions[0]
  const latest = revisions[revisions.length - 1]
  const prev   = revisions.length >= 2 ? revisions[revisions.length - 2] : null
  const latestSt = revStatus(latest)

  const allDates = [...revisions.map(r => r.tec.data_envio), ...revisions.map(r => r.com?.data_envio ?? null)].filter(Boolean) as string[]
  const periodFrom = allDates.length ? allDates.reduce((a, b) => a < b ? a : b) : null
  const periodTo   = allDates.length ? allDates.reduce((a, b) => a > b ? a : b) : null

  const bestRev = [...revisions].filter(r => r.valorTotal != null).sort((a, b) => a.valorTotal! - b.valorTotal!)[0] ?? null
  const economia = first.valorTotal != null && latest.valorTotal != null ? first.valorTotal - latest.valorTotal : null

  const N = revisions.length
  const linePct = `${(100 / (2 * N)).toFixed(2)}%`
  const labels  = revisions.map(r => r.label)

  const valorChart = mkChart(labels, revisions.map(r => r.valorTotal), '#2E7D32', 'currency')
  const hhChart    = mkChart(labels, revisions.map(r => r.hhTotal),    '#1565C0', 'num')
  const rhhChart   = mkChart(labels, revisions.map(r => r.rhh),        '#E65100', 'currency')

  type NumRow = { key: string; vals: (number | null)[]; fmt?: 'currency' | 'pct'; bold?: boolean }
  const tecRows: NumRow[] = [
    { key: 'HH Direto',      vals: revisions.map(r => r.tec.hh_direto) },
    { key: 'HH Indireto',    vals: revisions.map(r => r.tec.hh_indireto) },
    { key: 'HH Total',       vals: revisions.map(r => r.hhTotal), bold: true },
    { key: '% Indireto',     vals: revisions.map(r => percInd(r.tec)), fmt: 'pct' },
    { key: 'Efetivo Pico',   vals: revisions.map(r => r.tec.efetivo_pico) },
    { key: 'Dias de Parada', vals: revisions.map(r => r.tec.dias_parada) },
  ]
  const comRows: NumRow[] = [
    { key: 'Valor Total', vals: revisions.map(r => r.valorTotal),  fmt: 'currency' },
    { key: 'Terceiros',   vals: revisions.map(r => r.com?.valor_terceiros != null ? Number(r.com.valor_terceiros) : null), fmt: 'currency' },
    { key: 'R$/HH',       vals: revisions.map(r => r.rhh), fmt: 'currency' },
  ]

  function exportXLSX() {
    const rows = revisions.map(r => ({
      'Revisão': r.label, 'HH Direto': r.tec.hh_direto ?? '', 'HH Indireto': r.tec.hh_indireto ?? '',
      'HH Total': r.hhTotal ?? '', '% Indireto': percInd(r.tec)?.toFixed(1) ?? '',
      'Efetivo Pico': r.tec.efetivo_pico ?? '', 'Dias de Parada': r.tec.dias_parada ?? '', 'Turno': r.tec.turno ?? '',
      'Valor Total (R$)': r.valorTotal ?? '', 'Terceiros (R$)': r.com?.valor_terceiros ?? '', 'R$/HH': r.rhh?.toFixed(2) ?? '',
      'Resultado': r.com?.resultado ?? '', 'Env. Técnica': formatDate(r.tec.data_envio), 'Env. Comercial': formatDate(r.com?.data_envio),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
    XLSX.writeFile(wb, `historico_${raw?.numero ?? 'proposta'}.xlsx`)
  }

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 flex items-center gap-4">
        <div className="w-10 h-10 bg-green-primary rounded-lg flex items-center justify-center text-white font-bold text-[11px] shrink-0 text-center leading-tight">
          SOL
        </div>
        <div className="shrink-0">
          <button onClick={() => router.push('/orcamentos/propostas')} className="text-[9px] text-gray-400 hover:text-gray-600 mb-0.5 block">
            ← Propostas
          </button>
          <p className="text-[15px] font-bold text-gray-800 leading-tight">{raw.numero}</p>
          <p className="text-[11px] text-gray-500">{raw.cliente}</p>
        </div>
        <div className="w-px h-10 bg-gray-200 mx-1 shrink-0" />
        <div className="flex items-center gap-6 flex-1 flex-wrap">
          <InfoChip label="Período do histórico" value={periodFrom && periodTo ? `${formatDate(periodFrom)} a ${formatDate(periodTo)}` : '—'} />
          <div className="w-px h-8 bg-gray-100" />
          <InfoChip label="Total de revisões" value={`${N} revisão${N !== 1 ? 'ões' : ''}`} />
          <div className="w-px h-8 bg-gray-100" />
          <InfoChip label="Melhor proposta (menor valor)" value={bestRev?.label ?? '—'} sub={bestRev ? formatCurrency(bestRev.valorTotal) : undefined} />
        </div>
        <button onClick={exportXLSX} className="shrink-0 flex items-center gap-1 border border-gray-300 text-gray-600 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 transition-colors">
          ↓ Exportar
        </button>
      </div>

      {/* ── Linha do Tempo ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 mb-3">
        {/* Labels */}
        <div className="flex mb-2.5">
          {revisions.map(rev => {
            const st = revStatus(rev)
            return (
              <div key={rev.versao} className="flex-1 flex justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-gray-700">{rev.label}</span>
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', st.badgeCls)}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
        {/* Circles + line */}
        <div className="flex items-center relative py-0.5">
          <div className="absolute h-[3px] bg-green-primary z-0" style={{ left: linePct, right: linePct, top: '50%', transform: 'translateY(-50%)' }} />
          {revisions.map(rev => {
            const st = revStatus(rev)
            return (
              <div key={rev.versao} className="flex-1 flex justify-center relative z-10">
                <div className={cn('w-5 h-5 rounded-full border-2 shadow-sm', st.dotCls)} />
              </div>
            )
          })}
        </div>
        {/* Dates */}
        <div className="flex mt-2.5">
          {revisions.map(rev => (
            <div key={rev.versao} className="flex-1 text-center text-[9px] text-gray-400 leading-4">
              <span>Téc: {formatDate(rev.tec.data_envio)}</span>
              {rev.com && <span className="ml-1">• Com: {formatDate(rev.com.data_envio)}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        <KpiCard icon="👥" iconBg="bg-blue-100" label={`HH Total (${latest.label})`} value={fmtN(latest.hhTotal)}>
          {prev && (() => { const d = delta(latest.hhTotal, prev.hhTotal); if (!d) return null; return <p className={cn('text-[10px] font-semibold', d.favorable ? 'text-green-700' : d.favorable === false ? 'text-red-700' : 'text-gray-500')}>{d.abs} vs {prev.label}</p> })()}
        </KpiCard>
        <KpiCard icon="💰" iconBg="bg-green-100" label={`Valor Total (${latest.label})`} value={formatCurrency(latest.valorTotal)} small>
          {prev && (() => { const d = delta(latest.valorTotal, prev.valorTotal); if (!d) return null; return <p className={cn('text-[10px] font-semibold', d.favorable ? 'text-green-700' : d.favorable === false ? 'text-red-700' : 'text-gray-500')}>{d.pct} vs {prev.label}</p> })()}
        </KpiCard>
        <KpiCard icon="📊" iconBg="bg-indigo-100" label={`R$ por HH (${latest.label})`} value={latest.rhh != null ? formatCurrency(latest.rhh) : '—'} small>
          {prev && (() => { const d = delta(latest.rhh, prev.rhh); if (!d) return null; return <p className={cn('text-[10px] font-semibold', d.favorable ? 'text-green-700' : d.favorable === false ? 'text-red-700' : 'text-gray-500')}>{d.pct} vs {prev.label}</p> })()}
        </KpiCard>
        <KpiCard icon="📉" iconBg="bg-purple-100" label="Redução total valor" value={economia != null ? (economia >= 0 ? '-' : '+') + formatCurrency(Math.abs(economia)) : '—'} valueColor={economia != null ? (economia > 0 ? 'text-green-700' : economia < 0 ? 'text-red-700' : '') : ''} small>
          {economia != null && first.valorTotal != null && (
            <p className={cn('text-[10px] font-semibold', economia > 0 ? 'text-green-700' : 'text-red-700')}>
              {economia > 0 ? '-' : '+'}{((Math.abs(economia) / first.valorTotal) * 100).toFixed(1).replace('.', ',')}% vs {first.label}
            </p>
          )}
        </KpiCard>
        <KpiCard icon="✅" iconBg="bg-green-100" label="Situação" value={latestSt.label} valueColor={latestSt.textCls}>
          <p className="text-[10px] text-gray-400">Revisão mais recente</p>
        </KpiCard>
      </div>

      {/* ── Gráficos ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          { title: 'Evolução do Valor Total (R$)', chart: valorChart },
          { title: 'Evolução do HH Total',          chart: hhChart },
          { title: 'Evolução do R$ por HH',         chart: rhhChart },
        ].map(({ title, chart }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-[11px] font-semibold text-gray-600 mb-2">{title}</p>
            <div style={{ height: 180 }}>
              <Line data={chart.data} options={chart.options as never} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Comparativo + Envios ────────────────────────────────────────────── */}
      <div className="flex gap-3 items-start">

        {/* Tabela comparativa */}
        <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-[12px] font-semibold text-gray-700">Comparativo entre revisões</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-green-primary text-white">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold w-[140px]">Indicador</th>
                  {/* First revision: no delta before */}
                  <th className="px-3 py-0 text-center min-w-[110px]">
                    <div className="flex items-center justify-center gap-1 py-1">
                      <span className="font-bold">{first.label}</span>
                      <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', revStatus(first).badgeCls.replace('border-yellow-300', '').replace('border-green-300', '').replace('border-red-300', '').replace('border-orange-300', '').replace('border-gray-300', ''))}>{revStatus(first).label}</span>
                    </div>
                    <div className="text-[8px] text-green-200 pb-1.5 font-normal">
                      Téc: {formatDate(first.tec.data_envio)}{first.com ? ` • Com: ${formatDate(first.com.data_envio)}` : ''}
                    </div>
                  </th>
                  {/* Subsequent revisions: each gets a revision col + delta col */}
                  {revisions.slice(1).map((rev, idx) => (
                    <>
                      <th key={`r${rev.versao}`} className="px-3 py-0 text-center min-w-[110px]">
                        <div className="flex items-center justify-center gap-1 py-1">
                          <span className="font-bold">{rev.label}</span>
                          <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', revStatus(rev).badgeCls)}>{revStatus(rev).label}</span>
                        </div>
                        <div className="text-[8px] text-green-200 pb-1.5 font-normal">
                          Téc: {formatDate(rev.tec.data_envio)}{rev.com ? ` • Com: ${formatDate(rev.com.data_envio)}` : ''}
                        </div>
                      </th>
                      <th key={`d${rev.versao}`} className="px-3 py-2.5 text-center text-[9px] font-semibold text-green-100 bg-green-800/40 min-w-[90px] whitespace-nowrap">
                        Δ vs. {revisions[idx].label}
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* TÉCNICA */}
                <SectionRow label="TÉCNICA" colSpan={1 + revisions.length + Math.max(0, revisions.length - 1)} />
                {tecRows.map(row => (
                  <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} bold={row.bold} />
                ))}
                {/* Turno (string) */}
                <tr className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-1.5 text-gray-500">Turno</td>
                  <td className="px-3 py-1.5 text-center font-medium">{first.tec.turno ?? '—'}</td>
                  {revisions.slice(1).map((rev, idx) => (
                    <>
                      <td key={`t${rev.versao}`} className="px-3 py-1.5 text-center font-medium">{rev.tec.turno ?? '—'}</td>
                      <td key={`td${rev.versao}`} className="px-3 py-1.5 text-center bg-gray-50 text-gray-400 text-[10px]">
                        {rev.tec.turno !== revisions[idx].tec.turno && rev.tec.turno
                          ? <><span className="line-through text-gray-300">{revisions[idx].tec.turno ?? '—'}</span><br />{rev.tec.turno}</>
                          : '—'}
                      </td>
                    </>
                  ))}
                </tr>
                {/* COMERCIAL */}
                <SectionRow label="COMERCIAL" colSpan={1 + revisions.length + Math.max(0, revisions.length - 1)} />
                {comRows.map(row => (
                  <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-[9px] text-gray-400">ⓘ Δ = Variação em relação à revisão anterior.</p>
          </div>
        </div>

        {/* Histórico de envios */}
        <div className="w-[260px] shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-[12px] font-semibold text-gray-700">Histórico de envios</p>
          </div>
          <div className="px-4 py-3 space-y-4">
            {revisions.map((rev, idx) => {
              const st = revStatus(rev)
              return (
                <div key={rev.versao} className="relative">
                  {idx < revisions.length - 1 && (
                    <div className="absolute left-[7px] top-5 bottom-[-16px] w-[2px] bg-gray-100" />
                  )}
                  <div className="flex items-start gap-2.5">
                    <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 shrink-0', st.dotCls)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold text-gray-700">{rev.label}</span>
                        <span className={cn('text-[8px] font-semibold px-1.5 py-0.5 rounded-full', st.badgeCls)}>{st.label}</span>
                      </div>
                      <div className="text-[9px] text-gray-500 space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">Técnica enviada</span>
                          <span className="font-medium">{formatDate(rev.tec.data_envio)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">Comercial enviada</span>
                          <span className="font-medium">{formatDate(rev.com?.data_envio)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={() => document.querySelector('table')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full border border-gray-300 text-gray-600 text-[11px] font-medium rounded-md py-2 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
            >
              📋 Ver todas as versões
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[12px] font-bold text-gray-700">{value}</p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
    </div>
  )
}

function KpiCard({ icon, iconBg, label, value, valueColor, small, children }: {
  icon: string; iconBg: string; label: string; value: string
  valueColor?: string; small?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[15px]', iconBg)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-tight mb-0.5">{label}</p>
        <p className={cn('font-bold leading-tight truncate', small ? 'text-[13px]' : 'text-[18px]', valueColor || 'text-gray-800')}>{value}</p>
        {children}
      </div>
    </div>
  )
}

function SectionRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="bg-gray-100 border-t border-gray-200">
      <td colSpan={colSpan} className="px-4 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">{label}</td>
    </tr>
  )
}

function DataRow({ label, revisions, vals, fmt, bold }: {
  label: string; revisions: Rev[]
  vals: (number | null)[]; fmt?: 'currency' | 'pct'; bold?: boolean
}) {
  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50">
      <td className={cn('px-4 py-1.5 text-gray-600 whitespace-nowrap', bold && 'font-bold text-gray-800')}>{label}</td>
      {/* First revision value */}
      <td className={cn('px-3 py-1.5 text-center', bold && 'font-bold text-auto-value')}>
        {fmtCell(vals[0], fmt)}
      </td>
      {/* Subsequent revisions: value + delta */}
      {revisions.slice(1).map((rev, idx) => {
        const curr = vals[idx + 1]
        const prevV = vals[idx]
        const d = delta(curr, prevV)
        return (
          <>
            <td key={`v${rev.versao}`} className={cn('px-3 py-1.5 text-center', bold && 'font-bold text-auto-value')}>
              {fmtCell(curr, fmt)}
            </td>
            <td key={`d${rev.versao}`} className="px-3 py-1.5 text-center bg-gray-50 text-[10px]">
              {d == null || d.abs === '0' ? (
                <span className="text-gray-400">—</span>
              ) : (
                <span className={cn('font-semibold', d.favorable ? 'text-green-700' : d.favorable === false ? 'text-red-700' : 'text-gray-500')}>
                  <span className="block">{d.abs}</span>
                  <span className="block text-[9px]">{d.pct} {d.favorable ? '↓' : '↑'}</span>
                </span>
              )}
            </td>
          </>
        )
      })}
    </tr>
  )
}
