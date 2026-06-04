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
  hhTotal: number | null; valorTotal: number | null; rhh: number | null; rhhSemTerc: number | null
  isFirst: boolean; isLast: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revStatus(rev: Rev) {
  if (!rev.com) {
    if (rev.isFirst) return { label: 'Inicial',  dotCls: 'bg-yellow-400 border-yellow-500', badgeCls: 'bg-yellow-50 text-yellow-700 border border-yellow-300', textCls: 'text-yellow-700' }
    return              { label: 'Pendente', dotCls: 'bg-gray-300 border-gray-400',   badgeCls: 'bg-gray-100 text-gray-500 border border-gray-300',       textCls: 'text-gray-500'   }
  }
  if (rev.com.resultado === 'GANHOU') return { label: 'Aprovada',  dotCls: 'bg-green-600 border-green-600',  badgeCls: 'bg-green-50 text-green-700 border border-green-300',   textCls: 'text-green-700'  }
  if (rev.com.resultado === 'PERDEU') return { label: 'Perdeu',    dotCls: 'bg-white border-red-500',        badgeCls: 'bg-red-50 text-red-700 border border-red-300',         textCls: 'text-red-700'    }
  return                               { label: 'Aguardando', dotCls: 'bg-orange-400 border-orange-500', badgeCls: 'bg-orange-50 text-orange-700 border border-orange-300', textCls: 'text-orange-700' }
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

// delta: positivo (aumentou) → verde, negativo (diminuiu) → vermelho
function delta(curr: number | null, prev: number | null) {
  if (curr == null || prev == null) return null
  const d = curr - prev
  if (d === 0) return null
  const pct = prev !== 0 ? Math.abs(d / prev) * 100 : 0
  const sign = d > 0 ? '+' : ''
  return {
    abs: `${sign}${d.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
    pct: `${sign}${pct.toFixed(1).replace('.', ',')}%`,
    cls: d > 0 ? 'text-green-600' : 'text-red-600',
  }
}

function fmtCell(v: number | null, fmt?: 'currency' | 'pct') {
  if (v == null) return '—'
  if (fmt === 'currency') return formatCurrency(v)
  if (fmt === 'pct') return v.toFixed(1).replace('.', ',') + '%'
  return fmtN(v)
}

function mkChart(labels: string[], series: { vals: (number | null)[]; color: string }[], fmt: 'currency' | 'num' | 'decimal') {
  return {
    data: {
      labels,
      datasets: series.map(s => ({ data: s.vals, borderColor: s.color, backgroundColor: s.color + '12', pointBackgroundColor: s.color, pointRadius: 6, pointHoverRadius: 8, tension: 0.3, fill: true })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          display: true, align: 'top' as const, anchor: 'end' as const, offset: 6,
          font: { size: 10, weight: 'bold' as const }, color: '#374151',
          formatter: (v: number | null) => {
            if (v == null) return ''
            if (fmt === 'currency') return formatCurrency(v)
            if (fmt === 'decimal')  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return fmtN(v)
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af' } },
        y: { display: false },
      },
      layout: { padding: { top: 55, right: 24, left: 24, bottom: 8 } },
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [raw, setRaw] = useState<HistoricoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

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
      const isLast  = idx === raw.propostas_tecnicas.length - 1
      const isFirst = idx === 0
      const com = raw.propostas_comerciais.find(c => c.proposta_tecnica_id === tec.id) ?? null
      const hhTotal   = tec.hh_total ?? ((tec.hh_direto != null && tec.hh_indireto != null) ? tec.hh_direto + tec.hh_indireto : null)
      const valorTotal = com?.valor_total != null ? Number(com.valor_total) : null
      const rhh        = hhTotal && valorTotal && hhTotal > 0 ? valorTotal / hhTotal : null
      const terceiros  = com?.valor_terceiros != null ? Number(com.valor_terceiros) : null
      const rhhSemTerc = hhTotal && valorTotal != null && hhTotal > 0 ? (valorTotal - (terceiros ?? 0)) / hhTotal : null
      const label      = raw.as_sold && isLast ? 'As Sold.' : formatRev(tec.versao)
      return { versao: tec.versao, label, tec, com, hhTotal, valorTotal, rhh, rhhSemTerc, isFirst, isLast }
    })
  }, [raw])

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
  if (error || !raw) return <div className="p-8 text-center text-red-600 text-sm">{error ?? 'Não encontrado'}</div>
  if (revisions.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">Nenhuma revisão registrada.</div>

  const N       = revisions.length
  const linePct = `${(100 / (2 * N)).toFixed(2)}%`
  const labels  = revisions.map(r => r.label)

  const valorChart = mkChart(labels, [{ vals: revisions.map(r => r.valorTotal), color: '#2E7D32' }], 'currency')
  const hhChart    = mkChart(labels, [{ vals: revisions.map(r => r.hhTotal),    color: '#1565C0' }], 'num')
  const rhhChart   = mkChart(labels, [
    { vals: revisions.map(r => r.rhh),         color: '#E65100' },
    { vals: revisions.map(r => r.rhhSemTerc),  color: '#7B1FA2' },
  ], 'decimal')

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
    { key: 'Valor Total',        vals: revisions.map(r => r.valorTotal),   fmt: 'currency' },
    { key: 'Terceiros',          vals: revisions.map(r => r.com?.valor_terceiros != null ? Number(r.com.valor_terceiros) : null), fmt: 'currency' },
    { key: 'R$/HH',              vals: revisions.map(r => r.rhh),          fmt: 'currency' },
    { key: 'R$/HH s/ Terceiros', vals: revisions.map(r => r.rhhSemTerc),  fmt: 'currency' },
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
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-3 flex items-center gap-4">
        {/* Ícone */}
        <div className="w-10 h-10 bg-green-primary rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0">SOL</div>

        {/* Chips em uma linha */}
        <div className="flex items-center flex-1 min-w-0 gap-0">
          <div className="shrink-0"><InfoChip label="Proposta" value={raw.numero} bold /></div>
          <div className="w-px h-8 bg-gray-100 mx-4 shrink-0" />
          <div className="min-w-0 flex-[0.8]"><InfoChip label="Cliente" value={raw.cliente} truncate /></div>
          <div className="w-px h-8 bg-gray-100 mx-4 shrink-0" />
          <div className="min-w-0 flex-[0.8]"><InfoChip label="Cliente Final" value={raw.cliente_final ?? '—'} truncate /></div>
          <div className="w-px h-8 bg-gray-100 mx-4 shrink-0" />
          <div className="shrink-0"><InfoChip label="Local" value={[raw.cidade, raw.estado].filter(Boolean).join(' / ') || '—'} /></div>
          <div className="w-px h-8 bg-gray-100 mx-4 shrink-0" />
          <div className="min-w-0 flex-[3]"><InfoChip label="Escopo Resumido" value={raw.escopo ?? '—'} truncate /></div>
        </div>

        {/* Ações */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button onClick={() => router.push('/orcamentos/propostas')} className="text-[10px] text-gray-400 hover:text-gray-600">
            ← Voltar às Propostas
          </button>
          <button onClick={exportXLSX} className="flex items-center gap-1 border border-gray-300 text-gray-600 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 transition-colors">
            ↓ Exportar
          </button>
        </div>
      </div>

      {/* ── Linha do Tempo ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 mb-3">
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
        <div className="flex mt-2.5">
          {revisions.map(rev => (
            <div key={rev.versao} className="flex-1 text-center text-[9px] text-gray-400 leading-4">
              <span>Téc: {formatDate(rev.tec.data_envio)}</span>
              {rev.com && <span className="ml-1">• Com: {formatDate(rev.com.data_envio)}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Gráficos ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">Evolução do Valor Total (R$)</p>
          <div style={{ height: 200 }}><Line data={valorChart.data} options={valorChart.options as never} /></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">Evolução do HH Total</p>
          <div style={{ height: 200 }}><Line data={hhChart.data} options={hhChart.options as never} /></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-gray-600">Evolução do R$ por HH</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className="inline-block w-3 h-[2px] rounded bg-[#E65100]" /> R$/HH
              </span>
              <span className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className="inline-block w-3 h-[2px] rounded bg-[#7B1FA2]" /> s/ Terceiros
              </span>
            </div>
          </div>
          <div style={{ height: 200 }}><Line data={rhhChart.data} options={rhhChart.options as never} /></div>
        </div>
      </div>

      {/* ── Tabela Comparativa ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-[12px] font-semibold text-gray-700">Comparativo entre revisões</p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-[11px] border-collapse mx-auto">
            <thead>
              <tr className="bg-green-primary text-white">
                <th className="sticky left-0 z-10 bg-green-primary text-left px-3 py-2.5 text-[10px] font-semibold w-[130px] border-r border-green-700">Indicador</th>
                {revisions.map((rev) => {
                  const st = revStatus(rev)
                  return (
                    <th key={rev.versao} className="px-2 py-0 text-center w-[90px] border-l border-green-700">
                      <div className="flex items-center justify-center gap-1 pt-2 pb-0.5 flex-wrap">
                        <span className="font-bold text-[11px]">{rev.label}</span>
                        <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', st.badgeCls)}>{st.label}</span>
                      </div>
                      <div className="text-[8px] text-green-200 pb-2 font-normal whitespace-nowrap">
                        Téc: {formatDate(rev.tec.data_envio)}{rev.com ? ` • Com: ${formatDate(rev.com.data_envio)}` : ''}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <SectionRow label="TÉCNICA" colSpan={1 + N} />
              {tecRows.map(row => (
                <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} bold={row.bold} />
              ))}
              {/* Turno */}
              <tr className="border-t border-gray-50 group hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-3 py-2 text-gray-500 whitespace-nowrap border-r border-gray-100">Turno</td>
                {revisions.map((rev, idx) => {
                  const prevTurno = idx > 0 ? revisions[idx - 1].tec.turno : null
                  const changed = idx > 0 && rev.tec.turno !== prevTurno
                  return (
                    <td key={rev.versao} className="px-2 py-2 text-center border-l border-gray-100">
                      <div className="font-medium">{rev.tec.turno ?? '—'}</div>
                      {changed && prevTurno && (
                        <div className="text-[9px] text-orange-500 mt-0.5">era: {prevTurno}</div>
                      )}
                    </td>
                  )
                })}
              </tr>
              <SectionRow label="COMERCIAL" colSpan={1 + N} />
              {comRows.map(row => (
                <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[9px] text-gray-400">ⓘ Variação exibida abaixo de cada valor — verde se aumentou, vermelho se diminuiu.</p>
        </div>
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoChip({ label, value, bold, truncate }: { label: string; value: string; bold?: boolean; truncate?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-[12px] text-gray-800', bold ? 'font-extrabold' : 'font-medium', truncate && 'truncate')} title={truncate ? value : undefined}>
        {value}
      </p>
    </div>
  )
}


function SectionRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="bg-gray-100 border-t border-gray-200">
      <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">{label}</td>
      {colSpan > 1 && <td colSpan={colSpan - 1} className="bg-gray-100" />}
    </tr>
  )
}

function DataRow({ label, revisions, vals, fmt, bold }: {
  label: string; revisions: Rev[]
  vals: (number | null)[]; fmt?: 'currency' | 'pct'; bold?: boolean
}) {
  return (
    <tr className="border-t border-gray-50 group hover:bg-gray-50">
      <td className={cn('sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-3 py-2 text-gray-600 whitespace-nowrap border-r border-gray-100', bold && 'font-bold text-gray-800')}>{label}</td>
      {revisions.map((rev, idx) => {
        const curr  = vals[idx]
        const prevV = idx > 0 ? vals[idx - 1] : null
        const d     = idx > 0 ? delta(curr, prevV) : null
        return (
          <td key={rev.versao} className="px-2 py-2.5 text-center border-l border-gray-100">
            <div className={cn('text-[12px] font-bold', bold ? 'text-auto-value' : 'text-gray-800')}>
              {fmtCell(curr, fmt)}
            </div>
            {d && (
              <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>
                {d.abs} ({d.pct})
              </div>
            )}
          </td>
        )
      })}
    </tr>
  )
}
