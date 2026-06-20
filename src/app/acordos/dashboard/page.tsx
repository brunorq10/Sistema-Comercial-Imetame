'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const TREEMAP_COLORS = [
  '#1B5E20','#1565C0','#6A1B9A','#BF360C','#E65100',
  '#2E7D32','#0277BD','#4527A0','#C62828','#F57F17',
  '#00695C','#37474F',
]

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface MesData {
  mes:          number
  label:        string
  previsto:     number
  valor_fixado: number | null
  faturado:     number
  percentual:   number
  resultado:    number
  consolidado:  boolean
}

interface DashData {
  anoAtual:            number
  mesAtual:            number
  totalFaturadoAno:    number
  prevFaturamentoAno:  number
  aFaturarAno:         number
  faturamentoProxAnos: number
  prevMesAtual:        number
  faturadoMesAtual:    number
  faturadoUltimoMes:   number
  prevProxMes:         number
  percFaturadoGeral:   number
  porRamo:    { ramo: string; valor: number; percentual: number }[]
  porCliente: { nome: string; valor: number; percentual: number }[]
  porMes:     MesData[]
  clientes:   { id: number; nome: string }[]
}

const RAMO_OPTIONS = [
  { value: 'PAPEL_CELULOSE', label: 'Papel e Celulose' },
  { value: 'SIDERURGIA',     label: 'Siderurgia' },
  { value: 'MINERACAO',      label: 'Mineração' },
  { value: 'OLEO_GAS',       label: 'Óleo e Gás' },
  { value: 'OUTROS',         label: 'Outros' },
]

// ── Card de métrica ──────────────────────────────────────────────────────────
function MetricCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <div className="bg-green-dark px-3.5 py-2">
        <p className="text-[10px] font-semibold text-white/85 leading-snug uppercase tracking-[0.04em]">
          {label}{sub && <span className="text-white/50 font-normal normal-case"> · {sub}</span>}
        </p>
      </div>
      <div className="bg-white px-3.5 py-3">
        <p className="text-[20px] font-bold text-gray-900 leading-none">{fmt(value)}</p>
      </div>
    </div>
  )
}

// ── Barra de progresso horizontal ────────────────────────────────────────────
function PercConcluido({ percent, faturado, previsto }: { percent: number; faturado: number; previsto: number }) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div>
      {/* Linha superior: % grande + legenda */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[48px] font-bold text-green-dark leading-none">
            {percent.toFixed(1).replace('.', ',')}%
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">concluído no ano</p>
        </div>
        <div className="flex gap-5 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-primary flex-shrink-0" />
            <span className="text-[11px] text-gray-500">Faturado</span>
            <span className="text-[11px] font-bold text-green-dark ml-1">{fmt(faturado)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-light border border-green-primary flex-shrink-0" />
            <span className="text-[11px] text-gray-500">Previsto</span>
            <span className="text-[11px] font-semibold text-gray-600 ml-1">{fmt(previsto)}</span>
          </div>
        </div>
      </div>

      {/* Barra horizontal */}
      <div className="h-4 bg-green-light rounded-full overflow-hidden">
        <div
          className="h-full bg-green-primary rounded-full transition-all duration-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400">0%</span>
        <span className="text-[9px] text-gray-400">100%</span>
      </div>
    </div>
  )
}

