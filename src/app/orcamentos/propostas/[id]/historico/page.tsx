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
  finais_de_semana: boolean | null; nao_aplicavel: boolean
  peso_montagem: string | null
  peso_equipamentos: string | null; peso_tubulacoes: string | null
  peso_suportes: string | null; peso_estruturas: string | null
  data_envio: string | null
}
interface ComData {
  id: number; versao: number; proposta_tecnica_id: number | null
  valor_total: string | null; valor_terceiros: string | null
  valor_montagem_mecanica: string | null
  possui_fabricacao: boolean; valor_fabricacao: string | null
  possui_terceiros: boolean
  valor_eletrica: string | null; valor_isolamento: string | null
  valor_civil: string | null; valor_hidraulica: string | null
  valor_fibra: string | null; valor_tijolo_antiacido: string | null
  valor_outros_terceiros: string | null
  nao_aplicavel: boolean
  data_envio: string | null; resultado: string | null
}
interface EquipFab {
  id: number; ordem: number; descricao: string
  peso_ton: string; valor_total: string; observacoes: string | null
}
interface FabData {
  id: number; versao: number
  peso_total: string; valor_total: string
  possui_testes: boolean; descricao_testes: string | null; valor_testes: string | null
  resultado: string | null; data_envio: string | null
  equipamentos: EquipFab[]
}
interface InfoData {
  id: number; data: string; comentario: string
  versao: number | null; created_at: string; autor: string
}
interface HistoricoData {
  id: number; numero: string; created_at: string; data_recebimento: string | null
  cliente: string; cliente_final: string | null; cidade: string | null; estado: string | null
  escopo: string | null; orcamentista: string | null; as_sold: boolean
  classificacao: string | null
  propostas_tecnicas: TecData[]
  propostas_comerciais: ComData[]
  propostas_fabricacao: FabData[]
  informacoes: InfoData[]
}

