'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IntegerInput } from '@/components/ui/Input'
import { barColors } from '@/lib/hh'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MesPlano { mes: number; ano: number; hh_previsto: number | null; hh_planejado: number | null }

interface DiaApi {
  data: string
  efetivo_normal: number | null
  horas_normais: number | null
  efetivo_extra: number | null
  horas_extra_valor: number | null
  horas_extras: number | null
  hh_total: number
}

interface RealizadoDiarioObrasProps {
  contratoId: number
  mesesContrato: { mes: number; ano: number }[]
  mesesPlano: MesPlano[]
  onFechar: () => void
  onSalvo: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const HORAS_NORMAL_DIA = 8.8

function isoDate(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

function primeiroDiaSemana(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
}

function fmtHoras(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r)
    ? r.toLocaleString('pt-BR')
    : r.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const loc = (n: number) => n.toLocaleString('pt-BR')

// ─── Componente ──────────────────────────────────────────────────────────────

export function RealizadoDiarioObras({ contratoId, mesesContrato, mesesPlano, onFechar, onSalvo }: RealizadoDiarioObrasProps) {
  const [{ mes: mesSel, ano: anoSel }, setMesAno] = useState(() => {
    const hoje = new Date()
    const atual = mesesContrato.find(m => m.mes === hoje.getMonth() + 1 && m.ano === hoje.getFullYear())
    return atual ?? mesesContrato[0] ?? { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
  })

  const [dias, setDias] = useState<Record<string, DiaApi>>({})
  const [loadingDias, setLoadingDias] = useState(true)

  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [formEfetivoNormal, setFormEfetivoNormal] = useState('')
  const [formEfetivoExtra, setFormEfetivoExtra] = useState('')
  const [formHorasExtraValor, setFormHorasExtraValor] = useState('1')
  const [salvandoDia, setSalvandoDia] = useState(false)
  const [erroDia, setErroDia] = useState<string | null>(null)

  const carregarDias = useCallback(async () => {
    setLoadingDias(true)
    try {
      const res = await fetch(`/api/acordos/hh/${contratoId}/realizado-dia?ano=${anoSel}&mes=${mesSel}`)
      const json = await res.json()
      const lista: DiaApi[] = json.data ?? []
      setDias(Object.fromEntries(lista.map(d => [d.data, d])))
    } finally { setLoadingDias(false) }
  }, [contratoId, anoSel, mesSel])

  useEffect(() => { carregarDias() }, [carregarDias])

  const idx = mesesContrato.findIndex(m => m.mes === mesSel && m.ano === anoSel)
  const temAnterior = idx > 0
  const temProximo = idx >= 0 && idx < mesesContrato.length - 1

  function irMesAnterior() { if (temAnterior) { setDiaSelecionado(null); setMesAno(mesesContrato[idx - 1]) } }
  function irProximoMes() { if (temProximo) { setDiaSelecionado(null); setMesAno(mesesContrato[idx + 1]) } }

  const horasNormaisMes = Object.values(dias).reduce((s, d) => s + (d.horas_normais ?? 0), 0)
  const horasExtrasMes  = Object.values(dias).reduce((s, d) => s + (d.horas_extras ?? 0), 0)
  const hhRealizadoMes  = Math.round(horasNormaisMes + horasExtrasMes)

  const planoMes = mesesPlano.find(m => m.mes === mesSel && m.ano === anoSel)
  const previsto  = planoMes?.hh_previsto  ?? null
  const planejado = planoMes?.hh_planejado ?? null
  const pctRealPlan = planejado != null && planejado > 0 ? (hhRealizadoMes / planejado) * 100 : null

  function abrirDia(iso: string) {
    const d = dias[iso]
    setDiaSelecionado(iso)
    setFormEfetivoNormal(d?.efetivo_normal != null ? String(d.efetivo_normal) : '')
    setFormEfetivoExtra(d?.efetivo_extra != null ? String(d.efetivo_extra) : '')
    setFormHorasExtraValor(d?.horas_extra_valor != null ? String(d.horas_extra_valor).replace('.', ',') : '1')
    setErroDia(null)
  }

  const efetivoNormalNum = Number(formEfetivoNormal) || 0
  const horasNormaisCalc = efetivoNormalNum * HORAS_NORMAL_DIA
  const efetivoExtraNum = Number(formEfetivoExtra) || 0
  const horasExtraValorNum = (() => {
    if (formHorasExtraValor === '') return 1
    const n = parseFloat(formHorasExtraValor.replace(',', '.'))
    return isNaN(n) ? 0 : n
  })()
  const horasExtrasCalc = efetivoExtraNum * horasExtraValorNum
  const hhDiaCalc = horasNormaisCalc + horasExtrasCalc

  async function salvarDia() {
    if (!diaSelecionado) return
    setSalvandoDia(true); setErroDia(null)
    try {
      const res = await fetch(`/api/acordos/hh/${contratoId}/realizado-dia`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: diaSelecionado,
          efetivo_normal: formEfetivoNormal === '' ? null : efetivoNormalNum,
          efetivo_extra: formEfetivoExtra === '' ? null : efetivoExtraNum,
          horas_extra_valor: horasExtraValorNum,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErroDia(json.error ?? 'Erro ao salvar'); return }
      await carregarDias()
      setDiaSelecionado(null)
      onSalvo()
    } finally { setSalvandoDia(false) }
  }

  const celulas = useMemo(() => {
    const total = diasNoMes(anoSel, mesSel)
    const offset = primeiroDiaSemana(anoSel, mesSel)
    const arr: (number | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= total; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [anoSel, mesSel])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <div>
          <p className="text-[11px] font-bold text-green-800 uppercase tracking-wide">Lançamento diário de HH Realizado</p>
          <p className="text-[10px] text-green-700 mt-0.5">Clique em um dia do calendário para lançar ou editar o efetivo — o total do mês é calculado automaticamente pela soma dos dias.</p>
        </div>
        <button onClick={onFechar}
          className="text-[11px] px-4 py-1.5 bg-green-primary text-white rounded-md hover:bg-green-dark flex-shrink-0">
          Concluir
        </button>
      </div>

      {/* ── Faixa de resumo (5 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Horas Normais" sub="calculado — mês" value={fmtHoras(horasNormaisMes)} color="#185FA5" bg="bg-blue-50" />
        <SummaryCard label="Horas Extras" sub="calculado — mês" value={fmtHoras(horasExtrasMes)} color="#BA7517" bg="bg-amber-50" />
        <SummaryCard label="HH Realizado" sub="soma dos dias (mês)" value={loc(hhRealizadoMes)} color="#16A34A" bg="bg-green-50" />
        <SummaryCard label="HH Previsto" sub="mensal" value={previsto != null ? loc(previsto) : '—'} color="#185FA5" bg="bg-blue-50" />
        <SummaryCard label="HH Planejado" sub="mensal" value={planejado != null ? loc(planejado) : '—'} color="#BA7517" bg="bg-amber-50">
          {pctRealPlan != null && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">% do plan.</span>
                <span className="text-[10px] font-bold" style={{ color: barColors(pctRealPlan).text }}>{pctRealPlan.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pctRealPlan, 100)}%`, backgroundColor: barColors(pctRealPlan).bg }} />
              </div>
            </div>
          )}
        </SummaryCard>
      </div>

      {/* ── Calendário + painel do dia ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-center gap-4 mb-3">
          <button onClick={irMesAnterior} disabled={!temAnterior}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
          <p className="text-[13px] font-bold text-gray-700 w-40 text-center">{MESES_FULL[mesSel - 1]} {anoSel}</p>
          <button onClick={irProximoMes} disabled={!temProximo}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className={cnLoading(loadingDias, 'flex-1 min-w-0')}>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-[9px] font-semibold text-gray-400 uppercase text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {celulas.map((dia, i) => {
                if (dia == null) return <div key={i} />
                const iso = isoDate(anoSel, mesSel, dia)
                const info = dias[iso]
                const ativo = diaSelecionado === iso
                return (
                  <button key={iso} onClick={() => abrirDia(iso)}
                    className={cn(
                      'h-16 border rounded-md p-1 flex flex-col text-left transition-colors',
                      ativo ? 'border-green-400 bg-green-50/60 ring-1 ring-green-300' : 'border-slate-100 hover:border-green-300 hover:bg-green-50/30',
                    )}>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-gray-400">{dia}</span>
                      {info && <span className="text-[11px] font-bold text-green-700">{fmtHoras(info.hh_total)}</span>}
                    </div>
                    {info ? (
                      <div className="mt-auto grid grid-cols-2 gap-1 text-[8px] leading-tight">
                        <div className="text-[#185FA5]">
                          <div>{info.efetivo_normal ?? 0}p</div>
                          <div>{fmtHoras(info.horas_normais ?? 0)}h</div>
                        </div>
                        <div className="text-[#BA7517] text-right">
                          <div>{info.efetivo_extra ?? 0}p</div>
                          <div>{fmtHoras(info.horas_extras ?? 0)}h</div>
                        </div>
                      </div>
                    ) : <div className="flex-1" />}
                  </button>
                )
              })}
            </div>
          </div>

          {diaSelecionado && (
            <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4 lg:static lg:bg-transparent lg:p-0 lg:block lg:flex-shrink-0 lg:w-72">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-sm lg:max-w-none lg:w-72 max-h-[90vh] overflow-y-auto p-4">
                <p className="text-[12px] font-bold text-gray-700 mb-3 capitalize">
                  {new Date(diaSelecionado + 'T00:00:00.000Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })}
                </p>

                <div className="border border-blue-100 bg-blue-50/40 rounded-lg p-3 mb-3">
                  <p className="text-[9px] font-bold text-[#185FA5] uppercase tracking-wide mb-2">Hora normal</p>
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Efetivo</label>
                  <IntegerInput value={formEfetivoNormal} onChange={setFormEfetivoNormal}
                    className="w-full border border-blue-200 rounded-md px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <p className="text-[10px] text-gray-500 mt-2">{efetivoNormalNum} × 8,8h = <span className="font-bold text-[#185FA5]">{fmtHoras(horasNormaisCalc)}h</span></p>
                </div>

                <div className="border border-amber-100 bg-amber-50/40 rounded-lg p-3 mb-3">
                  <p className="text-[9px] font-bold text-[#BA7517] uppercase tracking-wide mb-2">Hora extra</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Efetivo</label>
                      <IntegerInput value={formEfetivoExtra} onChange={setFormEfetivoExtra}
                        className="w-full border border-amber-200 rounded-md px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Horas/pessoa</label>
                      <input type="text" inputMode="decimal" value={formHorasExtraValor}
                        onChange={e => setFormHorasExtraValor(e.target.value)}
                        className="w-full border border-amber-200 rounded-md px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">{efetivoExtraNum} × {loc(horasExtraValorNum)}h = <span className="font-bold text-[#BA7517]">{fmtHoras(horasExtrasCalc)}h</span></p>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-1 mb-3">
                  <div className="flex justify-between text-[11px]"><span className="text-gray-500">Horas normais</span><span className="font-semibold text-[#185FA5]">{fmtHoras(horasNormaisCalc)}h</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-gray-500">Horas extras</span><span className="font-semibold text-[#BA7517]">{fmtHoras(horasExtrasCalc)}h</span></div>
                  <div className="flex justify-between text-[12px] pt-1 border-t border-slate-100"><span className="font-bold text-gray-700">HH do dia</span><span className="font-bold text-green-700">{fmtHoras(hhDiaCalc)}h</span></div>
                </div>

                {erroDia && <p className="text-red-600 text-[11px] mb-2">{erroDia}</p>}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setDiaSelecionado(null)} className="text-[11px] px-4 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600">Cancelar</button>
                  <button onClick={salvarDia} disabled={salvandoDia}
                    className="text-[11px] px-4 py-1.5 bg-green-primary text-white rounded-md hover:bg-green-dark disabled:opacity-60">
                    {salvandoDia ? 'Salvando...' : 'Salvar dia'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes locais ──────────────────────────────────────────────────

function SummaryCard({ label, sub, value, color, bg, children }: {
  label: string; sub: string; value: string; color: string; bg: string; children?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', bg)}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <p className="text-[10px] font-normal text-gray-500 mb-0.5">{label}</p>
      <p className="text-[20px] font-bold leading-none tracking-tight" style={{ color }}>{value}</p>
      <p className="text-[9px] text-gray-400 mt-1">{sub}</p>
      {children}
    </div>
  )
}

function cn(...parts: (string | false | undefined)[]) { return parts.filter(Boolean).join(' ') }
function cnLoading(loading: boolean, base: string) { return loading ? `${base} opacity-50 pointer-events-none` : base }
