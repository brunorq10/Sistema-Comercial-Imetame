'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { barColors } from '@/lib/hh'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

// ─── Types ───────────────────────────────────────────────────────────────────

interface MesLancamento { mes: number; ano: number; hh_previsto: number | null; hh_planejado: number | null }
interface Lancamento {
  id: number; versao: number; data_inicio: string; data_fim: string
  motivo: string | null; created_at: string; criador: string; meses: MesLancamento[]
}
interface Realizado { id: number; mes: number; ano: number; hh_realizado: number }
interface ContratoInfo {
  id: number; indice: string; num_os: string | null; classificacao: string | null
  cliente: { id: number; nome: string }; cliente_final: { id: number; nome: string } | null
  descricao: string | null; responsavel: { id: number; nome: string } | null
  cidade: string | null; estado: string | null
  data_inicio: string | null; data_fim: string | null
  realizados: Realizado[]
}

type Modo = 'leitura' | 'previsto_planejado' | 'realizado'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMes(mes: number, ano: number) { return `${MESES_LABELS[mes - 1]}/${String(ano).slice(2)}` }
function formatRev(versao: number) { return `Rev${String(versao - 1).padStart(2, '0')}` }
function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

function gerarMeses(inicio: string, fim: string): { mes: number; ano: number }[] {
  if (!inicio || !fim) return []
  const result: { mes: number; ano: number }[] = []
  const d = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T00:00:00')
  if (isNaN(d.getTime()) || isNaN(f.getTime()) || d > f) return []
  while (d <= f) {
    result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
    d.setMonth(d.getMonth() + 1)
  }
  return result
}

/** Parser pt-BR ("150.456,99" / "150.456" / "1234") → string numérica plana. */
function parsePtBrHh(input: string): string {
  const s = input.trim().replace(/\s/g, '')
  if (!s) return ''
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? '' : String(n)
  }
  const parts = s.split('.')
  if (parts.length > 2 || (parts.length === 2 && /^\d+$/.test(parts[0]) && parts[1].length === 3 && /^\d+$/.test(parts[1]))) {
    const n = parseFloat(s.replace(/\./g, ''))
    return isNaN(n) ? '' : String(n)
  }
  const n = parseFloat(s)
  return isNaN(n) ? '' : String(n)
}