// ── Barras horizontais por Ramo ───────────────────────────────────────────────
function BarrasRamo({ data }: { data: { ramo: string; percentual: number; valor: number }[] }) {
  if (data.length === 0) return <p className="text-[11px] text-gray-400 py-6 text-center">Sem dados</p>
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((item) => (
        <div key={item.ramo}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] text-gray-700 font-medium">{item.ramo}</span>
            <span className="text-[10px] text-gray-500">{item.percentual.toFixed(1)}%</span>
          </div>
          <div className="h-[10px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-primary rounded-full transition-all duration-700"
              style={{ width: `${item.percentual}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5">{fmt(item.valor)}</p>
        </div>
      ))}
    </div>
  )
}

// ── Treemap: algoritmo squarify (Bruls et al.) ────────────────────────────────
type TRect = { nome: string; percentual: number; x: number; y: number; w: number; h: number }

function worstRatio(areas: number[], rowArea: number, short: number): number {
  const maxA = Math.max(...areas)
  const minA = Math.min(...areas)
  return Math.max(
    (short * short * maxA) / (rowArea * rowArea),
    (rowArea * rowArea) / (short * short * minA),
  )
}

function squarify(
  items: { nome: string; valor: number; percentual: number }[],
  x: number, y: number, w: number, h: number,
): TRect[] {
  if (items.length === 0) return []

  const total     = items.reduce((s, i) => s + i.valor, 0)
  const totalArea = w * h
  const data      = items.map(i => ({ ...i, area: (i.valor / total) * totalArea }))

  const result: TRect[] = []
  let remaining = [...data]
  let rx = x, ry = y, rw = w, rh = h

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      result.push({ nome: remaining[0].nome, percentual: remaining[0].percentual, x: rx, y: ry, w: rw, h: rh })
      break
    }

    const short = Math.min(rw, rh)
    let row     = [remaining[0]]
    let rowArea = remaining[0].area

    for (let i = 1; i < remaining.length; i++) {
      const candidate  = remaining[i]
      const newRow     = [...row, candidate]
      const newRowArea = rowArea + candidate.area
      const curr       = worstRatio(row.map(r => r.area), rowArea, short)
      const next       = worstRatio(newRow.map(r => r.area), newRowArea, short)
      if (next <= curr) { row = newRow; rowArea = newRowArea } else break
    }

    if (rw <= rh) {
      const stripH = rowArea / rw
      let lx = rx
      for (const item of row) {
        result.push({ nome: item.nome, percentual: item.percentual, x: lx, y: ry, w: rw * (item.area / rowArea), h: stripH })
        lx += rw * (item.area / rowArea)
      }
      ry += stripH; rh -= stripH
    } else {
      const stripW = rowArea / rh
      let ly = ry
      for (const item of row) {
        result.push({ nome: item.nome, percentual: item.percentual, x: rx, y: ly, w: stripW, h: rh * (item.area / rowArea) })
        ly += rh * (item.area / rowArea)
      }
      rx += stripW; rw -= stripW
    }

    remaining = remaining.slice(row.length)
  }

  return result
}

function Treemap({ data }: { data: { nome: string; valor: number; percentual: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => { const r = el.getBoundingClientRect(); setDims({ w: r.width, h: r.height }) }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (data.length === 0) return <p className="text-[11px] text-gray-400 py-6 text-center">Sem dados</p>

  const rects = dims.w > 0 ? squarify(data, 0, 0, dims.w, dims.h) : []

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 440 }}>
      {rects.map((rect, i) => {
        const cellW = Math.max(0, rect.w - 2)
        const cellH = Math.max(0, rect.h - 2)
        const nameSize = cellW < 70 ? 8 : 9
        const pctSize  = cellW < 70 ? 9 : 11
        return (
          <div
            key={rect.nome}
            className="absolute flex flex-col items-center justify-center rounded"
            style={{
              left:   rect.x + 1,
              top:    rect.y + 1,
              width:  cellW,
              height: cellH,
              backgroundColor: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
              overflow: 'visible',
              zIndex: 0,
            }}
          >
            <div
              className="flex flex-col items-center justify-center text-center px-1 pointer-events-none"
              style={{
                maxWidth: Math.max(cellW, 80),
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span
                className="text-white font-semibold leading-tight"
                style={{
                  fontSize: nameSize,
                  display: '-webkit-box',
                  WebkitLineClamp: cellH < 32 ? 1 : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                {rect.nome}
              </span>
              <span
                className="text-white font-bold mt-0.5"
                style={{
                  fontSize: pctSize,
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                {rect.percentual.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tabela Previsão x Realizado por Mês ──────────────────────────────────────
function TabelaMensal({ data, ano }: { data: MesData[]; ano: number }) {
  const totPrev  = data.reduce((s, d) => s + d.previsto, 0)
  const totFat   = data.reduce((s, d) => s + d.faturado, 0)
  const totRes   = data.reduce((s, d) => s + d.resultado, 0)
  const totFixed = data.reduce((s, d) => s + (d.valor_fixado ?? 0), 0)
  const totPct   = totPrev > 0 ? (totFat / totPrev) * 100 : 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-green-dark px-4 py-2.5 text-center">
        <h3 className="text-[12px] font-semibold text-white uppercase tracking-wide">
          Previsão x Realizado por Mês — {ano}
        </h3>
        <p className="text-[9px] text-white/50 mt-0.5">Verde = mês com consolidado gerado · Valor Fixado = snapshot do consolidado</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-green-dark text-white text-[11px]">
              <th className="text-left   px-4 py-2 font-semibold w-32">Mês</th>
              <th className="text-right  px-4 py-2 font-semibold">Valor Fixado</th>
              <th className="text-right  px-4 py-2 font-semibold">Previsto {ano}</th>
              <th className="text-right  px-4 py-2 font-semibold">Valor Total Faturado {ano}</th>
              <th className="text-center px-4 py-2 font-semibold w-32">% Fat. / Previsto</th>
              <th className="text-right  px-4 py-2 font-semibold">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={row.mes}
                className={[
                  row.consolidado ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                  'border-b border-gray-100',
                ].join(' ')}
              >
                <td className={`px-4 py-2 font-medium ${row.consolidado ? 'text-green-800' : 'text-gray-700'}`}>
                  {row.label}
                  {row.consolidado && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle" />
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.valor_fixado != null
                    ? <span className="text-[#6A1B9A] font-semibold">{fmt(row.valor_fixado)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right text-gray-700 tabular-nums">{fmt(row.previsto)}</td>
                <td className="px-4 py-2 text-right text-gray-700 tabular-nums">{fmt(row.faturado)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                    row.percentual >= 100 ? 'bg-green-100 text-green-800' : 'bg-orange-50 text-orange-700'
                  }`}>
                    {row.percentual.toFixed(1).replace('.', ',')}%
                  </span>
                </td>
                <td className={`px-4 py-2 text-right font-semibold tabular-nums ${
                  row.resultado >= 0 ? 'text-green-700' : 'text-red-600'
                }`}>
                  {fmt(row.resultado)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-dark text-white font-bold text-[12px]">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-purple-200">{totFixed > 0 ? fmt(totFixed) : '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totPrev)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totFat)}</td>
              <td className="px-4 py-2.5 text-center">{totPct.toFixed(1).replace('.', ',')}%</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${totRes >= 0 ? 'text-green-200' : 'text-red-300'}`}>
                {fmt(totRes)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i)

export default function DashboardAcordosPage() {
  const [data, setData]       = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Filtros
  const [ano,       setAno]       = useState(String(ANO_ATUAL))
  const [clienteId, setClienteId] = useState('')
  const [ramo,      setRamo]      = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (ano && ano !== String(ANO_ATUAL)) params.set('ano', ano)
    if (clienteId) params.set('clienteId', clienteId)
    if (ramo)      params.set('ramo', ramo)
    const qs = params.toString()
    fetch(`/api/acordos/dashboard${qs ? '?' + qs : ''}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error)
        else setData(j.data)
      })
      .catch(() => setError('Falha ao carregar dados'))
      .finally(() => setLoading(false))
  }, [ano, clienteId, ramo])

  useEffect(() => { fetchData() }, [fetchData])

  const anoNum = parseInt(ano, 10) || ANO_ATUAL
  const mesAtual = data?.mesAtual ?? (new Date().getMonth() + 1)
  const mesLabel     = MES_LABEL[mesAtual - 1]
  const mesAntLabel  = MES_LABEL[mesAtual === 1 ? 11 : mesAtual - 2]
  const mesProxLabel = MES_LABEL[mesAtual === 12 ? 0 : mesAtual]

  const clientes = data?.clientes ?? []

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em]'
  const selectCls = 'w-full px-2 py-[5px] border border-gray-300 rounded text-[11px] text-gray-800 bg-white outline-none focus:border-green-primary transition-colors'

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Dashboard Acordos</h2>
        {data && <span className="text-[11px] text-gray-400">{mesLabel} / {data.anoAtual}</span>}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 flex flex-wrap gap-2.5 items-end">
        <div className="min-w-[90px]">
          <label className={fLbl}>Ano</label>
          <select value={ano} onChange={(e) => setAno(e.target.value)} className={selectCls}>
            {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className={fLbl}>Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className={fLbl}>Ramo</label>
          <select value={ramo} onChange={(e) => setRamo(e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {RAMO_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setAno(String(ANO_ATUAL)); setClienteId(''); setRamo('') }}
          className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] hover:bg-gray-100 transition-colors"
        >
          ✕ Limpar
        </button>
      </div>

      {loading && <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>}
      {error   && <p className="text-center text-red-500 py-8 text-sm">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* ── Linha 1: Cards anuais ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Valor Total Faturado" sub={`Ano ${data.anoAtual}`}         value={data.totalFaturadoAno} />
            <MetricCard label="Prev. Faturamento"    sub={`Ano ${data.anoAtual}`}         value={data.prevFaturamentoAno} />
            <MetricCard label="À Faturar"            sub={`Ano ${data.anoAtual}`}         value={data.aFaturarAno} />
            <MetricCard label="Fat. Próximos Anos"   sub="Anos seguintes"                 value={data.faturamentoProxAnos} />
          </div>

          {/* ── Linha 2: Cards mensais ────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label={`Previsão Fat. ${mesLabel}`}    sub="Mês atual"   value={data.prevMesAtual} />
            <MetricCard label={`Faturado ${mesLabel}`}         sub="Mês atual"   value={data.faturadoMesAtual} />
            <MetricCard label={`Faturado ${mesAntLabel}`}      sub="Último mês"  value={data.faturadoUltimoMes} />
            <MetricCard label={`Previsão ${mesProxLabel}`}     sub="Próximo mês" value={data.prevProxMes} />
          </div>

          {/* ── Linha 3: Gauge + Barras horizontais ───────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-[12px] font-semibold text-gray-700 mb-4 text-center uppercase tracking-wide">
                % Faturado Geral — {data.anoAtual}
              </h3>
              <PercConcluido
                percent={data.percFaturadoGeral}
                faturado={data.totalFaturadoAno}
                previsto={data.prevFaturamentoAno}
              />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-[12px] font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                % Faturado por Ramo — {data.anoAtual}
              </h3>
              <BarrasRamo data={data.porRamo} />
            </div>
          </div>

          {/* ── Linha 4: Treemap por Cliente ─────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-[12px] font-semibold text-gray-700 mb-4 text-center uppercase tracking-wide">
              Distribuição por Cliente — {data.anoAtual}
            </h3>
            <Treemap data={data.porCliente} />
          </div>

          {/* ── Linha 5: Tabela Previsão x Realizado ─────────────────────── */}
          <TabelaMensal data={data.porMes} ano={anoNum} />
        </>
      )}
    </div>
  )
}
