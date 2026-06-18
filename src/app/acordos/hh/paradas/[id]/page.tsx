'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, MapPin, User, Building2, Briefcase } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Etapa = 'PREPARATIVO' | 'PARADA' | 'ACOMP_DESMOB'

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

  ucr_nao_suficiente: string; ucr_a_evoluir: string; ucr_bom: string; ucr_otimo: string; ucr_esplendido: string
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
    ucr_nao_suficiente: '161.98', ucr_a_evoluir: '162.00', ucr_bom: '180.00', ucr_otimo: '234.00', ucr_esplendido: '270.00',
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
    ucr_nao_suficiente: s(c.ucr_nao_suficiente) || '161.98',
    ucr_a_evoluir: s(c.ucr_a_evoluir) || '162.00',
    ucr_bom: s(c.ucr_bom) || '180.00',
    ucr_otimo: s(c.ucr_otimo) || '234.00',
    ucr_esplendido: s(c.ucr_esplendido) || '270.00',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-green-600' : 'bg-gray-300'}`}>
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
  label: string; inicio: string; fim: string
  onChangeInicio: (v: string) => void; onChangeFim: (v: string) => void
}) {
  const duracao = useMemo(() => diasEntreDatas(inicio, fim).length, [inicio, fim])
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
          etapa: Etapa; data: string
          efetivo_plan: number | null; hh_plan: number | null
          efetivo_real: number | null; hh_real: number | null
        }>
        const map = new Map<string, DiaState>()
        for (const d of diasApi) {
          map.set(`${d.etapa}__${d.data.substring(0, 10)}`, {
            efetivo_plan: d.efetivo_plan != null ? String(d.efetivo_plan) : '',
            hh_plan: d.hh_plan != null ? String(d.hh_plan) : '',
            efetivo_real: d.efetivo_real != null ? String(d.efetivo_real) : '',
            hh_real: d.hh_real != null ? String(d.hh_real) : '',
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
    dias.get(`${etapa}__${data}`) ?? { efetivo_plan: '', hh_plan: '', efetivo_real: '', hh_real: '' },
    [dias])

  const setDiaProp = useCallback((etapa: Etapa, data: string, prop: keyof DiaState, value: string) => {
    const key = `${etapa}__${data}`
    setDias((prev) => {
      const next = new Map(prev)
      const cur = next.get(key) ?? { efetivo_plan: '', hh_plan: '', efetivo_real: '', hh_real: '' }
      next.set(key, { ...cur, [prop]: value })
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

  // ── Pico efetivo da etapa Parada (auto-calculado) ──────────────────────────
  const picoEfetivoPrev = useMemo(() =>
    diasParada.reduce((mx, d) => Math.max(mx, n(getDia('PARADA', d).efetivo_plan)), 0),
    [dias, diasParada, getDia])

  const picoEfetivoReal = useMemo(() =>
    diasParada.reduce((mx, d) => Math.max(mx, n(getDia('PARADA', d).efetivo_real)), 0),
    [dias, diasParada, getDia])

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

  // ── UCR — classificação por R$/HH ─────────────────────────────────────────
  function classifyRsHH(rsHH: number | null): string | null {
    if (rsHH == null || isNaN(rsHH)) return null
    if (rsHH <= n(cfg.ucr_nao_suficiente)) return 'Não Suficiente'
    if (rsHH <= n(cfg.ucr_a_evoluir))      return 'A Evoluir'
    if (rsHH <= n(cfg.ucr_bom))            return 'Bom'
    if (rsHH <= n(cfg.ucr_otimo))          return 'Ótimo'
    return 'Esplêndido'
  }

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
        ucr_nao_suficiente: n(cfg.ucr_nao_suficiente),
        ucr_a_evoluir: n(cfg.ucr_a_evoluir),
        ucr_bom: n(cfg.ucr_bom),
        ucr_otimo: n(cfg.ucr_otimo),
        ucr_esplendido: n(cfg.ucr_esplendido),
        dias: Array.from(dias.entries()).map(([key, val]) => {
          const [etapa, data] = key.split('__')
          return {
            etapa: etapa as Etapa, data,
            efetivo_plan: val.efetivo_plan ? parseInt(val.efetivo_plan) : null,
            hh_plan: val.hh_plan ? n(val.hh_plan) : null,
            efetivo_real: val.efetivo_real ? parseInt(val.efetivo_real) : null,
            hh_real: val.hh_real ? n(val.hh_real) : null,
          }
        }),
      }
      await fetch(`/api/acordos/hh/paradas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    } finally { setSaving(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }

  const UCR_ROWS = [
    { label: 'Não Suficiente', cor: '#C62828', bg: '#FFCDD2', cfgKey: 'ucr_nao_suficiente' as const },
    { label: 'A Evoluir',      cor: '#F9A825', bg: '#FFF9C4', cfgKey: 'ucr_a_evoluir'      as const },
    { label: 'Bom',            cor: '#2E7D32', bg: '#C8E6C9', cfgKey: 'ucr_bom'            as const },
    { label: 'Ótimo',          cor: '#1565C0', bg: '#BBDEFB', cfgKey: 'ucr_otimo'          as const },
    { label: 'Esplêndido',     cor: '#AD1457', bg: '#F8BBD9', cfgKey: 'ucr_esplendido'     as const },
  ]

  function getUcrStyle(label: string | null) {
    const row = UCR_ROWS.find((r) => r.label === label)
    return row ?? null
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
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
            <Save size={16} />
            {saving ? 'Salvando…' : 'Lançar realizado'}
          </button>
        </div>
      </div>

      {/* ── Scrollable Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

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
          <EtapaCard label="Preparativo"
            inicio={cfg.prep_inicio} fim={cfg.prep_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, prep_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, prep_fim: v }))} />
          <EtapaCard label="Parada"
            inicio={cfg.parada_inicio} fim={cfg.parada_fim}
            onChangeInicio={(v) => setCfg((p) => ({ ...p, parada_inicio: v }))}
            onChangeFim={(v) => setCfg((p) => ({ ...p, parada_fim: v }))} />
          <EtapaCard label="Acomp. e Desmob."
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
          getDia={getDia} setDiaProp={setDiaProp}
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
                        <Toggle value={ativo} onChange={(v) => setCfg((p) => ({ ...p, [row.ativoKey]: v }))} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo}
                          value={cfg[row.prevKey]}
                          onChange={(e) => setCfg((p) => ({ ...p, [row.prevKey]: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo}
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
                        <Toggle value={ativo} onChange={(v) => setCfg((p) => ({ ...p, folga_ativo: v }))} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo}
                          value={cfg.folga_dias_prev}
                          onChange={(e) => setCfg((p) => ({ ...p, folga_dias_prev: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input type="number" min={0} step={0.1} disabled={!ativo}
                          value={cfg.folga_dias_real}
                          onChange={(e) => setCfg((p) => ({ ...p, folga_dias_real: e.target.value }))}
                          className="w-20 rounded border border-gray-300 px-2 py-0.5 text-center text-sm disabled:cursor-not-allowed disabled:bg-gray-100" />
                      </td>
                      {/* Pessoas em vez de pico */}
                      <td className="px-4 py-2.5 text-center text-xs">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-blue-600 w-10">Prev:</span>
                            <input type="number" min={0} disabled={!ativo}
                              value={cfg.folga_pessoas_prev}
                              onChange={(e) => setCfg((p) => ({ ...p, folga_pessoas_prev: e.target.value }))}
                              className="w-16 rounded border border-gray-300 px-1 py-0.5 text-center text-xs disabled:cursor-not-allowed disabled:bg-gray-100" />
                          </div>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-green-600 w-10">Real:</span>
                            <input type="number" min={0} disabled={!ativo}
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
                  { label: 'Acomp. e Desmob.',   prev: totAcomp.sumHhPlan,     real: totAcomp.sumHhReal },
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
                    <input type="number" min={0} step={0.01}
                      value={cfg.fin_prev_valor_servico}
                      onChange={(e) => setCfg((p) => ({ ...p, fin_prev_valor_servico: e.target.value }))}
                      placeholder="0,00"
                      className="w-36 rounded border border-gray-300 px-2 py-1 text-right focus:border-green-500 focus:outline-none" />
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
                    <input type="number" min={0} step={0.01}
                      value={cfg.fin_prev_ase}
                      onChange={(e) => setCfg((p) => ({ ...p, fin_prev_ase: e.target.value }))}
                      placeholder="0,00"
                      className="w-36 rounded border border-gray-300 px-2 py-1 text-right focus:border-green-500 focus:outline-none" />
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

        {/* ── UCR — leitura apenas (configurado no cadastro do contrato) ───── */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">UCR — Uso Consciente do Recurso</h3>
            <span className="text-[11px] text-green-200 font-normal">Faixas configuradas no cadastro do contrato</span>
          </div>
          <div className="flex flex-wrap gap-3 p-4">
            {UCR_ROWS.map((row, i) => {
              const curr = n(cfg[row.cfgKey])
              const prevVal = i > 0 ? n(cfg[UCR_ROWS[i - 1].cfgKey]) : null
              const faixaLabel = i === 0
                ? `≤ ${fmtR$(curr)}`
                : i === UCR_ROWS.length - 1
                  ? `> ${fmtR$(prevVal!)}`
                  : `${fmtR$(prevVal!)} – ${fmtR$(curr)}`
              const isAtiva =
                classifyRsHH(finOrcadoRsHH) === row.label ||
                classifyRsHH(finPrevRsHH)   === row.label ||
                classifyRsHH(finRealRsHH)   === row.label
              return (
                <div key={row.label}
                  className="flex-1 min-w-[120px] rounded-lg border-2 px-3 py-2 text-center"
                  style={{
                    borderColor: isAtiva ? row.cor : '#E5E7EB',
                    background: isAtiva ? row.bg : '#FAFAFA',
                  }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: row.cor }}>
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-gray-700">{faixaLabel}</div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Daily Grid ───────────────────────────────────────────────────────────────

interface DailyGridProps {
  diasPrep: string[]; diasParada: string[]; diasAcomp: string[]
  getDia: (etapa: Etapa, data: string) => DiaState
  setDiaProp: (etapa: Etapa, data: string, prop: keyof DiaState, value: string) => void
}

function DailyGrid({ diasPrep, diasParada, diasAcomp, getDia, setDiaProp }: DailyGridProps) {
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
    { etapa: 'ACOMP_DESMOB', label: 'Acomp. e Desmob.', dias: diasAcomp },
  ]

  const ROWS: Array<{ key: string; label: string; bg?: string; bold?: boolean }> = [
    { key: 'efetivo_plan', label: 'Efetivo plan.',    bg: '#EEF7EE' },
    { key: 'hh_plan',      label: 'HHT plan. (dia)', bg: '#EEF7EE' },
    { key: 'acum_plan',    label: '∑ HHT plan.',     bg: '#DCEDC8', bold: true },
    { key: 'efetivo_real', label: 'Efetivo real.' },
    { key: 'hh_real',      label: 'HHT real. (dia)' },
    { key: 'acum_real',    label: '∑ HHT real.',     bg: '#E3F2FD', bold: true },
    { key: 'desvio_hh',    label: 'Desvio HH (dia)', bg: '#FAFAFA' },
    { key: 'desvio_pct',   label: 'Desvio % (dia)',  bg: '#FAFAFA' },
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
            {ROWS.map(({ key, label, bg, bold }) => (
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
                  let acum = 0
                  return dias.map((d) => {
                    const dia = getDia(etapa, d)
                    const weekend = isWeekend(d)

                    if (key === 'efetivo_plan' || key === 'efetivo_real') {
                      const prop = key as keyof DiaState
                      const val = dia[prop]
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200 p-0"
                          style={{ background: bg ?? '#fff', minWidth: COL_W, width: COL_W }}>
                          <input type="number" min={0} step="1" value={val}
                            onChange={(e) => setDiaProp(etapa, d, prop, e.target.value)}
                            className="w-full bg-transparent px-0.5 py-0.5 focus:bg-yellow-50 focus:outline-none"
                            style={{ textAlign: 'center', color: (weekend && val !== '') ? '#C62828' : undefined }} />
                        </td>
                      )
                    }

                    if (key === 'hh_plan' || key === 'hh_real') {
                      const prop = key as keyof DiaState
                      const val = dia[prop]
                      return (
                        <td key={`${etapa}_${d}`} className="border border-gray-200 p-0"
                          style={{ background: bg ?? '#fff', minWidth: COL_W, width: COL_W }}>
                          <input type="text" inputMode="decimal" value={val}
                            onChange={(e) => setDiaProp(etapa, d, prop, e.target.value)}
                            onBlur={(e) => {
                              const num = n(e.target.value)
                              setDiaProp(etapa, d, prop,
                                num > 0 ? num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '')
                            }}
                            className="w-full bg-transparent px-0.5 py-0.5 focus:bg-yellow-50 focus:outline-none"
                            style={{ textAlign: 'center', color: (weekend && val !== '') ? '#C62828' : undefined }} />
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
