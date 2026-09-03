'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, MapPin, User, Building2, Briefcase } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UcrFaixasTabela } from '@/components/acordos/UcrFaixasTabela'
import { usePermissions } from '@/hooks/usePermissions'
import { regiaoPorEstado, classificarUcr, resolverVigencia, UCR_FAIXAS, UCR_REGIOES, type UcrVigencia } from '@/lib/ucr'

// ─── Types ───────────────────────────────────────────────────────────────────

type Etapa = 'PREPARATIVO' | 'PARADA' | 'ACOMP_DESMOB'

interface DiaState {
  efetivo_plan: string
  horas_dia_plan: string
  hh_plan: string
  efetivo_real: string
  horas_dia_real: string
  hh_real: string
}

// Padrão de horas/dia: 9,8 só na fase Parada; Preparativo e Pós Parada usam 8,8
// (mesmo valor já usado para os adicionais de mob./desmob./integ./folga — ver HH_DIA).
// Vale apenas como sugestão inicial da célula vazia — o usuário pode ajustar livremente.
const HORAS_DIA_PARADA = '9,8'
const HORAS_DIA_OUTRAS = '8,8'
function horasDiaPadrao(etapa: Etapa): string {
  return etapa === 'PARADA' ? HORAS_DIA_PARADA : HORAS_DIA_OUTRAS
}
function emptyDia(etapa: Etapa): DiaState {
  const h = horasDiaPadrao(etapa)
  return { efetivo_plan: '', horas_dia_plan: h, hh_plan: '', efetivo_real: '', horas_dia_real: h, hh_real: '' }
}

// Inteiro com separador de milhar enquanto digita: 1234 -> "1.234"
function maskInt(s: string): string {
  const d = s.replace(/\D/g, '')
  return d ? Number(d).toLocaleString('pt-BR') : ''
}

interface ContratoInfo {
  id: number
  numero: string
  descricao: string
  cliente: string
  cliente_final: string | null
  cidade: string | null
  estado: string | null
  escopo: string | null
  responsavel: string
  data_inicio: string | null
  valor_orcado: number
  valor_faturado: number
}

interface FechamentoInfo {
  fechada_em: string | null
  fechada_por_nome: string | null
}

interface ConfigState {
  prep_inicio: string; prep_fim: string
  parada_inicio: string; parada_fim: string
  acomp_inicio: string; acomp_fim: string

  mob_ativo: boolean
  mob_dias_prev: string; mob_dias_real: string

  desmob_ativo: boolean
  desmob_dias_prev: string; desmob_dias_real: string

  integ_ativo: boolean
  integ_dias_prev: string; integ_dias_real: string

  folga_ativo: boolean
  folga_dias_prev: string; folga_dias_real: string
  folga_pessoas_prev: string; folga_pessoas_real: string