// Rev unificada para Paradas/Obras
interface Rev {
  versao: number; label: string; tec: TecData; com: ComData | null
  hhTotal: number | null; pesoTotal: number | null
  valorTotal: number | null; valorSemTerc: number | null
  valorMontagem: number | null; valorFabricacao: number | null; valorTerceiros: number | null
  rhh: number | null; rhhSemTerc: number | null
  hhPorTon: number | null; rsPorKg: number | null; rsPorKgSemTerc: number | null
  isFirst: boolean; isLast: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revStatus(resultado: string | null | undefined, isFirst: boolean, hasCom: boolean) {
  if (!hasCom) {
    if (isFirst) return { label: 'Inicial',  dotCls: 'bg-yellow-400 border-yellow-500', badgeCls: 'bg-yellow-50 text-yellow-700 border border-yellow-300', textCls: 'text-yellow-700' }
    return              { label: 'Pendente', dotCls: 'bg-gray-300 border-gray-400',    badgeCls: 'bg-gray-100 text-gray-500 border border-gray-300',      textCls: 'text-gray-500'   }
  }
  if (resultado === 'GANHOU') return { label: 'Aprovada',  dotCls: 'bg-green-600 border-green-600',  badgeCls: 'bg-green-50 text-green-700 border border-green-300',   textCls: 'text-green-700'  }
  if (resultado === 'PERDEU') return { label: 'Perdeu',    dotCls: 'bg-white border-red-500',        badgeCls: 'bg-red-50 text-red-700 border border-red-300',         textCls: 'text-red-700'    }
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

function fmtCell(v: number | null, fmt?: 'currency' | 'pct' | 'decimal3' | 'ton0') {
  if (v == null) return '—'
  if (fmt === 'currency') return formatCurrency(v)
  if (fmt === 'pct') return v.toFixed(1).replace('.', ',') + '%'
  if (fmt === 'decimal3') return v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' t'
  if (fmt === 'ton0') return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' t'
  return fmtN(v)
}

function mkChart(labels: string[], series: { vals: (number | null)[]; color: string }[], fmt: 'currency' | 'num' | 'decimal') {
  return {
    data: {
      labels,
      datasets: series.map(s => ({
        data: s.vals,
        borderColor: s.color, backgroundColor: s.color + '12',
        pointBackgroundColor: s.color, pointRadius: 6, pointHoverRadius: 8,
        tension: 0.3, fill: true,
      })),
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
      const hhTotal     = tec.hh_total ?? ((tec.hh_direto != null && tec.hh_indireto != null) ? tec.hh_direto + tec.hh_indireto : null)
      const pesoTotal   = tec.peso_montagem != null ? Number(tec.peso_montagem) : null
      const valorTotal  = com?.valor_total != null ? Number(com.valor_total) : null
      // Para Obras as especialidades ficam em campos separados; valor_terceiros só é preenchido para Paradas.
      // Sempre prefere o somatório das especialidades se alguma tiver valor.
      const sumEspecialidades = com != null
        ? [com.valor_eletrica, com.valor_isolamento, com.valor_civil,
           com.valor_hidraulica, com.valor_fibra, com.valor_tijolo_antiacido,
           com.valor_outros_terceiros]
            .reduce((s, v) => s + (v != null ? Number(v) : 0), 0)
        : 0
      const valorTerceiros = com != null
        ? (sumEspecialidades > 0 ? sumEspecialidades : (com.valor_terceiros != null ? Number(com.valor_terceiros) : null))
        : null
      const valorMontagem   = com?.valor_montagem_mecanica != null ? Number(com.valor_montagem_mecanica) : null
      const valorFabricacao = com?.valor_fabricacao != null ? Number(com.valor_fabricacao) : null
      const valorSemTerc    = valorTotal != null ? valorTotal - (valorTerceiros ?? 0) : null
      const rhh         = hhTotal && valorTotal && hhTotal > 0 ? valorTotal / hhTotal : null
      const rhhSemTerc  = hhTotal && valorTotal != null && hhTotal > 0 ? (valorTotal - (valorTerceiros ?? 0)) / hhTotal : null
      const hhPorTon    = pesoTotal && hhTotal && pesoTotal > 0 ? hhTotal / pesoTotal : null
      // R$/kg = valor / (peso_ton * 1000)
      const rsPorKg        = pesoTotal && valorTotal && pesoTotal > 0 ? valorTotal / (pesoTotal * 1000) : null
      // R$/kg sem terceiros = (Valor total - Fabricações - Terceiros) / peso total em kg
      const rsPorKgSemTerc = pesoTotal && valorTotal != null && pesoTotal > 0
        ? (valorTotal - (valorFabricacao ?? 0) - (valorTerceiros ?? 0)) / (pesoTotal * 1000)
        : null
      const label = raw.as_sold && isLast ? 'As Sold.' : formatRev(tec.versao)
      return {
        versao: tec.versao, label, tec, com, hhTotal, pesoTotal,
        valorTotal, valorSemTerc, valorMontagem, valorFabricacao, valorTerceiros,
        rhh, rhhSemTerc, hhPorTon, rsPorKg, rsPorKgSemTerc,
        isFirst, isLast,
      }
    })
  }, [raw])

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
  if (error || !raw) return <div className="p-8 text-center text-red-600 text-sm">{error ?? 'Não encontrado'}</div>

  const isFab   = raw.classificacao === 'FABRICACOES' || raw.classificacao === 'OLEO_GAS'
  const isObra  = raw.classificacao === 'OBRAS'
  const isParada = raw.classificacao === 'PARADAS'

  // Fabricações usa modelo próprio
  if (isFab) {
    return <HistoricoFabricacao raw={raw} router={router} />
  }

