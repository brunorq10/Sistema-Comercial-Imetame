'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { cn, formatDate } from '@/lib/utils'
import { barColors } from '@/lib/hh'
import { AcoesMenu } from '@/components/ui/AcoesMenu'
import { useFilterOptions, HhFilters as Filters, applyFilters, type FilterState } from '@/components/acordos/HhFilters'
import {
  MESES_LABELS, mesesEntre, key, pesoPrevItem, pesoRealItem, pctAvanco, fmtHh, fmtPeso, fmtPct,
  type ContratoFab,
} from '@/lib/fabricacoes'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export type { ContratoFab }

// ════════════════════════════════════════════════════════════════════════════
export function FabricacoesView() {
  const router = useRouter()
  const [contratos, setContratos] = useState<ContratoFab[]>([])
  const [loading, setLoading] = useState(true)
  const [visao, setVisao] = useState<'contratos' | 'resumo'>('contratos')

  const [picker, setPicker] = useState(false)
  const [historico, setHistorico] = useState<ContratoFab | null>(null)
  const [excluir, setExcluir] = useState<ContratoFab | null>(null)

  const [filters, setFilters] = useState<FilterState>({})
  const setFilter = (k: string, v: string[]) => setFilters((p) => ({ ...p, [k]: v }))
  const opts = useFilterOptions(contratos)
  const filtradas = applyFilters(contratos, filters)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acordos/hh/fabricacoes')
      const json = await res.json()
      setContratos(json.data ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2 flex-wrap">
        <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5">
          {([['contratos', 'Contratos'], ['resumo', 'Resumo']] as ['contratos' | 'resumo', string][]).map(([k, l]) => (
            <button key={k} onClick={() => setVisao(k)}
              className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-full transition-colors',
                visao === k ? 'bg-green-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {l}
            </button>
          ))}
        </div>
        {visao === 'contratos' && (
          <Button onClick={() => setPicker(true)}>+ Novo Lançamento</Button>
        )}
      </div>

      {!loading && contratos.length > 0 && (
        <Filters opts={opts} filters={filters} onChange={setFilter} />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : visao === 'resumo' ? (
        <ResumoFab contratos={filtradas} />
      ) : (
        <ContratosFab
          contratos={filtradas}
          onAbrir={(c) => router.push(`/acordos/hh/fabricacoes/${c.id}`)}
          onHistorico={(c) => setHistorico(c)}
          onExcluir={(c) => setExcluir(c)}
        />
      )}

      {picker && (
        <PickerModal
          onClose={() => setPicker(false)}
          onSelect={(c) => { setPicker(false); router.push(`/acordos/hh/fabricacoes/${c.id}?novo=1`) }}
        />
      )}
      {historico && (
        <HistoricoFabModal contrato={historico} onClose={() => setHistorico(null)} />
      )}
      {excluir && (
        <ExcluirLancamentosModal
          contrato={excluir}
          onClose={() => setExcluir(null)}
          onSuccess={() => { setExcluir(null); fetchData() }}
        />
      )}
    </div>
  )
}

// ── Excluir lançamentos do contrato (com motivo obrigatório) ──────────────────
function ExcluirLancamentosModal({ contrato, onClose, onSuccess }: {
  contrato: ContratoFab; onClose: () => void; onSuccess: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!motivo.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/acordos/hh/fabricacoes/realizado', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contrato.id, motivo: motivo.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao excluir'); return }
      onSuccess()
    } finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Excluir lançamentos — ${contrato.indice}`}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button variant="danger" onClick={handleDelete} disabled={!motivo.trim() || loading}>
            {loading ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </>
      }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>}
      <p className="text-[12px] text-gray-600 mb-3">
        Esta ação remove <strong>todos os lançamentos de realizado</strong> (HH e peso) dos itens deste contrato. O cadastro dos itens é mantido. Informe o motivo:
      </p>
      <textarea
        value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
        placeholder="Motivo (obrigatório)"
        className="w-full text-[12px] border border-gray-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-green-primary"
      />
    </Modal>
  )
}

// ── Tabela de contratos cadastrados ─────────────────────────────────────────
function ContratosFab({ contratos, onAbrir, onHistorico, onExcluir }: {
  contratos: ContratoFab[]
  onAbrir: (c: ContratoFab) => void
  onHistorico: (c: ContratoFab) => void
  onExcluir: (c: ContratoFab) => void
}) {
  if (contratos.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum contrato corresponde aos filtros. Use “+ Novo Lançamento” para incluir.</p>
  }
  return (
    <div className="overflow-auto border border-gray-200 rounded-md bg-white">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-green-primary text-white text-[10px] uppercase tracking-wide">
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Índice</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Nº OS</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Cliente</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Cliente final</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Descrição</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">Itens</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Orçado</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Previsto</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Realizado</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Previsto (t)</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Realizado (t)</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">% Avanço acum.</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c, i) => {
            const pPrev = c.itens.reduce((a, it) => a + pesoPrevItem(it), 0)
            const pReal = c.itens.reduce((a, it) => a + pesoRealItem(it), 0)
            return (
              <tr key={c.id} className={cn('border-b border-gray-100', i % 2 ? 'bg-gray-50' : 'bg-white')}>
                <td className="px-2 py-1.5 font-bold text-green-dark whitespace-nowrap">{c.indice}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{c.num_os ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{c.cliente.nome}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{c.cliente_final?.nome ?? '—'}</td>
                <td className="px-2 py-1.5 max-w-[220px] truncate" title={c.descricao ?? ''}>{c.descricao ?? '—'}</td>
                <td className="px-2 py-1.5 text-center">{c.itens.length}</td>
                <td className="px-2 py-1.5 text-right">{c.hh_orcado != null ? fmtHh(c.hh_orcado) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{c.hh_previsto != null ? fmtHh(c.hh_previsto) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{c.hh_realizado != null ? fmtHh(c.hh_realizado) : '—'}</td>
                <td className="px-2 py-1.5 text-right text-[#185FA5]">{pPrev > 0 ? fmtPeso(pPrev) : '—'}</td>
                <td className="px-2 py-1.5 text-right text-green-dark">{pReal > 0 ? fmtPeso(pReal) : '—'}</td>
                <td className="px-2 py-1.5 text-right font-semibold text-[#1565C0]">{fmtPct(pctAvanco(pPrev, pReal))}</td>
                <td className="px-2 py-1.5 text-center whitespace-nowrap w-[64px]">
                  <AcoesMenu items={[
                    { label: 'Abrir contrato', icon: '+', destaque: true, onClick: () => onAbrir(c) },
                    { label: 'Histórico de alterações', icon: '🕘', onClick: () => onHistorico(c) },
                    { label: 'Excluir lançamentos', icon: '🗑', destrutiva: true, onClick: () => onExcluir(c) },
                  ]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Picker: escolher contrato (só Fabricação/Óleo-Gás sem itens) ─────────────
function PickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (c: ContratoFab) => void }) {
  const [lista, setLista] = useState<ContratoFab[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/acordos/hh/fabricacoes?disponivel=1')
      .then((r) => r.json()).then((j) => setLista(j.data ?? []))
      .finally(() => setLoading(false))
  }, [])
  const filtrada = lista.filter((c) =>
    `${c.indice} ${c.cliente.nome} ${c.descricao ?? ''}`.toLowerCase().includes(busca.toLowerCase()))
  return (
    <Modal open onClose={onClose} title="Novo Lançamento — escolher contrato" wide
      footer={<ModalCancelButton label="Fechar" />}>
      <Field label="Buscar">
        <Input placeholder="Índice, cliente ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </Field>
      <div className="mt-3 max-h-[50vh] overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>
        ) : filtrada.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Todos os contratos de Fabricação/Óleo e Gás já possuem itens cadastrados.</p>
        ) : filtrada.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)}
            className="w-full text-left px-3 py-2 hover:bg-green-light transition-colors">
            <p className="text-[12px] font-semibold text-green-dark">{c.indice} — {c.cliente.nome}</p>
            <p className="text-[10px] text-gray-500 truncate">{c.descricao ?? 'Sem descrição'} · {[c.cidade, c.estado].filter(Boolean).join('/')}</p>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ── Histórico de alterações do contrato (todos os itens) ─────────────────────
interface HistEntry { id: number; item: string; campo: string; valor_de: string | null; valor_para: string | null; alterado_em: string; alterado_por: string }
function HistoricoFabModal({ contrato, onClose }: { contrato: ContratoFab; onClose: () => void }) {
  const [hist, setHist] = useState<HistEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/acordos/hh/fabricacoes/historico?contrato_id=${contrato.id}`)
      .then((r) => r.json()).then((j) => setHist(j.data ?? []))
      .finally(() => setLoading(false))
  }, [contrato.id])
  return (
    <Modal open onClose={onClose} wide title={`Histórico de Alterações — ${contrato.indice} · ${contrato.cliente.nome}`}
      footer={<ModalCancelButton label="Fechar" />}>
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando histórico...</p>
      ) : hist.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400 text-sm">Nenhuma alteração registrada.</p>
          <p className="text-gray-300 text-xs mt-1">Alterações futuras nos itens aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-green-primary">
              <tr className="bg-green-primary text-white text-[10px] uppercase tracking-wide">
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Data / Hora</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Item</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Campo</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">De</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Para</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Alterado por</th>
              </tr>
            </thead>
            <tbody>
              {hist.map((h, idx) => {
                const dt = new Date(h.alterado_em)
                const dataHora = `${formatDate(h.alterado_em) ?? '—'} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                return (
                  <tr key={h.id} className={cn('border-b border-gray-100', idx % 2 ? 'bg-gray-50' : 'bg-white')}>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-500">{dataHora}</td>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-700">{h.item}</td>
                    <td className="px-3 py-[6px] whitespace-nowrap font-semibold text-gray-700">{h.campo}</td>
                    <td className="px-3 py-[6px]"><span className="text-red-500 bg-red-50 rounded px-1.5 py-0.5 whitespace-nowrap">{h.valor_de ?? '—'}</span></td>
                    <td className="px-3 py-[6px]"><span className="text-green-700 bg-green-50 rounded px-1.5 py-0.5 whitespace-nowrap">{h.valor_para ?? '—'}</span></td>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-600">{h.alterado_por}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

// ── Resumo: KPIs + cards de avanço (estilo Obras) + gráficos + tabela ────────
const COR = { orcado: '#BA7517', previsto: '#185FA5', realizado: '#16A34A' }

const chartOptsFactory = (fmt: (v: number) => string) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    datalabels: { display: false },
    tooltip: {
      mode: 'index' as const, intersect: false,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
          ctx.parsed.y == null ? '' : `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { ticks: { font: { size: 10 }, callback: (v: string | number) => typeof v === 'number' ? fmt(v) : v }, grid: { color: '#f0f0f0' } },
  },
})