  fin_prev_valor_servico: string
  fin_prev_ase: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasEntreDatas(inicio: string, fim: string): string[] {
  if (!inicio || !fim) return []
  const result: string[] = []
  const cur = new Date(inicio + 'T12:00:00')
  const end = new Date(fim + 'T12:00:00')
  while (cur <= end) {
    result.push(cur.toISOString().substring(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function fmtHH(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '–'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v) || !isFinite(v)) return '–'
  return (v * 100).toFixed(1) + '%'
}

function fmtR$(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '–'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
  return `${d.getDate().toString().padStart(2, '0')}\n${dias[d.getDay()]}`
}

function n(v: string): number {
  if (!v || v.trim() === '') return 0
  let s = v.trim()
  if (s.includes(',')) {
    // BR decimal: "1.234,5" or "150.456,99"
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // BR thousands without decimals: "150.456" or "1.234.567"
    s = s.replace(/\./g, '')
  }
  const r = parseFloat(s)
  return isNaN(r) ? 0 : r
}

function fmtCellHH(v: number): string {
  if (v === 0) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function defaultConfig(): ConfigState {
  return {
    prep_inicio: '', prep_fim: '', parada_inicio: '', parada_fim: '', acomp_inicio: '', acomp_fim: '',
    mob_ativo: false, mob_dias_prev: '', mob_dias_real: '',
    desmob_ativo: false, desmob_dias_prev: '', desmob_dias_real: '',
    integ_ativo: false, integ_dias_prev: '', integ_dias_real: '',
    folga_ativo: false, folga_dias_prev: '', folga_dias_real: '', folga_pessoas_prev: '', folga_pessoas_real: '',
    fin_prev_valor_servico: '', fin_prev_ase: '',
  }
}

function configFromApi(c: Record<string, unknown>): ConfigState {
  const d = (v: unknown) => (v ? String(v).substring(0, 10) : '')
  const s = (v: unknown) => (v != null ? String(v) : '')
  const b = (v: unknown) => Boolean(v)
  return {
    prep_inicio: d(c.prep_inicio), prep_fim: d(c.prep_fim),
    parada_inicio: d(c.parada_inicio), parada_fim: d(c.parada_fim),
    acomp_inicio: d(c.acomp_inicio), acomp_fim: d(c.acomp_fim),
    mob_ativo: b(c.mob_ativo), mob_dias_prev: s(c.mob_dias_prev), mob_dias_real: s(c.mob_dias_real),
    desmob_ativo: b(c.desmob_ativo), desmob_dias_prev: s(c.desmob_dias_prev), desmob_dias_real: s(c.desmob_dias_real),
    integ_ativo: b(c.integ_ativo), integ_dias_prev: s(c.integ_dias_prev), integ_dias_real: s(c.integ_dias_real),
    folga_ativo: b(c.folga_ativo), folga_dias_prev: s(c.folga_dias_prev), folga_dias_real: s(c.folga_dias_real),
    folga_pessoas_prev: s(c.folga_pessoas_prev), folga_pessoas_real: s(c.folga_pessoas_real),
    fin_prev_valor_servico: s(c.fin_prev_valor_servico),
    fin_prev_ase: s(c.fin_prev_ase),
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${value ? 'bg-green-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

function EtapaCard({ label, inicio, fim, onChangeInicio, onChangeFim, disabled }: {
  label: string; inicio: string; fim: string
  onChangeInicio: (v: string) => void; onChangeFim: (v: string) => void
  disabled?: boolean
}) {
  const duracao = useMemo(() => diasEntreDatas(inicio, fim).length, [inicio, fim])
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-green-700">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500">Início</label>
          <input type="date" value={inicio} disabled={disabled} onChange={(e) => onChangeInicio(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Fim</label>
          <input type="date" value={fim} disabled={disabled} onChange={(e) => onChangeFim(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500" />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Duração: <span className="font-semibold text-gray-700">{duracao > 0 ? `${duracao} dia${duracao !== 1 ? 's' : ''}` : '–'}</span>
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParadaHhPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { pode } = usePermissions()
  const podeReabrir = pode('acordos.paradas.reabrir')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contrato, setContrato] = useState<ContratoInfo | null>(null)
  const [fechamento, setFechamento] = useState<FechamentoInfo>({ fechada_em: null, fechada_por_nome: null })
  const [cfg, setCfg] = useState<ConfigState>(defaultConfig())
  const [dias, setDias] = useState<Map<string, DiaState>>(new Map())
  const [vigenciasUcr, setVigenciasUcr] = useState<UcrVigencia[]>([])

  const [confirmFechar, setConfirmFechar] = useState(false)
  const [fecharLoading, setFecharLoading] = useState(false)
  const [fecharErro, setFecharErro] = useState<string | null>(null)
  const [confirmReabrir, setConfirmReabrir] = useState(false)
  const [reabrirLoading, setReabrirLoading] = useState(false)
  const [reabrirErro, setReabrirErro] = useState<string | null>(null)

  const fechada = fechamento.fechada_em != null

  useEffect(() => {
    fetch('/api/acordos/hh/paradas/ucr-faixas')
      .then((r) => r.json())
      .then((j) => setVigenciasUcr([...(j.data?.vigentes ?? []), ...(j.data?.historico ?? [])]))
      .catch(() => {})
  }, [])

  const regiaoDoContrato = regiaoPorEstado(contrato?.estado)
  // Faixa fixada pela data de início da Parada — não "a atual" (ver src/lib/ucr.ts).
  const dataReferenciaUcr = cfg.parada_inicio || contrato?.data_inicio || null
  const faixaAtual = dataReferenciaUcr
    ? resolverVigencia(vigenciasUcr, regiaoDoContrato, new Date(dataReferenciaUcr))
    : null
  const valoresPorRegiaoNoPeriodo = useMemo(() => {
    if (!dataReferenciaUcr) return {}
    const data = new Date(dataReferenciaUcr)
    return Object.fromEntries(
      UCR_REGIOES.map((r) => [r.regiao, resolverVigencia(vigenciasUcr, r.regiao, data)]),
    )
  }, [vigenciasUcr, dataReferenciaUcr])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/acordos/hh/paradas/${id}`)
      const json = await res.json()
      if (!json.data) return
      setContrato(json.data.contrato)
      setFechamento({
        fechada_em: json.data.config?.fechada_em ?? null,
        fechada_por_nome: json.data.config?.quemFechou?.nome ?? null,
      })
      if (json.data.config) {
        setCfg(configFromApi(json.data.config as Record<string, unknown>))
        const diasApi = (json.data.config.dias ?? []) as Array<{
          etapa: Etapa; data: string
          efetivo_plan: number | null; horas_dia_plan: number | null; hh_plan: number | null
          efetivo_real: number | null; horas_dia_real: number | null; hh_real: number | null
        }>
        const map = new Map<string, DiaState>()
        const sBr = (v: number | null) => v != null ? String(v).replace('.', ',') : ''
        for (const d of diasApi) {
          const hPadrao = horasDiaPadrao(d.etapa)
          map.set(`${d.etapa}__${d.data.substring(0, 10)}`, {
            efetivo_plan: d.efetivo_plan != null ? d.efetivo_plan.toLocaleString('pt-BR') : '',
            horas_dia_plan: d.horas_dia_plan != null ? sBr(d.horas_dia_plan) : hPadrao,
            hh_plan: d.hh_plan != null ? sBr(d.hh_plan) : '',
            efetivo_real: d.efetivo_real != null ? d.efetivo_real.toLocaleString('pt-BR') : '',
            horas_dia_real: d.horas_dia_real != null ? sBr(d.horas_dia_real) : hPadrao,
            hh_real: d.hh_real != null ? sBr(d.hh_real) : '',
          })
        }
        setDias(map)
      }
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived day lists ──────────────────────────────────────────────────────
  const diasPrep   = useMemo(() => diasEntreDatas(cfg.prep_inicio,   cfg.prep_fim),   [cfg.prep_inicio, cfg.prep_fim])
  const diasParada = useMemo(() => diasEntreDatas(cfg.parada_inicio, cfg.parada_fim), [cfg.parada_inicio, cfg.parada_fim])
  const diasAcomp  = useMemo(() => diasEntreDatas(cfg.acomp_inicio,  cfg.acomp_fim),  [cfg.acomp_inicio, cfg.acomp_fim])

  const getDia = useCallback((etapa: Etapa, data: string): DiaState =>
    dias.get(`${etapa}__${data}`) ?? emptyDia(etapa),
    [dias])

  const setDiaProp = useCallback((etapa: Etapa, data: string, prop: keyof DiaState, value: string) => {
    const key = `${etapa}__${data}`
    setDias((prev) => {
      const next = new Map(prev)
      const cur = next.get(key) ?? emptyDia(etapa)
      const upd = { ...cur, [prop]: value }
      // HHT (dia) = Efetivo × Horas dia — recalculado automaticamente
      const fmtHH = (x: number) => x > 0 ? x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
      if (prop === 'efetivo_plan' || prop === 'horas_dia_plan') {
        upd.hh_plan = fmtHH(n(upd.efetivo_plan) * n(upd.horas_dia_plan))
      }
      if (prop === 'efetivo_real' || prop === 'horas_dia_real') {
        upd.hh_real = fmtHH(n(upd.efetivo_real) * n(upd.horas_dia_real))
      }
      next.set(key, upd)
      return next
    })
  }, [])

  // ── Totals per etapa ───────────────────────────────────────────────────────
  const totPrep = useMemo(() => {
    let sumHhPlan = 0, sumHhReal = 0
    for (const d of diasPrep) { const dia = getDia('PREPARATIVO', d); sumHhPlan += n(dia.hh_plan); sumHhReal += n(dia.hh_real) }
    return { sumHhPlan, sumHhReal, desvio: sumHhReal - sumHhPlan }
  }, [dias, diasPrep, getDia])

  const totParada = useMemo(() => {
    let sumHhPlan = 0, sumHhReal = 0
    for (const d of diasParada) { const dia = getDia('PARADA', d); sumHhPlan += n(dia.hh_plan); sumHhReal += n(dia.hh_real) }
    return { sumHhPlan, sumHhReal, desvio: sumHhReal - sumHhPlan }
  }, [dias, diasParada, getDia])

  const totAcomp = useMemo(() => {
    let sumHhPlan = 0, sumHhReal = 0
    for (const d of diasAcomp) { const dia = getDia('ACOMP_DESMOB', d); sumHhPlan += n(dia.hh_plan); sumHhReal += n(dia.hh_real) }
    return { sumHhPlan, sumHhReal, desvio: sumHhReal - sumHhPlan }
  }, [dias, diasAcomp, getDia])

  // ── Pico efetivo de todo o período (auto-calculado) ────────────────────────
  // Considera as três fases — Preparativo, Parada e Pós Parada —, não apenas a Parada.
  const picoEfetivoPrev = useMemo(() => {
    const etapas: Array<{ etapa: Etapa; dias: string[] }> = [
      { etapa: 'PREPARATIVO', dias: diasPrep }, { etapa: 'PARADA', dias: diasParada }, { etapa: 'ACOMP_DESMOB', dias: diasAcomp },
    ]
    return etapas.reduce((mx, { etapa, dias: ds }) =>
      ds.reduce((mx2, d) => Math.max(mx2, n(getDia(etapa, d).efetivo_plan)), mx), 0)
  }, [dias, diasPrep, diasParada, diasAcomp, getDia])

  const picoEfetivoReal = useMemo(() => {
    const etapas: Array<{ etapa: Etapa; dias: string[] }> = [
      { etapa: 'PREPARATIVO', dias: diasPrep }, { etapa: 'PARADA', dias: diasParada }, { etapa: 'ACOMP_DESMOB', dias: diasAcomp },
    ]
    return etapas.reduce((mx, { etapa, dias: ds }) =>
      ds.reduce((mx2, d) => Math.max(mx2, n(getDia(etapa, d).efetivo_real)), mx), 0)
  }, [dias, diasPrep, diasParada, diasAcomp, getDia])

  // ── Adicionais calculados (prev e real separados) ──────────────────────────
  const HH_DIA = 8.8
  const adicionais = useMemo(() => {
    const calc = (ativo: boolean, pico: number, dias: string) => ativo ? pico * n(dias) * HH_DIA : 0
    const calcFolga = (ativo: boolean, pessoas: string, dias: string) => ativo ? n(pessoas) * n(dias) * HH_DIA : 0
    return {
      mob_prev:   calc(cfg.mob_ativo,   picoEfetivoPrev, cfg.mob_dias_prev),
      mob_real:   calc(cfg.mob_ativo,   picoEfetivoReal, cfg.mob_dias_real),
      desmob_prev: calc(cfg.desmob_ativo, picoEfetivoPrev, cfg.desmob_dias_prev),
      desmob_real: calc(cfg.desmob_ativo, picoEfetivoReal, cfg.desmob_dias_real),
      integ_prev:  calc(cfg.integ_ativo,  picoEfetivoPrev, cfg.integ_dias_prev),
      integ_real:  calc(cfg.integ_ativo,  picoEfetivoReal, cfg.integ_dias_real),
      folga_prev:  calcFolga(cfg.folga_ativo, cfg.folga_pessoas_prev, cfg.folga_dias_prev),
      folga_real:  calcFolga(cfg.folga_ativo, cfg.folga_pessoas_real, cfg.folga_dias_real),
    }
  }, [cfg, picoEfetivoPrev, picoEfetivoReal])

  const adicTotalPrev = adicionais.mob_prev + adicionais.desmob_prev + adicionais.integ_prev + adicionais.folga_prev
  const adicTotalReal = adicionais.mob_real + adicionais.desmob_real + adicionais.integ_real + adicionais.folga_real

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const hhTotalPrev = totPrep.sumHhPlan + totParada.sumHhPlan + totAcomp.sumHhPlan + adicTotalPrev
  const hhTotalReal = totPrep.sumHhReal + totParada.sumHhReal + totAcomp.sumHhReal + adicTotalReal
  const desvioAcum  = hhTotalReal - hhTotalPrev

  // ── UCR — classificação por R$/HH (faixa da região do contrato, via Estado) ──
  const classifyRsHH = (rsHH: number | null): string | null => classificarUcr(rsHH, faixaAtual)

  // ── Análise Financeira ─────────────────────────────────────────────────────
  const finOrcadoValor  = contrato?.valor_orcado ?? 0
  const finRealValor    = contrato?.valor_faturado ?? 0
  const finPrevTotal    = n(cfg.fin_prev_valor_servico) + n(cfg.fin_prev_ase)
  const finOrcadoRsHH  = hhTotalPrev > 0 ? finOrcadoValor / hhTotalPrev : null
  const finPrevRsHH    = hhTotalReal  > 0 ? finPrevTotal  / hhTotalReal  : null
  const finRealRsHH    = hhTotalReal  > 0 ? finRealValor  / hhTotalReal  : null

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        prep_inicio: cfg.prep_inicio || null, prep_fim: cfg.prep_fim || null,
        parada_inicio: cfg.parada_inicio || null, parada_fim: cfg.parada_fim || null,
        acomp_inicio: cfg.acomp_inicio || null, acomp_fim: cfg.acomp_fim || null,
        mob_ativo: cfg.mob_ativo,
        mob_dias_prev: cfg.mob_dias_prev ? n(cfg.mob_dias_prev) : null,
        mob_dias_real: cfg.mob_dias_real ? n(cfg.mob_dias_real) : null,
        desmob_ativo: cfg.desmob_ativo,
        desmob_dias_prev: cfg.desmob_dias_prev ? n(cfg.desmob_dias_prev) : null,
        desmob_dias_real: cfg.desmob_dias_real ? n(cfg.desmob_dias_real) : null,
        integ_ativo: cfg.integ_ativo,
        integ_dias_prev: cfg.integ_dias_prev ? n(cfg.integ_dias_prev) : null,
        integ_dias_real: cfg.integ_dias_real ? n(cfg.integ_dias_real) : null,
        folga_ativo: cfg.folga_ativo,
        folga_dias_prev: cfg.folga_dias_prev ? n(cfg.folga_dias_prev) : null,
        folga_dias_real: cfg.folga_dias_real ? n(cfg.folga_dias_real) : null,
        folga_pessoas_prev: cfg.folga_pessoas_prev ? parseInt(cfg.folga_pessoas_prev) : null,
        folga_pessoas_real: cfg.folga_pessoas_real ? parseInt(cfg.folga_pessoas_real) : null,
        fin_prev_valor_servico: cfg.fin_prev_valor_servico ? n(cfg.fin_prev_valor_servico) : null,
        fin_prev_ase: cfg.fin_prev_ase ? n(cfg.fin_prev_ase) : null,
        dias: Array.from(dias.entries()).map(([key, val]) => {
          const [etapa, data] = key.split('__')
          return {
            etapa: etapa as Etapa, data,
            efetivo_plan: val.efetivo_plan ? Math.round(n(val.efetivo_plan)) : null,
            horas_dia_plan: val.horas_dia_plan ? n(val.horas_dia_plan) : null,
            hh_plan: val.hh_plan ? n(val.hh_plan) : null,
            efetivo_real: val.efetivo_real ? Math.round(n(val.efetivo_real)) : null,
            horas_dia_real: val.horas_dia_real ? n(val.horas_dia_real) : null,
            hh_real: val.hh_real ? n(val.hh_real) : null,
          }
        }),
      }
      await fetch(`/api/acordos/hh/paradas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    } finally { setSaving(false) }
  }

  // ── Fechar / Reabrir Parada ──────────────────────────────────────────────
  async function handleFechar() {
    setFecharLoading(true); setFecharErro(null)
    try {
      const res = await fetch(`/api/acordos/hh/paradas/${id}/fechar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.error) { setFecharErro(json.error ?? 'Erro ao fechar a Parada'); return }
      setConfirmFechar(false)
      await fetchData()
    } finally { setFecharLoading(false) }
  }

  async function handleReabrir(motivo: string) {
    setReabrirLoading(true); setReabrirErro(null)
    try {
      const res = await fetch(`/api/acordos/hh/paradas/${id}/reabrir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setReabrirErro(json.error ?? 'Erro ao reabrir a Parada'); return }
      setConfirmReabrir(false)
      await fetchData()
    } finally { setReabrirLoading(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  function getUcrStyle(label: string | null) {
    return UCR_FAIXAS.find((r) => r.label === label) ?? null
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b bg-white px-6 py-3 shadow-sm">
        <button onClick={() => router.push('/acordos/hh?tab=paradas')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-green-700">{contrato?.numero ?? '–'}</span>
          <span className="hidden text-gray-300 sm:block">|</span>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">{contrato?.cliente ?? ''}</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {contrato?.cliente_final && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex"><Building2 size={13} /><span>{contrato.cliente_final}</span></div>
          )}
          {contrato?.cidade && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex"><MapPin size={13} /><span>{contrato.cidade}</span></div>
          )}
          {contrato?.escopo && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex"><Briefcase size={13} /><span>{contrato.escopo}</span></div>
          )}
          {contrato?.responsavel && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex"><User size={13} /><span>{contrato.responsavel}</span></div>
          )}
          {!fechada && (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
                <Save size={16} />
                {saving ? 'Salvando…' : 'Lançar realizado'}
              </button>
              <button onClick={() => { setFecharErro(null); setConfirmFechar(true) }}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                Fechar Parada
              </button>
            </>
          )}
          {fechada && podeReabrir && (
            <button onClick={() => { setReabrirErro(null); setConfirmReabrir(true) }}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
              Reabrir Parada
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {fechada && (
          <div className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-700 flex items-center gap-2">
            <span className="font-semibold">Parada fechada</span>
            <span>
              em {fechamento.fechada_em ? new Date(fechamento.fechada_em).toLocaleDateString('pt-BR') : '–'}
              {fechamento.fechada_por_nome ? ` por ${fechamento.fechada_por_nome}` : ''} — os lançamentos estão consolidados e não podem mais ser ajustados.
              {podeReabrir ? ' Use "Reabrir Parada" para editar novamente.' : ''}
            </span>
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="HHT Total Previsto"  value={fmtHH(hhTotalPrev)} color="text-blue-700" />
          <KpiCard label="HHT Total Realizado" value={fmtHH(hhTotalReal)} color="text-green-700" />
          <KpiCard label="Desvio Acumulado"
            value={`${fmtHH(desvioAcum)} (${fmtPct(hhTotalPrev > 0 ? desvioAcum / hhTotalPrev : null)})`}
            color={desvioAcum < 0 ? 'text-green-700' : desvioAcum > 0 ? 'text-red-600' : 'text-gray-400'} />
        </div>

        {/* ── Etapas ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <EtapaCard label="Preparativo" disabled={fechada}
            inicio={cfg.prep_inicio} fim={cfg.prep_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, prep_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, prep_fim: v }))} />
          <EtapaCard label="Parada" disabled={fechada}
            inicio={cfg.parada_inicio} fim={cfg.parada_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, parada_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, parada_fim: v }))} />
          <EtapaCard label="Pós Parada" disabled={fechada}
            inicio={cfg.acomp_inicio} fim={cfg.acomp_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, acomp_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, acomp_fim: v }))} />
        </div>

        {/* ── Legenda ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-white px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Legenda:</span>
          {[
            { cor: '#c8e6c9', label: 'Abaixo do planejado (melhor)' },
            { cor: '#ffcdd2', label: 'Acima do planejado (pior)' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm border border-gray-300" style={{ background: l.cor }} />
              <span className="text-xs text-gray-600">{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Grade de HH Diário ───────────────────────────────────────────── */}
        <DailyGrid
          diasPrep={diasPrep} diasParada={diasParada} diasAcomp={diasAcomp}
          getDia={getDia} setDiaProp={setDiaProp} disabled={fechada}
        />

        {/* ── Horas Adicionais ─────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg">
            <h3 className="text-sm font-semibold text-white">Horas Adicionais</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 w-32">Tipo</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600 w-24">Considerar?</th>
                  <th className="px-4 py-2 text-center font-semibold text-blue-700">Dias Previsto</th>
                  <th className="px-4 py-2 text-center font-semibold text-green-700">Dias Realizado</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500">Pico Efetivo (auto)</th>
                  <th className="px-4 py-2 text-center font-semibold text-blue-700">HH Previsto</th>
                  <th className="px-4 py-2 text-center font-semibold text-green-700">HH Realizado</th>
                </tr>
              </thead>
              <tbody>
                {/* Mobilização */}
                {([
                  { label: 'Mobilização',   ativoKey: 'mob_ativo' as const,   prevKey: 'mob_dias_prev' as const,   realKey: 'mob_dias_real' as const,   hhPrev: adicionais.mob_prev,   hhReal: adicionais.mob_real },
                  { label: 'Desmobilização', ativoKey: 'desmob_ativo' as const, prevKey: 'desmob_dias_prev' as const, realKey: 'desmob_dias_real' as const, hhPrev: adicionais.desmob_prev, hhReal: adicionais.desmob_real },
                  { label: 'Integração',    ativoKey: 'integ_ativo' as const,  prevKey: 'integ_dias_prev' as const,  realKey: 'integ_dias_real' as const,  hhPrev: adicionais.integ_prev,  hhReal: adicionais.integ_real },
                ]).map((row) => {
                  const ativo = cfg[row.ativoKey]
                  return (
                    <tr key={row.label} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Toggle value={ativo} disabled={fechada} onChange={(v) => setCfg((p) => ({ ...p, [row.ativoKey]: v }))} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo || fechada}
                          value={cfg[row.prevKey]}
                          onChange={(e) => setCfg((p) => ({ ...p, [row.prevKey]: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo || fechada}
                          value={cfg[row.realKey]}
                          onChange={(e) => setCfg((p) => ({ ...p, [row.realKey]: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-blue-600">Prev: {picoEfetivoPrev > 0 ? picoEfetivoPrev.toLocaleString('pt-BR') : '–'}</span>
                          <span className="text-green-600">Real: {picoEfetivoReal > 0 ? picoEfetivoReal.toLocaleString('pt-BR') : '–'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-blue-700">
                        {ativo && row.hhPrev > 0 ? fmtHH(row.hhPrev) : '–'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-green-700">
                        {ativo && row.hhReal > 0 ? fmtHH(row.hhReal) : '–'}
                      </td>
                    </tr>
                  )
                })}

                {/* Folga */}
                {(() => {
                  const ativo = cfg.folga_ativo
                  return (
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-700">Folga</td>
                      <td className="px-4 py-2.5 text-center">
                        <Toggle value={ativo} disabled={fechada} onChange={(v) => setCfg((p) => ({ ...p, folga_ativo: v }))} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo || fechada}
                          value={cfg.folga_dias_prev}
                          onChange={(e) => setCfg((p) => ({ ...p, folga_dias_prev: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo || fechada}
                          value={cfg.folga_dias_real}
                          onChange={(e) => setCfg((p) => ({ ...p, folga_dias_real: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      {/* Pessoas em vez de pico */}
                      <td className="px-4 py-2.5 text-center text-xs">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-blue-600 w-10">Prev:</span>
                            <input type="number" min={0} disabled={!ativo || fechada}
                              value={cfg.folga_pessoas_prev}
                              onChange={(e) => setCfg((p) => ({ ...p, folga_pessoas_prev: e.target.value }))}
                              className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-xs disabled:cursor-not-allowed disabled:bg-gray-100" />
                          </div>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-green-600 w-10">Real:</span>
                            <input type="number" min={0} disabled={!ativo || fechada}
                              value={cfg.folga_pessoas_real}
                              onChange={(e) => setCfg((p) => ({ ...p, folga_pessoas_real: e.target.value }))}
                              className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-xs disabled:cursor-not-allowed disabled:bg-gray-100" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-blue-700">
                        {ativo && adicionais.folga_prev > 0 ? fmtHH(adicionais.folga_prev) : '–'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-green-700">
                        {ativo && adicionais.folga_real > 0 ? fmtHH(adicionais.folga_real) : '–'}
                      </td>
                    </tr>
                  )
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-green-700 text-white text-xs font-bold">
                  <td colSpan={5} className="px-4 py-2 text-right">Total Horas Adicionais</td>
                  <td className="px-4 py-2 text-center">{adicTotalPrev > 0 ? fmtHH(adicTotalPrev) : '–'}</td>
                  <td className="px-4 py-2 text-center">{adicTotalReal > 0 ? fmtHH(adicTotalReal) : '–'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Total Geral de HH ────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg">
            <h3 className="text-sm font-semibold text-white">Total Geral de HH</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Fase</th>
                  <th className="px-4 py-2 text-right font-semibold text-blue-700">HH Previsto</th>
                  <th className="px-4 py-2 text-right font-semibold text-green-700">HH Realizado</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Desvio HH</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Desvio %</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Mobilização',       prev: adicionais.mob_prev,    real: adicionais.mob_real },
                  { label: 'Integração',         prev: adicionais.integ_prev,  real: adicionais.integ_real },
                  { label: 'Preparativo',        prev: totPrep.sumHhPlan,      real: totPrep.sumHhReal },
                  { label: 'Parada',             prev: totParada.sumHhPlan,    real: totParada.sumHhReal },
                  { label: 'Pós Parada',         prev: totAcomp.sumHhPlan,     real: totAcomp.sumHhReal },
                  { label: 'Desmobilização',     prev: adicionais.desmob_prev, real: adicionais.desmob_real },
                  { label: 'Folga',              prev: adicionais.folga_prev,  real: adicionais.folga_real },
                ]).map((row) => {
                  const desvio = row.real - row.prev
                  const pct = row.prev > 0 ? desvio / row.prev : null
                  return (
                    <tr key={row.label} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{row.label}</td>
                      <td className="px-4 py-2 text-right text-blue-700">{row.prev > 0 ? fmtHH(row.prev) : <span className="text-gray-300">–</span>}</td>
                      <td className="px-4 py-2 text-right text-green-700">{row.real > 0 ? fmtHH(row.real) : <span className="text-gray-300">–</span>}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${desvio < 0 ? 'text-green-700' : desvio > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {row.prev > 0 || row.real > 0 ? fmtHH(desvio) : <span className="text-gray-300">–</span>}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${(pct ?? 0) < 0 ? 'text-green-700' : (pct ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmtPct(pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-green-700 text-white">
                  <td className="px-4 py-2 font-bold">Total Geral</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtHH(hhTotalPrev)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtHH(hhTotalReal)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtHH(desvioAcum)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtPct(hhTotalPrev > 0 ? desvioAcum / hhTotalPrev : null)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Análise Financeira ───────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg">
            <h3 className="text-sm font-semibold text-white">Análise Financeira</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: '12px' }}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 w-48">Campo</th>
                  <th className="px-4 py-2 text-right font-bold text-blue-700 w-52">① Orçado</th>
                  <th className="px-4 py-2 text-right font-bold text-orange-600 w-52">② Previsto</th>
                  <th className="px-4 py-2 text-right font-bold text-green-700 w-52">③ Real Faturado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-600">Valor Total Serviço</td>
                  <td className="px-4 py-2 text-right text-gray-800 font-semibold">
                    {fmtR$(finOrcadoValor > 0 ? finOrcadoValor : null)}
                    <div className="text-[10px] font-normal text-gray-400 mt-0.5">Orçado no faturamento</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <CurrencyInput
                      value={cfg.fin_prev_valor_servico}
                      onChange={(v) => setCfg((p) => ({ ...p, fin_prev_valor_servico: v }))}
                      placeholder="0,00" disabled={fechada}
                      className="w-36 text-right" />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-800 font-semibold">
                    {fmtR$(finRealValor > 0 ? finRealValor : null)}
                    <div className="text-[10px] font-normal text-gray-400 mt-0.5">Faturado (NFs ativas)</div>
                  </td>
                </tr>

                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-600">Serviços Extras (ASE)</td>
                  <td className="px-4 py-2 text-center text-gray-300">—</td>
                  <td className="px-4 py-2 text-right">
                    <CurrencyInput
                      value={cfg.fin_prev_ase}
                      onChange={(v) => setCfg((p) => ({ ...p, fin_prev_ase: v }))}
                      placeholder="0,00" disabled={fechada}
                      className="w-36 text-right" />
                  </td>
                  <td className="px-4 py-2 text-center text-gray-300">—</td>
                </tr>

                <tr className="border-b bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-600">Total Valor</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">{fmtR$(finOrcadoValor > 0 ? finOrcadoValor : null)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">{fmtR$(finPrevTotal > 0 ? finPrevTotal : null)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">{fmtR$(finRealValor > 0 ? finRealValor : null)}</td>
                </tr>

                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-600">HH Total</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {hhTotalPrev > 0 ? fmtHH(hhTotalPrev) : <span className="text-gray-300">–</span>}
                    <div className="text-[10px] text-gray-400 mt-0.5">HH Previsto</div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {hhTotalReal > 0 ? fmtHH(hhTotalReal) : <span className="text-gray-300">–</span>}
                    <div className="text-[10px] text-gray-400 mt-0.5">HH Real</div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {hhTotalReal > 0 ? fmtHH(hhTotalReal) : <span className="text-gray-300">–</span>}
                    <div className="text-[10px] text-gray-400 mt-0.5">HH Real</div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-green-700 font-bold">
                  <td className="px-4 py-2 bg-green-700 text-white">R$/HH</td>
                  {([
                    { rsHH: finOrcadoRsHH, key: 'orc' },
                    { rsHH: finPrevRsHH,   key: 'prev' },
                    { rsHH: finRealRsHH,   key: 'real' },
                  ] as const).map(({ rsHH, key }) => {
                    const cls = classifyRsHH(rsHH)
                    const s = getUcrStyle(cls)
                    return (
                      <td key={key} className="px-4 py-2 text-center"
                        style={{ background: s?.bg ?? '#F9FAFB', color: s?.cor ?? '#374151' }}>
                        <div>{rsHH != null ? fmtR$(rsHH) : '–'}</div>
                        {cls && <div className="text-[10px] font-semibold mt-0.5 opacity-80">{cls}</div>}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── UCR — tabela completa (todas as regiões) da vigência aplicável ── */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">UCR — Uso Consciente do Recurso</h3>
            <span className="text-[11px] text-green-200 font-normal">
              Região desta Parada: {UCR_REGIOES.find((r) => r.regiao === regiaoDoContrato)?.label ?? regiaoDoContrato}
              {contrato?.estado ? ` (UF: ${contrato.estado})` : ''}
              {faixaAtual ? ` · Vigência: ${new Date(faixaAtual.vigencia_inicio).toLocaleDateString('pt-BR')} a ${new Date(faixaAtual.vigencia_fim).toLocaleDateString('pt-BR')}` : ''}
            </span>
          </div>
          {!dataReferenciaUcr ? (
            <p className="text-center text-gray-400 py-6 text-xs">Informe a data de início da Parada para ver as faixas aplicáveis.</p>
          ) : !faixaAtual ? (
            <p className="text-center text-amber-600 py-6 text-xs px-4">
              Não há faixa de UCR vigente para a região {regiaoDoContrato} cobrindo {new Date(dataReferenciaUcr).toLocaleDateString('pt-BR')}.
              Cadastre uma faixa em &quot;Faixas de UCR&quot; antes de fechar esta Parada.
            </p>
          ) : (
            <div className="p-4">
              <UcrFaixasTabela
                valoresPorRegiao={valoresPorRegiaoNoPeriodo}
                regiaoDestaque={regiaoDoContrato}
                faixaAtivaPorRegiao={{ [regiaoDoContrato]: classifyRsHH(finRealRsHH) }}
              />
            </div>
          )}
        </div>

      </div>

      {confirmFechar && (
        <ConfirmDialog
          open
          title="Fechar Parada"
          message="Isso consolida os lançamentos desta Parada — nenhum ajuste poderá ser feito até que ela seja reaberta. Confirmar o fechamento?"
          variant="warning"
          confirmLabel="Fechar Parada"
          loading={fecharLoading}
          error={fecharErro}
          onConfirm={handleFechar}
          onClose={() => setConfirmFechar(false)}
        />
      )}
      {confirmReabrir && (
        <ConfirmDialog
          open
          title="Reabrir Parada"
          message="Explique o motivo da reabertura — ficará registrado no histórico."
          variant="warning"
          confirmLabel="Reabrir Parada"
          input={{ label: 'Justificativa', placeholder: 'Motivo da reabertura...', required: true, multiline: true }}
          loading={reabrirLoading}
          error={reabrirErro}
          onConfirm={handleReabrir}
          onClose={() => setConfirmReabrir(false)}
        />
      )}
    </div>
  )
}

// ─── Daily Grid ───────────────────────────────────────────────────────────────

interface DailyGridProps {
  diasPrep: string[]; diasParada: string[]; diasAcomp: string[]
  getDia: (etapa: Etapa, data: string) => DiaState
  setDiaProp: (etapa: Etapa, data: string, prop: keyof DiaState, value: string) => void
  disabled?: boolean
}

function DailyGrid({ diasPrep, diasParada, diasAcomp, getDia, setDiaProp, disabled }: DailyGridProps) {
  const noData = diasPrep.length === 0 && diasParada.length === 0 && diasAcomp.length === 0
  if (noData) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
        Configure as datas das etapas para visualizar a grade de HH diário.
      </div>
    )
  }

  const etapaSections: Array<{ etapa: Etapa; label: string; dias: string[] }> = [
    { etapa: 'PREPARATIVO',  label: 'Preparativo',       dias: diasPrep },
    { etapa: 'PARADA',       label: 'Parada',            dias: diasParada },
    { etapa: 'ACOMP_DESMOB', label: 'Pós Parada', dias: diasAcomp },
  ]

  const ROWS: Array<{ key: string; label: string; bg?: string; bold?: boolean }> = [
    { key: 'efetivo_plan',   label: 'Efetivo plan.',    bg: '#EEF7EE' },
    { key: 'horas_dia_plan', label: 'Horas dia (plan.)', bg: '#EEF7EE' },
    { key: 'hh_plan',        label: 'HHT plan. (dia)',  bg: '#EEF7EE' },
    { key: 'acum_plan',      label: '∑ HHT plan.',      bg: '#DCEDC8', bold: true },
    { key: 'efetivo_real',   label: 'Efetivo real.' },
    { key: 'horas_dia_real', label: 'Horas dia (real.)' },
    { key: 'hh_real',        label: 'HHT real. (dia)' },
    { key: 'acum_real',      label: '∑ HHT real.',      bg: '#E3F2FD', bold: true },
    { key: 'desvio_hh',      label: 'Desvio HH (dia)',  bg: '#FAFAFA' },
    { key: 'desvio_pct',     label: 'Desvio % (dia)',   bg: '#FAFAFA' },
  ]

  const STICKY_W = 148
  const COL_W    = 66

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg">
        <h3 className="text-sm font-semibold text-white">Grade de HH Diário</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ tableLayout: 'fixed', fontSize: '11px' }}>
          <colgroup>
            <col style={{ width: STICKY_W, minWidth: STICKY_W }} />
            {etapaSections.flatMap(({ dias }) =>
              dias.map((_, i) => <col key={i} style={{ width: COL_W, minWidth: COL_W }} />)
            )}
          </colgroup>

          <thead>
            {/* Row 1 – etapa headers */}
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-2 py-1"
                style={{ position: 'sticky', left: 0, zIndex: 3, width: STICKY_W }} />
              {etapaSections.map(({ etapa, label, dias }) => (
                <th key={etapa}
                  colSpan={dias.length}
                  className="border border-gray-300 bg-green-700 py-1 text-center text-xs font-bold text-white"
                  style={{ borderLeft: '2px solid #1B5E20' }}>
                  {label} ({dias.length} dias)
                </th>
              ))}
            </tr>

            {/* Row 2 – date headers */}
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-xs text-left"
                style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F3F4F6' }}>Linha</th>
              {etapaSections.flatMap(({ etapa, dias }) =>
                dias.map((d) => (
                  <th key={`${etapa}_${d}`}
                    className="border border-gray-300 py-0.5 text-center text-xs font-medium"
                    style={{
                      background: '#F9FAFB',
                      color: isWeekend(d) ? '#9CA3AF' : '#374151',
                      borderLeft: d === etapaSections.find(s => s.etapa === etapa)?.dias[0] && etapa !== 'PREPARATIVO'
                        ? '2px solid #1B5E20' : undefined,
                    }}>
                    {dayLabel(d).split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {ROWS.map(({ key, label, bg, bold }) => {
              // Acumulado contínuo: uma única variável por linha, persistindo
              // através das três etapas (Preparativo → Parada → Pós Parada) —
              // não pode ser reiniciada a cada seção.
              let acum = 0
              return (
              <tr key={key}>
                {/* Sticky label */}
                <td className="border border-gray-200 px-2 py-0.5 font-medium"
                  style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: bg ?? '#fff', color: '#374151',
                    fontWeight: bold ? 700 : 400, width: STICKY_W,
                  }}>
                  {label}
                </td>

                {etapaSections.flatMap(({ etapa, dias }) => {
                  return dias.map((d) => {
                    const dia = getDia(etapa, d)
                    const weekend = isWeekend(d)

                    if (key === 'efetivo_plan' || key === 'efetivo_real') {
                      const prop = key as keyof DiaState
                      const val = dia[prop]
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200 p-0"
                          style={{ background: bg ?? '#fff', minWidth: COL_W, width: COL_W }}>
                          <input type="text" inputMode="numeric" value={val} disabled={disabled}
                            onChange={(e) => setDiaProp(etapa, d, prop, maskInt(e.target.value))}
                            className="w-full bg-transparent px-0.5 py-0.5 text-center focus:bg-yellow-50 focus:outline-none disabled:text-gray-400"
                            style={{ textAlign: 'center', color: (weekend && val !== '') ? '#C62828' : undefined }} />
                        </td>
                      )
                    }

                    if (key === 'horas_dia_plan' || key === 'horas_dia_real') {
                      const prop = key as keyof DiaState
                      const val = dia[prop]
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200 p-0"
                          style={{ background: bg ?? '#fff', minWidth: COL_W, width: COL_W }}>
                          <input type="text" inputMode="decimal" value={val} disabled={disabled}
                            onChange={(e) => setDiaProp(etapa, d, prop, e.target.value)}
                            onBlur={(e) => {
                              const num = n(e.target.value)
                              setDiaProp(etapa, d, prop,
                                num > 0 ? num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '')
                            }}
                            className="w-full bg-transparent px-0.5 py-0.5 text-center text-gray-500 focus:bg-yellow-50 focus:outline-none"
                            style={{ textAlign: 'center' }} />
                        </td>
                      )
                    }

                    if (key === 'hh_plan' || key === 'hh_real') {
                      const prop = key as keyof DiaState
                      const val = dia[prop]
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200"
                          style={{ background: bg ?? '#fff', minWidth: COL_W, width: COL_W, textAlign: 'center', color: (weekend && val !== '') ? '#C62828' : '#374151' }}
                          title="Calculado: Efetivo × Horas dia">
                          {val !== '' ? fmtCellHH(n(val)) : ''}
                        </td>
                      )
                    }

                    if (key === 'acum_plan') {
                      acum += n(dia.hh_plan)
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200"
                          style={{ background: '#DCEDC8', fontWeight: 700, textAlign: 'center' }}>
                          {acum > 0 ? fmtCellHH(acum) : ''}
                        </td>
                      )
                    }

                    if (key === 'acum_real') {
                      acum += n(dia.hh_real)
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200"
                          style={{ background: '#E3F2FD', fontWeight: 700, textAlign: 'center' }}>
                          {acum > 0 ? fmtCellHH(acum) : ''}
                        </td>
                      )
                    }

                    if (key === 'desvio_hh') {
                      const dev = n(dia.hh_real) - n(dia.hh_plan)
                      const hasData = dia.hh_real !== '' && dia.hh_plan !== ''
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200"
                          style={{ background: hasData ? (dev < 0 ? '#c8e6c9' : dev > 0 ? '#ffcdd2' : '#fff') : '#fff', textAlign: 'center' }}>
                          {hasData ? fmtCellHH(dev) : ''}
                        </td>
                      )
                    }

                    if (key === 'desvio_pct') {
                      const plan = n(dia.hh_plan); const real = n(dia.hh_real)
                      const hasData = dia.hh_real !== '' && dia.hh_plan !== ''
                      const pct = plan > 0 ? (real - plan) / plan : null
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200"
                          style={{ background: hasData && pct != null ? (pct < 0 ? '#c8e6c9' : pct > 0 ? '#ffcdd2' : '#fff') : '#fff', textAlign: 'center' }}>
                          {hasData && pct != null ? `${(pct * 100).toFixed(1)}%` : ''}
                        </td>
                      )
                    }

                    return <td key={`${etapa}_${d}`} className="border border-gray-200" />
                  })
                })}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
