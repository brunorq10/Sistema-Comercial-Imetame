'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MesLancamento {
  mes: number; ano: number; hh_previsto: number | null; hh_planejado: number | null
}
interface Lancamento {
  id: number; versao: number; data_inicio: string; data_fim: string
  motivo: string | null; created_at: string; criador: string; meses: MesLancamento[]
}
interface Realizado {
  id: number; mes: number; ano: number; hh_realizado: number; observacoes: string | null
}
interface ContratoHhItem {
  id: number; indice: string; num_os: string | null; cliente: { nome: string }; descricao: string | null
  lancamento_atual: Lancamento | null
  realizados: Realizado[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function gerarMeses(inicio: string, fim: string): { mes: number; ano: number }[] {
  const result: { mes: number; ano: number }[] = []
  const d = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T00:00:00')
  while (d <= f) {
    result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
    d.setMonth(d.getMonth() + 1)
  }
  return result
}

function calcMeses(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0
  const ms = gerarMeses(inicio, fim)
  return ms.length
}

function fmtMes(mes: number, ano: number) {
  return `${MESES_LABELS[mes - 1]}/${String(ano).slice(2)}`
}

function formatRev(versao: number) {
  return `Rev${String(versao - 1).padStart(2, '0')}`
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface Props {
  contrato: ContratoHhItem
  onClose: () => void
  onSuccess: () => void
}

type TabKey = 'plano' | 'realizado' | 'historico'

export function LancamentoHhModal({ contrato, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<TabKey>('plano')
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [realizados, setRealizados] = useState<Realizado[]>(contrato.realizados ?? [])
  const [loadingData, setLoadingData] = useState(false)

  // ── Aba Plano ──────────────────────────────────────────────────────────────
  const lancAtual = contrato.lancamento_atual
  const [dataInicio,  setDataInicio]  = useState(lancAtual?.data_inicio?.split('T')[0] ?? '')
  const [dataFim,     setDataFim]     = useState(lancAtual?.data_fim?.split('T')[0] ?? '')
  const [motivo,      setMotivo]      = useState('')
  const [hhPrevisto,  setHhPrevisto]  = useState<Record<string, string>>({})
  const [hhPlanejado, setHhPlanejado] = useState<Record<string, string>>({})
  const [loadingPlano, setLoadingPlano] = useState(false)
  const [errorPlano,   setErrorPlano]   = useState<string | null>(null)

  // ── Aba Realizado ──────────────────────────────────────────────────────────
  const [mesRef,       setMesRef]       = useState('')
  const [hhReal,       setHhReal]       = useState('')
  const [obsReal,      setObsReal]      = useState('')
  const [loadingReal,  setLoadingReal]  = useState(false)
  const [errorReal,    setErrorReal]    = useState<string | null>(null)

  // Pre-fill plan values from current lancamento
  useEffect(() => {
    if (!lancAtual) return
    const map: Record<string, string> = {}
    const mapP: Record<string, string> = {}
    for (const m of lancAtual.meses) {
      const k = `${m.ano}-${m.mes}`
      if (m.hh_previsto  != null) map[k]  = String(m.hh_previsto)
      if (m.hh_planejado != null) mapP[k] = String(m.hh_planejado)
    }
    setHhPrevisto(map)
    setHhPlanejado(mapP)
  }, [lancAtual])

  const fetchLancamentos = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch(`/api/acordos/hh/${contrato.id}/lancamento`)
      const json = await res.json()
      if (json.data) setLancamentos(json.data)
    } finally { setLoadingData(false) }
  }, [contrato.id])

  useEffect(() => { fetchLancamentos() }, [fetchLancamentos])

  const mesesPeriodo = dataInicio && dataFim ? gerarMeses(dataInicio, dataFim) : []

  // ── Salvar plano ────────────────────────────────────────────────────────────
  const handleSalvarPlano = async () => {
    if (!dataInicio || !dataFim) { setErrorPlano('Informe data início e fim'); return }
    if (mesesPeriodo.length === 0) { setErrorPlano('Período inválido'); return }
    if (lancAtual && !motivo.trim()) { setErrorPlano('Informe o motivo da alteração'); return }

    setLoadingPlano(true); setErrorPlano(null)
    try {
      const meses = mesesPeriodo.map(({ mes, ano }) => {
        const k = `${ano}-${mes}`
        return { mes, ano, hh_previsto: Number(hhPrevisto[k]) || 0, hh_planejado: Number(hhPlanejado[k]) || 0 }
      })
      const res = await fetch(`/api/acordos/hh/${contrato.id}/lancamento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_inicio: dataInicio, data_fim: dataFim, motivo: motivo || undefined, meses }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorPlano(json.error ?? 'Erro ao salvar'); return }
      await fetchLancamentos()
      onSuccess()
      setMotivo('')
    } finally { setLoadingPlano(false) }
  }

  // ── Salvar realizado ────────────────────────────────────────────────────────
  const handleSalvarRealizado = async () => {
    if (!mesRef) { setErrorReal('Selecione o mês de referência'); return }
    if (!hhReal || Number(hhReal) < 0) { setErrorReal('Informe o HH realizado'); return }
    const [ano, mes] = mesRef.split('-').map(Number)
    setLoadingReal(true); setErrorReal(null)
    try {
      const res = await fetch(`/api/acordos/hh/${contrato.id}/realizado`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, ano, hh_realizado: Number(hhReal), observacoes: obsReal || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorReal(json.error ?? 'Erro ao salvar'); return }
      // Update local realizados list
      setRealizados(prev => {
        const filtered = prev.filter(r => !(r.mes === mes && r.ano === ano))
        return [...filtered, { id: json.data.id, mes, ano, hh_realizado: Number(hhReal), observacoes: obsReal || null }]
          .sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)
      })
      onSuccess()
      setHhReal(''); setObsReal('')
    } finally { setLoadingReal(false) }
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'plano',     label: 'HH Previsto e Planejado' },
    { key: 'realizado', label: 'HH Realizado' },
    { key: 'historico', label: 'Histórico de revisões' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#1B5E20] text-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold">{contrato.indice}</h2>
              <p className="text-white/70 text-[11px] mt-0.5">
                {[contrato.num_os && `OS ${contrato.num_os}`, contrato.cliente.nome, contrato.descricao]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-[20px] leading-none">×</button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-t transition-colors',
                  tab === t.key ? 'bg-white text-green-dark' : 'text-white/70 hover:text-white hover:bg-white/10')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Aba Plano ─────────────────────────────────────────────────── */}
          {tab === 'plano' && (
            <div>
              {lancAtual && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-2 rounded-md mb-4 flex items-center gap-2">
                  <span className="text-amber-500 font-bold">⚠</span>
                  Já existe um lançamento ({formatRev(lancAtual.versao)}). Qualquer alteração criará uma nova revisão automaticamente ao salvar.
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Data Início *</label>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Data Fim *</label>
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total de Meses</label>
                  <div className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[11px] bg-[#EEF7EE] text-auto-value font-bold">
                    {dataInicio && dataFim ? calcMeses(dataInicio, dataFim) : '—'}
                  </div>
                </div>
              </div>

              {lancAtual && (
                <div className="mb-4">
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Motivo da alteração *</label>
                  <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo da revisão..."
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
                </div>
              )}

              {mesesPeriodo.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[110px] border-r border-gray-200">Indicador</th>
                        {mesesPeriodo.map(({ mes, ano }) => (
                          <th key={`${ano}-${mes}`} className="px-2 py-2 text-center text-[9px] text-gray-500 uppercase font-semibold min-w-[70px]">
                            {fmtMes(mes, ano)}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center text-[9px] text-green-dark uppercase font-bold bg-green-light border-l border-gray-200">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* HH Previsto */}
                      <tr className="border-t border-gray-100">
                        <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-[#185FA5] border-r border-gray-100">HH Previsto</td>
                        {mesesPeriodo.map(({ mes, ano }) => {
                          const k = `${ano}-${mes}`
                          return (
                            <td key={k} className="px-1 py-1 text-center">
                              <input type="number" min="0" value={hhPrevisto[k] ?? ''}
                                onChange={e => setHhPrevisto(p => ({ ...p, [k]: e.target.value }))}
                                className="w-16 border border-gray-200 rounded px-1.5 py-1 text-center text-[11px] focus:outline-none focus:border-blue-400" />
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-center font-bold text-[#185FA5] bg-green-light border-l border-gray-200">
                          {mesesPeriodo.reduce((s, { mes, ano }) => s + (Number(hhPrevisto[`${ano}-${mes}`]) || 0), 0).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                      {/* HH Planejado */}
                      <tr className="border-t border-gray-100">
                        <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-[#BA7517] border-r border-gray-100">HH Planejado</td>
                        {mesesPeriodo.map(({ mes, ano }) => {
                          const k = `${ano}-${mes}`
                          return (
                            <td key={k} className="px-1 py-1 text-center">
                              <input type="number" min="0" value={hhPlanejado[k] ?? ''}
                                onChange={e => setHhPlanejado(p => ({ ...p, [k]: e.target.value }))}
                                className="w-16 border border-gray-200 rounded px-1.5 py-1 text-center text-[11px] focus:outline-none focus:border-amber-400" />
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-center font-bold text-[#BA7517] bg-green-light border-l border-gray-200">
                          {mesesPeriodo.reduce((s, { mes, ano }) => s + (Number(hhPlanejado[`${ano}-${mes}`]) || 0), 0).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {errorPlano && <p className="text-red-600 text-[11px] mt-3">{errorPlano}</p>}
            </div>
          )}

          {/* ── Aba Realizado ──────────────────────────────────────────────── */}
          {tab === 'realizado' && (
            <div>
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] px-3 py-2 rounded-md mb-4 flex items-center gap-2">
                <span>ℹ</span> O lançamento de HH Realizado pode ser feito e ajustado a qualquer momento.
              </div>

              {!lancAtual ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded-md mb-4">
                  Registre primeiro o HH Previsto e Planejado para habilitar os lançamentos de realizado.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Mês de referência *</label>
                      <select value={mesRef} onChange={e => setMesRef(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30">
                        <option value="">Selecione...</option>
                        {gerarMeses(lancAtual.data_inicio.split('T')[0], lancAtual.data_fim.split('T')[0]).map(({ mes, ano }) => (
                          <option key={`${ano}-${mes}`} value={`${ano}-${mes}`}>{fmtMes(mes, ano)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">HH Realizado *</label>
                      <input type="number" min="0" value={hhReal} onChange={e => setHhReal(e.target.value)} placeholder="Ex: 1.200"
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Observações</label>
                      <input type="text" value={obsReal} onChange={e => setObsReal(e.target.value)} placeholder="Opcional..."
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
                    </div>
                  </div>
                  {errorReal && <p className="text-red-600 text-[11px] mb-3">{errorReal}</p>}
                  <button onClick={handleSalvarRealizado} disabled={loadingReal}
                    className="bg-green-primary text-white text-[11px] font-semibold px-4 py-1.5 rounded-md hover:bg-green-dark transition-colors disabled:opacity-60 mb-6">
                    {loadingReal ? 'Salvando...' : 'Salvar lançamento'}
                  </button>

                  {/* Tabela de realizados */}
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold">Mês</th>
                          <th className="px-3 py-2 text-right text-[9px] text-gray-500 uppercase font-semibold">HH Previsto</th>
                          <th className="px-3 py-2 text-right text-[9px] text-gray-500 uppercase font-semibold">HH Planejado</th>
                          <th className="px-3 py-2 text-right text-[9px] text-gray-500 uppercase font-semibold">HH Realizado</th>
                          <th className="px-3 py-2 text-right text-[9px] text-gray-500 uppercase font-semibold">Δ Plan vs Real</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gerarMeses(lancAtual.data_inicio.split('T')[0], lancAtual.data_fim.split('T')[0]).map(({ mes, ano }) => {
                          const k = `${ano}-${mes}`
                          const mesData = lancAtual.meses.find(m => m.mes === mes && m.ano === ano)
                          const realData = realizados.find(r => r.mes === mes && r.ano === ano)
                          const prev = mesData?.hh_previsto ?? null
                          const plan = mesData?.hh_planejado ?? null
                          const real = realData?.hh_realizado ?? null
                          const delta = plan != null && real != null ? real - plan : null
                          const deltaFmt = delta != null
                            ? `${delta >= 0 ? '+' : ''}${delta.toLocaleString('pt-BR')} (${plan ? ((delta / plan) * 100).toFixed(1) : '—'}%)`
                            : '—'
                          return (
                            <tr key={k} className="border-t border-gray-50 hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{fmtMes(mes, ano)}</td>
                              <td className="px-3 py-2 text-right text-[#185FA5]">{prev?.toLocaleString('pt-BR') ?? '—'}</td>
                              <td className="px-3 py-2 text-right text-[#BA7517]">{plan?.toLocaleString('pt-BR') ?? '—'}</td>
                              <td className="px-3 py-2 text-right text-[#3B6D11] font-semibold">{real?.toLocaleString('pt-BR') ?? '—'}</td>
                              <td className={cn('px-3 py-2 text-right font-semibold',
                                delta == null ? 'text-gray-400' : delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-700' : 'text-gray-600')}>
                                {deltaFmt}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Aba Histórico ──────────────────────────────────────────────── */}
          {tab === 'historico' && (
            <div>
              {loadingData ? (
                <p className="text-center text-gray-400 py-6 text-sm">Carregando...</p>
              ) : lancamentos.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">Nenhum lançamento registrado.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lancamentos.map((l, idx) => {
                    const isAtual = idx === 0
                    const totalPrev = l.meses.reduce((s, m) => s + (m.hh_previsto ?? 0), 0)
                    const totalPlan = l.meses.reduce((s, m) => s + (m.hh_planejado ?? 0), 0)
                    return (
                      <div key={l.id} className={cn('border rounded-lg p-4', isAtual ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white opacity-75')}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                            isAtual ? 'bg-green-primary text-white' : 'bg-blue-100 text-blue-700')}>
                            {formatRev(l.versao)}{isAtual ? ' • atual' : ''}
                          </span>
                          <span className="text-[10px] text-gray-500">{new Date(l.created_at).toLocaleDateString('pt-BR')} às {new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-[10px] text-gray-400">por {l.criador}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-[11px]">
                          <div><p className="text-[9px] text-gray-400 uppercase">HH Previsto total</p><p className="font-bold text-[#185FA5]">{totalPrev.toLocaleString('pt-BR')}</p></div>
                          <div><p className="text-[9px] text-gray-400 uppercase">HH Planejado total</p><p className="font-bold text-[#BA7517]">{totalPlan.toLocaleString('pt-BR')}</p></div>
                          <div><p className="text-[9px] text-gray-400 uppercase">Período</p><p className="font-medium">{new Date(l.data_inicio).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })} → {new Date(l.data_fim).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</p></div>
                          <div><p className="text-[9px] text-gray-400 uppercase">Motivo</p><p className="font-medium text-gray-600">{l.motivo ?? (l.versao === 1 ? 'Lançamento inicial' : '—')}</p></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3 flex justify-end gap-2 flex-shrink-0 bg-gray-50">
          <button onClick={onClose} className="border border-gray-300 text-gray-600 rounded-md px-4 py-1.5 text-[11px] font-medium hover:bg-gray-100 transition-colors">
            Fechar
          </button>
          {tab === 'plano' && (
            <button onClick={handleSalvarPlano} disabled={loadingPlano}
              className="bg-green-primary text-white rounded-md px-4 py-1.5 text-[11px] font-semibold hover:bg-green-dark transition-colors disabled:opacity-60">
              {loadingPlano ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
