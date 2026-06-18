'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  num_acordo: string | null; num_proposta: string | null
  cidade: string | null; estado: string | null; classificacao: string | null
  cliente:       { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
  descricao: string | null
  responsavel: { id: number; nome: string } | null
  data_inicio: string | null; data_fim: string | null
  tem_lancamento: boolean
  valor_orcado: number | null; valor_faturado: number | null
  hh_previsto: number | null; hh_planejado: number | null; hh_realizado: number | null
  parada_hh_previsto: number | null; parada_hh_realizado: number | null
  parada_pct_real_prev: number | null
  parada_fin_orcado_rs_hh: number | null; parada_fin_prev_rs_hh: number | null; parada_fin_real_rs_hh: number | null
  parada_classificacao_ucr: string | null
  lancamento_atual: {
    id: number; versao: number; data_inicio: string; data_fim: string
    motivo: string | null; created_at: string; criador: string
    meses: { mes: number; ano: number; hh_previsto: number | null; hh_planejado: number | null }[]
  } | null
  realizados: { id: number; mes: number; ano: number; hh_realizado: number; observacoes: string | null }[]
}

interface LancamentoDetalhe {
  id: number; versao: number
  data_inicio: string; data_fim: string
  motivo: string | null; created_at: string; criador: string
  meses: { mes: number; ano: number; hh_previsto: number | null; hh_planejado: number | null }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const nowLabel = () => { const d = new Date(); return `${MESES_LABELS[d.getMonth()]} ${d.getFullYear()}` }
const fmtMes   = (mes: number, ano: number) => `${MESES_LABELS[mes-1]}/${String(ano).slice(2)}`
const fmtDate  = (iso: string) => {
  const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`
}

function gerarMeses(inicio: string, fim: string) {
  const r: { mes: number; ano: number }[] = []
  const d = new Date(inicio + 'T00:00:00')
  const f = new Date(fim    + 'T00:00:00')
  while (d <= f) { r.push({ mes: d.getMonth() + 1, ano: d.getFullYear() }); d.setMonth(d.getMonth() + 1) }
  return r
}

// <90% verde | 90-100% âmbar | >100% vermelho
function pctColor(pct: number): string {
  if (pct > 100) return '#C62828'
  if (pct >= 90)  return '#BA7517'
  return '#3B6D11'
}

function MiniBar({ pct }: { pct: number }) {
  const color = pctColor(pct)
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${Math.min((pct / 120) * 100, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

// ─── UCR style helper ─────────────────────────────────────────────────────────

const UCR_STYLE: Record<string, { cor: string; bg: string }> = {
  'Não Suficiente': { cor: '#C62828', bg: '#FFCDD2' },
  'A Evoluir':      { cor: '#F9A825', bg: '#FFF9C4' },
  'Bom':            { cor: '#2E7D32', bg: '#C8E6C9' },
  'Ótimo':          { cor: '#1565C0', bg: '#BBDEFB' },
  'Esplêndido':     { cor: '#4040A0', bg: '#D3D3FF' },
}
function ucrStyle(label: string | null) { return label ? UCR_STYLE[label] ?? null : null }

// ─── Botão de ação (padrão das outras tabelas) ────────────────────────────────

function ABtn({ onClick, title, color, children }: {
  onClick: () => void; title: string; color: string; children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    blue:  'border-blue-400 text-blue-500 hover:bg-blue-50',
    green: 'border-green-primary text-green-primary hover:bg-green-light',
    gray:  'border-gray-300 text-gray-500 hover:bg-gray-100',
    red:   'border-red-400 text-red-400 hover:bg-red-50',
  }
  return (
    <button onClick={onClick} title={title}
      className={cn('border rounded px-1.5 py-0.5 text-[11px]', colors[color] ?? colors.gray)}>
      {children}
    </button>
  )
}

// ─── Modal Visualizar Contrato HH ─────────────────────────────────────────────

interface VisualizarContratoHhModalProps {
  contrato: ContratoHh
  onClose: () => void
}

function VisualizarContratoHhModal({ contrato, onClose }: VisualizarContratoHhModalProps) {
  const [lancamentos, setLancamentos] = useState<LancamentoDetalhe[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expandedRev, setExpandedRev] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/acordos/hh/${contrato.id}/lancamento`)
      .then(r => r.json())
      .then(j => { setLancamentos(j.data ?? []); if (j.data?.[0]) setExpandedRev(j.data[0].id) })
      .finally(() => setLoading(false))
  }, [contrato.id])

  const loc = (n: number) => n.toLocaleString('pt-BR')
  const pctPrev = contrato.hh_previsto && contrato.hh_previsto > 0 && contrato.hh_realizado != null
    ? (contrato.hh_realizado / contrato.hh_previsto) * 100 : null
  const pctPlan = contrato.hh_planejado && contrato.hh_planejado > 0 && contrato.hh_realizado != null
    ? (contrato.hh_realizado / contrato.hh_planejado) * 100 : null

  function PctChip({ pct }: { pct: number }) {
    const c = pctColor(pct)
    return <span className="text-[10px] font-bold ml-2" style={{ color: c }}>{pct.toFixed(1)}%</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end bg-black/40" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-[#1B5E20] text-white px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold bg-white/20 rounded px-2 py-0.5">{contrato.indice}</span>
                {contrato.num_os && <span className="text-white/70 text-[11px]">OS: {contrato.num_os}</span>}
              </div>
              <p className="text-white font-semibold text-[14px] mt-1 leading-snug">{contrato.descricao ?? '—'}</p>
              <p className="text-white/70 text-[11px] mt-0.5">
                {contrato.cliente.nome}
                {contrato.cliente_final && <> • <span className="text-white/50">Final: {contrato.cliente_final.nome}</span></>}
              </p>
              <div className="flex items-center gap-3 mt-1 text-white/60 text-[10px]">
                {contrato.responsavel && <span>Resp.: {contrato.responsavel.nome}</span>}
                {(contrato.cidade || contrato.estado) && <span>{[contrato.cidade, contrato.estado].filter(Boolean).join(' / ')}</span>}
                {contrato.data_inicio && contrato.data_fim && (
                  <span>{fmtDate(contrato.data_inicio)} – {fmtDate(contrato.data_fim)}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-[22px] leading-none ml-4">×</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 border-b border-gray-200 flex-shrink-0">
          {[
            { label: 'HH Previsto',  val: contrato.hh_previsto,  color: '#185FA5', pct: null },
            { label: 'HH Planejado', val: contrato.hh_planejado, color: '#BA7517', pct: null },
            { label: 'HH Realizado', val: contrato.hh_realizado, color: '#3B6D11', pct: pctPrev },
          ].map(({ label, val, color, pct }) => (
            <div key={label} className="px-4 py-3 border-r border-gray-100 last:border-r-0">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
              <p className="text-[20px] font-bold leading-tight mt-0.5" style={{ color }}>
                {val != null ? loc(val) : <span className="text-gray-300 text-[14px]">—</span>}
              </p>
              {pct != null && <PctChip pct={pct} />}
              {label === 'HH Planejado' && pctPrev != null && (
                <p className="text-[9px] text-gray-400 mt-0.5">
                  {pctPlan != null ? <PctChip pct={pctPlan} /> : null}
                  <span className="text-[9px] text-gray-400"> vs plan.</span>
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

          {/* Lançamentos */}
          <section>
            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
              Lançamentos ({lancamentos.length})
            </h3>
            {loading ? (
              <p className="text-gray-400 text-[11px]">Carregando...</p>
            ) : lancamentos.length === 0 ? (
              <p className="text-gray-400 text-[11px]">Nenhum lançamento registrado.</p>
            ) : (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {lancamentos.map((lan, idx) => {
                  const isAtual   = idx === 0
                  const expanded  = expandedRev === lan.id
                  const totPrev   = lan.meses.reduce((s, m) => s + (m.hh_previsto  ?? 0), 0)
                  const totPlan   = lan.meses.reduce((s, m) => s + (m.hh_planejado ?? 0), 0)
                  return (
                    <div key={lan.id} className="border-b border-gray-100 last:border-b-0">
                      <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => setExpandedRev(expanded ? null : lan.id)}>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-700">
                            Rev.{String(lan.versao).padStart(2,'0')}
                          </span>
                          {isAtual && <span className="text-[8px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">ATUAL</span>}
                          {lan.motivo && <span className="text-[10px] text-gray-400 italic">"{lan.motivo}"</span>}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-gray-500">
                          <span>{fmtDate(lan.data_inicio)} – {fmtDate(lan.data_fim)}</span>
                          <span className="text-[#185FA5] font-medium">Prev: {loc(totPrev)}</span>
                          <span className="text-[#BA7517] font-medium">Plan: {loc(totPlan)}</span>
                          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="border-t border-gray-100 overflow-x-auto bg-gray-50">
                          <table className="text-[10px] w-full">
                            <thead>
                              <tr className="bg-gray-100 text-gray-500 text-[9px] uppercase">
                                <th className="px-3 py-1.5 text-left">Mês</th>
                                <th className="px-3 py-1.5 text-right text-[#185FA5]">HH Previsto</th>
                                <th className="px-3 py-1.5 text-right text-[#BA7517]">HH Planejado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lan.meses.map(m => (
                                <tr key={`${m.mes}-${m.ano}`} className="border-t border-gray-100">
                                  <td className="px-3 py-1 text-gray-600">{fmtMes(m.mes, m.ano)}</td>
                                  <td className="px-3 py-1 text-right text-[#185FA5] font-medium">{m.hh_previsto != null ? loc(m.hh_previsto) : '—'}</td>
                                  <td className="px-3 py-1 text-right text-[#BA7517] font-medium">{m.hh_planejado != null ? loc(m.hh_planejado) : '—'}</td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                                <td className="px-3 py-1.5 text-gray-700 text-[9px] uppercase">Total</td>
                                <td className="px-3 py-1.5 text-right text-[#185FA5]">{loc(totPrev)}</td>
                                <td className="px-3 py-1.5 text-right text-[#BA7517]">{loc(totPlan)}</td>
                              </tr>
                            </tbody>
                          </table>
                          <p className="px-3 py-1.5 text-[9px] text-gray-400">
                            Criado por {lan.criador} em {fmtDate(lan.created_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* HH Realizado */}
          <section>
            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
              HH Realizado ({contrato.realizados.length} {contrato.realizados.length === 1 ? 'mês' : 'meses'})
            </h3>
            {contrato.realizados.length === 0 ? (
              <p className="text-gray-400 text-[11px]">Nenhum realizado lançado ainda.</p>
            ) : (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="text-[11px] w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-[9px] text-gray-500 uppercase border-b border-gray-200">
                      <th className="px-3 py-2 text-left">Mês / Ano</th>
                      <th className="px-3 py-2 text-right text-[#3B6D11]">HH Realizado</th>
                      <th className="px-3 py-2 text-right text-[#185FA5]">HH Planejado</th>
                      <th className="px-3 py-2 text-center">% Real/Plan</th>
                      <th className="px-3 py-2 text-left">Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrato.realizados.map(r => {
                      const mesLan = contrato.lancamento_atual?.meses.find(m => m.mes === r.mes && m.ano === r.ano)
                      const plan   = mesLan?.hh_planejado ?? null
                      const pct    = plan && plan > 0 ? (r.hh_realizado / plan) * 100 : null
                      return (
                        <tr key={r.id} className="border-b border-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-700">{fmtMes(r.mes, r.ano)}</td>
                          <td className="px-3 py-2 text-right font-bold text-[#3B6D11]">{loc(r.hh_realizado)}</td>
                          <td className="px-3 py-2 text-right text-[#BA7517]">{plan != null ? loc(plan) : '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {pct != null
                              ? <span className="text-[10px] font-bold" style={{ color: pctColor(pct) }}>{pct.toFixed(1)}%</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-[10px]">{r.observacoes ?? '—'}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[11px]">
                      <td className="px-3 py-2 text-gray-700 text-[9px] uppercase">Total</td>
                      <td className="px-3 py-2 text-right text-[#3B6D11]">
                        {loc(contrato.realizados.reduce((s, r) => s + r.hh_realizado, 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex justify-end bg-gray-50 flex-shrink-0">
          <button onClick={onClose}
            className="border border-gray-300 text-gray-600 rounded-md px-4 py-1.5 text-[11px] font-medium hover:bg-gray-100">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Editar Contrato (dados cadastrais) ─────────────────────────────────

interface EditarContratoHhModalProps {
  contrato: ContratoHh
  clientes: { id: number; nome: string }[]
  responsaveis: { id: number; nome: string }[]
  onClose: () => void
  onSuccess: () => void
}

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function EditarContratoHhModal({ contrato, clientes, responsaveis, onClose, onSuccess }: EditarContratoHhModalProps) {
  const [clienteFinalId, setClienteFinalId] = useState(contrato.cliente_final ? String(contrato.cliente_final.id) : '')
  const [cidade,         setCidade]         = useState(contrato.cidade ?? '')
  const [estado,         setEstado]         = useState(contrato.estado ?? '')
  const [responsavelId,  setResponsavelId]  = useState(contrato.responsavel ? String(contrato.responsavel.id) : '')
  const [numOs,          setNumOs]          = useState(contrato.num_os ?? '')
  const [dataInicio,     setDataInicio]     = useState(contrato.data_inicio?.split('T')[0] ?? '')
  const [dataFim,        setDataFim]        = useState(contrato.data_fim?.split('T')[0] ?? '')
  const [descricao,      setDescricao]      = useState(contrato.descricao ?? '')
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const iLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider'
  const iCls = 'w-full border border-gray-300 rounded-md px-2.5 py-[5px] text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30'

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/faturamento/contratos/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_final_id: clienteFinalId ? Number(clienteFinalId) : null,
          cidade: cidade || null,
          estado: estado || null,
          responsavel_id: responsavelId ? Number(responsavelId) : null,
          num_os: numOs || null,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          descricao: descricao || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="bg-[#1B5E20] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold">Editar Contrato — {contrato.indice}</h2>
            <p className="text-white/70 text-[11px] mt-0.5">Dados cadastrais do acompanhamento de HH</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-[20px]">×</button>
        </div>
        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded-md">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={iLbl}>Cliente Final</label>
              <select value={clienteFinalId} onChange={e => setClienteFinalId(e.target.value)} className={iCls}>
                <option value="">Nenhum</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={iLbl}>Responsável</label>
              <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)} className={iCls}>
                <option value="">Nenhum</option>
                {responsaveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={iLbl}>Nº OS</label>
              <input value={numOs} onChange={e => setNumOs(e.target.value)} placeholder="Ex: OS-9001" className={iCls} />
            </div>
            <div>
              <label className={iLbl}>Cidade</label>
              <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Volta Redonda" className={iCls} />
            </div>
            <div>
              <label className={iLbl}>UF</label>
              <select value={estado} onChange={e => setEstado(e.target.value)} className={iCls}>
                <option value="">—</option>
                {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={iLbl}>Data Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={iCls} />
            </div>
            <div>
              <label className={iLbl}>Data Fim</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={iCls} />
            </div>
          </div>
          <div>
            <label className={iLbl}>Descrição / Escopo</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-md px-2.5 py-[5px] text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="border border-gray-300 text-gray-600 rounded-md px-4 py-1.5 text-[11px] font-medium hover:bg-gray-100">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-green-primary text-white rounded-md px-4 py-1.5 text-[11px] font-semibold hover:bg-green-dark transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Novo Lançamento Modal ────────────────────────────────────────────────────

function NovoLancamentoModal({ onClose, onSelect, classificacao }: { onClose: () => void; onSelect: (c: ContratoHh) => void; classificacao: 'OBRAS' | 'PARADAS' }) {
  const [disponivel, setDisponivel] = useState<ContratoHh[]>([])
  const [loading,    setLoading]    = useState(true)
  const [query,      setQuery]      = useState('')

  useEffect(() => {
    fetch(`/api/acordos/hh?disponivel=1&classificacao=${classificacao}`)
      .then(r => r.json())
      .then(j => setDisponivel(j.data ?? []))
      .finally(() => setLoading(false))
  }, [classificacao])

  const filtered = query.trim()
    ? disponivel.filter(c =>
        c.indice.toLowerCase().includes(query.toLowerCase()) ||
        c.cliente.nome.toLowerCase().includes(query.toLowerCase()) ||
        (c.descricao ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.num_os ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.num_acordo ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.num_proposta ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (c.cidade ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : disponivel

  const cols = ['Índice','Cliente','Cliente Final','Descrição / Evento','Nº Acordo','Nº Proposta','Cidade / UF','']
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-[#1B5E20] text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-[14px] font-bold">Novo Lançamento — Controle de HH</h2>
            <p className="text-white/70 text-[11px] mt-0.5">Selecione o contrato a ser acompanhado</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-[20px]">×</button>
        </div>
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar por CT, cliente, OS, Nº Acordo, Nº Proposta, cidade ou escopo..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              {disponivel.length === 0 ? `Todos os contratos de ${classificacao === 'OBRAS' ? 'Obras' : 'Paradas'} já possuem lançamento de HH.` : 'Nenhum resultado encontrado.'}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  {cols.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}
                    className={cn('border-b border-gray-50 hover:bg-green-50 cursor-pointer transition-colors', i % 2 === 0 ? '' : 'bg-gray-50/40')}
                    onClick={() => onSelect(c)}>
                    <td className="px-3 py-2.5 font-bold text-green-dark whitespace-nowrap">{c.indice}</td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-[130px]">
                      <span className="line-clamp-2 whitespace-normal">{c.cliente.nome}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[110px]">
                      <span className="line-clamp-2 whitespace-normal">{c.cliente_final?.nome ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[200px]">
                      <span className="line-clamp-2 whitespace-normal" title={c.descricao ?? ''}>{c.descricao ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{c.num_acordo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{c.num_proposta ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
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

// ─── UCR Config Modal ────────────────────────────────────────────────────────

const UCR_ROWS_CFG = [
  { label: 'Não Suficiente', cor: '#C62828', bg: '#FFCDD2', key: 'ucr_nao_suficiente' as const },
  { label: 'A Evoluir',      cor: '#F9A825', bg: '#FFF9C4', key: 'ucr_a_evoluir'      as const },
  { label: 'Bom',            cor: '#2E7D32', bg: '#C8E6C9', key: 'ucr_bom'            as const },
  { label: 'Ótimo',          cor: '#1565C0', bg: '#BBDEFB', key: 'ucr_otimo'          as const },
  { label: 'Esplêndido',     cor: '#4040A0', bg: '#D3D3FF', key: 'ucr_esplendido'     as const },
]

type UcrKeys = 'ucr_nao_suficiente' | 'ucr_a_evoluir' | 'ucr_bom' | 'ucr_otimo' | 'ucr_esplendido'

function UcrConfigModal({ contrato, onClose }: { contrato: ContratoHh; onClose: () => void }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [ucr, setUcr] = useState<Record<UcrKeys, string>>({
    ucr_nao_suficiente: '161.98',
    ucr_a_evoluir:      '162.00',
    ucr_bom:            '180.00',
    ucr_otimo:          '234.00',
    ucr_esplendido:     '270.00',
  })

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await fetch(`/api/acordos/hh/paradas/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ucr_nao_suficiente: parseFloat(ucr.ucr_nao_suficiente) || 161.98,
          ucr_a_evoluir:      parseFloat(ucr.ucr_a_evoluir)      || 162.00,
          ucr_bom:            parseFloat(ucr.ucr_bom)            || 180.00,
          ucr_otimo:          parseFloat(ucr.ucr_otimo)          || 234.00,
          ucr_esplendido:     parseFloat(ucr.ucr_esplendido)     || 270.00,
        }),
      })
      router.push(`/acordos/hh/paradas/${contrato.id}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="bg-[#1B5E20] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold">Uso Consciente do Recurso (UCR)</h2>
            <p className="text-white/70 text-[11px] mt-0.5">{contrato.indice} · {contrato.descricao ?? contrato.cliente.nome}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-[20px]">×</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-[11px] text-gray-500">Defina os limites de R$/HH para cada faixa de classificação.</p>
          <div className="flex flex-col gap-2.5">
            {UCR_ROWS_CFG.map(({ label, cor, bg, key }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-[140px] rounded-md px-3 py-1.5 text-[11px] font-semibold flex-shrink-0"
                  style={{ background: bg, color: cor }}>
                  {label}
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">até R$</span>
                <input
                  type="number" step="0.01"
                  value={ucr[key]}
                  onChange={e => setUcr(p => ({ ...p, [key]: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px] text-right focus:outline-none focus:ring-2 focus:ring-green-primary/30"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose}
            className="border border-gray-300 text-gray-600 rounded-md px-4 py-1.5 text-[11px] font-medium hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="bg-green-primary text-white rounded-md px-4 py-1.5 text-[11px] font-semibold hover:bg-green-dark transition-colors disabled:opacity-60">
            {saving ? 'Configurando...' : 'Confirmar e Abrir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filtros + opções ─────────────────────────────────────────────────────────

function useFilterOptions(contratos: ContratoHh[]) {
  return useMemo(() => ({
    clientes:       Array.from(new Map(contratos.map(c => [c.cliente.id, c.cliente.nome])).entries()).map(([v,l]) => ({ value: String(v), label: l })),
    clientesFinais: Array.from(new Map(contratos.filter(c=>c.cliente_final).map(c => [c.cliente_final!.id, c.cliente_final!.nome])).entries()).map(([v,l]) => ({ value: String(v), label: l })),
    oss:            Array.from(new Set(contratos.map(c => c.num_os).filter((v): v is string => v != null))).map(v => ({ value: v, label: v })),
    responsaveis:   Array.from(new Map(contratos.filter(c=>c.responsavel).map(c=>[c.responsavel!.id, c.responsavel!.nome])).entries()).map(([v,l]) => ({ value: String(v), label: l })),
    mercados:       Array.from(new Set(contratos.map(c => c.cliente.ramo_atuacao).filter((v): v is string => v != null && v !== ''))).map(v => ({ value: v, label: v })),
    escopos:        contratos.filter(c=>c.descricao).map(c => ({ value: c.descricao!, label: c.descricao! })),
  }), [contratos])
}

type FilterState = Record<string, string[]>

function Filters({ opts, filters, onChange }: {
  opts: ReturnType<typeof useFilterOptions>
  filters: FilterState
  onChange: (k: string, v: string[]) => void
}) {
  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'
  const filterDefs = [
    { key: 'clientes',       label: 'Cliente',       opts: opts.clientes },
    { key: 'clientesFinais', label: 'Cliente Final', opts: opts.clientesFinais },
    { key: 'oss',            label: 'OS',            opts: opts.oss },
    { key: 'responsaveis',   label: 'Responsável',   opts: opts.responsaveis },
    { key: 'mercados',       label: 'Mercado',       opts: opts.mercados },
    { key: 'escopos',        label: 'Escopo',        opts: opts.escopos },
  ]
  const hasAny = Object.values(filters).some(v => v.length > 0)
  return (
    <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 flex gap-1.5 items-end mb-3 flex-wrap">
      {filterDefs.map(({ key, label, opts: o }) => (
        <div key={key} className="flex-1 min-w-[110px]">
          <label className={fLbl}>{label}</label>
          <SearchableMultiSelect values={filters[key] ?? []} onChange={v => onChange(key, v)} options={o} />
        </div>
      ))}
      {hasAny && (
        <button onClick={() => filterDefs.forEach(f => onChange(f.key, []))}
          className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] hover:bg-gray-100 flex-shrink-0">✕</button>
      )}
    </div>
  )
}

function applyFilters(contratos: ContratoHh[], filters: FilterState) {
  return contratos.filter(c => {
    if (filters.clientes?.length       && !filters.clientes.includes(String(c.cliente.id)))                return false
    if (filters.clientesFinais?.length && !filters.clientesFinais.includes(String(c.cliente_final?.id)))   return false
    if (filters.oss?.length            && !filters.oss.includes(c.num_os ?? ''))                           return false
    if (filters.responsaveis?.length   && !filters.responsaveis.includes(String(c.responsavel?.id)))       return false
    if (filters.mercados?.length       && !filters.mercados.includes(c.cliente.ramo_atuacao ?? ''))        return false
    if (filters.escopos?.length        && !filters.escopos.includes(c.descricao ?? ''))                    return false
    return true
  })
}

// ─── Visão Contratos ──────────────────────────────────────────────────────────

function VisaoContratos({ contratos, opts, onRefresh, classificacao }: {
  contratos: ContratoHh[]
  opts: ReturnType<typeof useFilterOptions>
  onRefresh: () => void
  classificacao: 'OBRAS' | 'PARADAS'
}) {
  const router = useRouter()
  const [modalLancamento,  setModalLancamento]  = useState<ContratoHh | null>(null)
  const [modalUcr,         setModalUcr]         = useState<ContratoHh | null>(null)
  const [modalEditar,      setModalEditar]      = useState<ContratoHh | null>(null)
  const [modalVisualizar,  setModalVisualizar]  = useState<ContratoHh | null>(null)
  const [novoModal,        setNovoModal]        = useState(false)
  const [deleteId,         setDeleteId]         = useState<number | null>(null)
  const [deleting,         setDeleting]         = useState(false)
  const [filters,          setFilters]          = useState<FilterState>({})
  const [clientes,         setClientes]         = useState<{ id: number; nome: string }[]>([])
  const [responsaveis,     setResponsaveis]     = useState<{ id: number; nome: string }[]>([])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(j => setClientes(j.data ?? []))
    fetch('/api/users/acordos').then(r => r.json()).then(j => setResponsaveis(j.data ?? []))
  }, [])

  const filtered = applyFilters(contratos, filters)
  const setFilter = (k: string, v: string[]) => setFilters(p => ({ ...p, [k]: v }))

  const handleDelete = async (id: number) => {
    setDeleting(true)
    try {
      await fetch(`/api/acordos/hh/${id}`, { method: 'DELETE' })
      setDeleteId(null); onRefresh()
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-400">{filtered.length} contrato{filtered.length !== 1 ? 's' : ''}</span>
        <button onClick={() => setNovoModal(true)}
          className="bg-green-primary text-white text-[11px] font-semibold px-3 py-1.5 rounded-md hover:bg-green-dark transition-colors">
          + Novo Lançamento
        </button>
      </div>

      <Filters opts={opts} filters={filters} onChange={setFilter} />

      <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-md bg-white">
        <table className="text-[11px] border-collapse min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-green-primary text-white">
              <th colSpan={9} className="px-3 py-1.5 text-left text-[10px] font-semibold border-r border-green-700">Cadastro</th>
              <th colSpan={classificacao === 'PARADAS' ? 7 : 5} className="px-3 py-1.5 text-center text-[10px] font-semibold bg-[#1B5E20] border-r border-green-700">Indicadores de HH</th>
              <th className="px-2 py-1.5 text-center text-[10px] font-semibold w-[100px]">Ações</th>
            </tr>
            <tr className="bg-green-primary text-white text-[9px] uppercase tracking-wide">
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap w-[90px]">Índice</th>
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap w-[100px]">OS</th>
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap w-[130px]">Cliente</th>
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap w-[120px]">Cliente Final</th>
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 min-w-[210px]">Escopo</th>
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap w-[90px]">Cidade/UF</th>
              <th className="px-3 py-1.5 text-left font-semibold border-r border-green-800 whitespace-nowrap w-[120px]">Responsável</th>
              <th className="px-3 py-1.5 text-right font-semibold border-r border-green-800 whitespace-nowrap w-[110px]">Val. Orçado</th>
              <th className="px-3 py-1.5 text-right font-semibold border-r border-green-800 whitespace-nowrap w-[110px]">Val. Faturado</th>
              {classificacao === 'PARADAS' ? (
                <>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[72px]">HH Prev.</th>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[72px]">HH Real.</th>
                  <th className="px-2 py-1.5 text-center font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[80px]">% R/Prev</th>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[90px]">R$/HH Orç.</th>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[90px]">R$/HH Prev.</th>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[90px]">R$/HH Real</th>
                  <th className="px-2 py-1.5 text-center font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[110px]">Classificação UCR</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[72px]">HH Prev.</th>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[72px]">HH Plan.</th>
                  <th className="px-2 py-1.5 text-right font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[72px]">HH Real.</th>
                  <th className="px-2 py-1.5 text-center font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[90px]">% R/Prev</th>
                  <th className="px-2 py-1.5 text-center font-semibold bg-[#1B5E20] border-r border-green-900 whitespace-nowrap w-[90px]">% R/Plan</th>
                </>
              )}
              <th className="px-2 py-1.5 text-center font-semibold w-[100px]" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={classificacao === 'PARADAS' ? 17 : 15} className="text-center text-gray-400 py-10 text-sm">Nenhum contrato encontrado.</td></tr>
            )}
            {filtered.map((c, idx) => {
              const bg = idx % 2 === 0 ? '#fff' : '#f9fafb'
              const { hh_previsto: prev, hh_planejado: plan, hh_realizado: real } = c
              const pctPrev = prev && prev > 0 && real != null ? (real / prev) * 100 : null
              const pctPlan = plan && plan > 0 && real != null ? (real / plan) * 100 : null
              const isDeleting = deleteId === c.id
              return (
                <tr key={c.id} style={{ background: bg }} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                  <td className="px-3 py-2 font-bold text-green-dark whitespace-nowrap">{c.indice}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{c.num_os ?? '—'}</td>
                  <td className="px-3 py-2 max-w-[130px]">
                    <span className="line-clamp-2 whitespace-normal" title={c.cliente.nome}>{c.cliente.nome}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[120px]">
                    <span className="line-clamp-2 whitespace-normal" title={c.cliente_final?.nome}>{c.cliente_final?.nome ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2 min-w-[210px]">
                    <span className="line-clamp-2 whitespace-normal text-gray-600 leading-snug" title={c.descricao ?? ''}>{c.descricao ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-[10px]">
                    {[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-[10px]">
                    {c.responsavel?.nome ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[10px] font-medium" style={{ color: '#185FA5' }}>
                    {c.valor_orcado != null ? c.valor_orcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-[10px] font-medium" style={{ color: '#3B6D11' }}>
                    {c.valor_faturado != null ? c.valor_faturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : <span className="text-gray-300">—</span>}
                  </td>
                  {classificacao === 'PARADAS' ? (
                    <>
                      <td className="px-2 py-2 text-right font-medium w-[72px]" style={{ color: '#185FA5' }}>
                        {c.parada_hh_previsto != null ? c.parada_hh_previsto.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-medium w-[72px]" style={{ color: '#3B6D11' }}>
                        {c.parada_hh_realizado != null ? c.parada_hh_realizado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 w-[80px]">
                        {c.parada_pct_real_prev != null ? <MiniBar pct={c.parada_pct_real_prev} /> : <span className="text-gray-300 text-[10px] block text-center">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right text-[10px] font-medium w-[90px]" style={{ color: '#185FA5' }}>
                        {c.parada_fin_orcado_rs_hh != null ? c.parada_fin_orcado_rs_hh.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right text-[10px] font-medium w-[90px]" style={{ color: '#BA7517' }}>
                        {c.parada_fin_prev_rs_hh != null ? c.parada_fin_prev_rs_hh.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right text-[10px] font-medium w-[90px]" style={{ color: '#3B6D11' }}>
                        {c.parada_fin_real_rs_hh != null ? c.parada_fin_real_rs_hh.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-center w-[110px]">
                        {(() => {
                          const s = ucrStyle(c.parada_classificacao_ucr)
                          return s ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: s.cor, background: s.bg }}>
                              {c.parada_classificacao_ucr}
                            </span>
                          ) : <span className="text-gray-300 text-[10px]">—</span>
                        })()}
                      </td>
                    </>
                  ) : (
                    <>
                      {[
                        { v: prev, color: '#185FA5' },
                        { v: plan, color: '#BA7517' },
                        { v: real, color: '#3B6D11' },
                      ].map(({ v, color }, i) => (
                        <td key={i} className="px-2 py-2 text-right font-medium w-[72px]" style={{ color }}>
                          {v != null ? v.toLocaleString('pt-BR') : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-2 py-2 w-[90px]">
                        {pctPrev != null ? <MiniBar pct={pctPrev} /> : <span className="text-gray-300 text-[10px] block text-center">—</span>}
                      </td>
                      <td className="px-2 py-2 w-[90px]">
                        {pctPlan != null ? <MiniBar pct={pctPlan} /> : <span className="text-gray-300 text-[10px] block text-center">—</span>}
                      </td>
                    </>
                  )}
                  {/* Ações */}
                  <td className="px-2 py-2 text-center w-[100px]">
                    {isDeleting ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleDelete(c.id)} disabled={deleting}
                          className="text-[9px] font-bold text-red-600 border border-red-300 rounded px-1.5 py-0.5 hover:bg-red-50 disabled:opacity-50">
                          {deleting ? '...' : 'Confirmar'}
                        </button>
                        <button onClick={() => setDeleteId(null)} className="text-gray-400 hover:text-gray-600 text-[11px]">✕</button>
                      </div>
                    ) : classificacao === 'PARADAS' ? (
                      <div className="flex items-center justify-center gap-1">
                        <ABtn onClick={() => setModalEditar(c)} title="Editar dados cadastrais" color="green">✎</ABtn>
                        <ABtn onClick={() => router.push(`/acordos/hh/paradas/${c.id}`)} title="Lançar / Controle de HH" color="gray">+ HH</ABtn>
                        <ABtn onClick={() => setDeleteId(c.id)} title="Excluir lançamento" color="red">🗑</ABtn>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <ABtn onClick={() => setModalVisualizar(c)} title="Visualizar lançamentos" color="blue">👁</ABtn>
                        <ABtn onClick={() => setModalEditar(c)} title="Editar dados cadastrais" color="green">✎</ABtn>
                        <ABtn onClick={() => setModalLancamento(c)} title="Lançar HH" color="gray">+</ABtn>
                        <ABtn onClick={() => setDeleteId(c.id)} title="Remover do acompanhamento" color="red">🗑</ABtn>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[9px] text-gray-400">ⓘ Verde &lt;90%, Âmbar 90–100%, Vermelho &gt;100% do previsto ou planejado.</p>
        </div>
      </div>

      {novoModal && (
        <NovoLancamentoModal
          onClose={() => setNovoModal(false)}
          onSelect={c => {
            setNovoModal(false)
            if (classificacao === 'PARADAS') setModalUcr(c)
            else setModalLancamento(c)
          }}
          classificacao={classificacao}
        />
      )}
      {modalUcr && (
        <UcrConfigModal
          contrato={modalUcr}
          onClose={() => setModalUcr(null)}
        />
      )}
      {modalLancamento && (
        <LancamentoHhModal
          contrato={modalLancamento}
          onClose={() => setModalLancamento(null)}
          onSuccess={() => { onRefresh() }}
        />
      )}
      {modalEditar && (
        <EditarContratoHhModal
          contrato={modalEditar}
          clientes={clientes}
          responsaveis={responsaveis}
          onClose={() => setModalEditar(null)}
          onSuccess={() => { setModalEditar(null); onRefresh() }}
        />
      )}
      {modalVisualizar && (
        <VisualizarContratoHhModal
          contrato={modalVisualizar}
          onClose={() => setModalVisualizar(null)}
        />
      )}
    </>
  )
}

// ─── Visão Resumo ─────────────────────────────────────────────────────────────

function barColors(pct: number) {
  if (pct > 100) return { text: '#DC2626', bg: '#EF4444' }
  if (pct >= 90)  return { text: '#CA8A04', bg: '#EAB308' }
  return { text: '#16A34A', bg: '#22C55E' }
}

function VisaoResumo({ contratos, opts }: { contratos: ContratoHh[]; opts: ReturnType<typeof useFilterOptions> }) {
  const [filters, setFilters] = useState<FilterState>({})
  const setFilter = (k: string, v: string[]) => setFilters(p => ({ ...p, [k]: v }))
  const selecionados = applyFilters(contratos, filters)

  const mesData = useMemo(() => {
    const map = new Map<string, { previsto: number; planejado: number; realizado: number | null; label: string }>()
    for (const c of selecionados) {
      if (!c.lancamento_atual) continue
      for (const { mes, ano } of gerarMeses(c.lancamento_atual.data_inicio.split('T')[0], c.lancamento_atual.data_fim.split('T')[0])) {
        const k = `${ano}-${String(mes).padStart(2,'0')}`
        const ex = map.get(k) ?? { previsto: 0, planejado: 0, realizado: null, label: `${MESES_LABELS[mes-1]}/${String(ano).slice(2)}` }
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

  const labels  = mesData.map(m => m.label)
  const cumPrev = mesData.reduce<number[]>((acc, m) => { const l = acc.length ? acc[acc.length-1] : 0; return [...acc, l + m.previsto] }, [])
  const cumPlan = mesData.reduce<number[]>((acc, m) => { const l = acc.length ? acc[acc.length-1] : 0; return [...acc, l + m.planejado] }, [])
  const cumReal = mesData.reduce<(number|null)[]>((acc, m) => { const l = acc.length ? (acc[acc.length-1] ?? 0) : 0; return [...acc, m.realizado != null ? l + m.realizado : null] }, [])

  const loc = (n: number) => n.toLocaleString('pt-BR')

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

  const makeSeries = (monthly: boolean) => ({
    labels,
    datasets: [
      { label: 'Previsto',  data: monthly ? mesData.map(m => m.previsto)  : cumPrev, borderColor: '#185FA5', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6,3], tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#185FA5', spanGaps: true  },
      { label: 'Planejado', data: monthly ? mesData.map(m => m.planejado) : cumPlan, borderColor: '#BA7517', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4,2], tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#BA7517', spanGaps: true  },
      { label: 'Realizado', data: monthly ? mesData.map(m => m.realizado) : cumReal, borderColor: '#16A34A', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, pointRadius: 2.5, pointBackgroundColor: '#16A34A', spanGaps: false },
    ],
  })

  // Tabela: desvio mensal (realizado_mes vs previsto_mes / planejado_mes)
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

  const hasData = selecionados.length > 0 && selecionados.some(c => c.tem_lancamento)

  return (
    <div className="space-y-4">
      <Filters opts={opts} filters={filters} onChange={setFilter} />

      {!hasData ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-4 py-3 rounded-md">
          Nenhum contrato com lançamento de HH corresponde aos filtros selecionados.
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Card 1 — HH Previsto */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="#185FA5" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-normal text-gray-500 mb-1">HH Previsto</p>
                <p className="text-[30px] font-bold text-[#185FA5] leading-none tracking-tight">
                  {totPrev > 0 ? loc(totPrev) : '—'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5">contrato completo</p>
              </div>
            </div>

            {/* Card 2 — HH Planejado Acumulado */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="#BA7517" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-normal text-gray-500 mb-1">HH Planejado Acumulado</p>
                <p className="text-[30px] font-bold text-[#BA7517] leading-none tracking-tight">
                  {totPlan > 0 ? loc(totPlan) : '—'}
                </p>
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

            {/* Card 3 — HH Realizado Acumulado */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="#16A34A" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-normal text-gray-500 mb-1">HH Realizado Acumulado</p>
                <p className="text-[30px] font-bold text-[#16A34A] leading-none tracking-tight">
                  {totReal != null ? loc(totReal) : '—'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {totReal != null ? 'acumulado até o último lançamento' : 'sem lançamento realizado'}
                </p>
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

          {mesData.length > 0 && (
            <>
              {/* ── Gráficos ── */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Mensal</p>
                <p className="text-[11px] text-gray-400 mb-3">Comparativo mês a mês</p>
                {chartLegend}
                <div style={{ height: 230 }}><Line data={makeSeries(true)} options={chartOpts} /></div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Acumulado</p>
                <p className="text-[11px] text-gray-400 mb-3">Progressão acumulada ao longo do contrato</p>
                {chartLegend}
                <div style={{ height: 230 }}><Line data={makeSeries(false)} options={chartOpts} /></div>
              </div>

              {/* ── Tabela ── */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                      {tabelaRows.map((row, i) => {
                        const rcPrev = row.pctRealMes  != null ? barColors(row.pctRealMes).text  : undefined
                        const rcAcum = row.pctRealAcum != null ? barColors(row.pctRealAcum).text : undefined
                        const dcPrev = row.desvPrev != null ? (row.desvPrev <= 0 ? '#16A34A' : '#DC2626') : undefined
                        const dcPlan = row.desvPlan != null ? (row.desvPlan <= 0 ? '#16A34A' : '#DC2626') : undefined
                        return (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-gray-700">{row.label}</td>
                            <td className="px-4 py-2.5 text-right text-[#185FA5]">{loc(row.previsto)}</td>
                            <td className="px-4 py-2.5 text-right text-[#BA7517]">{loc(row.planejado)}</td>
                            <td className="px-4 py-2.5 text-right font-bold" style={{ color: rcPrev ?? '#9CA3AF' }}>
                              {row.realizado != null ? loc(row.realizado) : <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#185FA5]">{loc(row.prevAcum)}</td>
                            <td className="px-4 py-2.5 text-right text-[#BA7517]">{loc(row.planAcum)}</td>
                            <td className="px-4 py-2.5 text-right font-bold" style={{ color: rcAcum ?? '#9CA3AF' }}>
                              {row.realAcum != null ? loc(row.realAcum) : <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold" style={{ color: dcPrev }}>
                              {row.desvPrev != null
                                ? `${row.desvPrev > 0 ? '+' : ''}${row.desvPrev.toFixed(1)}%`
                                : <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold" style={{ color: dcPlan }}>
                              {row.desvPlan != null
                                ? `${row.desvPlan > 0 ? '+' : ''}${row.desvPlan.toFixed(1)}%`
                                : <span className="text-slate-300 font-normal">—</span>}
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
                        {/* Desvio total Prev x Real */}
                        {(() => {
                          const d = totPrev > 0 && totReal != null ? ((totReal - totPrev) / totPrev) * 100 : null
                          return (
                            <td className="px-4 py-3 text-right" style={{ color: d != null ? (d <= 0 ? '#16A34A' : '#DC2626') : undefined }}>
                              {d != null ? `${d > 0 ? '+' : ''}${d.toFixed(1)}%` : '—'}
                            </td>
                          )
                        })()}
                        {/* Desvio total Plan x Real */}
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
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Categoria = 'obras' | 'paradas'
type Visao    = 'contratos' | 'resumo'

export default function ControleHhPage() {
  const searchParams = useSearchParams()
  const [categoria, setCategoria] = useState<Categoria>(
    () => searchParams.get('tab') === 'paradas' ? 'paradas' : 'obras'
  )
  const [visao,     setVisao]     = useState<Visao>('contratos')
  const [contratos, setContratos] = useState<ContratoHh[]>([])
  const [loading,   setLoading]   = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const cls = categoria === 'obras' ? 'OBRAS' : 'PARADAS'
      const res = await fetch(`/api/acordos/hh?classificacao=${cls}`)
      const json = await res.json()
      setContratos(json.data ?? [])
    } finally { setLoading(false) }
  }, [categoria])

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

      <>
        {categoria === 'obras' && (
          <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 mb-3 self-start flex-shrink-0">
            {([['contratos','Contratos'],['resumo','Resumo']] as [Visao,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setVisao(k)}
                className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-full transition-colors',
                  visao === k ? 'bg-green-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {l}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
        ) : categoria === 'paradas' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <VisaoContratos
              contratos={contratos}
              opts={opts}
              onRefresh={fetchData}
              classificacao="PARADAS"
            />
          </div>
        ) : visao === 'contratos' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <VisaoContratos
              contratos={contratos}
              opts={opts}
              onRefresh={fetchData}
              classificacao="OBRAS"
            />
          </div>
        ) : (
          <VisaoResumo contratos={contratos} opts={opts} />
        )}
      </>
    </div>
  )
}
