'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import type { Plugin } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { cn, formatDate } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { barColors } from '@/lib/hh'
import {
  MESES_LABELS, mesesEntre, key, pesoPrevItem, pesoRealItem, pctAvanco, fmtHh, fmtPeso, fmtPct,
  type ContratoFab, type ItemFab,
} from '@/lib/fabricacoes'
import { CadastroModal, LancamentoModal } from '@/components/acordos/FabricacaoItensModals'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

// Linha vertical guia ao passar o mouse — não existe em nenhum gráfico do projeto
// hoje (os demais usam só tooltip mode:'index'), registrada só neste gráfico.
const verticalLinePlugin: Plugin<'line'> = {
  id: 'fabVerticalLine',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements()
    if (active && active.length) {
      const x = active[0].element.x
      const { top, bottom } = chart.chartArea
      const ctx = chart.ctx
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
      ctx.lineWidth = 1
      ctx.strokeStyle = '#CBD5E1'
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.restore()
    }
  },
}

const loc = (n: number) => n.toLocaleString('pt-BR')

// ── Card de indicador (mesmo padrão visual dos cards de Obras/ResumoFab) ──────
function IndicadorCard({ label, value, color, bg, iconPath, sub, extra, bar }: {
  label: string; value: string; color: string; bg: string; iconPath: string; sub?: string
  extra?: React.ReactNode
  bar?: { titulo: string; pct: number }
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-normal text-gray-500 mb-1">{label}</p>
        <p className="text-[30px] font-bold leading-none tracking-tight" style={{ color }}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
        {extra}
        {bar && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{bar.titulo}</span>
              <span className="text-[11px] font-bold" style={{ color: barColors(bar.pct).text }}>{bar.pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(bar.pct, 100)}%`, backgroundColor: barColors(bar.pct).bg }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const ICONS = {
  doc:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  trend:  'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  target: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  list:   'M4 6h16M4 12h16M4 18h16',
  bolt:   'M13 10V3L4 14h7v7l9-11h-7z',
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ContratoFabricacaoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pode, ehDono } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [contrato, setContrato] = useState<ContratoFab | null>(null)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalLancar, setModalLancar] = useState(false)
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [metrica, setMetrica] = useState<'hh' | 'peso'>('hh')
  const [autoAbriuNovo, setAutoAbriuNovo] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/acordos/hh/fabricacoes/${id}`)
      const json = await res.json()
      setContrato(json.data ?? null)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // Fluxo "+ Novo Lançamento" da lista: abre "Editar itens" automaticamente
  useEffect(() => {
    if (autoAbriuNovo || loading || !contrato) return
    if (searchParams.get('novo') === '1' && contrato.itens.length === 0) {
      setModalEditar(true)
      setAutoAbriuNovo(true)
    }
  }, [autoAbriuNovo, loading, contrato, searchParams])

  const itens: ItemFab[] = contrato?.itens ?? []

  const podeEditarItens = pode('acordos.fab.itens.editar')
  const podeLancarRealizado = pode('acordos.fab.realizado.lancar', {
    ehDono: ehDono(contrato ? { responsavel_id: contrato.responsavel?.id ?? null } : null, 'contrato'),
  })

  // ── Período contínuo do contrato (união das datas de todos os itens) ────────
  const periodo = useMemo(() => {
    if (itens.length === 0) return { inicio: '', fim: '' }
    const inicios = itens.map((it) => it.data_inicio.slice(0, 10)).sort()
    const fins = itens.map((it) => it.data_fim.slice(0, 10)).sort()
    return { inicio: inicios[0], fim: fins[fins.length - 1] }
  }, [itens])

  const mesesContrato = useMemo(() => mesesEntre(periodo.inicio, periodo.fim), [periodo])

  // ── Série mensal consolidada (soma de todos os itens) ────────────────────────
  const serie = useMemo(() => mesesContrato.map(({ mes, ano }) => {
    let orc = 0, prev = 0, real = 0, pesoPrev = 0, pesoReal = 0
    let temRealHh = false, temRealPeso = false
    for (const it of itens) {
      const m = it.meses.find((x) => x.mes === mes && x.ano === ano)
      if (m) { orc += m.hh_orcado ?? 0; prev += m.hh_previsto ?? 0; pesoPrev += m.peso_previsto ?? 0 }
      const r = it.realizados.find((x) => x.mes === mes && x.ano === ano)
      if (r) {
        if (r.hh_realizado != null)   { real += r.hh_realizado; temRealHh = true }
        if (r.peso_realizado != null) { pesoReal += r.peso_realizado; temRealPeso = true }
      }
    }
    return { mes, ano, label: `${MESES_LABELS[mes]}/${String(ano).slice(2)}`, orc, prev, real, pesoPrev, pesoReal, temRealHh, temRealPeso }
  }), [mesesContrato, itens])

  const totals = useMemo(() => {
    let orc = 0, prev = 0, real = 0, pesoPrev = 0, pesoReal = 0
    for (const it of itens) {
      orc += it.meses.reduce((a, m) => a + (m.hh_orcado ?? 0), 0)
      prev += it.meses.reduce((a, m) => a + (m.hh_previsto ?? 0), 0)
      real += it.realizados.reduce((a, r) => a + (r.hh_realizado ?? 0), 0)
      pesoPrev += pesoPrevItem(it)
      pesoReal += pesoRealItem(it)
    }
    return { orc, prev, real, pesoPrev, pesoReal }
  }, [itens])

  const pctPeso = pctAvanco(totals.pesoPrev, totals.pesoReal)
  const pctHhPrev = pctAvanco(totals.prev, totals.real)
  const hhPorTonPrev = totals.pesoPrev > 0 ? totals.prev / totals.pesoPrev : null
  const hhPorTonReal = totals.pesoReal > 0 ? totals.real / totals.pesoReal : null

  // ── Gráfico ──────────────────────────────────────────────────────────────────
  const labels = serie.map((s) => s.label)
  const prevArr = metrica === 'hh' ? serie.map((s) => s.prev) : serie.map((s) => s.pesoPrev)
  const realArrRaw = metrica === 'hh'
    ? serie.map((s) => (s.temRealHh ? s.real : null))
    : serie.map((s) => (s.temRealPeso ? s.pesoReal : null))

  const cumPrev = prevArr.reduce<number[]>((acc, v) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + v] }, [])
  const cumReal = realArrRaw.reduce<(number | null)[]>((acc, v) => { const l = acc.length ? (acc[acc.length - 1] ?? 0) : 0; return [...acc, v != null ? l + v : null] }, [])

  const fmtEixo = metrica === 'hh' ? (v: number) => loc(v) : (v: number) => fmtPeso(v)

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const v = ctx.parsed.y
            if (v == null) return ctx.dataset.label === 'Realizado' ? 'Realizado: — não lançado' : ''
            return `${ctx.dataset.label}: ${fmtEixo(v)}${metrica === 'peso' ? ' t' : ''}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { ticks: { font: { size: 10 }, callback: (v: string | number) => typeof v === 'number' ? fmtEixo(v) : v }, grid: { color: '#f0f0f0' } },
    },
  }

  const chartData = {
    labels,
    datasets: [
      { label: 'Previsto',  data: cumPrev, borderColor: '#185FA5', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6,3], tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#185FA5', spanGaps: true  },
      { label: 'Realizado', data: cumReal, borderColor: '#16A34A', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#16A34A', spanGaps: false },
    ],
  }

  // ── Handlers de modal ────────────────────────────────────────────────────────
  const handleSucessoEditar = () => { setModalEditar(false); fetchData() }
  const handleSucessoLancar = () => { setModalLancar(false); fetchData() }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b bg-white px-6 py-3 shadow-sm flex-wrap">
        <button onClick={() => router.push('/acordos/hh?tab=fabricacoes')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-green-700">{contrato?.indice ?? '–'}</span>
            <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">FABRICAÇÃO</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
            <span>{contrato?.cliente.nome}</span>
            {contrato?.cliente_final && <><span className="text-gray-300">•</span><span>Final: {contrato.cliente_final.nome}</span></>}
            {(contrato?.cidade || contrato?.estado) && (
              <><span className="text-gray-300">•</span><span>{[contrato?.cidade, contrato?.estado].filter(Boolean).join('/')}</span></>
            )}
            {contrato?.responsavel && <><span className="text-gray-300">•</span><span>{contrato.responsavel.nome}</span></>}
            {contrato?.data_inicio && contrato?.data_fim && (
              <><span className="text-gray-300">•</span><span>{formatDate(contrato.data_inicio)} – {formatDate(contrato.data_fim)}</span></>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {podeEditarItens && (
            <button onClick={() => setModalEditar(true)}
              className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-[11px] font-semibold text-[#185FA5] hover:bg-blue-100 transition-colors">
              Editar itens
            </button>
          )}
          {itens.length > 0 && podeLancarRealizado && (
            <button onClick={() => setModalLancar(true)}
              className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-[11px] font-semibold text-green-dark hover:bg-green-100 transition-colors">
              Lançar Realizado
            </button>
          )}
        </div>
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {itens.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-4 py-3 rounded-md">
            Nenhum item de fabricação cadastrado ainda para este contrato.
            {podeEditarItens && ' Clique em "Editar itens" para cadastrar o primeiro item.'}
          </div>
        ) : (
          <>
            {/* ── Cards — fileira Peso ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <IndicadorCard label="Peso Previsto" value={`${fmtPeso(totals.pesoPrev)} t`} color="#185FA5" bg="#DBEAFE" iconPath={ICONS.doc} sub="contrato completo" />
              <IndicadorCard label="Peso Realizado" value={`${fmtPeso(totals.pesoReal)} t`} color="#16A34A" bg="#DCFCE7" iconPath={ICONS.trend} sub="acumulado lançado"
                bar={{ titulo: '% do Previsto', pct: pctPeso }} />
              <IndicadorCard label="% Avanço do Contrato" value={fmtPct(pctPeso)} color="#7C3AED" bg="#EDE9FE" iconPath={ICONS.target} sub="peso realizado ÷ previsto" />
              <IndicadorCard label="Itens no Contrato" value={String(itens.length)} color="#334155" bg="#F1F5F9" iconPath={ICONS.list}
                extra={<p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2">{itens.map((it) => it.descricao).join(', ')}</p>} />
            </div>

            {/* ── Cards — fileira HH ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <IndicadorCard label="HH Orçado" value={fmtHh(totals.orc)} color="#6B7280" bg="#F3F4F6" iconPath={ICONS.doc} sub="base do orçamento" />
              <IndicadorCard label="HH Previsto" value={fmtHh(totals.prev)} color="#185FA5" bg="#DBEAFE" iconPath={ICONS.doc} sub="distribuído nos itens" />
              <IndicadorCard label="HH Realizado" value={fmtHh(totals.real)} color="#16A34A" bg="#DCFCE7" iconPath={ICONS.trend} sub="acumulado lançado"
                bar={{ titulo: '% do Previsto', pct: pctHhPrev }} />
              <IndicadorCard label="HH / ton" value={hhPorTonPrev != null ? `${hhPorTonPrev.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} HH/t` : '—'}
                color="#BA7517" bg="#FEF3C7" iconPath={ICONS.bolt} sub="produtividade prevista"
                extra={<p className="text-[10px] text-gray-400 mt-1.5">Realizado: {hhPorTonReal != null ? `${hhPorTonReal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} HH/t` : '—'}</p>} />
            </div>

            {/* ── Gráfico ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-0.5 flex-wrap gap-2">
                <div>
                  <p className="text-[13px] font-bold text-gray-700">Acumulado do Contrato</p>
                  <p className="text-[11px] text-gray-400">
                    {metrica === 'hh' ? 'Progressão acumulada de HH ao longo do contrato' : 'Progressão acumulada de peso (t) ao longo do contrato'}
                  </p>
                </div>
                <div className="inline-flex bg-gray-100 rounded-full p-0.5 flex-shrink-0">
                  {(['hh', 'peso'] as const).map((m) => (
                    <button key={m} onClick={() => setMetrica(m)}
                      className={cn('px-3 py-1 text-[10px] font-semibold rounded-full transition-colors',
                        metrica === m ? 'bg-white text-green-dark shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      {m === 'hh' ? 'HH' : 'Peso (t)'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-5 my-3">
                <span className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="inline-block w-5 h-0.5" style={{ background: 'repeating-linear-gradient(90deg,#185FA5 0,#185FA5 4px,transparent 4px,transparent 8px)' }} />
                  Previsto
                </span>
                <span className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="inline-block w-5 h-0.5" style={{ background: '#16A34A' }} />
                  Realizado
                </span>
              </div>
              <div style={{ height: 230 }}><Line data={chartData} options={chartOpts} plugins={[verticalLinePlugin]} /></div>
            </div>

            {/* ── Grade consolidada ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 pt-4 pb-1">
                <p className="text-[13px] font-bold text-gray-700">Detalhamento mês a mês</p>
              </div>
              <div className="overflow-x-auto" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-green-primary text-white text-[9px] uppercase tracking-wide">
                      <th className="px-4 py-2 text-left font-semibold whitespace-nowrap">Mês</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">HH Orçado</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">HH Previsto</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">HH Realizado</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Peso Prev. (t)</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Peso Real. (t)</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">% Avanço (Mês)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {serie.map((row) => {
                      const pctMes = row.pesoPrev > 0 && row.temRealPeso ? (row.pesoReal / row.pesoPrev) * 100 : null
                      return (
                        <tr key={`${row.ano}-${row.mes}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-gray-700">{row.label}</td>
                          <td className="px-4 py-2.5 text-right" style={{ color: '#6B7280' }}>{loc(row.orc)}</td>
                          <td className="px-4 py-2.5 text-right text-[#185FA5]">{loc(row.prev)}</td>
                          <td className="px-4 py-2.5 text-right text-[#16A34A] font-bold">
                            {row.temRealHh ? loc(row.real) : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#185FA5]">{fmtPeso(row.pesoPrev)}</td>
                          <td className="px-4 py-2.5 text-right text-[#16A34A] font-bold">
                            {row.temRealPeso ? fmtPeso(row.pesoReal) : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#7C3AED' }}>
                            {pctMes != null ? fmtPct(pctMes) : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                      <td className="px-4 py-3 text-[11px] uppercase tracking-wide text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right" style={{ color: '#6B7280' }}>{loc(totals.orc)}</td>
                      <td className="px-4 py-3 text-right text-[#185FA5]">{loc(totals.prev)}</td>
                      <td className="px-4 py-3 text-right text-[#16A34A]">{loc(totals.real)}</td>
                      <td className="px-4 py-3 text-right text-[#185FA5]">{fmtPeso(totals.pesoPrev)}</td>
                      <td className="px-4 py-3 text-right text-[#16A34A]">{fmtPeso(totals.pesoReal)}</td>
                      <td className="px-4 py-3 text-right" style={{ color: '#7C3AED' }}>{fmtPct(pctPeso)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                <p className="text-[10px] text-gray-400 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#6B7280' }} />HH Orçado</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#185FA5' }} />Previsto</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#16A34A' }} />Realizado</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#7C3AED' }} />% Avanço</span>
                </p>
              </div>
            </div>

            {/* ── Itens de fabricação ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-[13px] font-bold text-gray-700">Itens de fabricação</p>
              </div>
              {itens.map((it) => {
                const prev = pesoPrevItem(it)
                const real = pesoRealItem(it)
                const pct = pctAvanco(prev, real)
                const expanded = expandedItem === it.id
                const mesesItem = mesesEntre(it.data_inicio.slice(0, 10), it.data_fim.slice(0, 10))
                const planMap = new Map(it.meses.map((m) => [key(m.ano, m.mes), m]))
                const realMap = new Map(it.realizados.map((r) => [key(r.ano, r.mes), r]))
                return (
                  <div key={it.id} className="border-b border-slate-100 last:border-b-0">
                    <button onClick={() => setExpandedItem(expanded ? null : it.id)}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-gray-700 truncate">{it.descricao}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Peso total {it.peso_total != null ? `${fmtPeso(it.peso_total)} t` : '—'} · {formatDate(it.data_inicio)} – {formatDate(it.data_fim)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Peso real / prev</p>
                          <p className="text-[12px] font-bold">
                            <span className="text-green-dark">{fmtPeso(real)}</span> <span className="text-gray-300">/</span> <span className="text-[#185FA5]">{fmtPeso(prev)} t</span>
                          </p>
                        </div>
                        <div className="w-28">
                          <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                            <span>AVANÇO</span><span className="font-bold" style={{ color: barColors(pct).text }}>{fmtPct(pct)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColors(pct).bg }} />
                          </div>
                        </div>
                        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-100 overflow-x-auto bg-slate-50">
                        <table className="text-[10px] border-collapse min-w-max">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="px-3 py-1.5 text-left font-semibold text-gray-500 sticky left-0 bg-slate-100">Indicador</th>
                              {mesesItem.map(({ mes, ano }) => (
                                <th key={key(ano, mes)} className="px-2 py-1.5 text-center font-semibold text-gray-500 whitespace-nowrap w-[80px]">{MESES_LABELS[mes]}/{String(ano).slice(2)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-slate-200">
                              <td className="px-3 py-1.5 font-semibold sticky left-0 bg-slate-50 whitespace-nowrap" style={{ color: '#6B7280' }}>HH Orçado</td>
                              {mesesItem.map(({ mes, ano }) => <td key={key(ano, mes)} className="px-2 py-1.5 text-center" style={{ color: '#6B7280' }}>{planMap.get(key(ano, mes))?.hh_orcado ?? '—'}</td>)}
                            </tr>
                            <tr className="border-t border-slate-200">
                              <td className="px-3 py-1.5 font-semibold text-[#185FA5] sticky left-0 bg-slate-50 whitespace-nowrap">HH Previsto</td>
                              {mesesItem.map(({ mes, ano }) => <td key={key(ano, mes)} className="px-2 py-1.5 text-center text-[#185FA5]">{planMap.get(key(ano, mes))?.hh_previsto ?? '—'}</td>)}
                            </tr>
                            <tr className="border-t border-slate-200">
                              <td className="px-3 py-1.5 font-semibold text-green-dark sticky left-0 bg-slate-50 whitespace-nowrap">HH Realizado</td>
                              {mesesItem.map(({ mes, ano }) => <td key={key(ano, mes)} className="px-2 py-1.5 text-center text-green-dark">{realMap.get(key(ano, mes))?.hh_realizado ?? '—'}</td>)}
                            </tr>
                            <tr className="border-t border-slate-200">
                              <td className="px-3 py-1.5 font-semibold text-[#185FA5] sticky left-0 bg-slate-50 whitespace-nowrap">Peso Previsto (t)</td>
                              {mesesItem.map(({ mes, ano }) => {
                                const p = planMap.get(key(ano, mes))?.peso_previsto
                                return <td key={key(ano, mes)} className="px-2 py-1.5 text-center text-[#185FA5]">{p != null ? fmtPeso(p) : '—'}</td>
                              })}
                            </tr>
                            <tr className="border-t border-slate-200">
                              <td className="px-3 py-1.5 font-semibold text-green-dark sticky left-0 bg-slate-50 whitespace-nowrap">Peso Realizado (t)</td>
                              {mesesItem.map(({ mes, ano }) => {
                                const r = realMap.get(key(ano, mes))?.peso_realizado
                                return <td key={key(ano, mes)} className="px-2 py-1.5 text-center text-green-dark">{r != null ? fmtPeso(r) : '—'}</td>
                              })}
                            </tr>
                            <tr className="border-t border-slate-200">
                              <td className="px-3 py-1.5 font-semibold sticky left-0 bg-slate-50 whitespace-nowrap" style={{ color: '#7C3AED' }}>% Avanço (mês)</td>
                              {mesesItem.map(({ mes, ano }) => {
                                const pp = planMap.get(key(ano, mes))?.peso_previsto ?? 0
                                const pr = realMap.get(key(ano, mes))?.peso_realizado ?? 0
                                return (
                                  <td key={key(ano, mes)} className="px-2 py-1.5 text-center" style={{ color: '#7C3AED' }}>
                                    {pp > 0 && pr > 0 ? fmtPct((pr / pp) * 100) : '—'}
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modalEditar && contrato && (
        <CadastroModal contrato={contrato} onClose={() => setModalEditar(false)} onSuccess={handleSucessoEditar} />
      )}
      {modalLancar && contrato && (
        <LancamentoModal contrato={contrato} onClose={() => setModalLancar(false)} onSuccess={handleSucessoLancar} />
      )}
    </div>
  )
}