  if (revisions.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">Nenhuma revisão registrada.</div>

  const N      = revisions.length
  const labels = revisions.map(r => r.label)
  const solDate = raw.data_recebimento ?? raw.created_at

  function exportXLSX() {
    const rows = revisions.map(r => ({
      'Revisão': r.label,
      'HH Direto': r.tec.hh_direto ?? '', 'HH Indireto': r.tec.hh_indireto ?? '',
      'HH Total': r.hhTotal ?? '', 'Peso Total (t)': r.pesoTotal ?? '',
      'HH/ton': r.hhPorTon?.toFixed(1) ?? '',
      '% Indireto': percInd(r.tec)?.toFixed(1) ?? '',
      'Efetivo Pico': r.tec.efetivo_pico ?? '', 'Dias de Parada': r.tec.dias_parada ?? '', 'Turno': r.tec.turno ?? '',
      'Valor Total (R$)': r.valorTotal ?? '', 'Valor Montagem (R$)': r.valorMontagem ?? '',
      'Terceiros (R$)': r.valorTerceiros ?? '', 'Fabricações (R$)': r.valorFabricacao ?? '',
      'R$/HH': r.rhh?.toFixed(2) ?? '', 'R$/kg': r.rsPorKg?.toFixed(4) ?? '',
      'Resultado': r.com?.resultado ?? '',
      'Env. Técnica': formatDate(r.tec.data_envio), 'Env. Comercial': formatDate(r.com?.data_envio),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
    XLSX.writeFile(wb, `historico_${raw?.numero ?? 'proposta'}.xlsx`)
  }

  // ── Charts por classificação ──────────────────────────────────────────────
  type ChartDef = { title: string; chart: ReturnType<typeof mkChart>; legend?: { color: string; label: string }[] }
  let chartDefs: ChartDef[] = []

  if (isObra) {
    chartDefs = [
      {
        title: 'Evolução do HH Total',
        chart: mkChart(labels, [{ vals: revisions.map(r => r.hhTotal), color: '#1565C0' }], 'num'),
      },
      {
        title: 'HH/ton',
        chart: mkChart(labels, [{ vals: revisions.map(r => r.hhPorTon), color: '#7B1FA2' }], 'num'),
      },
      {
        title: 'Evolução do R$/kg',
        chart: mkChart(labels, [
          { vals: revisions.map(r => r.rsPorKg),        color: '#2E7D32' },
          { vals: revisions.map(r => r.rsPorKgSemTerc), color: '#0288D1' },
        ], 'decimal'),
        legend: [
          { color: '#2E7D32', label: 'R$/kg' },
          { color: '#0288D1', label: 's/ Fab+Terc' },
        ],
      },
    ]
  } else {
    // Paradas (default)
    chartDefs = [
      {
        title: 'Evolução do Valor Total (R$)',
        chart: mkChart(labels, [
          { vals: revisions.map(r => r.valorTotal),   color: '#2E7D32' },
          { vals: revisions.map(r => r.valorSemTerc), color: '#0288D1' },
        ], 'currency'),
        legend: [
          { color: '#2E7D32', label: 'Total' },
          { color: '#0288D1', label: 's/ Terceiros' },
        ],
      },
      {
        title: 'Evolução do HH Total',
        chart: mkChart(labels, [{ vals: revisions.map(r => r.hhTotal), color: '#1565C0' }], 'num'),
      },
      {
        title: 'Evolução do R$ por HH',
        chart: mkChart(labels, [
          { vals: revisions.map(r => r.rhh),        color: '#E65100' },
          { vals: revisions.map(r => r.rhhSemTerc), color: '#7B1FA2' },
        ], 'decimal'),
        legend: [
          { color: '#E65100', label: 'R$/HH' },
          { color: '#7B1FA2', label: 's/ Terceiros' },
        ],
      },
    ]
  }

  // ── Rows da tabela por classificação ──────────────────────────────────────
  type NumRow = { key: string; vals: (number | null)[]; fmt?: 'currency' | 'pct' | 'decimal3' | 'ton0'; bold?: boolean; highlight?: boolean }

  const tecRows: NumRow[] = isObra ? [
    { key: 'Peso Equipamentos (t)',  vals: revisions.map(r => r.tec.peso_equipamentos != null ? Number(r.tec.peso_equipamentos) : null), fmt: 'ton0' },
    { key: 'Peso Tubulações (t)',    vals: revisions.map(r => r.tec.peso_tubulacoes != null ? Number(r.tec.peso_tubulacoes) : null), fmt: 'ton0' },
    { key: 'Peso Suportes (t)',      vals: revisions.map(r => r.tec.peso_suportes != null ? Number(r.tec.peso_suportes) : null), fmt: 'ton0' },
    { key: 'Peso Estruturas (t)',    vals: revisions.map(r => r.tec.peso_estruturas != null ? Number(r.tec.peso_estruturas) : null), fmt: 'ton0' },
    { key: 'Peso Total (t)',         vals: revisions.map(r => r.pesoTotal), fmt: 'ton0', bold: true, highlight: true },
    { key: 'HH Total',               vals: revisions.map(r => r.hhTotal), bold: true, highlight: true },
    { key: 'HH/ton',                 vals: revisions.map(r => r.hhPorTon) },
  ] : [
    // Paradas
    { key: 'HH Direto',      vals: revisions.map(r => r.tec.hh_direto) },
    { key: 'HH Indireto',    vals: revisions.map(r => r.tec.hh_indireto) },
    { key: 'HH Total',       vals: revisions.map(r => r.hhTotal), bold: true, highlight: true },
    { key: '% Indireto',     vals: revisions.map(r => percInd(r.tec)), fmt: 'pct' },
    { key: 'Efetivo Pico',   vals: revisions.map(r => r.tec.efetivo_pico) },
    { key: 'Dias de Parada', vals: revisions.map(r => r.tec.dias_parada) },
  ]

  // Obras: comRows exclui Terceiros (renderizado separadamente com expand)
  const comRowsObra: NumRow[] = [
    { key: 'Valor Montagem',      vals: revisions.map(r => r.valorMontagem),    fmt: 'currency' },
    { key: 'R$/kg s/ Fab+Terc',   vals: revisions.map(r => r.rsPorKgSemTerc),  fmt: 'currency' },
    { key: 'Fabricações',         vals: revisions.map(r => r.valorFabricacao),  fmt: 'currency' },
    // Terceiros rendered as TerceirosExpandableRow
    { key: 'Valor Total',         vals: revisions.map(r => r.valorTotal),       fmt: 'currency', bold: true, highlight: true },
    { key: 'R$/kg',               vals: revisions.map(r => r.rsPorKg),          fmt: 'currency' },
    { key: 'R$/HH',               vals: revisions.map(r => r.rhh),              fmt: 'currency' },
  ]

  const comRows: NumRow[] = isObra ? [] : [
    // Paradas
    { key: 'Valor Total',         vals: revisions.map(r => r.valorTotal),       fmt: 'currency', bold: true, highlight: true },
    { key: 'Terceiros',           vals: revisions.map(r => r.valorTerceiros),   fmt: 'currency' },
    { key: 'R$/HH',               vals: revisions.map(r => r.rhh),              fmt: 'currency' },
    { key: 'R$/HH s/ Terceiros',  vals: revisions.map(r => r.rhhSemTerc),       fmt: 'currency' },
  ]

  // ── Timeline ──────────────────────────────────────────────────────────────
  const tlTotal   = N + 1
  const tlLinePct = `${(100 / (2 * tlTotal)).toFixed(2)}%`

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <HeaderBar raw={raw} onBack={() => router.push('/orcamentos/propostas')} onExport={exportXLSX} />

      {/* ── Linha do Tempo ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 mb-3">
        <div className="flex mb-2.5">
          <div className="flex-1 flex justify-center">
            <span className="text-[11px] font-semibold text-gray-500">Solicitação</span>
          </div>
          {revisions.map(rev => {
            const st = revStatus(rev.com?.resultado, rev.isFirst, rev.com !== null)
            const showBadge = rev.com?.resultado === 'GANHOU' || rev.com?.resultado === 'PERDEU'
            return (
              <div key={rev.versao} className="flex-1 flex justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-gray-700">{rev.label}</span>
                  {showBadge && <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', st.badgeCls)}>{st.label}</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center relative py-0.5">
          <div className="absolute h-[3px] bg-green-primary z-0" style={{ left: tlLinePct, right: tlLinePct, top: '50%', transform: 'translateY(-50%)' }} />
          <div className="flex-1 flex justify-center relative z-10">
            <div className="w-5 h-5 rounded-full border-2 bg-blue-100 border-blue-400 shadow-sm" />
          </div>
          {revisions.map(rev => {
            const st = revStatus(rev.com?.resultado, rev.isFirst, rev.com !== null)
            return (
              <div key={rev.versao} className="flex-1 flex justify-center relative z-10">
                <div className={cn('w-5 h-5 rounded-full border-2 shadow-sm', st.dotCls)} />
              </div>
            )
          })}
        </div>
        <div className="flex mt-2.5">
          <div className="flex-1 text-center text-[9px] text-gray-400 leading-4">{formatDate(solDate)}</div>
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
        {chartDefs.map(({ title, chart, legend }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold text-gray-600">{title}</p>
              {legend && (
                <div className="flex items-center gap-3">
                  {legend.map(l => (
                    <span key={l.label} className="flex items-center gap-1 text-[9px] text-gray-500">
                      <span className="inline-block w-3 h-[2px] rounded" style={{ background: l.color }} /> {l.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ height: 200 }}><Line data={chart.data} options={chart.options as never} /></div>
          </div>
        ))}
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
                <th className="sticky left-0 z-10 bg-green-primary text-left px-3 py-2.5 text-[10px] font-semibold w-[140px] border-r border-green-700">Indicador</th>
                {revisions.map(rev => {
                  const st = revStatus(rev.com?.resultado, rev.isFirst, rev.com !== null)
                  const showBadge = rev.com?.resultado === 'GANHOU' || rev.com?.resultado === 'PERDEU'
                  return (
                    <th key={rev.versao} className="px-2 py-0 text-center w-[90px] border-l border-green-700">
                      <div className="flex items-center justify-center gap-1 pt-2 pb-0.5 flex-wrap">
                        <span className="font-bold text-[11px]">{rev.label}</span>
                        {showBadge && <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', st.badgeCls)}>{st.label}</span>}
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
                <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} bold={row.bold} highlight={row.highlight} />
              ))}
              {isParada && (
                <tr className="border-t border-gray-50 group hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-3 py-2 text-gray-500 whitespace-nowrap border-r border-gray-100">Turno</td>
                  {revisions.map((rev, idx) => {
                    const prevTurno = idx > 0 ? revisions[idx - 1].tec.turno : null
                    const changed = idx > 0 && rev.tec.turno !== prevTurno
                    return (
                      <td key={rev.versao} className="px-2 py-2 text-center border-l border-gray-100">
                        <div className="font-medium">{rev.tec.turno ?? '—'}</div>
                        {changed && prevTurno && <div className="text-[9px] text-orange-500 mt-0.5">era: {prevTurno}</div>}
                      </td>
                    )
                  })}
                </tr>
              )}
              <SectionRow label="COMERCIAL" colSpan={1 + N} />
              {isObra ? (
                <>
                  {/* Valor Montagem + R$/kg s/ Fab+Terc + Fabricações */}
                  {comRowsObra.slice(0, 3).map(row => (
                    <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} bold={row.bold} highlight={row.highlight} />
                  ))}
                  {/* Terceiros expansível */}
                  <TerceirosExpandableRow revisions={revisions} />
                  {/* Valor Total + R$/kg + R$/HH */}
                  {comRowsObra.slice(3).map(row => (
                    <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} bold={row.bold} highlight={row.highlight} />
                  ))}
                </>
              ) : (
                comRows.map(row => (
                  <DataRow key={row.key} label={row.key} revisions={revisions} vals={row.vals} fmt={row.fmt} bold={row.bold} highlight={row.highlight} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[9px] text-gray-400">ⓘ Variação exibida abaixo de cada valor — verde se aumentou, vermelho se diminuiu.</p>
        </div>
      </div>

      <InfoSection infos={raw.informacoes} />
    </div>
  )
}

// ─── Fabricação layout ────────────────────────────────────────────────────────

function HistoricoFabricacao({ raw, router }: { raw: HistoricoData; router: ReturnType<typeof useRouter> }) {
  const fabs = raw.propostas_fabricacao

  function exportXLSX() {
    const rows: Record<string, unknown>[] = []
    fabs.forEach(f => {
      const label = formatRev(f.versao)
      f.equipamentos.forEach(e => {
        rows.push({
          'Revisão': label,
          'Equipamento': e.descricao,
          'Peso (t)': Number(e.peso_ton),
          'Valor (R$)': Number(e.valor_total),
          'R$/kg': Number(e.valor_total) / (Number(e.peso_ton) * 1000),
          'Observações': e.observacoes ?? '',
        })
      })
      rows.push({
        'Revisão': label, 'Equipamento': 'TOTAL',
        'Peso (t)': Number(f.peso_total), 'Valor (R$)': Number(f.valor_total),
        'R$/kg': Number(f.valor_total) / (Number(f.peso_total) * 1000),
      })
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
    XLSX.writeFile(wb, `historico_${raw.numero}.xlsx`)
  }

  if (fabs.length === 0) return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50">
      <HeaderBar raw={raw} onBack={() => router.push('/orcamentos/propostas')} onExport={exportXLSX} />
      <div className="p-8 text-center text-gray-400 text-sm">Nenhuma proposta registrada.</div>
    </div>
  )

  const tlTotal   = fabs.length + 1
  const tlLinePct = `${(100 / (2 * tlTotal)).toFixed(2)}%`
  const solDate   = raw.data_recebimento ?? raw.created_at

  const labels      = fabs.map(f => formatRev(f.versao))
  const pesoVals    = fabs.map(f => Number(f.peso_total))
  const valorVals   = fabs.map(f => Number(f.valor_total))
  const pesoChart   = mkChart(labels, [{ vals: pesoVals, color: '#7B1FA2' }], 'decimal')
  const valorChart  = mkChart(labels, [{ vals: valorVals, color: '#2E7D32' }], 'currency')

  // Collect all unique equipment names across versions for comparison
  const allEquipNames = Array.from(new Set(fabs.flatMap(f => f.equipamentos.map(e => e.descricao))))

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50">
      <HeaderBar raw={raw} onBack={() => router.push('/orcamentos/propostas')} onExport={exportXLSX} />

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-4 mb-3">
        <div className="flex mb-2.5">
          <div className="flex-1 flex justify-center">
            <span className="text-[11px] font-semibold text-gray-500">Solicitação</span>
          </div>
          {fabs.map(f => {
            const st = revStatus(f.resultado, f.versao === 1, true)
            const showBadge = f.resultado === 'GANHOU' || f.resultado === 'PERDEU'
            return (
              <div key={f.versao} className="flex-1 flex justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-gray-700">{formatRev(f.versao)}</span>
                  {showBadge && <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', st.badgeCls)}>{st.label}</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center relative py-0.5">
          <div className="absolute h-[3px] bg-green-primary z-0" style={{ left: tlLinePct, right: tlLinePct, top: '50%', transform: 'translateY(-50%)' }} />
          <div className="flex-1 flex justify-center relative z-10">
            <div className="w-5 h-5 rounded-full border-2 bg-blue-100 border-blue-400 shadow-sm" />
          </div>
          {fabs.map(f => {
            const st = revStatus(f.resultado, f.versao === 1, true)
            return (
              <div key={f.versao} className="flex-1 flex justify-center relative z-10">
                <div className={cn('w-5 h-5 rounded-full border-2 shadow-sm', st.dotCls)} />
              </div>
            )
          })}
        </div>
        <div className="flex mt-2.5">
          <div className="flex-1 text-center text-[9px] text-gray-400">{formatDate(solDate)}</div>
          {fabs.map(f => (
            <div key={f.versao} className="flex-1 text-center text-[9px] text-gray-400">{formatDate(f.data_envio)}</div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">Evolução do Valor Total (R$)</p>
          <div style={{ height: 200 }}><Line data={valorChart.data} options={valorChart.options as never} /></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">Evolução do Peso Total (t)</p>
          <div style={{ height: 200 }}><Line data={pesoChart.data} options={pesoChart.options as never} /></div>
        </div>
      </div>

      {/* Tabela comparativa de equipamentos */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-[12px] font-semibold text-gray-700">Comparativo entre revisões — Equipamentos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-[11px] border-collapse mx-auto">
            <thead>
              <tr className="bg-green-primary text-white">
                <th className="sticky left-0 z-10 bg-green-primary text-left px-3 py-2.5 text-[10px] font-semibold w-[180px] border-r border-green-700">Equipamento</th>
                {fabs.map(f => (
                  <th key={f.versao} className="px-2 py-2.5 text-center w-[130px] border-l border-green-700">
                    <div className="font-bold text-[11px]">{formatRev(f.versao)}</div>
                    <div className="text-[8px] text-green-200 font-normal">{formatDate(f.data_envio)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Equipamentos */}
              {allEquipNames.map(name => (
                <tr key={name} className="border-t border-gray-50 group hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-3 py-2 text-gray-600 whitespace-nowrap border-r border-gray-100 max-w-[180px] truncate" title={name}>{name}</td>
                  {fabs.map((f, fi) => {
                    const eq = f.equipamentos.find(e => e.descricao === name)
                    const prevFab = fi > 0 ? fabs[fi - 1] : null
                    const prevEq  = prevFab?.equipamentos.find(e => e.descricao === name) ?? null
                    const val = eq ? Number(eq.valor_total) : null
                    const prevVal = prevEq ? Number(prevEq.valor_total) : null
                    const d = fi > 0 ? delta(val, prevVal) : null
                    return (
                      <td key={f.versao} className="px-2 py-2 text-center border-l border-gray-100">
                        {eq ? (
                          <>
                            <div className="text-[11px] font-semibold text-gray-800">{formatCurrency(Number(eq.valor_total))}</div>
                            <div className="text-[9px] text-gray-400">{Number(eq.peso_ton).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</div>
                            {d && <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>{d.abs} ({d.pct})</div>}
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {/* Testes */}
              <tr className="border-t border-gray-100 bg-gray-50">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">Testes</td>
                {fabs.map(f => (
                  <td key={f.versao} className="px-2 py-1.5 text-center border-l border-gray-100 text-[10px] text-gray-500">
                    {f.possui_testes && f.valor_testes ? formatCurrency(Number(f.valor_testes)) : '—'}
                  </td>
                ))}
              </tr>
              {/* Total Peso */}
              <tr className="border-t border-gray-200 bg-green-50 group hover:bg-green-100">
                <td className="sticky left-0 z-10 bg-green-50 group-hover:bg-green-100 px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap border-r border-green-200">Peso Total (t)</td>
                {fabs.map((f, fi) => {
                  const val = Number(f.peso_total)
                  const prevVal = fi > 0 ? Number(fabs[fi - 1].peso_total) : null
                  const d = fi > 0 ? delta(val, prevVal) : null
                  return (
                    <td key={f.versao} className="px-2 py-2.5 text-center border-l border-green-200">
                      <div className="text-[12px] font-bold text-auto-value">{val.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} t</div>
                      {d && <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>{d.abs} ({d.pct})</div>}
                    </td>
                  )
                })}
              </tr>
              {/* Total Valor */}
              <tr className="border-t border-gray-50 bg-green-50 group hover:bg-green-100">
                <td className="sticky left-0 z-10 bg-green-50 group-hover:bg-green-100 px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap border-r border-green-200">Valor Total</td>
                {fabs.map((f, fi) => {
                  const val = Number(f.valor_total)
                  const prevVal = fi > 0 ? Number(fabs[fi - 1].valor_total) : null
                  const d = fi > 0 ? delta(val, prevVal) : null
                  return (
                    <td key={f.versao} className="px-2 py-2.5 text-center border-l border-green-200">
                      <div className="text-[12px] font-bold text-auto-value">{formatCurrency(val)}</div>
                      {d && <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>{d.abs} ({d.pct})</div>}
                    </td>
                  )
                })}
              </tr>
              {/* R$/kg */}
              <tr className="border-t border-gray-50 group hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-3 py-2 text-gray-600 whitespace-nowrap border-r border-gray-100">R$/kg médio</td>
                {fabs.map((f, fi) => {
                  const peso = Number(f.peso_total)
                  const valor = Number(f.valor_total)
                  const val = peso > 0 ? valor / (peso * 1000) : null
                  const prevF = fi > 0 ? fabs[fi - 1] : null
                  const prevPeso = prevF ? Number(prevF.peso_total) : null
                  const prevValor = prevF ? Number(prevF.valor_total) : null
                  const prevVal = prevPeso && prevPeso > 0 ? prevValor! / (prevPeso * 1000) : null
                  const d = fi > 0 ? delta(val, prevVal) : null
                  return (
                    <td key={f.versao} className="px-2 py-2 text-center border-l border-gray-100">
                      <div className="text-[12px] font-bold text-gray-800">{val != null ? formatCurrency(val) : '—'}</div>
                      {d && <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>{d.abs} ({d.pct})</div>}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <InfoSection infos={raw.informacoes} />
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function InfoSection({ infos }: { infos: InfoData[] }) {
  if (infos.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <p className="text-[12px] font-semibold text-gray-700">Informações registradas durante a negociação</p>
      </div>
      <div className="divide-y divide-gray-50">
        {infos.map(info => (
          <div key={info.id} className="px-4 py-3 flex gap-4">
            <div className="shrink-0 text-center min-w-[70px]">
              <p className="text-[10px] font-semibold text-gray-700">{formatDate(info.data)}</p>
              {info.versao != null && (
                <span className="inline-block mt-0.5 text-[9px] bg-green-50 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5 font-semibold">
                  {formatRev(info.versao)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-700 leading-relaxed">{info.comentario}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] text-gray-400">{info.autor}</p>
              <p className="text-[9px] text-gray-300">{formatDate(info.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeaderBar({ raw, onBack, onExport }: { raw: HistoricoData; onBack: () => void; onExport: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-3 flex items-center gap-4">
      <div className="w-10 h-10 bg-green-primary rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0">SOL</div>
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
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 border border-gray-300 text-gray-600 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 transition-colors">
          ← Voltar às Propostas
        </button>
        <button onClick={onExport} className="flex items-center gap-1 border border-gray-300 text-gray-600 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 transition-colors">
          ↓ Exportar
        </button>
      </div>
    </div>
  )
}

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

const TERC_ESPECIALIDADES: { key: keyof ComData; label: string }[] = [
  { key: 'valor_eletrica',         label: 'Elétrica' },
  { key: 'valor_isolamento',       label: 'Isolamento' },
  { key: 'valor_civil',            label: 'Civil' },
  { key: 'valor_hidraulica',       label: 'Hidráulica' },
  { key: 'valor_fibra',            label: 'Fibra' },
  { key: 'valor_tijolo_antiacido', label: 'Tijolo antiácido' },
  { key: 'valor_outros_terceiros', label: 'Outros' },
]

function TerceirosExpandableRow({ revisions }: { revisions: Rev[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <tr className="border-t border-gray-50 group hover:bg-gray-50">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-3 py-2 text-gray-600 whitespace-nowrap border-r border-gray-100">
          <div className="flex items-center gap-1.5">
            <span>Terceiros</span>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[9px] text-gray-400 hover:text-green-primary border border-gray-200 rounded px-1.5 py-0.5 leading-none transition-colors"
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </td>
        {revisions.map((rev, idx) => {
          const curr  = rev.valorTerceiros
          const prevV = idx > 0 ? revisions[idx - 1].valorTerceiros : null
          const d     = idx > 0 ? delta(curr, prevV) : null
          return (
            <td key={rev.versao} className="px-2 py-2.5 text-center border-l border-gray-100">
              <div className="text-[12px] font-bold text-gray-800">{fmtCell(curr, 'currency')}</div>
              {d && <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>{d.abs} ({d.pct})</div>}
            </td>
          )
        })}
      </tr>
      {expanded && TERC_ESPECIALIDADES.map(({ key, label }) => {
        const vals = revisions.map(r => {
          const v = r.com?.[key]
          return v != null ? Number(v) : null
        })
        const hasAny = vals.some(v => v != null && v > 0)
        if (!hasAny) return null
        return (
          <tr key={key} className="border-t border-gray-50 group bg-gray-50/60 hover:bg-gray-100/60">
            <td className="sticky left-0 z-10 bg-gray-50/60 group-hover:bg-gray-100/60 pl-7 pr-3 py-1.5 text-[10px] text-gray-500 whitespace-nowrap border-r border-gray-100">
              ↳ {label}
            </td>
            {revisions.map((rev, idx) => {
              const curr  = vals[idx]
              const prevV = idx > 0 ? vals[idx - 1] : null
              const d     = idx > 0 ? delta(curr, prevV) : null
              return (
                <td key={rev.versao} className="px-2 py-1.5 text-center border-l border-gray-100">
                  <div className="text-[11px] font-medium text-gray-700">{curr != null && curr > 0 ? fmtCell(curr, 'currency') : '—'}</div>
                  {d && <div className={cn('text-[10px] font-semibold mt-0.5', d.cls)}>{d.abs} ({d.pct})</div>}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

function DataRow({ label, revisions, vals, fmt, bold, highlight }: {
  label: string; revisions: Rev[]
  vals: (number | null)[]; fmt?: 'currency' | 'pct' | 'decimal3' | 'ton0'; bold?: boolean; highlight?: boolean
}) {
  return (
    <tr className={cn('border-t border-gray-50 group', highlight ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50')}>
      <td className={cn(
        'sticky left-0 z-10 px-3 py-2 text-gray-600 whitespace-nowrap border-r border-gray-100',
        highlight ? 'bg-green-50 group-hover:bg-green-100' : 'bg-white group-hover:bg-gray-50',
        bold && 'font-bold text-gray-800'
      )}>{label}</td>
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