function Legenda({ series }: { series: [string, string, 'solid' | 'dashed'][] }) {
  return (
    <div className="flex items-center gap-5 mb-3 flex-wrap">
      {series.map(([c, l, style]) => (
        <span key={l} className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-block w-5 h-0.5" style={{
            background: style === 'solid' ? c
              : `repeating-linear-gradient(90deg,${c} 0,${c} 4px,transparent 4px,transparent 8px)`,
          }} />
          {l}
        </span>
      ))}
    </div>
  )
}

// Card estilo Obras com barras de progresso
function AvancoCard({ label, value, color, bgIcon, sub, bars }: {
  label: string; value: string; color: string; bgIcon: string; sub: string
  bars?: { titulo: string; pct: number }[]
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bgIcon }}>
        <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-normal text-gray-500 mb-1">{label}</p>
        <p className="text-[30px] font-bold leading-none tracking-tight" style={{ color }}>{value}</p>
        <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>
        {bars && bars.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
            {bars.map((b) => (
              <div key={b.titulo}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{b.titulo}</span>
                  <span className="text-[11px] font-bold" style={{ color: barColors(b.pct).text }}>{b.pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, backgroundColor: barColors(b.pct).bg }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResumoFab({ contratos }: { contratos: ContratoFab[] }) {
  const [expandido, setExpandido] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setExpandido((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const itens = useMemo(
    () => contratos.flatMap((c) => c.itens.map((it) => ({ ...it, contrato: c.indice }))),
    [contratos],
  )

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

  // Série mensal agregada (ordenada por ano/mês)
  const serie = useMemo(() => {
    const map = new Map<string, { ano: number; mes: number; orc: number; prev: number; real: number; pesoPrev: number; pesoReal: number }>()
    const get = (ano: number, mes: number) => {
      const k = key(ano, mes)
      if (!map.has(k)) map.set(k, { ano, mes, orc: 0, prev: 0, real: 0, pesoPrev: 0, pesoReal: 0 })
      return map.get(k)!
    }
    for (const it of itens) {
      for (const m of it.meses) { const e = get(m.ano, m.mes); e.orc += m.hh_orcado ?? 0; e.prev += m.hh_previsto ?? 0; e.pesoPrev += m.peso_previsto ?? 0 }
      for (const r of it.realizados) { const e = get(r.ano, r.mes); e.real += r.hh_realizado ?? 0; e.pesoReal += r.peso_realizado ?? 0 }
    }
    return Array.from(map.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes)
  }, [itens])

  if (itens.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Sem itens cadastrados para resumir.</p>
  }

  const pctHhOrc = pctAvanco(totals.orc, totals.real)
  const pctHhPrev = pctAvanco(totals.prev, totals.real)
  const pctPrevOrc = pctAvanco(totals.orc, totals.prev)
  const pctPeso = pctAvanco(totals.pesoPrev, totals.pesoReal)

  const labels = serie.map((s) => `${MESES_LABELS[s.mes]}/${String(s.ano).slice(2)}`)
  const acumular = (arr: number[]) => arr.reduce<number[]>((acc, v) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + v] }, [])
  const orcArr = serie.map((s) => s.orc)
  const prevArr = serie.map((s) => s.prev)
  const realArr = serie.map((s) => s.real)
  const pesoPrevArr = serie.map((s) => s.pesoPrev)
  const pesoRealArr = serie.map((s) => s.pesoReal)

  const lineDS = (label: string, data: number[], color: string, dashed: boolean) => ({
    label, data, borderColor: color, backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: dashed ? [6, 3] : [], tension: 0.4,
    pointRadius: 2.5, pointBackgroundColor: color, spanGaps: true,
  })

  const hhMensal = { labels, datasets: [lineDS('Orçado', orcArr, COR.orcado, true), lineDS('Previsto', prevArr, COR.previsto, true), lineDS('Realizado', realArr, COR.realizado, false)] }
  const hhAcum = { labels, datasets: [lineDS('Orçado', acumular(orcArr), COR.orcado, true), lineDS('Previsto', acumular(prevArr), COR.previsto, true), lineDS('Realizado', acumular(realArr), COR.realizado, false)] }
  const pesoMensal = { labels, datasets: [lineDS('Previsto', pesoPrevArr, COR.previsto, true), lineDS('Realizado', pesoRealArr, COR.realizado, false)] }
  const pesoAcum = { labels, datasets: [lineDS('Previsto', acumular(pesoPrevArr), COR.previsto, true), lineDS('Realizado', acumular(pesoRealArr), COR.realizado, false)] }

  const optsHh = chartOptsFactory(fmtHh)
  const optsPeso = chartOptsFactory(fmtPeso)
  const legHh: [string, string, 'solid' | 'dashed'][] = [[COR.orcado, 'Orçado', 'dashed'], [COR.previsto, 'Previsto', 'dashed'], [COR.realizado, 'Realizado', 'solid']]
  const legPeso: [string, string, 'solid' | 'dashed'][] = [[COR.previsto, 'Previsto', 'dashed'], [COR.realizado, 'Realizado', 'solid']]

  return (
    <div className="space-y-4">
      {/* Cards de avanço — estilo Obras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AvancoCard label="HH Orçado" value={fmtHh(totals.orc)} color={COR.orcado} bgIcon="#FEF3C7" sub="total orçado dos itens" />
        <AvancoCard label="HH Previsto" value={fmtHh(totals.prev)} color={COR.previsto} bgIcon="#DBEAFE" sub="distribuído nos meses"
          bars={[{ titulo: '% do Orçado', pct: pctPrevOrc }]} />
        <AvancoCard label="HH Realizado" value={fmtHh(totals.real)} color={COR.realizado} bgIcon="#DCFCE7" sub="acumulado lançado"
          bars={[{ titulo: '% do Orçado', pct: pctHhOrc }, { titulo: '% do Previsto', pct: pctHhPrev }]} />
      </div>

      {/* KPIs de peso e avanço */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <KpiCard label="Peso Previsto (t)" value={fmtPeso(totals.pesoPrev)} color="text-[#185FA5]" />
        <KpiCard label="Peso Realizado (t)" value={fmtPeso(totals.pesoReal)} color="text-green-dark" />
        <KpiCard label="% Avanço (peso)" value={fmtPct(pctPeso)} color="text-[#1565C0]" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Mensal</p>
          <p className="text-[11px] text-gray-400 mb-3">Comparativo mês a mês — Orçado, Previsto e Realizado</p>
          <Legenda series={legHh} />
          <div style={{ height: 230 }}><Line data={hhMensal} options={optsHh} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Acumulado</p>
          <p className="text-[11px] text-gray-400 mb-3">Progressão acumulada dos três indicadores</p>
          <Legenda series={legHh} />
          <div style={{ height: 230 }}><Line data={hhAcum} options={optsHh} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">Peso Mensal (t)</p>
          <p className="text-[11px] text-gray-400 mb-3">Previsto x Realizado mês a mês</p>
          <Legenda series={legPeso} />
          <div style={{ height: 230 }}><Line data={pesoMensal} options={optsPeso} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">Peso Acumulado (t)</p>
          <p className="text-[11px] text-gray-400 mb-3">Progressão acumulada Previsto x Realizado</p>
          <Legenda series={legPeso} />
          <div style={{ height: 230 }}><Line data={pesoAcum} options={optsPeso} /></div>
        </div>
      </div>

      {/* Tabela por item (clique para ver mês a mês) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-green-primary text-white text-[10px] uppercase tracking-wide">
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap w-6"></th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Contrato</th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Item</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Orçado</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Previsto</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Realizado</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Prev. (t)</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Real. (t)</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">% Avanço</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => {
              const orc = it.meses.reduce((a, m) => a + (m.hh_orcado ?? 0), 0)
              const prev = it.meses.reduce((a, m) => a + (m.hh_previsto ?? 0), 0)
              const real = it.realizados.reduce((a, r) => a + (r.hh_realizado ?? 0), 0)
              const pPrev = pesoPrevItem(it)
              const pReal = pesoRealItem(it)
              const aberto = expandido.has(it.id)
              const planMap = new Map(it.meses.map((m) => [key(m.ano, m.mes), m]))
              const realMap = new Map(it.realizados.map((r) => [key(r.ano, r.mes), r]))
              const meses = mesesEntre(it.data_inicio.slice(0, 10), it.data_fim.slice(0, 10))
              return (
                <Fragment key={it.id}>
                  <tr onClick={() => toggle(it.id)}
                    className={cn('border-b border-gray-100 cursor-pointer hover:bg-green-light/40', i % 2 ? 'bg-gray-50' : 'bg-white')}>
                    <td className="px-2 py-1.5 text-center text-gray-400 select-none">{aberto ? '▾' : '▸'}</td>
                    <td className="px-2 py-1.5 font-semibold text-green-dark whitespace-nowrap">{it.contrato}</td>
                    <td className="px-2 py-1.5">{it.descricao}</td>
                    <td className="px-2 py-1.5 text-right">{fmtHh(orc)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtHh(prev)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtHh(real)}</td>
                    <td className="px-2 py-1.5 text-right text-[#185FA5]">{fmtPeso(pPrev)}</td>
                    <td className="px-2 py-1.5 text-right text-green-dark">{fmtPeso(pReal)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-[#1565C0]">{fmtPct(pctAvanco(pPrev, pReal))}</td>
                  </tr>
                  {aberto && meses.map(({ mes, ano }) => {
                    const k = key(ano, mes)
                    const mPlan = planMap.get(k)
                    const mReal = realMap.get(k)
                    const pp = mPlan?.peso_previsto ?? 0
                    const pr = mReal?.peso_realizado ?? 0
                    return (
                      <tr key={`${it.id}-${k}`} className="bg-slate-50/70 border-b border-gray-100 text-[10px] text-gray-600">
                        <td className="bg-slate-50/70"></td>
                        <td colSpan={2} className="px-2 py-1 pl-8 text-gray-500 whitespace-nowrap">{MESES_LABELS[mes]}/{String(ano).slice(2)}</td>
                        <td className="px-2 py-1 text-right">{fmtNumOrDash(mPlan?.hh_orcado)}</td>
                        <td className="px-2 py-1 text-right">{fmtNumOrDash(mPlan?.hh_previsto)}</td>
                        <td className="px-2 py-1 text-right">{fmtNumOrDash(mReal?.hh_realizado)}</td>
                        <td className="px-2 py-1 text-right text-[#185FA5]">{fmtPesoOrDash(mPlan?.peso_previsto)}</td>
                        <td className="px-2 py-1 text-right text-green-dark">{fmtPesoOrDash(mReal?.peso_realizado)}</td>
                        <td className="px-2 py-1 text-right text-[#1565C0]">{pp > 0 && pr > 0 ? fmtPct((pr / pp) * 100) : '—'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const fmtNumOrDash = (v: number | null | undefined) => (v == null ? '—' : fmtHh(v))
const fmtPesoOrDash = (v: number | null | undefined) => (v == null ? '—' : fmtPeso(v))

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-[20px] font-bold', color)}>{value}</p>
    </div>
  )
}
