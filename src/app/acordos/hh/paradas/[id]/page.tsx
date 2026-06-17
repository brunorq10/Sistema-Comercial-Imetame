'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, MapPin, User, Building2, Briefcase } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Etapa = 'PREPARATIVO' | 'PARADA' | 'ACOMP_DESMOB'

interface DiaKey { etapa: Etapa; data: string }

interface DiaState {
  efetivo_plan: string
  hh_plan: string
  efetivo_real: string
  hh_real: string
}

interface ContratoInfo {
  id: number
  numero: string
  descricao: string
  cliente: string
  cliente_final: string | null
  cidade: string | null
  escopo: string | null
  responsavel: string
  valor_orcado: number
  valor_faturado: number
}

interface ConfigState {
  prep_inicio: string
  prep_fim: string
  parada_inicio: string
  parada_fim: string
  acomp_inicio: string
  acomp_fim: string

  mob_ativo: boolean
  mob_dias: string
  mob_pico_efetivo: string

  desmob_ativo: boolean
  desmob_dias: string
  desmob_pico_efetivo: string

  integ_ativo: boolean
  integ_dias: string
  integ_pico_efetivo: string

  folga_ativo: boolean
  folga_dias: string
  folga_pessoas: string

  fin_prev_mob: string
  fin_prev_integ: string
  fin_prev_prep: string
  fin_prev_parada: string
  fin_prev_acomp: string
  fin_prev_desmob: string
  fin_prev_folga: string

  fin_real_mob: string
  fin_real_integ: string
  fin_real_prep: string
  fin_real_parada: string
  fin_real_acomp: string
  fin_real_desmob: string
  fin_real_folga: string

  ucr_f1: string
  ucr_f2: string
  ucr_f3: string
  ucr_f4: string
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
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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
  const r = parseFloat(v.replace(',', '.'))
  return isNaN(r) ? 0 : r
}

