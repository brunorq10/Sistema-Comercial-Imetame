'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { cn } from '@/lib/utils'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { LancamentoHhModal } from '@/components/acordos/LancamentoHhModal'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContratoHh {
  id: number; indice: string; num_os: string | null
  cidade: string | null; estado: string | null; classificacao: string | null
  cliente:       { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
  descricao: string | null
  responsavel: { id: number; nome: string } | null
  data_inicio: string | null; data_fim: string | null
  tem_lancamento: boolean
  hh_previsto: number | null; hh_planejado: number | null; hh_realizado: number | null
  lancamento_atual: {
    id: number; versao: number; data_inicio: string; data_fim: string
    motivo: string | null; created_at: string; criador: string
    meses: { mes: number; ano: number; hh_previsto: number | null; hh_planejado: number | null }[]
  } | null
  realizados: { id: number; mes: number; ano: number; hh_realizado: number; observacoes: string | null }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const nowLabel = () => { const d = new Date(); return `${MESES[d.getMonth()]} ${d.getFullYear()}` }

function gerarMeses(inicio: string, fim: string) {
  const r: { mes: number; ano: number }[] = []
  const d = new Date(inicio + 'T00:00:00')
  const f = new Date(fim    + 'T00:00:00')
  while (d <= f) { r.push({ mes: d.getMonth() + 1, ano: d.getFullYear() }); d.setMonth(d.getMonth() + 1) }
  return r
}

function MiniBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? '#3B6D11' : pct >= 80 ? '#BA7517' : '#C62828'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-9 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${Math.min((pct / 150) * 100, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

// ─── Novo Lançamento Modal ────────────────────────────────────────────────────

function NovoLancamentoModal({ onClose, onSelect }: { onClose: () => void; onSelect: (c: ContratoHh) => void }) {
  const [disponivel, setDisponivel] = useState<ContratoHh[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/acordos/hh?disponivel=1')
      .then(r => r.json())
      .then(j => setDisponivel(j.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? disponivel.filter(c =>
        c.indice.toLowerCase().includes(query.toLowerCase()) ||
        c.cliente.nome.toLowerCase().includes(query.toLowerCase()) ||
        (c.descricao ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.num_os ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : disponivel

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-[#1B5E20] text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-[14px] font-bold">Novo Lançamento — Controle de HH</h2>
            <p className="text-white/70 text-[11px] mt-0.5">Selecione o contrato a ser acompanhado</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-[20px]">×</button>
        </div>
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar por CT, cliente, OS ou escopo..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              {disponivel.length === 0 ? 'Todos os contratos já possuem lançamento de HH.' : 'Nenhum resultado encontrado.'}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  {['CT','Cliente','Cliente Final','Escopo'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={cn('border-b border-gray-50 hover:bg-green-50 cursor-pointer transition-colors', i % 2 === 0 ? '' : 'bg-gray-50/50')}
                    onClick={() => onSelect(c)}>
                    <td className="px-4 py-2.5 font-bold text-green-dark whitespace-nowrap">{c.indice}{c.num_os ? ` / ${c.num_os}` : ''}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.cliente.nome}</td>
                    <td className="px-4 py-2.5 text-gray-500">{c.cliente_final?.nome ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate" title={c.descricao ?? ''}>{c.descricao ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-green-primary text-[10px] font-semibold">Selecionar →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-gray-100 px-4 py-3 flex justify-end flex-shrink-0 bg-gray-50">
          <button onClick={onClose} className="border border-gray-300 text-gray-600 rounded-md px-4 py-1.5 text-[11px] font-medium hover:bg-gray-100">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Visão Contratos ──────────────────────────────────────────────────────────

function useFilterOptions(contratos: ContratoHh[]) {
  return useMemo(() => ({
    clientes:      Array.from(new Map(contratos.map(c => [c.cliente.id,       c.cliente.nome      ])).entries()).map(([v,l]) => ({ value: String(v), label: l })),
    clientesFinais:Array.from(new Map(contratos.filter(c=>c.cliente_final).map(c => [c.cliente_final!.id, c.cliente_final!.nome])).entries()).map(([v,l]) => ({ value: String(v), label: l })),
    oss:            Array.from(new Set(contratos.map(c => c.num_os).filter((v): v is string => v != null))).map(v => ({ value: v, label: v })),
    mercados:       Array.from(new Set(contratos.map(c => c.cliente.ramo_atuacao).filter((v): v is string => v != null && v !== ''))).map(v => ({ value: v, label: v })),
    escopos:        contratos.filter(c=>c.descricao).map(c => ({ value: c.descricao!, label: c.descricao! })),
  }), [contratos])
}

function Filters({ opts, filters, onChange }: {
  opts: ReturnType<typeof useFilterOptions>
  filters: Record<string, string[]>
  onChange: (k: string, v: string[]) => void
}) {
  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'
  return (
    <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 flex gap-1.5 items-end mb-3 flex-wrap">
      {[
        { key: 'clientes',       label: 'Cliente',       opts: opts.clientes },
        { key: 'clientesFinais', label: 'Cliente Final', opts: opts.clientesFinais },
        { key: 'oss',            label: 'OS',            opts: opts.oss },
        { key: 'mercados',       label: 'Mercado',       opts: opts.mercados },
        { key: 'escopos',        label: 'Escopo',        opts: opts.escopos },
      ].map(({ key, label, opts: o }) => (
        <div key={key} className="flex-1 min-w-[120px]">
          <label className={fLbl}>{label}</label>
          <SearchableMultiSelect values={filters[key] ?? []} onChange={v => onChange(key, v)} options={o} />
        </div>
      ))}
      <button onClick={() => ['clientes','clientesFinais','oss','mercados','escopos'].forEach(k => onChange(k,[]))}
        className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] hover:bg-gray-100 flex-shrink-0">✕</button>
    </div>
  )
}

function applyFilters(contratos: ContratoHh[], filters: Record<string, string[]>) {
  return contratos.filter(c => {
    if (filters.clientes?.length       && !filters.clientes.includes(String(c.cliente.id)))           return false
    if (filters.clientesFinais?.length && !filters.clientesFinais.includes(String(c.cliente_final?.id))) return false
    if (filters.oss?.length            && !filters.oss.includes(c.num_os ?? ''))                       return false
    if (filters.mercados?.length       && !filters.mercados.includes(c.cliente.ramo_atuacao ?? ''))    return false
    if (filters.escopos?.length        && !filters.escopos.includes(c.descricao ?? ''))                return false
    return true
  })
}

function VisaoContratos({ contratos, opts, onRefresh }: { contratos: ContratoHh[]; opts: ReturnType<typeof useFilterOptions>; onRefresh: () => void }) {
  const [modalItem,   setModalItem]   = useState<ContratoHh | null>(null)
  const [novoModal,   setNovoModal]   = useState(false)
  const [deleteId,    setDeleteId]    = useState<number | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [filters,     setFilters]     = useState<Record<string, string[]>>({})

  const filtered = applyFilters(contratos, filters)
  const setFilter = (k: string, v: string[]) => setFilters(p => ({ ...p, [k]: v }))

  const handleDelete = async (id: number) => {
    setDeleting(true)
    try {
      await fetch(`/api/acordos/hh/${id}`, { method: 'DELETE' })
      setDeleteId(null)
      onRefresh()
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-400">{filtered.length} contrato{filtered.length !== 1 ? 's' : ''}</span>
        <button onClick={() => setNovoModal(true)}
          className="bg-green-primary text-white text-[11px] font-semibold px-3 py-1.5 rounded-md hover:bg-green-dark transition-colors flex items-center gap-1.5">
          + Novo Lançamento
        </button>
      </div>

      <Filters opts={opts} filters={filters} onChange={setFilter} />

      <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-md bg-white">
        <table className="text-[11px] border-collapse min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-green-primary text-white">
              <th colSpan={5} className="px-3 py-1.5 text-left text-[10px] font-semibold border-r border-green-700">Cadastro</th>
              <th colSpan={5} className="px-3 py-1.5 text-center text-[10px] font-semibold bg-[#1B5E20] border-r border-green-700">Indicadores de HH</th>
              <th className="px-2 py-1.5 text-center text-[10px] font-semibold w-[60px]">Ações</th>
            </tr>
            <tr className="bg-green-primary text-white text-[9px] uppercase tracking-wide">
              {['Índice','OS','Cliente','Cliente Final','Escopo'].map(h => (
                <th key={h} className={cn('px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap',
                  h === 'Escopo' ? 'min-w-[180px]' : h.includes('Cliente') ? 'min-w-[120px]' : 'whitespace-nowrap')}>
                  {h}
                </th>
              ))}
              {['HH Prev.','HH Plan.','HH Real.','% R/P','% R/Pl'].map(h => (
                <th key={h} className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[80px]">{h}</th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold w-[60px]" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="text-center text-gray-400 py-10 text-sm">Nenhum contrato encontrado.</td></tr>
            )}
            {filtered.map((c, idx) => {
              const bg = idx % 2 === 0 ? '#fff' : '#f9fafb'
              const { hh_previsto: prev, hh_planejado: plan, hh_realizado: real } = c
              const pctPrev = prev && prev > 0 && real != null ? (real / prev) * 100 : null
              const pctPlan = plan && plan > 0 && real != null ? (real / plan) * 100 : null
              return (
                <tr key={c.id} style={{ background: bg }} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                  <td className="px-3 py-2 font-bold text-green-dark whitespace-nowrap">{c.indice}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{c.num_os ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate" title={c.cliente.nome}>{c.cliente.nome}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap max-w-[130px] truncate" title={c.cliente_final?.nome}>{c.cliente_final?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={c.descricao ?? ''}>{c.descricao ?? '—'}</td>
                  {[
                    { v: prev, color: '#185FA5' },
                    { v: plan, color: '#BA7517' },
                    { v: real, color: '#3B6D11' },
                  ].map(({ v, color }, i) => (
                    <td key={i} className="px-2 py-2 text-right font-medium w-[80px]" style={{ color }}>
                      {v != null ? v.toLocaleString('pt-BR') : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right w-[80px]">{pctPrev != null ? <MiniBar pct={pctPrev} /> : <span className="text-gray-300 text-[10px]">—</span>}</td>
                  <td className="px-2 py-2 text-right w-[80px]">{pctPlan != null ? <MiniBar pct={pctPlan} /> : <span className="text-gray-300 text-[10px]">—</span>}</td>
                  <td className="px-2 py-2 text-center w-[60px]">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModalItem(c)} title="Lançamentos"
                        className="text-gray-400 hover:text-green-primary transition-colors text-[13px]">⊕</button>
                      {deleteId === c.id ? (
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => handleDelete(c.id)} disabled={deleting}
                            className="text-red-600 hover:text-red-700 text-[10px] font-bold px-1 border border-red-300 rounded">
                            {deleting ? '...' : 'OK'}
                          </button>
                          <button onClick={() => setDeleteId(null)} className="text-gray-400 hover:text-gray-600 text-[10px]">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteId(c.id)} title="Remover do acompanhamento"
                          className="text-gray-400 hover:text-red-500 transition-colors text-[13px]">⊖</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[9px] text-gray-400">ⓘ % acima de 100% indica consumo acima do previsto ou planejado. Verde ≥ 100%, âmbar &lt; 100%, vermelho &gt; 100%.</p>
        </div>
      </div>

      {novoModal && (
        <NovoLancamentoModal
          onClose={() => setNovoModal(false)}
          onSelect={c => { setNovoModal(false); setModalItem(c) }}
        />
      )}
      {modalItem && (
        <LancamentoHhModal
          contrato={modalItem}
          onClose={() => setModalItem(null)}
          onSuccess={() => { onRefresh() }}
        />
      )}
    </>
  )
}

// ─── Visão Resumo ─────────────────────────────────────────────────────────────

function VisaoResumo({ contratos, opts }: { contratos: ContratoHh[]; opts: ReturnType<typeof useFilterOptions> }) {
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const setFilter = (k: string, v: string[]) => setFilters(p => ({ ...p, [k]: v }))

  const selecionados = applyFilters(contratos, filters)

  const mesData = useMemo(() => {
    const map = new Map<string, { previsto: number; planejado: number; realizado: number | null; label: string }>()
    for (const c of selecionados) {
      if (!c.lancamento_atual) continue
      for (const { mes, ano } of gerarMeses(c.lancamento_atual.data_inicio.split('T')[0], c.lancamento_atual.data_fim.split('T')[0])) {
        const k = `${ano}-${String(mes).padStart(2,'0')}`
        const ex = map.get(k) ?? { previsto: 0, planejado: 0, realizado: null, label: `${MESES[mes-1]}/${String(ano).slice(2)}` }
        const mesL = c.lancamento_atual.meses.find(m => m.mes === mes && m.ano === ano)
        ex.previsto  += mesL?.hh_previsto  ?? 0
        ex.planejado += mesL?.hh_planejado ?? 0
        const r = c.realizados.find(r => r.mes === mes && r.ano === ano)
        if (r) ex.realizado = (ex.realizado ?? 0) + r.hh_realizado
        map.set(k, ex)
      }
    }
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v)
  }, [selecionados])

  const totPrev = selecionados.reduce((s, c) => s + (c.hh_previsto ?? 0), 0)
  const totPlan = selecionados.reduce((s, c) => s + (c.hh_planejado ?? 0), 0)
  const totReal = selecionados.some(c => c.hh_realizado != null)
    ? selecionados.reduce((s, c) => s + (c.hh_realizado ?? 0), 0) : null

  const pctPlanPrev = totPrev > 0 ? (totPlan / totPrev) * 100 : null
  const pctRealPrev = totPrev > 0 && totReal != null ? (totReal / totPrev) * 100 : null
  const pctRealPlan = totPlan > 0 && totReal != null ? (totReal / totPlan) * 100 : null

  const labels = mesData.map(m => m.label)
  const cumPrev = mesData.reduce<(number|null)[]>((acc, m) => { const l = acc.length ? acc[acc.length-1] ?? 0 : 0; return [...acc, l + m.previsto] }, [])
  const cumPlan = mesData.reduce<(number|null)[]>((acc, m) => { const l = acc.length ? acc[acc.length-1] ?? 0 : 0; return [...acc, l + m.planejado] }, [])
  const cumReal = mesData.reduce<(number|null)[]>((acc, m) => { const l = acc.length ? acc[acc.length-1] ?? 0 : 0; return [...acc, m.realizado != null ? l + m.realizado : null] }, [])

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' as const } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } }, grid: { color: '#f0f0f0' } } },
  }

  const makeSeries = (monthly: boolean) => ({
    labels,
    datasets: [
      { label: 'Previsto',  data: monthly ? mesData.map(m => m.previsto)  : cumPrev,  borderColor: '#185FA5', backgroundColor: '#185FA515', borderDash: [5,3], tension: 0.3, pointRadius: 4, spanGaps: true  },
      { label: 'Planejado', data: monthly ? mesData.map(m => m.planejado) : cumPlan,  borderColor: '#BA7517', backgroundColor: '#BA751715', tension: 0.3, pointRadius: 4, spanGaps: true  },
      { label: 'Realizado', data: monthly ? mesData.map(m => m.realizado) : cumReal,  borderColor: '#3B6D11', backgroundColor: '#3B6D1115', tension: 0.3, pointRadius: 4, spanGaps: false },
    ],
  })

  function PctBar({ pct, label }: { pct: number; label: string }) {
    const color = pct >= 100 ? '#3B6D11' : pct >= 80 ? '#BA7517' : '#C62828'
    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-gray-500 uppercase font-semibold">{label}</span>
          <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        </div>
      </div>
    )
  }

  const chartLegend = (
    <div className="flex items-center gap-4 mb-2">
      {([['#185FA5','Previsto'],['#BA7517','Planejado'],['#3B6D11','Realizado']] as [string,string][]).map(([c,l]) => (
        <span key={l} className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="inline-block w-4 h-[2px] rounded" style={{ background: c }} />{l}
        </span>
      ))}
    </div>
  )

  return (
    <div>
      <Filters opts={opts} filters={filters} onChange={setFilter} />
      {selecionados.length === 0 || !selecionados.some(c => c.tem_lancamento) ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-4 py-3 rounded-md">
          Nenhum contrato com lançamento de HH corresponde aos filtros selecionados.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">HH Previsto</p>
              <p className="text-[28px] font-bold text-[#185FA5] leading-tight">{totPrev > 0 ? totPrev.toLocaleString('pt-BR') : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1">contrato completo</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">HH Planejado Acumulado</p>
              <p className="text-[28px] font-bold text-[#BA7517] leading-tight">{totPlan > 0 ? totPlan.toLocaleString('pt-BR') : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1">distribuído nos meses</p>
              {pctPlanPrev != null && (
                <div className="border-t border-gray-100 mt-3 pt-3"><PctBar pct={pctPlanPrev} label="% do Previsto" /></div>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">HH Realizado Acumulado</p>
              <p className="text-[28px] font-bold text-[#3B6D11] leading-tight">{totReal != null ? totReal.toLocaleString('pt-BR') : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1">{totReal != null ? 'acumulado até o último lançamento' : 'sem lançamento'}</p>
              {(pctRealPrev != null || pctRealPlan != null) && (
                <div className="border-t border-gray-100 mt-3 pt-3 flex flex-col gap-2">
                  {pctRealPrev != null && <PctBar pct={pctRealPrev} label="% do Previsto" />}
                  {pctRealPlan != null && <PctBar pct={pctRealPlan} label="% do Planejado" />}
                </div>
              )}
            </div>
          </div>
          {mesData.length > 0 && (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                <p className="text-[12px] font-semibold text-gray-700 mb-1">HH Mensal</p>
                {chartLegend}
                <div style={{ height: 220 }}><Line data={makeSeries(true)} options={chartOpts} /></div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-[12px] font-semibold text-gray-700 mb-1">HH Acumulado</p>
                {chartLegend}
                <div style={{ height: 220 }}><Line data={makeSeries(false)} options={chartOpts} /></div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Categoria = 'obras' | 'paradas'
type Visao    = 'contratos' | 'resumo'

export default function ControleHhPage() {
  const [categoria, setCategoria] = useState<Categoria>('obras')
  const [visao,     setVisao]     = useState<Visao>('contratos')
  const [contratos, setContratos] = useState<ContratoHh[]>([])
  const [loading,   setLoading]   = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acordos/hh?classificacao=OBRAS')
      const json = await res.json()
      setContratos(json.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const opts = useFilterOptions(contratos)

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50 flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-bold">Controle de HH</h2>
          <p className="text-[11px] text-gray-400">Módulo Acordos · {nowLabel()}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-shrink-0">
        {([['obras','Obras'],['paradas','Paradas']] as [Categoria,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setCategoria(k)}
            className={cn('px-5 py-2 text-[12px] font-semibold rounded-full border transition-colors',
              categoria === k ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-green-primary')}>
            {l}
          </button>
        ))}
      </div>

      {categoria === 'paradas' ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          <p className="text-[13px] font-semibold mb-1">Em desenvolvimento</p>
          <p className="text-[11px]">O controle de HH para Paradas estará disponível em breve.</p>
        </div>
      ) : (
        <>
          <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 mb-3 self-start flex-shrink-0">
            {([['contratos','Contratos'],['resumo','Resumo']] as [Visao,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setVisao(k)}
                className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-full transition-colors',
                  visao === k ? 'bg-green-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {l}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : visao === 'contratos' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <VisaoContratos contratos={contratos} opts={opts} onRefresh={fetchData} />
            </div>
          ) : (
            <VisaoResumo contratos={contratos} opts={opts} />
          )}
        </>
      )}
    </div>
  )
}
