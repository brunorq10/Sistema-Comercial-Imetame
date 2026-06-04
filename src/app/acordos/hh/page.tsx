'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { cn } from '@/lib/utils'
import { LancamentoHhModal } from '@/components/acordos/LancamentoHhModal'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContratoHh {
  id: number; indice: string; num_os: string | null
  classificacao: string | null
  cliente: { id: number; nome: string }; descricao: string | null
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
const nowLabel = () => {
  const d = new Date()
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  const capped = Math.min(pct, 150)
  const bg = pct >= 100 ? '#3B6D11' : pct >= 80 ? '#BA7517' : '#C62828'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full transition-all" style={{ width: `${(capped / 150) * 100}%`, background: bg }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color: bg }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function gerarMeses(inicio: string, fim: string) {
  const result: { mes: number; ano: number }[] = []
  const d = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T00:00:00')
  while (d <= f) { result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() }); d.setMonth(d.getMonth() + 1) }
  return result
}

// ─── Visão Contratos ──────────────────────────────────────────────────────────

function VisaoContratos({ contratos, onRefresh }: { contratos: ContratoHh[]; onRefresh: () => void }) {
  const [modalItem, setModalItem] = useState<ContratoHh | null>(null)
  const [filterOs,    setFilterOs]    = useState('')
  const [filterCli,   setFilterCli]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = contratos.filter(c => {
    if (filterOs && !c.num_os?.toLowerCase().includes(filterOs.toLowerCase())) return false
    if (filterCli && !c.cliente.nome.toLowerCase().includes(filterCli.toLowerCase())) return false
    if (filterStatus === 'com' && !c.tem_lancamento) return false
    if (filterStatus === 'sem' &&  c.tem_lancamento) return false
    return true
  })

  return (
    <>
      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-md px-3 py-2 flex gap-2 items-end mb-3">
        {[
          { label: 'OS', val: filterOs, set: setFilterOs, placeholder: 'Filtrar por OS...' },
          { label: 'Cliente', val: filterCli, set: setFilterCli, placeholder: 'Filtrar por cliente...' },
        ].map(({ label, val, set, placeholder }) => (
          <div key={label} className="flex-1">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
            <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
              className="w-full border border-gray-300 rounded px-2 py-[5px] text-[11px] focus:outline-none focus:border-green-primary" />
          </div>
        ))}
        <div>
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Status HH</p>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded px-2 py-[5px] text-[11px] focus:outline-none focus:border-green-primary">
            <option value="">Todos</option>
            <option value="com">Com lançamento</option>
            <option value="sem">Sem lançamento</option>
          </select>
        </div>
        <button onClick={() => { setFilterOs(''); setFilterCli(''); setFilterStatus('') }}
          className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] hover:bg-gray-100">✕</button>
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-md bg-white">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-green-primary text-white">
              <th colSpan={6} className="px-3 py-1.5 text-left text-[10px] font-semibold border-r border-green-700">Cadastro</th>
              <th colSpan={5} className="px-3 py-1.5 text-center text-[10px] font-semibold bg-[#1B5E20] border-r border-green-700">Indicadores de HH</th>
              <th className="px-3 py-1.5 text-center text-[10px] font-semibold">Ações</th>
            </tr>
            <tr className="bg-green-primary text-white text-[9px] uppercase tracking-wide">
              {['Índice','OS','Classif.','Cliente','Cidade','Escopo'].map(h => (
                <th key={h} className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap">{h}</th>
              ))}
              {['HH Previsto','HH Planejado','HH Realizado','% Real/Prev','% Real/Plan'].map(h => (
                <th key={h} className="px-3 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap">{h}</th>
              ))}
              <th className="px-3 py-1.5 text-center font-semibold" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="text-center text-gray-400 py-10 text-sm">Nenhum contrato encontrado.</td></tr>
            )}
            {filtered.map((c, idx) => {
              const bg = idx % 2 === 0 ? '#fff' : '#f9fafb'
              const prev = c.hh_previsto; const plan = c.hh_planejado; const real = c.hh_realizado
              const pctPrev = prev && prev > 0 && real != null ? (real / prev) * 100 : null
              const pctPlan = plan && plan > 0 && real != null ? (real / plan) * 100 : null
              return (
                <tr key={c.id} style={{ background: bg }} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 font-bold text-green-dark whitespace-nowrap">{c.indice}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.num_os ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{c.classificacao ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate" title={c.cliente.nome}>{c.cliente.nome}</td>
                  <td className="px-3 py-2 text-gray-500">—</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate" title={c.descricao ?? ''}>{c.descricao ?? '—'}</td>
                  {/* HH Cols */}
                  {[prev, plan, real].map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right font-medium"
                      style={{ color: i === 0 ? '#185FA5' : i === 1 ? '#BA7517' : '#3B6D11' }}>
                      {v != null ? v.toLocaleString('pt-BR') : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    {pctPrev != null ? <MiniBar pct={pctPrev} color="#185FA5" /> : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pctPlan != null ? <MiniBar pct={pctPlan} color="#BA7517" /> : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setModalItem(c)}
                      className="border border-gray-300 text-gray-600 text-[10px] font-semibold px-2.5 py-1 rounded hover:bg-gray-50 hover:border-green-primary hover:text-green-primary transition-colors whitespace-nowrap">
                      Lançamentos
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Rodapé */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[9px] text-gray-400">ⓘ % acima de 100% indica consumo acima do previsto ou planejado. Barra: verde ≥ 100%, âmbar &lt; 100%, vermelho &gt; 100%.</p>
        </div>
      </div>

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

function VisaoResumo({ contratos }: { contratos: ContratoHh[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const selecionados = selectedIds.length > 0 ? contratos.filter(c => selectedIds.includes(c.id)) : contratos

  // Agregar dados mensais
  const mesData = useMemo(() => {
    const map = new Map<string, { previsto: number; planejado: number; realizado: number | null; label: string }>()
    for (const c of selecionados) {
      if (!c.lancamento_atual) continue
      const meses = gerarMeses(c.lancamento_atual.data_inicio.split('T')[0], c.lancamento_atual.data_fim.split('T')[0])
      for (const { mes, ano } of meses) {
        const k = `${ano}-${String(mes).padStart(2,'0')}`
        const existing = map.get(k) ?? { previsto: 0, planejado: 0, realizado: null, label: `${MESES[mes-1]}/${String(ano).slice(2)}` }
        const mesL = c.lancamento_atual.meses.find(m => m.mes === mes && m.ano === ano)
        existing.previsto  += mesL?.hh_previsto  ?? 0
        existing.planejado += mesL?.hh_planejado ?? 0
        const realizado = c.realizados.find(r => r.mes === mes && r.ano === ano)
        if (realizado) existing.realizado = (existing.realizado ?? 0) + realizado.hh_realizado
        map.set(k, existing)
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

  const temLancamento = selecionados.some(c => c.tem_lancamento)
  const labels = mesData.map(m => m.label)

  // Cumulative
  const cumPrev = mesData.reduce<(number|null)[]>((acc, m) => { const last = acc.length ? (acc[acc.length-1] ?? 0) : 0; return [...acc, last + m.previsto] }, [])
  const cumPlan = mesData.reduce<(number|null)[]>((acc, m) => { const last = acc.length ? (acc[acc.length-1] ?? 0) : 0; return [...acc, last + m.planejado] }, [])
  const cumReal = mesData.reduce<(number|null)[]>((acc, m) => {
    const prev = acc.length ? (acc[acc.length-1] ?? 0) : 0
    return [...acc, m.realizado != null ? prev + m.realizado : null]
  }, [])

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' as const } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { ticks: { font: { size: 10 } }, grid: { color: '#f0f0f0' } },
    },
  }

  const makeDatasets = (monthly: boolean) => ({
    labels,
    datasets: [
      { label: 'Previsto',  data: monthly ? mesData.map(m => m.previsto)  : cumPrev,  borderColor: '#185FA5', backgroundColor: '#185FA520', borderDash: [5,3], tension: 0.3, pointRadius: 4, spanGaps: true  },
      { label: 'Planejado', data: monthly ? mesData.map(m => m.planejado) : cumPlan,  borderColor: '#BA7517', backgroundColor: '#BA751720', tension: 0.3, pointRadius: 4, spanGaps: true  },
      { label: 'Realizado', data: monthly ? mesData.map(m => m.realizado) : cumReal,  borderColor: '#3B6D11', backgroundColor: '#3B6D1120', tension: 0.3, pointRadius: 4, spanGaps: false },
    ],
  })

  function PctBar({ pct, label }: { pct: number | null; label: string }) {
    if (pct == null) return null
    const color = pct >= 100 ? '#3B6D11' : pct >= 80 ? '#BA7517' : '#C62828'
    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-gray-500 uppercase font-semibold">{label}</span>
          <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        </div>
      </div>
    )
  }

  const chartLegend = (
    <div className="flex items-center gap-4 mb-2">
      {[['#185FA5','Previsto'],['#BA7517','Planejado'],['#3B6D11','Realizado']].map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="inline-block w-4 h-[2px] rounded" style={{ background: color }} />{label}
        </span>
      ))}
    </div>
  )

  return (
    <div>
      {/* Seletor de OS */}
      <div className="bg-white border border-gray-200 rounded-md px-3 py-2 flex gap-2 items-center mb-4 flex-wrap">
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Filtrar OS:</span>
        {contratos.map(c => (
          <button key={c.id} onClick={() => setSelectedIds(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}
            className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors',
              selectedIds.includes(c.id) ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-300 hover:border-green-primary')}>
            {c.indice}{c.num_os ? ` / ${c.num_os}` : ''}
          </button>
        ))}
        {selectedIds.length > 0 && (
          <button onClick={() => setSelectedIds([])} className="text-[10px] text-gray-400 hover:text-gray-600 ml-2">✕ Limpar</button>
        )}
      </div>

      {!temLancamento ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-4 py-3 rounded-md">
          Nenhum contrato selecionado possui lançamento de HH. Registre o HH Previsto e Planejado na Visão Contratos.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Previsto */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">HH Previsto</p>
              <p className="text-[28px] font-bold text-[#185FA5] leading-tight">{totPrev > 0 ? totPrev.toLocaleString('pt-BR') : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1">contrato completo</p>
            </div>
            {/* Planejado */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">HH Planejado Acumulado</p>
              <p className="text-[28px] font-bold text-[#BA7517] leading-tight">{totPlan > 0 ? totPlan.toLocaleString('pt-BR') : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1">distribuído nos meses</p>
              {pctPlanPrev != null && (
                <>
                  <div className="border-t border-gray-100 mt-3 pt-3 flex flex-col gap-2">
                    <PctBar pct={pctPlanPrev} label="% do Previsto" />
                  </div>
                  <div className="flex-1" />
                </>
              )}
            </div>
            {/* Realizado */}
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

          {/* Gráfico Mensal */}
          {mesData.length > 0 && (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                <p className="text-[12px] font-semibold text-gray-700 mb-1">HH Mensal</p>
                {chartLegend}
                <div style={{ height: 220 }}>
                  <Line data={makeDatasets(true)} options={chartOptions} />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-[12px] font-semibold text-gray-700 mb-1">HH Acumulado</p>
                {chartLegend}
                <div style={{ height: 220 }}>
                  <Line data={makeDatasets(false)} options={chartOptions} />
                </div>
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

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-bold">Controle de HH</h2>
          <p className="text-[11px] text-gray-400">Módulo Acordos · {nowLabel()}</p>
        </div>
      </div>

      {/* Category tabs */}
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
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 flex-shrink-0">
          <p className="text-[13px] font-semibold mb-1">Em desenvolvimento</p>
          <p className="text-[11px]">O controle de HH para Paradas estará disponível em breve.</p>
        </div>
      ) : (
        <>
          {/* View selector */}
          <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 mb-3 self-start flex-shrink-0">
            {([['contratos','Contratos'],['resumo','Resumo']] as [Visao,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setVisao(k)}
                className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-full transition-colors',
                  visao === k ? 'bg-green-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {l}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : visao === 'contratos' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <VisaoContratos contratos={contratos} onRefresh={fetchData} />
            </div>
          ) : (
            <VisaoResumo contratos={contratos} />
          )}
        </>
      )}
    </div>
  )
}