function defaultConfig(): ConfigState {
  return {
    prep_inicio: '', prep_fim: '',
    parada_inicio: '', parada_fim: '',
    acomp_inicio: '', acomp_fim: '',
    mob_ativo: false, mob_dias: '', mob_pico_efetivo: '',
    desmob_ativo: false, desmob_dias: '', desmob_pico_efetivo: '',
    integ_ativo: false, integ_dias: '', integ_pico_efetivo: '',
    folga_ativo: false, folga_dias: '', folga_pessoas: '',
    fin_prev_mob: '', fin_prev_integ: '', fin_prev_prep: '',
    fin_prev_parada: '', fin_prev_acomp: '', fin_prev_desmob: '', fin_prev_folga: '',
    fin_real_mob: '', fin_real_integ: '', fin_real_prep: '',
    fin_real_parada: '', fin_real_acomp: '', fin_real_desmob: '', fin_real_folga: '',
    ucr_f1: '0.85', ucr_f2: '0.93', ucr_f3: '1.00', ucr_f4: '1.07',
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
    mob_ativo: b(c.mob_ativo), mob_dias: s(c.mob_dias), mob_pico_efetivo: s(c.mob_pico_efetivo),
    desmob_ativo: b(c.desmob_ativo), desmob_dias: s(c.desmob_dias), desmob_pico_efetivo: s(c.desmob_pico_efetivo),
    integ_ativo: b(c.integ_ativo), integ_dias: s(c.integ_dias), integ_pico_efetivo: s(c.integ_pico_efetivo),
    folga_ativo: b(c.folga_ativo), folga_dias: s(c.folga_dias), folga_pessoas: s(c.folga_pessoas),
    fin_prev_mob: s(c.fin_prev_mob), fin_prev_integ: s(c.fin_prev_integ), fin_prev_prep: s(c.fin_prev_prep),
    fin_prev_parada: s(c.fin_prev_parada), fin_prev_acomp: s(c.fin_prev_acomp),
    fin_prev_desmob: s(c.fin_prev_desmob), fin_prev_folga: s(c.fin_prev_folga),
    fin_real_mob: s(c.fin_real_mob), fin_real_integ: s(c.fin_real_integ), fin_real_prep: s(c.fin_real_prep),
    fin_real_parada: s(c.fin_real_parada), fin_real_acomp: s(c.fin_real_acomp),
    fin_real_desmob: s(c.fin_real_desmob), fin_real_folga: s(c.fin_real_folga),
    ucr_f1: s(c.ucr_f1) || '0.85', ucr_f2: s(c.ucr_f2) || '0.93',
    ucr_f3: s(c.ucr_f3) || '1.00', ucr_f4: s(c.ucr_f4) || '1.07',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-green-600' : 'bg-gray-300'}`}
    >
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

function EtapaCard({ label, inicio, fim, onChangeInicio, onChangeFim }: {
  label: string
  inicio: string
  fim: string
  onChangeInicio: (v: string) => void
  onChangeFim: (v: string) => void
}) {
  const duracao = useMemo(() => {
    const dias = diasEntreDatas(inicio, fim)
    return dias.length
  }, [inicio, fim])

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-green-700">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500">Início</label>
          <input type="date" value={inicio} onChange={(e) => onChangeInicio(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Fim</label>
          <input type="date" value={fim} onChange={(e) => onChangeFim(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contrato, setContrato] = useState<ContratoInfo | null>(null)
  const [cfg, setCfg] = useState<ConfigState>(defaultConfig())
  const [dias, setDias] = useState<Map<string, DiaState>>(new Map())

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/acordos/hh/paradas/${id}`)
      const json = await res.json()
      if (!json.data) return
      setContrato(json.data.contrato)
      if (json.data.config) {
        setCfg(configFromApi(json.data.config as Record<string, unknown>))
        const diasApi = (json.data.config.dias ?? []) as Array<{
          etapa: Etapa; data: string; efetivo_plan: number | null; hh_plan: number | null
          efetivo_real: number | null; hh_real: number | null
        }>
        const map = new Map<string, DiaState>()
        for (const d of diasApi) {
          const key = `${d.etapa}__${d.data.substring(0, 10)}`
          map.set(key, {
            efetivo_plan: d.efetivo_plan != null ? String(d.efetivo_plan) : '',
            hh_plan: d.hh_plan != null ? String(d.hh_plan) : '',
            efetivo_real: d.efetivo_real != null ? String(d.efetivo_real) : '',
            hh_real: d.hh_real != null ? String(d.hh_real) : '',
          })
        }
        setDias(map)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived day lists ──────────────────────────────────────────────────────
  const diasPrep = useMemo(() => diasEntreDatas(cfg.prep_inicio, cfg.prep_fim), [cfg.prep_inicio, cfg.prep_fim])
  const diasParada = useMemo(() => diasEntreDatas(cfg.parada_inicio, cfg.parada_fim), [cfg.parada_inicio, cfg.parada_fim])
  const diasAcomp = useMemo(() => diasEntreDatas(cfg.acomp_inicio, cfg.acomp_fim), [cfg.acomp_inicio, cfg.acomp_fim])

  function getDia(etapa: Etapa, data: string): DiaState {
    return dias.get(`${etapa}__${data}`) ?? { efetivo_plan: '', hh_plan: '', efetivo_real: '', hh_real: '' }
  }

  function setDiaProp(etapa: Etapa, data: string, prop: keyof DiaState, value: string) {
    const key = `${etapa}__${data}`
    setDias((prev) => {
      const next = new Map(prev)
      const cur = next.get(key) ?? { efetivo_plan: '', hh_plan: '', efetivo_real: '', hh_real: '' }
      next.set(key, { ...cur, [prop]: value })
      return next
    })
  }

  // ── Totals per etapa ───────────────────────────────────────────────────────
  function etapaTotals(etapa: Etapa, diasList: string[]) {
    let sumHhPlan = 0, sumHhReal = 0
    for (const d of diasList) {
      const dia = getDia(etapa, d)
      sumHhPlan += n(dia.hh_plan)
      sumHhReal += n(dia.hh_real)
    }
    return { sumHhPlan, sumHhReal, desvio: sumHhReal - sumHhPlan }
  }

  const totPrep = useMemo(() => etapaTotals('PREPARATIVO', diasPrep), [dias, diasPrep])
  const totParada = useMemo(() => etapaTotals('PARADA', diasParada), [dias, diasParada])
  const totAcomp = useMemo(() => etapaTotals('ACOMP_DESMOB', diasAcomp), [dias, diasAcomp])

  // ── Adicionais calculados ──────────────────────────────────────────────────
  const adicionais = useMemo(() => {
    const HH_DIA = 8.8
    const mob = cfg.mob_ativo ? n(cfg.mob_pico_efetivo) * n(cfg.mob_dias) * HH_DIA : 0
    const desmob = cfg.desmob_ativo ? n(cfg.desmob_pico_efetivo) * n(cfg.desmob_dias) * HH_DIA : 0
    const integ = cfg.integ_ativo ? n(cfg.integ_pico_efetivo) * n(cfg.integ_dias) * HH_DIA : 0
    const folga = cfg.folga_ativo ? n(cfg.folga_pessoas) * n(cfg.folga_dias) * HH_DIA : 0
    return { mob, desmob, integ, folga }
  }, [cfg])

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const hhTotalPrev = useMemo(() =>
    totPrep.sumHhPlan + totParada.sumHhPlan + totAcomp.sumHhPlan +
    adicionais.mob + adicionais.desmob + adicionais.integ + adicionais.folga,
    [totPrep, totParada, totAcomp, adicionais])

  const hhTotalReal = useMemo(() =>
    totPrep.sumHhReal + totParada.sumHhReal + totAcomp.sumHhReal,
    [totPrep, totParada, totAcomp])

  const desvioAcum = hhTotalReal - hhTotalPrev

  // ── UCR ───────────────────────────────────────────────────────────────────
  const ucrVal = hhTotalPrev > 0 ? hhTotalReal / hhTotalPrev : null

  const UCR_ROWS = [
    { label: 'Não Suficiente', cor: '#D32F2F', bg: '#FFEBEE', cond: (v: number, f1: number) => v <= f1 },
    { label: 'A Evoluir',      cor: '#F57C00', bg: '#FFF3E0', cond: (v: number, f1: number, f2: number) => v > f1 && v <= f2 },
    { label: 'Bom',            cor: '#388E3C', bg: '#E8F5E9', cond: (v: number, _f1: number, f2: number, f3: number) => v > f2 && v <= f3 },
    { label: 'Ótimo',          cor: '#1565C0', bg: '#E3F2FD', cond: (v: number, _f1: number, _f2: number, f3: number, f4: number) => v > f3 && v <= f4 },
    { label: 'Esplêndido',     cor: '#6A1B9A', bg: '#F3E5F5', cond: (v: number, _f1: number, _f2: number, _f3: number, f4: number) => v > f4 },
  ]

  function getUcrClass() {
    if (ucrVal == null) return null
    const f1 = n(cfg.ucr_f1), f2 = n(cfg.ucr_f2), f3 = n(cfg.ucr_f3), f4 = n(cfg.ucr_f4)
    if (ucrVal <= f1) return 'Não Suficiente'
    if (ucrVal <= f2) return 'A Evoluir'
    if (ucrVal <= f3) return 'Bom'
    if (ucrVal <= f4) return 'Ótimo'
    return 'Esplêndido'
  }

  // ── Análise Financeira ─────────────────────────────────────────────────────
  const fin = useMemo(() => {
    const orcado = contrato?.valor_orcado ?? 0
    const faturado = contrato?.valor_faturado ?? 0
    const prevTotal = n(cfg.fin_prev_mob) + n(cfg.fin_prev_integ) + n(cfg.fin_prev_prep) +
      n(cfg.fin_prev_parada) + n(cfg.fin_prev_acomp) + n(cfg.fin_prev_desmob) + n(cfg.fin_prev_folga)
    const realTotal = n(cfg.fin_real_mob) + n(cfg.fin_real_integ) + n(cfg.fin_real_prep) +
      n(cfg.fin_real_parada) + n(cfg.fin_real_acomp) + n(cfg.fin_real_desmob) + n(cfg.fin_real_folga)
    return { orcado, faturado, prevTotal, realTotal }
  }, [cfg, contrato])

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const diasPayload: DiaKey[] = []
      const allKeys = Array.from(dias.keys())
      for (const key of allKeys) {
        const [etapa, data] = key.split('__')
        diasPayload.push({ etapa: etapa as Etapa, data })
      }

      const payload = {
        prep_inicio: cfg.prep_inicio || null,
        prep_fim: cfg.prep_fim || null,
        parada_inicio: cfg.parada_inicio || null,
        parada_fim: cfg.parada_fim || null,
        acomp_inicio: cfg.acomp_inicio || null,
        acomp_fim: cfg.acomp_fim || null,
        mob_ativo: cfg.mob_ativo,
        mob_dias: cfg.mob_dias ? parseInt(cfg.mob_dias) : null,
        mob_pico_efetivo: cfg.mob_pico_efetivo ? parseInt(cfg.mob_pico_efetivo) : null,
        desmob_ativo: cfg.desmob_ativo,
        desmob_dias: cfg.desmob_dias ? parseInt(cfg.desmob_dias) : null,
        desmob_pico_efetivo: cfg.desmob_pico_efetivo ? parseInt(cfg.desmob_pico_efetivo) : null,
        integ_ativo: cfg.integ_ativo,
        integ_dias: cfg.integ_dias ? parseInt(cfg.integ_dias) : null,
        integ_pico_efetivo: cfg.integ_pico_efetivo ? parseInt(cfg.integ_pico_efetivo) : null,
        folga_ativo: cfg.folga_ativo,
        folga_dias: cfg.folga_dias ? parseInt(cfg.folga_dias) : null,
        folga_pessoas: cfg.folga_pessoas ? parseInt(cfg.folga_pessoas) : null,
        fin_prev_mob: cfg.fin_prev_mob ? n(cfg.fin_prev_mob) : null,
        fin_prev_integ: cfg.fin_prev_integ ? n(cfg.fin_prev_integ) : null,
        fin_prev_prep: cfg.fin_prev_prep ? n(cfg.fin_prev_prep) : null,
        fin_prev_parada: cfg.fin_prev_parada ? n(cfg.fin_prev_parada) : null,
        fin_prev_acomp: cfg.fin_prev_acomp ? n(cfg.fin_prev_acomp) : null,
        fin_prev_desmob: cfg.fin_prev_desmob ? n(cfg.fin_prev_desmob) : null,
        fin_prev_folga: cfg.fin_prev_folga ? n(cfg.fin_prev_folga) : null,
        fin_real_mob: cfg.fin_real_mob ? n(cfg.fin_real_mob) : null,
        fin_real_integ: cfg.fin_real_integ ? n(cfg.fin_real_integ) : null,
        fin_real_prep: cfg.fin_real_prep ? n(cfg.fin_real_prep) : null,
        fin_real_parada: cfg.fin_real_parada ? n(cfg.fin_real_parada) : null,
        fin_real_acomp: cfg.fin_real_acomp ? n(cfg.fin_real_acomp) : null,
        fin_real_desmob: cfg.fin_real_desmob ? n(cfg.fin_real_desmob) : null,
        fin_real_folga: cfg.fin_real_folga ? n(cfg.fin_real_folga) : null,
        ucr_f1: n(cfg.ucr_f1),
        ucr_f2: n(cfg.ucr_f2),
        ucr_f3: n(cfg.ucr_f3),
        ucr_f4: n(cfg.ucr_f4),
        dias: Array.from(dias.entries()).map(([key, val]) => {
          const [etapa, data] = key.split('__')
          return {
            etapa: etapa as Etapa,
            data,
            efetivo_plan: val.efetivo_plan ? parseInt(val.efetivo_plan) : null,
            hh_plan: val.hh_plan ? n(val.hh_plan) : null,
            efetivo_real: val.efetivo_real ? parseInt(val.efetivo_real) : null,
            hh_real: val.hh_real ? n(val.hh_real) : null,
          }
        }),
      }

      await fetch(`/api/acordos/hh/paradas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  const ucrClass = getUcrClass()
  const f1 = n(cfg.ucr_f1), f2 = n(cfg.ucr_f2), f3 = n(cfg.ucr_f3), f4 = n(cfg.ucr_f4)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b bg-white px-6 py-3 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-green-700">{contrato?.numero ?? '–'}</span>
          <span className="hidden text-gray-300 sm:block">|</span>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">{contrato?.cliente ?? ''}</span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {contrato?.cliente_final && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex">
              <Building2 size={13} />
              <span>{contrato.cliente_final}</span>
            </div>
          )}
          {contrato?.cidade && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex">
              <MapPin size={13} />
              <span>{contrato.cidade}</span>
            </div>
          )}
          {contrato?.escopo && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex">
              <Briefcase size={13} />
              <span>{contrato.escopo}</span>
            </div>
          )}
          {contrato?.responsavel && (
            <div className="hidden items-center gap-1 text-xs text-gray-500 lg:flex">
              <User size={13} />
              <span>{contrato.responsavel}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Salvando…' : 'Lançar realizado'}
          </button>
        </div>
      </div>

      {/* ── Scrollable Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="HHT Total Previsto" value={fmtHH(hhTotalPrev)} color="text-blue-700" />
          <KpiCard label="HHT Total Realizado" value={fmtHH(hhTotalReal)} color="text-green-700" />
          <KpiCard
            label="Desvio Acumulado"
            value={`${fmtHH(desvioAcum)} (${fmtPct(hhTotalPrev > 0 ? desvioAcum / hhTotalPrev : null)})`}
            color={desvioAcum >= 0 ? 'text-green-700' : 'text-red-600'}
          />
        </div>

        {/* ── Etapas ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <EtapaCard
            label="Preparativo"
            inicio={cfg.prep_inicio} fim={cfg.prep_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, prep_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, prep_fim: v }))}
          />
          <EtapaCard
            label="Parada"
            inicio={cfg.parada_inicio} fim={cfg.parada_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, parada_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, parada_fim: v }))}
          />
          <EtapaCard
            label="Acomp. e Desmob."
            inicio={cfg.acomp_inicio} fim={cfg.acomp_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, acomp_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, acomp_fim: v }))}
          />
        </div>

        {/* ── Legenda ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-white px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Legenda:</span>
          {[
            { cor: '#c8e6c9', label: 'Acima do planejado' },
            { cor: '#ffcdd2', label: 'Abaixo do planejado' },
            { cor: '#fff9c4', label: 'Sem lançamento' },
            { cor: '#f5f5f5', label: 'Final de semana' },
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
          getDia={getDia} setDiaProp={setDiaProp}
          totPrep={totPrep} totParada={totParada} totAcomp={totAcomp}
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
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Tipo</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">Ativo</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">Dias</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">Pico Efetivo / Pessoas</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">HH Calculado</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Mobilização',       ativo: 'mob_ativo',   dias: 'mob_dias',   campo: 'mob_pico_efetivo',   campoLabel: 'Pico Efetivo', hh: adicionais.mob },
                  { label: 'Desmobilização',    ativo: 'desmob_ativo', dias: 'desmob_dias', campo: 'desmob_pico_efetivo', campoLabel: 'Pico Efetivo', hh: adicionais.desmob },
                  { label: 'Integração',        ativo: 'integ_ativo', dias: 'integ_dias', campo: 'integ_pico_efetivo',  campoLabel: 'Pico Efetivo', hh: adicionais.integ },
                  { label: 'Folga',             ativo: 'folga_ativo', dias: 'folga_dias', campo: 'folga_pessoas',        campoLabel: 'Pessoas',      hh: adicionais.folga },
                ] as const).map((row) => {
                  const ativo = cfg[row.ativo] as boolean
                  return (
                    <tr key={row.label} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{row.label}</td>
                      <td className="px-4 py-2 text-center">
                        <Toggle value={ativo} onChange={(v) => setCfg((p) => ({ ...p, [row.ativo]: v }))} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number" min={0} disabled={!ativo}
                          value={cfg[row.dias] as string}
                          onChange={(e) => setCfg((p) => ({ ...p, [row.dias]: e.target.value }))}
                          className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number" min={0} disabled={!ativo}
                          value={cfg[row.campo] as string}
                          onChange={(e) => setCfg((p) => ({ ...p, [row.campo]: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-1 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-2 text-center font-semibold" style={{ color: ativo ? '#1B5E20' : '#9CA3AF' }}>
                        {ativo ? fmtHH(row.hh) : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
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
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">HH Previsto</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">HH Realizado</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Desvio HH</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Desvio %</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Mobilização',    prev: adicionais.mob,             real: 0 },
                  { label: 'Integração',     prev: adicionais.integ,           real: 0 },
                  { label: 'Preparativo',    prev: totPrep.sumHhPlan,          real: totPrep.sumHhReal },
                  { label: 'Parada',         prev: totParada.sumHhPlan,        real: totParada.sumHhReal },
                  { label: 'Acomp. e Desmob.', prev: totAcomp.sumHhPlan,      real: totAcomp.sumHhReal },
                  { label: 'Desmobilização', prev: adicionais.desmob,          real: 0 },
                  { label: 'Folga',          prev: adicionais.folga,           real: 0 },
                ]).map((row) => {
                  const desvio = row.real - row.prev
                  const pct = row.prev > 0 ? desvio / row.prev : null
                  return (
                    <tr key={row.label} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{row.label}</td>
                      <td className="px-4 py-2 text-right text-blue-700">{fmtHH(row.prev)}</td>
                      <td className="px-4 py-2 text-right text-green-700">{fmtHH(row.real)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${desvio < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtHH(desvio)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${(pct ?? 0) < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtPct(pct)}</td>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 w-36">Fase</th>
                  <th className="px-4 py-2 text-right font-semibold text-blue-700">① Orçado</th>
                  <th className="px-4 py-2 text-right font-semibold text-orange-600">② Previsto</th>
                  <th className="px-4 py-2 text-right font-semibold text-green-700">③ Real Faturado</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Mobilização',     prevKey: 'fin_prev_mob',    realKey: 'fin_real_mob' },
                  { label: 'Integração',      prevKey: 'fin_prev_integ',  realKey: 'fin_real_integ' },
                  { label: 'Preparativo',     prevKey: 'fin_prev_prep',   realKey: 'fin_real_prep' },
                  { label: 'Parada',          prevKey: 'fin_prev_parada', realKey: 'fin_real_parada' },
                  { label: 'Acomp. e Desmob.', prevKey: 'fin_prev_acomp', realKey: 'fin_real_acomp' },
                  { label: 'Desmobilização',  prevKey: 'fin_prev_desmob', realKey: 'fin_real_desmob' },
                  { label: 'Folga',           prevKey: 'fin_prev_folga',  realKey: 'fin_real_folga' },
                ] as const).map((row) => (
                  <tr key={row.label} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{row.label}</td>
                    <td className="px-4 py-2 text-right text-blue-700 bg-blue-50 text-xs">
                      {fmtR$(contrato?.valor_orcado ? contrato.valor_orcado / 7 : null)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number" min={0} step={0.01}
                        value={cfg[row.prevKey]}
                        onChange={(e) => setCfg((p) => ({ ...p, [row.prevKey]: e.target.value }))}
                        className="w-32 rounded border border-gray-300 px-2 py-0.5 text-right text-sm focus:border-orange-400 focus:outline-none"
                        placeholder="0,00"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number" min={0} step={0.01}
                        value={cfg[row.realKey]}
                        onChange={(e) => setCfg((p) => ({ ...p, [row.realKey]: e.target.value }))}
                        className="w-32 rounded border border-gray-300 px-2 py-0.5 text-right text-sm focus:border-green-500 focus:outline-none"
                        placeholder="0,00"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-green-700 text-white">
                  <td className="px-4 py-2 font-bold">Total</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtR$(fin.orcado)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtR$(fin.prevTotal)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmtR$(fin.realTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── UCR ──────────────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg">
            <h3 className="text-sm font-semibold text-white">UCR — Uso Consciente do Recurso</h3>
          </div>
          <div className="p-4">
            {/* Limites editáveis */}
            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <span className="font-semibold">Limites:</span>
              {(['ucr_f1', 'ucr_f2', 'ucr_f3', 'ucr_f4'] as const).map((k, i) => (
                <label key={k} className="flex items-center gap-1">
                  <span>F{i + 1}:</span>
                  <input
                    type="number" step={0.01} min={0} max={2}
                    value={cfg[k]}
                    onChange={(e) => setCfg((p) => ({ ...p, [k]: e.target.value }))}
                    className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center focus:border-green-500 focus:outline-none"
                  />
                </label>
              ))}
              {ucrVal != null && (
                <span className="ml-auto font-semibold">
                  UCR atual: <span className="text-green-700">{(ucrVal * 100).toFixed(1)}%</span>
                </span>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Classificação</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">Faixa</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {UCR_ROWS.map((row, i) => {
                  const faixaLabel = (() => {
                    if (i === 0) return `≤ ${(f1 * 100).toFixed(0)}%`
                    if (i === 1) return `${(f1 * 100).toFixed(0)}% – ${(f2 * 100).toFixed(0)}%`
                    if (i === 2) return `${(f2 * 100).toFixed(0)}% – ${(f3 * 100).toFixed(0)}%`
                    if (i === 3) return `${(f3 * 100).toFixed(0)}% – ${(f4 * 100).toFixed(0)}%`
                    return `> ${(f4 * 100).toFixed(0)}%`
                  })()
                  const isCurrent = ucrClass === row.label
                  return (
                    <tr key={row.label} className="border-b last:border-0" style={{ background: isCurrent ? row.bg : undefined }}>
                      <td className="px-4 py-2 font-medium" style={{ color: row.cor }}>{row.label}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{faixaLabel}</td>
                      <td className="px-4 py-2 text-center">
                        {isCurrent && (
                          <span className="rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: row.cor }}>
                            ← Atual
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Daily Grid Component ─────────────────────────────────────────────────────

interface DailyGridProps {
  diasPrep: string[]
  diasParada: string[]
  diasAcomp: string[]
  getDia: (etapa: Etapa, data: string) => DiaState
  setDiaProp: (etapa: Etapa, data: string, prop: keyof DiaState, value: string) => void
  totPrep: { sumHhPlan: number; sumHhReal: number; desvio: number }
  totParada: { sumHhPlan: number; sumHhReal: number; desvio: number }
  totAcomp: { sumHhPlan: number; sumHhReal: number; desvio: number }
}

function DailyGrid({ diasPrep, diasParada, diasAcomp, getDia, setDiaProp, totPrep, totParada, totAcomp }: DailyGridProps) {
  const today = new Date().toISOString().substring(0, 10)

  const cellInput = (etapa: Etapa, data: string, prop: keyof DiaState) => {
    const val = getDia(etapa, data)[prop]
    const weekend = isWeekend(data)
    const isPast = data < today
    const isReal = prop === 'efetivo_real' || prop === 'hh_real'
    const hasMissing = isReal && isPast && !val
    const bg = weekend ? '#f5f5f5' : hasMissing ? '#fff9c4' : ''

    if (weekend) {
      return <td key={prop} className="border border-gray-200 text-center text-xs text-gray-400" style={{ background: bg, minWidth: 52, width: 52 }}>–</td>
    }

    return (
      <td key={prop} className="border border-gray-200 p-0" style={{ background: bg, minWidth: 52, width: 52 }}>
        <input
          type="number" min={0} step={prop.includes('hh') ? '0.1' : '1'}
          value={val}
          onChange={(e) => setDiaProp(etapa, data, prop, e.target.value)}
          className="w-full bg-transparent px-0.5 py-0.5 text-center text-xs focus:bg-yellow-50 focus:outline-none"
        />
      </td>
    )
  }

  const etapaSections: Array<{ etapa: Etapa; label: string; dias: string[]; tot: { sumHhPlan: number; sumHhReal: number; desvio: number } }> = [
    { etapa: 'PREPARATIVO', label: 'Preparativo', dias: diasPrep, tot: totPrep },
    { etapa: 'PARADA', label: 'Parada', dias: diasParada, tot: totParada },
    { etapa: 'ACOMP_DESMOB', label: 'Acomp. e Desmob.', dias: diasAcomp, tot: totAcomp },
  ]

  const noData = diasPrep.length === 0 && diasParada.length === 0 && diasAcomp.length === 0

  if (noData) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
        Configure as datas das etapas para visualizar a grade de HH diário.
      </div>
    )
  }

  type RowType = 'efetivo_plan' | 'hh_plan' | 'acum_plan' | 'efetivo_real' | 'hh_real' | 'acum_real' | 'desvio_hh' | 'desvio_pct' | 'total'

  const ROWS: Array<{ key: RowType; label: string; bg?: string; textColor?: string; bold?: boolean }> = [
    { key: 'efetivo_plan', label: 'Efetivo plan.', bg: '#EEF7EE' },
    { key: 'hh_plan', label: 'HHT plan. (dia)', bg: '#EEF7EE' },
    { key: 'acum_plan', label: '∑ HHT plan.', bg: '#DCEDC8', bold: true },
    { key: 'efetivo_real', label: 'Efetivo real.' },
    { key: 'hh_real', label: 'HHT real. (dia)' },
    { key: 'acum_real', label: '∑ HHT real.', bg: '#E3F2FD', bold: true },
    { key: 'desvio_hh', label: 'Desvio HH (dia)', bg: '#FFF8E1' },
    { key: 'desvio_pct', label: 'Desvio % (dia)', bg: '#FFF8E1' },
    { key: 'total', label: 'Total etapa', bg: '#1B5E20', textColor: '#fff', bold: true },
  ]

  const STICKY_W = 140

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg">
        <h3 className="text-sm font-semibold text-white">Grade de HH Diário</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: STICKY_W, minWidth: STICKY_W }} />
            {etapaSections.flatMap(({ dias }) => [
              ...dias.map((_, i) => <col key={i} style={{ width: 52, minWidth: 52 }} />),
              <col key="tot" style={{ width: 80, minWidth: 80 }} />,
            ])}
          </colgroup>

          {/* Header row 1: etapa names */}
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left text-xs" style={{ position: 'sticky', left: 0, zIndex: 3, width: STICKY_W }}></th>
              {etapaSections.map(({ etapa, label, dias }) => (
                <th
                  key={etapa}
                  colSpan={dias.length + 1}
                  className="border border-gray-300 bg-green-700 py-1 text-center text-xs font-bold text-white"
                  style={{ borderLeft: '2px solid #1B5E20' }}
                >
                  {label} ({dias.length} dias)
                </th>
              ))}
            </tr>

            {/* Header row 2: dates */}
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left text-xs" style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F3F4F6' }}>Linha</th>
              {etapaSections.flatMap(({ etapa, dias }) => [
                ...dias.map((d) => (
                  <th
                    key={`${etapa}_${d}`}
                    className="border border-gray-300 py-0.5 text-center text-xs font-medium"
                    style={{
                      background: isWeekend(d) ? '#f5f5f5' : '#F9FAFB',
                      color: isWeekend(d) ? '#9CA3AF' : '#374151',
                      borderLeft: etapa !== 'PREPARATIVO' && d === etapaSections.find(s => s.etapa === etapa)?.dias[0] ? '2px solid #1B5E20' : undefined,
                    }}
                  >
                    {dayLabel(d).split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  </th>
                )),
                <th key={`${etapa}_tot`} className="border border-gray-300 bg-green-100 py-1 text-center text-xs font-bold text-green-800">TOTAL</th>,
              ])}
            </tr>
          </thead>

          <tbody>
            {ROWS.map(({ key, label, bg, textColor, bold }) => (
              <tr key={key}>
                {/* Sticky label cell */}
                <td
                  className="border border-gray-200 px-2 py-0.5 font-medium"
                  style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: bg ?? '#fff', color: textColor ?? '#374151',
                    fontWeight: bold ? 700 : 400,
                    width: STICKY_W,
                  }}
                >
                  {label}
                </td>

                {etapaSections.flatMap(({ etapa, dias, tot }) => {
                  let acum = 0
                  const cells = dias.map((d) => {
                    const dia = getDia(etapa, d)
                    const weekend = isWeekend(d)
                    const isPast = d < today

                    if (key === 'efetivo_plan') {
                      return cellInput(etapa, d, 'efetivo_plan')
                    }
                    if (key === 'hh_plan') {
                      return cellInput(etapa, d, 'hh_plan')
                    }
                    if (key === 'acum_plan') {
                      if (!weekend) acum += n(dia.hh_plan)
                      return (
                        <td key={d} className="border border-gray-200 text-center" style={{ background: '#DCEDC8', fontWeight: 700 }}>
                          {acum > 0 ? acum.toFixed(1) : '–'}
                        </td>
                      )
                    }
                    if (key === 'efetivo_real') {
                      return cellInput(etapa, d, 'efetivo_real')
                    }
                    if (key === 'hh_real') {
                      return cellInput(etapa, d, 'hh_real')
                    }
                    if (key === 'acum_real') {
                      if (!weekend) acum += n(dia.hh_real)
                      return (
                        <td key={d} className="border border-gray-200 text-center" style={{ background: '#E3F2FD', fontWeight: 700 }}>
                          {acum > 0 ? acum.toFixed(1) : '–'}
                        </td>
                      )
                    }
                    if (key === 'desvio_hh') {
                      const dev = n(dia.hh_real) - n(dia.hh_plan)
                      const hasData = dia.hh_real !== '' || dia.hh_plan !== ''
                      const hasMissing = isPast && !dia.hh_real && !weekend
                      return (
                        <td key={d} className="border border-gray-200 text-center text-xs"
                          style={{
                            background: weekend ? '#f5f5f5' : hasMissing ? '#fff9c4' : dev > 0 ? '#c8e6c9' : dev < 0 ? '#ffcdd2' : '#FFF8E1',
                          }}>
                          {weekend ? '–' : hasData ? dev.toFixed(1) : '–'}
                        </td>
                      )
                    }
                    if (key === 'desvio_pct') {
                      const plan = n(dia.hh_plan)
                      const real = n(dia.hh_real)
                      const hasMissing = isPast && !dia.hh_real && !weekend
                      const pct = plan > 0 ? (real - plan) / plan : null
                      return (
                        <td key={d} className="border border-gray-200 text-center text-xs"
                          style={{
                            background: weekend ? '#f5f5f5' : hasMissing ? '#fff9c4' : pct != null && pct > 0 ? '#c8e6c9' : pct != null && pct < 0 ? '#ffcdd2' : '#FFF8E1',
                          }}>
                          {weekend ? '–' : pct != null ? `${(pct * 100).toFixed(1)}%` : '–'}
                        </td>
                      )
                    }
                    if (key === 'total') {
                      return <td key={d} className="border border-gray-200" style={{ background: '#1B5E20' }} />
                    }
                    return <td key={d} />
                  })

                  // Total column
                  let totalCell: React.ReactNode
                  if (key === 'efetivo_plan' || key === 'efetivo_real') {
                    totalCell = <td className="border border-gray-200 bg-green-100 text-center font-bold">–</td>
                  } else if (key === 'hh_plan' || key === 'acum_plan') {
                    totalCell = <td className="border border-gray-200 bg-green-100 text-center font-bold text-blue-700">{fmtHH(tot.sumHhPlan)}</td>
                  } else if (key === 'hh_real' || key === 'acum_real') {
                    totalCell = <td className="border border-gray-200 bg-green-100 text-center font-bold text-green-700">{fmtHH(tot.sumHhReal)}</td>
                  } else if (key === 'desvio_hh') {
                    totalCell = <td className={`border border-gray-200 bg-green-100 text-center font-bold ${tot.desvio < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtHH(tot.desvio)}</td>
                  } else if (key === 'desvio_pct') {
                    const pct = tot.sumHhPlan > 0 ? tot.desvio / tot.sumHhPlan : null
                    totalCell = <td className={`border border-gray-200 bg-green-100 text-center font-bold ${(pct ?? 0) < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtPct(pct)}</td>
                  } else if (key === 'total') {
                    totalCell = (
                      <td className="border border-gray-200 p-1 text-center text-xs font-bold text-white" style={{ background: '#1B5E20' }}>
                        <div>P: {fmtHH(tot.sumHhPlan)}</div>
                        <div>R: {fmtHH(tot.sumHhReal)}</div>
                        <div className={tot.desvio < 0 ? 'text-red-300' : 'text-green-300'}>{fmtHH(tot.desvio)}</div>
                      </td>
                    )
                  } else {
                    totalCell = <td className="border border-gray-200 bg-green-100" />
                  }

                  return [...cells, totalCell]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