const loc = (n: number) => n.toLocaleString('pt-BR')

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ContratoObrasHhPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { pode, ehDono } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [contrato, setContrato] = useState<ContratoInfo | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [revisaoId, setRevisaoId] = useState<number | null>(null)
  const [aba, setAba] = useState<'grade' | 'historico'>('grade')
  const [expandedRev, setExpandedRev] = useState<number | null>(null)
  const [modo, setModo] = useState<Modo>('leitura')

  // ── Edição: Previsto/Planejado ──
  const [editInicio, setEditInicio] = useState('')
  const [editFim, setEditFim] = useState('')
  const [editMotivo, setEditMotivo] = useState('')
  const [editPrevisto, setEditPrevisto] = useState<Record<string, string>>({})
  const [editPlanejado, setEditPlanejado] = useState<Record<string, string>>({})
  const [savingPP, setSavingPP] = useState(false)
  const [erroPP, setErroPP] = useState<string | null>(null)

  // ── Edição: Realizado ──
  const [editRealizado, setEditRealizado] = useState<Record<string, string>>({})
  const [savingReal, setSavingReal] = useState(false)
  const [erroReal, setErroReal] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rContrato, rLanc] = await Promise.all([
        fetch(`/api/acordos/hh/${id}`),
        fetch(`/api/acordos/hh/${id}/lancamento`),
      ])
      const jContrato = await rContrato.json()
      const jLanc = await rLanc.json()
      setContrato(jContrato.data ?? null)
      const lancs: Lancamento[] = jLanc.data ?? []
      setLancamentos(lancs)
      setRevisaoId(lancs[0]?.id ?? null)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const lancAtual = lancamentos[0] ?? null
  const lancSelecionado = lancamentos.find(l => l.id === revisaoId) ?? lancAtual
  const isRevisaoAtual = lancamentos.length === 0 || revisaoId === lancAtual?.id

  const podeEditar = pode('acordos.obras.hh.lancar', {
    ehDono: ehDono(contrato ? { responsavel_id: contrato.responsavel?.id ?? null } : null, 'contrato'),
  })

  const realizadosMap = useMemo(
    () => new Map((contrato?.realizados ?? []).map(r => [`${r.ano}-${r.mes}`, r.hh_realizado])),
    [contrato],
  )

  // ── Meses ativos na visão atual (persistidos ou em edição de Previsto/Planejado) ──
  const mesesAtivos = modo === 'previsto_planejado'
    ? gerarMeses(editInicio, editFim)
    : (lancSelecionado ? gerarMeses(lancSelecionado.data_inicio.split('T')[0], lancSelecionado.data_fim.split('T')[0]) : [])

  const mesData = useMemo(() => mesesAtivos.map(({ mes, ano }) => {
    const key = `${ano}-${mes}`
    const persistido = lancSelecionado?.meses.find(m => m.mes === mes && m.ano === ano) ?? null
    const previsto = modo === 'previsto_planejado' ? (Number(editPrevisto[key]) || 0) : (persistido?.hh_previsto ?? 0)
    const planejado = modo === 'previsto_planejado' ? (Number(editPlanejado[key]) || 0) : (persistido?.hh_planejado ?? 0)
    let realizado: number | null
    if (modo === 'realizado' && key in editRealizado) {
      realizado = editRealizado[key] === '' ? null : (Number(editRealizado[key]) || 0)
    } else {
      realizado = realizadosMap.get(key) ?? null
    }
    return { mes, ano, label: fmtMes(mes, ano), previsto, planejado, realizado }
  }), [mesesAtivos, lancSelecionado, modo, editPrevisto, editPlanejado, editRealizado, realizadosMap])

  const totPrev = mesData.reduce((s, m) => s + m.previsto, 0)
  const totPlan = mesData.reduce((s, m) => s + m.planejado, 0)
  const totReal = mesData.some(m => m.realizado != null) ? mesData.reduce((s, m) => s + (m.realizado ?? 0), 0) : null

  const pctPlanPrev = totPrev > 0 ? (totPlan / totPrev) * 100 : null
  const pctRealPrev = totPrev > 0 && totReal != null ? (totReal / totPrev) * 100 : null
  const pctRealPlan = totPlan > 0 && totReal != null ? (totReal / totPlan) * 100 : null

  const labels  = mesData.map(m => m.label)
  const cumPrev = mesData.reduce<number[]>((acc, m) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + m.previsto] }, [])
  const cumPlan = mesData.reduce<number[]>((acc, m) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + m.planejado] }, [])
  const cumReal = mesData.reduce<(number | null)[]>((acc, m) => { const l = acc.length ? (acc[acc.length - 1] ?? 0) : 0; return [...acc, m.realizado != null ? l + m.realizado : null] }, [])

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
            if (v == null) return ''
            return `${ctx.dataset.label}: ${v.toLocaleString('pt-BR')}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        ticks: {
          font: { size: 10 },
          callback: (value: string | number) => typeof value === 'number' ? value.toLocaleString('pt-BR') : value,
        },
        grid: { color: '#f0f0f0' },
      },
    },
  }

  const chartData = {
    labels,
    datasets: [
      { label: 'Previsto',  data: cumPrev, borderColor: '#185FA5', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6,3], tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#185FA5', spanGaps: true  },
      { label: 'Planejado', data: cumPlan, borderColor: '#BA7517', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4,2], tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#BA7517', spanGaps: true  },
      { label: 'Realizado', data: cumReal, borderColor: '#16A34A', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#16A34A', spanGaps: false },
    ],
  }

  const chartLegend = (
    <div className="flex items-center gap-5 mb-3">
      {([
        ['#185FA5', 'Previsto',  'dashed'],
        ['#BA7517', 'Planejado', 'dashed'],
        ['#16A34A', 'Realizado', 'solid'],
      ] as [string, string, string][]).map(([c, l, style]) => (
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

  const tabelaRows = mesData.map((m, i) => {
    const prevAcum = cumPrev[i] ?? 0
    const planAcum = cumPlan[i] ?? 0
    const realAcum = cumReal[i] ?? null
    const pctRealMes  = m.previsto > 0 && m.realizado != null ? (m.realizado / m.previsto) * 100 : null
    const pctRealAcum = prevAcum > 0 && realAcum != null ? (realAcum / prevAcum) * 100 : null
    const desvPrev = m.previsto > 0 && m.realizado != null ? ((m.realizado - m.previsto)  / m.previsto)  * 100 : null
    const desvPlan = m.planejado > 0 && m.realizado != null ? ((m.realizado - m.planejado) / m.planejado) * 100 : null
    return { ...m, prevAcum, planAcum, realAcum, pctRealMes, pctRealAcum, desvPrev, desvPlan }
  })

  // ── Ações: entrar/sair dos modos de edição ──────────────────────────────────

  function handleAbrirEdicaoPP() {
    const p: Record<string, string> = {}, pl: Record<string, string> = {}
    for (const m of lancAtual?.meses ?? []) {
      const k = `${m.ano}-${m.mes}`
      if (m.hh_previsto  != null) p[k]  = String(m.hh_previsto)
      if (m.hh_planejado != null) pl[k] = String(m.hh_planejado)
    }
    setEditInicio(lancAtual?.data_inicio?.split('T')[0] ?? contrato?.data_inicio?.split('T')[0] ?? '')
    setEditFim(lancAtual?.data_fim?.split('T')[0] ?? contrato?.data_fim?.split('T')[0] ?? '')
    setEditMotivo('')
    setEditPrevisto(p)
    setEditPlanejado(pl)
    setErroPP(null)
    setModo('previsto_planejado')
  }

  function handleAbrirEdicaoReal() {
    setEditRealizado({})
    setErroReal(null)
    setModo('realizado')
  }

  function handleCancelarEdicao() {
    setModo('leitura'); setErroPP(null); setErroReal(null)
  }

  async function handleSalvarPP() {
    if (!editInicio || !editFim) { setErroPP('Informe data início e fim'); return }
    const meses = gerarMeses(editInicio, editFim)
    if (meses.length === 0) { setErroPP('Período inválido'); return }
    const jaTemLancamento = lancamentos.length > 0
    if (jaTemLancamento && !editMotivo.trim()) { setErroPP('Informe o motivo da alteração'); return }

    setSavingPP(true); setErroPP(null)
    try {
      const payload = {
        data_inicio: editInicio, data_fim: editFim,
        motivo: jaTemLancamento ? editMotivo : undefined,
        meses: meses.map(({ mes, ano }) => {
          const k = `${ano}-${mes}`
          return {
            mes, ano,
            hh_previsto:  Math.round(Number(editPrevisto[k])  || 0),
            hh_planejado: Math.round(Number(editPlanejado[k]) || 0),
          }
        }),
      }
      const res = await fetch(`/api/acordos/hh/${id}/lancamento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErroPP(json.error ?? 'Erro ao salvar'); return }
      await fetchData()
      setModo('leitura')
    } finally { setSavingPP(false) }
  }

  async function handleSalvarRealizado() {
    const entradas = Object.entries(editRealizado).filter(([, v]) => v !== '')
    if (entradas.length === 0) { setErroReal('Informe ao menos um valor de HH Realizado'); return }

    setSavingReal(true); setErroReal(null)
    try {
      const results = await Promise.all(entradas.map(([k, v]) => {
        const [ano, mes] = k.split('-').map(Number)
        return fetch(`/api/acordos/hh/${id}/realizado`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mes, ano, hh_realizado: Math.round(Number(v) || 0) }),
        })
      }))
      if (results.some(r => !r.ok)) { setErroReal('Erro ao salvar um ou mais lançamentos'); return }
      await fetchData()
      setModo('leitura')
      setEditRealizado({})
    } finally { setSavingReal(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────

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
        <button onClick={() => router.push('/acordos/hh?tab=obras')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-green-700">{contrato?.indice ?? '–'}</span>
            {contrato?.classificacao && (
              <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                {contrato.classificacao}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
            <span>{contrato?.cliente.nome}</span>
            {contrato?.cliente_final && <><span className="text-gray-300">•</span><span>Final: {contrato.cliente_final.nome}</span></>}
            {(contrato?.cidade || contrato?.estado) && (
              <><span className="text-gray-300">•</span><span>{[contrato?.cidade, contrato?.estado].filter(Boolean).join('/')}</span></>
            )}
            {contrato?.responsavel && <><span className="text-gray-300">•</span><span>{contrato.responsavel.nome}</span></>}
            {contrato?.data_inicio && contrato?.data_fim && (
              <><span className="text-gray-300">•</span><span>{fmtDate(contrato.data_inicio)} – {fmtDate(contrato.data_fim)}</span></>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {lancamentos.length > 0 && (
            <select
              value={revisaoId ?? ''}
              onChange={e => { setRevisaoId(Number(e.target.value)); setModo('leitura') }}
              className="text-[11px] border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-primary"
            >
              {lancamentos.map((l, idx) => (
                <option key={l.id} value={l.id}>{formatRev(l.versao)}{idx === 0 ? ' (atual)' : ''}</option>
              ))}
            </select>
          )}
          {isRevisaoAtual && modo === 'leitura' && podeEditar && (
            <>
              <button onClick={handleAbrirEdicaoPP}
                className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-[11px] font-semibold text-[#185FA5] hover:bg-blue-100 transition-colors">
                Editar Previsto/Planejado
              </button>
              {lancamentos.length > 0 && (
                <button onClick={handleAbrirEdicaoReal}
                  className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-[11px] font-semibold text-green-dark hover:bg-green-100 transition-colors">
                  Lançar Realizado
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 mb-4">
          {(['grade', 'historico'] as const).map(k => (
            <button key={k} onClick={() => setAba(k)}
              className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-full transition-colors',
                aba === k ? 'bg-green-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {k === 'grade' ? 'Grade de HH' : 'Histórico de revisões'}
            </button>
          ))}
        </div>

        {aba === 'grade' ? (
          <div className="space-y-4">
            {modo === 'previsto_planejado' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Editando Previsto/Planejado</span>
                  <span className="text-[11px] text-blue-700">
                    {lancamentos.length > 0
                      ? `— salvar criará automaticamente a revisão ${formatRev((lancAtual?.versao ?? 0) + 1)}`
                      : '— primeiro lançamento de HH deste contrato'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Data Início *</label>
                    <input type="date" value={editInicio} onChange={e => setEditInicio(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Data Fim *</label>
                    <input type="date" value={editFim} onChange={e => setEditFim(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  {lancamentos.length > 0 && (
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Motivo da alteração *</label>
                      <input type="text" value={editMotivo} onChange={e => setEditMotivo(e.target.value)} placeholder="Descreva o motivo da revisão..."
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  )}
                </div>
                {erroPP && <p className="text-red-600 text-[11px] mb-2">{erroPP}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={handleCancelarEdicao} className="text-[11px] px-4 py-1.5 border border-gray-300 rounded-md hover:bg-white text-gray-600">Cancelar</button>
                  <button onClick={handleSalvarPP} disabled={savingPP}
                    className="text-[11px] px-4 py-1.5 bg-[#185FA5] text-white rounded-md hover:bg-[#134a80] disabled:opacity-60">
                    {savingPP ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {modo === 'realizado' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-[11px] text-green-800">
                  <span className="font-bold uppercase tracking-wide mr-1">Lançando Realizado</span>
                  — pode ser ajustado a qualquer momento; não gera uma nova revisão.
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {erroReal && <span className="text-red-600 text-[11px]">{erroReal}</span>}
                  <button onClick={handleCancelarEdicao} className="text-[11px] px-4 py-1.5 border border-gray-300 rounded-md hover:bg-white text-gray-600">Cancelar</button>
                  <button onClick={handleSalvarRealizado} disabled={savingReal}
                    className="text-[11px] px-4 py-1.5 bg-green-primary text-white rounded-md hover:bg-green-dark disabled:opacity-60">
                    {savingReal ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {mesData.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-4 py-3 rounded-md">
                Nenhum lançamento de HH registrado ainda para este contrato.
                {podeEditar && modo === 'leitura' && ' Clique em "Editar Previsto/Planejado" para cadastrar o primeiro lançamento.'}
              </div>
            ) : (
              <>
                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="#185FA5" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-normal text-gray-500 mb-1">HH Previsto</p>
                      <p className="text-[30px] font-bold text-[#185FA5] leading-none tracking-tight">{totPrev > 0 ? loc(totPrev) : '—'}</p>
                      <p className="text-[11px] text-gray-400 mt-1.5">contrato completo</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="#BA7517" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-normal text-gray-500 mb-1">HH Planejado Acumulado</p>
                      <p className="text-[30px] font-bold text-[#BA7517] leading-none tracking-tight">{totPlan > 0 ? loc(totPlan) : '—'}</p>
                      <p className="text-[11px] text-gray-400 mt-1.5">distribuído nos meses</p>
                      {pctPlanPrev != null && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">% do Previsto</span>
                            <span className="text-[11px] font-bold" style={{ color: barColors(pctPlanPrev).text }}>{pctPlanPrev.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pctPlanPrev, 100)}%`, backgroundColor: barColors(pctPlanPrev).bg }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="#16A34A" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-normal text-gray-500 mb-1">HH Realizado Acumulado</p>
                      <p className="text-[30px] font-bold text-[#16A34A] leading-none tracking-tight">{totReal != null ? loc(totReal) : '—'}</p>
                      <p className="text-[11px] text-gray-400 mt-1.5">{totReal != null ? 'acumulado até o último lançamento' : 'sem lançamento realizado'}</p>
                      {(pctRealPrev != null || pctRealPlan != null) && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                          {pctRealPrev != null && (
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">% do Previsto</span>
                                <span className="text-[11px] font-bold" style={{ color: barColors(pctRealPrev).text }}>{pctRealPrev.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(pctRealPrev, 100)}%`, backgroundColor: barColors(pctRealPrev).bg }} />
                              </div>
                            </div>
                          )}
                          {pctRealPlan != null && (
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">% do Planejado</span>
                                <span className="text-[11px] font-bold" style={{ color: barColors(pctRealPlan).text }}>{pctRealPlan.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(pctRealPlan, 100)}%`, backgroundColor: barColors(pctRealPlan).bg }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Gráfico ── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Acumulado</p>
                  <p className="text-[11px] text-gray-400 mb-3">Progressão acumulada ao longo do contrato</p>
                  {chartLegend}
                  <div style={{ height: 230 }}><Line data={chartData} options={chartOpts} /></div>
                </div>

                {/* ── Tabela ── */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 pt-4 pb-1 flex items-center gap-3 flex-wrap">
                    <p className="text-[13px] font-bold text-gray-700">Detalhamento mês a mês</p>
                    {modo === 'previsto_planejado' && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-[#185FA5]">Editando Previsto/Planejado</span>
                    )}
                    {modo === 'realizado' && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-dark">Lançando Realizado</span>
                    )}
                  </div>
                  <div className="overflow-x-auto" style={{ maxHeight: '556px', overflowY: 'auto' }}>
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-green-primary text-white text-[9px] uppercase tracking-wide">
                          <th className="px-4 py-2 text-left font-semibold whitespace-nowrap">Mês</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Previsto</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Planejado</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Realizado</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Previsto (Acum.)</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Planejado (Acum.)</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Realizado (Acum.)</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Desvio (Prev. x Real)</th>
                          <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Desvio (Plan. x Real)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tabelaRows.map((row) => {
                          const key = `${row.ano}-${row.mes}`
                          const rcPrev = row.pctRealMes  != null ? barColors(row.pctRealMes).text  : undefined
                          const rcAcum = row.pctRealAcum != null ? barColors(row.pctRealAcum).text : undefined
                          const dcPrev = row.desvPrev != null ? (row.desvPrev <= 0 ? '#16A34A' : '#DC2626') : undefined
                          const dcPlan = row.desvPlan != null ? (row.desvPlan <= 0 ? '#16A34A' : '#DC2626') : undefined
                          return (
                            <tr key={key} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-2.5 font-semibold text-gray-700">{row.label}</td>

                              <td className="px-4 py-2.5 text-right text-[#185FA5]">
                                {modo === 'previsto_planejado' ? (
                                  <input type="text" inputMode="decimal"
                                    value={editPrevisto[key] ?? ''}
                                    onChange={e => setEditPrevisto(p => ({ ...p, [key]: e.target.value }))}
                                    onBlur={e => setEditPrevisto(p => ({ ...p, [key]: parsePtBrHh(e.target.value) }))}
                                    onPaste={e => { e.preventDefault(); setEditPrevisto(p => ({ ...p, [key]: parsePtBrHh(e.clipboardData.getData('text')) })) }}
                                    className="w-20 text-right border border-blue-200 bg-blue-50/60 rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-blue-400" />
                                ) : loc(row.previsto)}
                              </td>

                              <td className="px-4 py-2.5 text-right text-[#BA7517]">
                                {modo === 'previsto_planejado' ? (
                                  <input type="text" inputMode="decimal"
                                    value={editPlanejado[key] ?? ''}
                                    onChange={e => setEditPlanejado(p => ({ ...p, [key]: e.target.value }))}
                                    onBlur={e => setEditPlanejado(p => ({ ...p, [key]: parsePtBrHh(e.target.value) }))}
                                    onPaste={e => { e.preventDefault(); setEditPlanejado(p => ({ ...p, [key]: parsePtBrHh(e.clipboardData.getData('text')) })) }}
                                    className="w-20 text-right border border-amber-200 bg-amber-50/60 rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-amber-400" />
                                ) : loc(row.planejado)}
                              </td>

                              <td className="px-4 py-2.5 text-right font-bold" style={{ color: modo === 'realizado' ? undefined : (rcPrev ?? '#9CA3AF') }}>
                                {modo === 'realizado' ? (
                                  <input type="text" inputMode="decimal"
                                    value={editRealizado[key] ?? (row.realizado != null ? String(row.realizado) : '')}
                                    onChange={e => setEditRealizado(p => ({ ...p, [key]: e.target.value }))}
                                    onBlur={e => setEditRealizado(p => ({ ...p, [key]: parsePtBrHh(e.target.value) }))}
                                    onPaste={e => { e.preventDefault(); setEditRealizado(p => ({ ...p, [key]: parsePtBrHh(e.clipboardData.getData('text')) })) }}
                                    className="w-20 text-right border border-green-200 bg-green-50/60 rounded px-1.5 py-1 text-[11px] font-normal focus:outline-none focus:border-green-400" />
                                ) : (row.realizado != null ? loc(row.realizado) : <span className="text-slate-300 font-normal">—</span>)}
                              </td>

                              <td className="px-4 py-2.5 text-right text-[#185FA5]">{loc(row.prevAcum)}</td>
                              <td className="px-4 py-2.5 text-right text-[#BA7517]">{loc(row.planAcum)}</td>
                              <td className="px-4 py-2.5 text-right font-bold" style={{ color: rcAcum ?? '#9CA3AF' }}>
                                {row.realAcum != null ? loc(row.realAcum) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold" style={{ color: dcPrev }}>
                                {row.desvPrev != null ? `${row.desvPrev > 0 ? '+' : ''}${row.desvPrev.toFixed(1)}%` : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold" style={{ color: dcPlan }}>
                                {row.desvPlan != null ? `${row.desvPlan > 0 ? '+' : ''}${row.desvPlan.toFixed(1)}%` : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="px-4 py-3 text-[11px] uppercase tracking-wide text-gray-700">Total</td>
                          <td className="px-4 py-3 text-right text-[#185FA5]">{loc(totPrev)}</td>
                          <td className="px-4 py-3 text-right text-[#BA7517]">{loc(totPlan)}</td>
                          <td className="px-4 py-3 text-right" style={{ color: pctRealPrev != null ? barColors(pctRealPrev).text : '#9CA3AF' }}>
                            {totReal != null ? loc(totReal) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400">—</td>
                          <td className="px-4 py-3 text-right text-gray-400">—</td>
                          <td className="px-4 py-3 text-right text-gray-400">—</td>
                          {(() => {
                            const d = totPrev > 0 && totReal != null ? ((totReal - totPrev) / totPrev) * 100 : null
                            return (
                              <td className="px-4 py-3 text-right" style={{ color: d != null ? (d <= 0 ? '#16A34A' : '#DC2626') : undefined }}>
                                {d != null ? `${d > 0 ? '+' : ''}${d.toFixed(1)}%` : '—'}
                              </td>
                            )
                          })()}
                          {(() => {
                            const d = totPlan > 0 && totReal != null ? ((totReal - totPlan) / totPlan) * 100 : null
                            return (
                              <td className="px-4 py-3 text-right" style={{ color: d != null ? (d <= 0 ? '#16A34A' : '#DC2626') : undefined }}>
                                {d != null ? `${d > 0 ? '+' : ''}${d.toFixed(1)}%` : '—'}
                              </td>
                            )
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                    <p className="text-[10px] text-gray-400">
                      ⓘ Realizado: <span className="text-green-600 font-medium">Verde &lt;90%</span> · <span className="text-yellow-500 font-medium">Âmbar 90–100%</span> · <span className="text-red-500 font-medium">Vermelho &gt;100%</span> do previsto · Desvio: verde = economia, vermelho = estouro
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {lancamentos.length === 0 ? (
              <p className="text-gray-400 text-[11px] p-6 text-center">Nenhum lançamento registrado.</p>
            ) : lancamentos.map((lan, idx) => {
              const isAtual  = idx === 0
              const expanded = expandedRev === lan.id
              const totPrevL = lan.meses.reduce((s, m) => s + (m.hh_previsto  ?? 0), 0)
              const totPlanL = lan.meses.reduce((s, m) => s + (m.hh_planejado ?? 0), 0)
              return (
                <div key={lan.id} className="border-b border-slate-100 last:border-b-0">
                  <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedRev(expanded ? null : lan.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-700">{formatRev(lan.versao)}</span>
                      {isAtual && <span className="text-[8px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">ATUAL</span>}
                      {lan.motivo && <span className="text-[10px] text-gray-400 italic">"{lan.motivo}"</span>}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-gray-500 flex-wrap justify-end">
                      <span>{fmtDate(lan.data_inicio)} – {fmtDate(lan.data_fim)}</span>
                      <span className="text-[#185FA5] font-medium">Prev: {loc(totPrevL)}</span>
                      <span className="text-[#BA7517] font-medium">Plan: {loc(totPlanL)}</span>
                      <span className="text-gray-400">por {lan.criador}</span>
                      <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-slate-100 overflow-x-auto bg-slate-50">
                      <table className="text-[10px] w-full">
                        <thead>
                          <tr className="bg-slate-100 text-gray-500 text-[9px] uppercase">
                            <th className="px-4 py-1.5 text-left">Mês</th>
                            <th className="px-4 py-1.5 text-right text-[#185FA5]">HH Previsto</th>
                            <th className="px-4 py-1.5 text-right text-[#BA7517]">HH Planejado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lan.meses.map(m => (
                            <tr key={`${m.mes}-${m.ano}`} className="border-t border-slate-100">
                              <td className="px-4 py-1 text-gray-600">{fmtMes(m.mes, m.ano)}</td>
                              <td className="px-4 py-1 text-right text-[#185FA5] font-medium">{m.hh_previsto != null ? loc(m.hh_previsto) : '—'}</td>
                              <td className="px-4 py-1 text-right text-[#BA7517] font-medium">{m.hh_planejado != null ? loc(m.hh_planejado) : '—'}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                            <td className="px-4 py-1.5 text-gray-700 text-[9px] uppercase">Total</td>
                            <td className="px-4 py-1.5 text-right text-[#185FA5]">{loc(totPrevL)}</td>
                            <td className="px-4 py-1.5 text-right text-[#BA7517]">{loc(totPlanL)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
