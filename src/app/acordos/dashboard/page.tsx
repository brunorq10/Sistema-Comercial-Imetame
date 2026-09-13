'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { MultasIndicador } from '@/components/acordos/MultasIndicador'
import { ComposicaoFaturamentoView } from '@/components/acordos/ComposicaoFaturamentoView'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { ContratoAvancoPercentualChart } from '@/components/faturamento/ContratoFaturamentoChart'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { FilterBar, FilterField, ClearFiltersButton, filterSelectClass } from '@/components/dashboard/FilterBar'
import { ProgressBar } from '@/components/dashboard/ProgressBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/dashboard/Avatar'
import { DASHBOARD_POSITIVO, DASHBOARD_PREVISTO, DASHBOARD_ATENCAO } from '@/lib/dashboardColors'
import { formatCurrency, cn } from '@/lib/utils'
import { TIPOS_MULTA } from '@/lib/multas'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const MES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fmt = formatCurrency
// Valor por extenso (sem abreviação M/K) — pontos de milhar e vírgula decimal
function fmtM(v: number) {
  return fmt(v)
}

interface MesData {
  mes: number; label: string; previsto: number; previsto_bruto: number; valor_fixado: number | null
  faturado: number; percentual: number; resultado: number; consolidado: boolean
}
interface DashData {
  anoAtual: number; mesAtual: number
  totalFaturadoAno: number; prevFaturamentoAno: number; aFaturarAno: number; faturamentoProxAnos: number
  prevMesAtual: number; faturadoMesAtual: number; faturadoUltimoMes: number; prevProxMes: number
  percFaturadoGeral: number
  porRamo:    { ramo: string; real: number; previsto: number }[]
  porRamoHh:  { ramo: string; real: number; previsto: number }[]
  porCliente: { id: number; nome: string; real: number; previsto: number }[]
  porMes:     MesData[]
  porResponsavel: { id: number | null; nome: string; contratos: number; valorSobGestao: number; previsto: number; realizado: number; aderencia: number; saldo: number }[]
  ocorrenciasPorResponsavel: { id: number; nome: string; osSobGestao: number; total: number }[]
  clientes: { id: number; nome: string }[]
  clientesFinais: { id: number; nome: string }[]
  responsaveis: { id: number; nome: string }[]
  cidades: string[]
}

const RAMO_OPTIONS = [
  { value: 'PAPEL_CELULOSE_OBRAS',   label: 'Papel e Celulose - Obras' },
  { value: 'PAPEL_CELULOSE_PARADAS', label: 'Papel e Celulose - Paradas' },
  { value: 'SIDERURGIA',             label: 'Siderurgia' },
  { value: 'OLEO_GAS',               label: 'Óleo e Gás' },
  { value: 'OLEO_GAS_PETRO',         label: 'Óleo e Gás - Petro' },
  { value: 'OUTROS',                 label: 'Outros' },
]

// ══ Gauge (velocímetro) ══
function Gauge({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent))
  const data = {
    datasets: [{ data: [p, 100 - p], backgroundColor: [DASHBOARD_POSITIVO, '#E5E7EB'], borderWidth: 0, circumference: 180, rotation: 270 }],
  }
  const opts = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } },
  }
  return (
    <div className="relative mx-auto" style={{ height: 280, maxWidth: 460 }}>
      <Doughnut data={data} options={opts} />
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-[36px] font-bold text-green-primary leading-none">{percent.toFixed(1).replace('.', ',')}%</span>
      </div>
    </div>
  )
}

// ══ Tabela — Faturamento/HH por mercado, com toggle Previsto/Real ══
// Mesmo formato/config para os dois indicadores (Faturamento por mercado e HH
// por mercado) — só muda a formatação do valor. Todos os mercados aparecem
// sempre (mesmo zerados); ordenação sempre do maior para o menor % conforme a
// métrica selecionada no toggle.
const MERCADO_COLORS = ['#16A34A', '#1565C0', '#F59E0B', '#8B5CF6', '#DC2626', '#0891B2']

type MercadoDatum = { ramo: string; real: number; previsto: number }
type Metrica = 'real' | 'previsto'

// Barra de participação em escala fixa de 0-100% (não relativa ao maior valor
// da lista) — largura mínima perceptível para valores > 0 muito pequenos;
// trilho com hachura para linhas zeradas (zero "intencional", não "sem dado").
// `w-full` de propósito: a coluna que a contém tem largura FIXA (colgroup),
// então a barra sempre tem o mesmo tamanho de trilho em toda linha, mesmo com
// valores/rótulos de larguras diferentes nas colunas vizinhas.
function MercadoBar({ pct, color, zero }: { pct: number; color: string; zero: boolean }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div
      className="relative w-full h-4 rounded bg-slate-100 overflow-hidden"
      style={zero ? { backgroundImage: 'repeating-linear-gradient(135deg, #E2E8F0 0px, #E2E8F0 4px, #F1F5F9 4px, #F1F5F9 8px)' } : undefined}
    >
      {!zero && clamped > 0 && (
        <div className="h-full rounded" style={{ width: `${clamped}%`, minWidth: '6px', background: color }} />
      )}
    </div>
  )
}

function TabelaMercadoToggle({
  data, formatValor, colunaBase,
}: { data: MercadoDatum[]; formatValor: (n: number) => string; colunaBase: string }) {
  const [metrica, setMetrica] = useState<Metrica>('real')
  const valores = data.map((d) => ({ ramo: d.ramo, valor: metrica === 'real' ? d.real : d.previsto }))
  const total = valores.reduce((s, d) => s + d.valor, 0)
  const ordenado = [...valores].sort((a, b) => b.valor - a.valor)
  const colunaLabel = `${colunaBase} — ${metrica === 'real' ? 'Real' : 'Previsto'}`

  return (
    <div>
      <div className="flex justify-end mb-2.5">
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-[10px] font-semibold">
          <button
            onClick={() => setMetrica('real')}
            className={`px-2.5 py-1 transition-colors ${metrica === 'real' ? 'bg-green-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            Real
          </button>
          <button
            onClick={() => setMetrica('previsto')}
            className={`px-2.5 py-1 border-l border-gray-200 transition-colors ${metrica === 'previsto' ? 'bg-green-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            Previsto
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {/* table-layout fixed + colgroup: a coluna da barra sempre tem a mesma
            largura entre as linhas (não encolhe/expande conforme o texto do
            valor ao lado) — é o que padroniza o tamanho de todas as barras e
            garante que Valor/Participação terminem sempre na mesma posição,
            inclusive nas linhas zeradas. */}
        <table className="w-full text-[12px] border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '32%' }} />
            <col />
            <col style={{ width: '112px' }} />
            <col style={{ width: '84px' }} />
          </colgroup>
          <thead>
            <tr className="text-left text-[11px] text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3 font-semibold">Mercado</th>
              <th className="py-2 px-3 font-semibold" colSpan={2}>{colunaLabel}</th>
              <th className="py-2 pl-3 font-semibold text-right">Participação</th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((item, i) => {
              const color = MERCADO_COLORS[i % MERCADO_COLORS.length]
              const pct = total > 0 ? (item.valor / total) * 100 : 0
              const zero = item.valor === 0
              return (
                <tr key={item.ramo} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 overflow-hidden">
                    <span className="inline-flex items-center gap-2 max-w-full">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className={cn('truncate', zero ? 'text-gray-400 font-normal' : 'text-gray-700 font-medium')}>{item.ramo}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <MercadoBar pct={pct} color={color} zero={zero} />
                  </td>
                  <td className={cn(
                    'py-2.5 pl-3 text-right tabular-nums whitespace-nowrap',
                    zero ? 'text-gray-400 font-normal' : 'text-gray-700 font-semibold',
                  )}>
                    {formatValor(item.valor)}
                  </td>
                  <td className={cn(
                    'py-2.5 pl-3 text-right tabular-nums whitespace-nowrap',
                    zero ? 'text-gray-400 font-normal' : 'text-gray-600 font-semibold',
                  )}>
                    {pct.toFixed(1).replace('.', ',')}%
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 font-bold">
              <td className="py-2.5 pr-3 text-gray-800" colSpan={2}>Total</td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{formatValor(total)}</td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-gray-800">100,0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function fmtHH(v: number): string {
  return `${Math.round(v).toLocaleString('pt-BR')} HH`
}

// ══ Participação de cada empresa no faturamento do ano atual (Composição
// Faturamento) — ranking com representatividade (%) e acumulado, toggle
// Previsto/Real. Só entram empresas com valor > 0 na métrica ativa (não é o
// caso "sempre mostrar todos", como em Faturamento/HH por mercado — aqui a
// lista de participantes varia por natureza). ══
type ClienteDatum = { id: number; nome: string; real: number; previsto: number }

function ParticipacaoEmpresasView({ data }: { data: ClienteDatum[] }) {
  const [metrica, setMetrica] = useState<Metrica>('real')

  const linhas = (() => {
    const valores = data
      .map((d) => ({ id: d.id, nome: d.nome, valor: metrica === 'real' ? d.real : d.previsto }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor)
    const total = valores.reduce((s, d) => s + d.valor, 0)
    let acumulado = 0
    return valores.map((v, i) => {
      const pct = total > 0 ? (v.valor / total) * 100 : 0
      acumulado += pct
      return { ...v, ranking: i + 1, pct, acumulado }
    })
  })()

  return (
    <ChartCard>
      <div className="flex justify-end mb-3">
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-[10px] font-semibold flex-shrink-0">
          <button
            onClick={() => setMetrica('real')}
            className={`px-2.5 py-1 transition-colors ${metrica === 'real' ? 'bg-green-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            Real
          </button>
          <button
            onClick={() => setMetrica('previsto')}
            className={`px-2.5 py-1 border-l border-gray-200 transition-colors ${metrica === 'previsto' ? 'bg-green-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            Previsto
          </button>
        </div>
      </div>

      {linhas.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-[12px]">Sem dados para o período.</p>
      ) : (
        <div className="overflow-auto max-h-[420px] border border-gray-100 rounded-md">
          <table className="w-full text-[12px] border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '140px' }} />
              <col />
              <col style={{ width: '90px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr className="text-left text-[11px] text-gray-500 border-b border-gray-200 sticky top-0 z-10 bg-white">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 px-2 font-semibold">Empresa</th>
                <th className="py-2 px-2 font-semibold text-right">Total Faturamento</th>
                <th className="py-2 pr-4 font-semibold" colSpan={2}>Representatividade (%)</th>
                <th className="py-2 pl-4 font-semibold text-right">Acumulado (%)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-2.5 pr-2 text-gray-400 font-semibold tabular-nums">{l.ranking}</td>
                  <td className="py-2.5 px-2 text-gray-700 font-medium truncate">{l.nome}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-gray-700 whitespace-nowrap">{fmtM(l.valor)}</td>
                  <td className="py-2.5 pr-2"><MercadoBar pct={l.pct} color={DASHBOARD_POSITIVO} zero={false} /></td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-gray-600 font-semibold whitespace-nowrap">{l.pct.toFixed(1).replace('.', ',')}%</td>
                  <td className="py-2.5 pl-4 text-right tabular-nums font-bold text-green-dark bg-green-light/50 whitespace-nowrap">{l.acumulado.toFixed(1).replace('.', ',')}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-2.5">A soma das participações pode não totalizar exatamente 100% devido ao arredondamento.</p>
    </ChartCard>
  )
}

// ══ Tabela Previsão x Realizado por Mês ══
function TabelaMensal({ data, ano }: { data: MesData[]; ano: number }) {
  const totPrev = data.reduce((s, d) => s + d.previsto_bruto, 0)
  const totFat = data.reduce((s, d) => s + d.faturado, 0)
  const totRes = data.reduce((s, d) => s + d.resultado, 0)
  const totFixed = data.reduce((s, d) => s + (d.valor_fixado ?? 0), 0)
  const totPct = totPrev > 0 ? (totFat / totPrev) * 100 : 0
  return (
    <ChartCard>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
              <th className="text-left px-4 py-2 font-semibold w-32">Mês</th>
              <th className="text-right px-4 py-2 font-semibold">Valor Fixado</th>
              <th className="text-right px-4 py-2 font-semibold">Previsto {ano}</th>
              <th className="text-right px-4 py-2 font-semibold">Valor Total Faturado {ano}</th>
              <th className="text-right px-4 py-2 font-semibold w-32">% Fat. / Fixado</th>
              <th className="text-right px-4 py-2 font-semibold">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.mes} className={[row.consolidado ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50', 'border-b border-gray-100'].join(' ')}>
                <td className={`px-4 py-2 font-medium ${row.consolidado ? 'text-green-800' : 'text-gray-700'}`}>
                  {row.label}
                  {row.consolidado && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle" />}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.valor_fixado != null ? <span className="text-[#6A1B9A] font-semibold">{fmt(row.valor_fixado)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right text-[#1565C0] tabular-nums">{fmt(row.previsto_bruto)}</td>
                <td className="px-4 py-2 text-right text-gray-700 tabular-nums">{fmt(row.faturado)}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${row.percentual >= 100 ? 'bg-green-100 text-green-800' : 'bg-orange-50 text-orange-700'}`}>
                    {row.percentual.toFixed(1).replace('.', ',')}%
                  </span>
                </td>
                <td className={`px-4 py-2 text-right font-semibold tabular-nums ${row.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(row.resultado)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-primary text-white font-bold text-[12px]">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-purple-100">{totFixed > 0 ? fmt(totFixed) : '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totPrev)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totFat)}</td>
              <td className="px-4 py-2.5 text-right">{totPct.toFixed(1).replace('.', ',')}%</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${totRes >= 0 ? 'text-green-100' : 'text-red-200'}`}>{fmt(totRes)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ChartCard>
  )
}

// ══ Avatar de iniciais ══
function adColor(p: number) { return p >= 70 ? { bg: '#DCFCE7', text: '#15803D' } : p >= 50 ? { bg: '#FEF3C7', text: '#B45309' } : { bg: '#FEE2E2', text: '#B91C1C' } }

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i)

export default function IndicadoresAcordosPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [clienteId, setClienteId] = useState<string[]>([])
  const [clienteFinalId, setClienteFinalId] = useState<string[]>([])
  const [ramo, setRamo] = useState<string[]>([])
  const [responsavelId, setResponsavelId] = useState<string[]>([])
  const [cidade, setCidade] = useState<string[]>([])
  const [escopo, setEscopo] = useState('')
  const [abaInd, setAbaInd] = useState<'geral' | 'responsavel' | 'composicao'>('geral')
  // Filtros específicos da aba "Eventos Contratuais" (Multas) — período livre em
  // vez de Ano, mais o tipo de multa. Vivem na barra padrão, só aparecem nessa aba.
  const [periodoDe, setPeriodoDe] = useState('')
  const [periodoAte, setPeriodoAte] = useState('')
  const [multaTipo, setMultaTipo] = useState<string[]>([])

  const fetchData = useCallback(() => {
    setLoading(true); setError(null)
    const params = new URLSearchParams()
    if (ano && ano !== String(ANO_ATUAL)) params.set('ano', ano)
    if (clienteId.length) params.set('clienteId', clienteId.join(','))
    if (clienteFinalId.length) params.set('clienteFinalId', clienteFinalId.join(','))
    if (ramo.length) params.set('ramo', ramo.join(','))
    if (responsavelId.length) params.set('responsavelId', responsavelId.join(','))
    if (cidade.length) params.set('cidade', cidade.join(','))
    if (escopo.trim()) params.set('escopo', escopo.trim())
    const qs = params.toString()
    fetch(`/api/acordos/dashboard${qs ? '?' + qs : ''}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setData(j.data) })
      .catch(() => setError('Falha ao carregar dados'))
      .finally(() => setLoading(false))
  }, [ano, clienteId, clienteFinalId, ramo, responsavelId, cidade, escopo])
  useEffect(() => { fetchData() }, [fetchData])

  const anoNum = parseInt(ano, 10) || ANO_ATUAL
  const mesAtual = data?.mesAtual ?? (new Date().getMonth() + 1)
  const mesLabel = MES_LABEL[mesAtual - 1]
  const mesAntLabel = MES_LABEL[mesAtual === 1 ? 11 : mesAtual - 2]
  const mesProxLabel = MES_LABEL[mesAtual === 12 ? 0 : mesAtual]
  const clientes = data?.clientes ?? []
  const clientesFinais = data?.clientesFinais ?? []
  const responsaveis = data?.responsaveis ?? []
  const cidades = data?.cidades ?? []

  // Meta de faturamento acumulada (%) x Faturado acumulado (%) — ambas em
  // relação ao total previsto do ano. A meta é conhecida para o ano inteiro
  // (orçamento fechado); o faturado só é conhecido até o mês corrente do ano
  // selecionado (meses futuros ficam null — sem dado, não "zero").
  const totalPrevistoAno = data ? data.porMes.reduce((a, m) => a + m.previsto, 0) : 0
  const mesConhecidoAte = !data ? 0
    : anoNum < data.anoAtual ? 12
    : anoNum === data.anoAtual ? data.mesAtual
    : 0
  const metaAcumPct = data
    ? (() => { let acc = 0; return data.porMes.map((m) => { acc += m.previsto; return totalPrevistoAno > 0 ? (acc / totalPrevistoAno) * 100 : null }) })()
    : []
  const faturadoAcumPct = data
    ? (() => { let acc = 0; return data.porMes.map((m) => {
        acc += m.faturado
        return m.mes <= mesConhecidoAte && totalPrevistoAno > 0 ? (acc / totalPrevistoAno) * 100 : null
      }) })()
    : []

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Zona congelada — título e filtros ────────────────────────────── */}
      <div className="flex-shrink-0 p-3 pb-0">
      <PageHeader
        title="Indicadores Acordos"
        actions={data && <span className="text-[11px] text-gray-400">{mesLabel} / {data.anoAtual}</span>}
      />

      {/* Filtros — linha única; alguns campos trocam conforme a aba ativa (Ano/Mercado/
          Escopo em Indicadores Gerais; Período/Tipo em Eventos Contratuais) */}
      <FilterBar className="!mt-2">
        {abaInd !== 'responsavel' ? (
          <FilterField label="Ano" className="min-w-[90px]">
            <select value={ano} onChange={(e) => setAno(e.target.value)} className={filterSelectClass}>{ANOS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          </FilterField>
        ) : (
          <>
            <FilterField label="Período (de)" className="min-w-[120px]">
              <input type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} className={filterSelectClass} />
            </FilterField>
            <FilterField label="Período (até)" className="min-w-[120px]">
              <input type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} className={filterSelectClass} />
            </FilterField>
          </>
        )}
        <FilterField label="Responsável" className="min-w-[150px] flex-1">
          <SearchableMultiSelect values={responsavelId} onChange={setResponsavelId} options={responsaveis.map((r) => ({ value: String(r.id), label: r.nome }))} />
        </FilterField>
        <FilterField label="Cliente" className="min-w-[150px] flex-[2]">
          <SearchableMultiSelect values={clienteId} onChange={setClienteId} options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))} />
        </FilterField>
        <FilterField label="Cliente Final" className="min-w-[150px] flex-[2]">
          <SearchableMultiSelect values={clienteFinalId} onChange={setClienteFinalId} options={clientesFinais.map((c) => ({ value: String(c.id), label: c.nome }))} />
        </FilterField>
        <FilterField label="Cidade" className="min-w-[120px] flex-1">
          <SearchableMultiSelect values={cidade} onChange={setCidade} options={cidades.map((c) => ({ value: c, label: c }))} />
        </FilterField>
        {abaInd !== 'responsavel' ? (
          <>
            <FilterField label="Mercado" className="min-w-[130px] flex-1">
              <SearchableMultiSelect values={ramo} onChange={setRamo} options={RAMO_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} emptyLabel="Todos" />
            </FilterField>
            <FilterField label="Escopo" className="min-w-[140px] flex-1">
              <input type="text" value={escopo} onChange={(e) => setEscopo(e.target.value)} placeholder="Buscar por escopo..." className={filterSelectClass} />
            </FilterField>
          </>
        ) : (
          <FilterField label="Tipo" className="min-w-[120px] flex-1">
            <SearchableMultiSelect values={multaTipo} onChange={setMultaTipo} options={TIPOS_MULTA.map((t) => ({ value: t.value, label: t.label }))} emptyLabel="Todos" />
          </FilterField>
        )}
        <ClearFiltersButton onClick={() => {
          setAno(String(ANO_ATUAL)); setClienteId([]); setClienteFinalId([]); setRamo([]); setResponsavelId([]); setCidade([]); setEscopo('')
          setPeriodoDe(''); setPeriodoAte(''); setMultaTipo([])
        }} />
      </FilterBar>
      </div>

      {/* ── Área rolável — indicadores ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 pt-2 space-y-1">

      {loading && <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>}
      {error && <p className="text-center text-red-500 py-8 text-sm">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Abas de indicadores */}
          <DashboardTabs
            tabs={[
              { key: 'geral', label: 'Indicadores Gerais' },
              { key: 'composicao', label: 'Composição Faturamento' },
              { key: 'responsavel', label: 'Eventos Contratuais' },
            ]}
            active={abaInd}
            onChange={setAbaInd}
          />

          {abaInd === 'geral' && (<>
          {/* 1 — Visão consolidada do ano */}
          <SectionTitle>Visão consolidada do ano</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total faturado no ano" value={fmtM(data.totalFaturadoAno)} accent={DASHBOARD_POSITIVO} sub={`${data.percFaturadoGeral.toFixed(1).replace('.', ',')}% da previsão`} />
            <KpiCard label="Previsão de faturamento no ano" value={fmtM(data.prevFaturamentoAno)} accent={DASHBOARD_PREVISTO} sub="meta anual de receita" />
            <KpiCard label="Falta faturar no ano" value={fmtM(data.aFaturarAno)} accent={DASHBOARD_ATENCAO} sub="saldo até dezembro" />
            <KpiCard label="Previsão anos seguintes" value={fmtM(data.faturamentoProxAnos)} accent="#475569" sub="acordos multi-ano" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 !mt-3">
            <KpiCard label={`Faturado mês atual (${mesLabel})`} value={fmtM(data.faturadoMesAtual)} accent={DASHBOARD_POSITIVO} />
            <KpiCard label={`Previsão mês atual (${mesLabel})`} value={fmtM(data.prevMesAtual)} accent={DASHBOARD_PREVISTO} />
            <KpiCard label={`Faturado último mês (${mesAntLabel})`} value={fmtM(data.faturadoUltimoMes)} accent={DASHBOARD_POSITIVO} />
            <KpiCard label={`Previsão próximo mês (${mesProxLabel})`} value={fmtM(data.prevProxMes)} accent={DASHBOARD_PREVISTO} />
          </div>

          {/* 2/3 — Faturamento por mercado (esquerda) + HH por mercado (direita) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <SectionTitle>Faturamento por mercado</SectionTitle>
              <ChartCard>
                <TabelaMercadoToggle data={data.porRamo} formatValor={fmtM} colunaBase="Faturamento" />
              </ChartCard>
            </div>
            <div>
              <SectionTitle>HH por mercado</SectionTitle>
              <ChartCard>
                <TabelaMercadoToggle data={data.porRamoHh} formatValor={fmtHH} colunaBase="HH" />
              </ChartCard>
            </div>
          </div>

          {/* 4 — Meta acumulada x Faturado acumulado (%) (70%) + % faturado geral do ano (30%) */}
          <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3">
            <div>
              <SectionTitle>Meta de faturamento acumulada x faturamento real — avanço %</SectionTitle>
              <ChartCard>
                <div style={{ height: 300 }}>
                  <ContratoAvancoPercentualChart
                    serieA={metaAcumPct} serieB={faturadoAcumPct}
                    labelA="Meta acumulada (%)" labelB="Faturado acumulado (%)"
                    corA={DASHBOARD_PREVISTO} corB={DASHBOARD_POSITIVO}
                    labels={MES_LABEL}
                    maintainAspectRatio={false}
                  />
                </div>
              </ChartCard>
            </div>
            <div>
              <SectionTitle>% faturado geral do ano</SectionTitle>
              <ChartCard>
                <Gauge percent={data.percFaturadoGeral} />
              </ChartCard>
            </div>
          </div>

          {/* 5 — Tabela detalhada */}
          <SectionTitle>Previsão x realizado por mês — detalhamento</SectionTitle>
          <TabelaMensal data={data.porMes} ano={anoNum} />

          {/* 7 — Aderência por responsável */}
          <SectionTitle>Aderência por responsável de Acordos</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-semibold">Responsável</th>
                    <th className="text-center px-4 py-2 font-semibold">Acordos</th>
                    <th className="text-right px-4 py-2 font-semibold">Valor sob gestão</th>
                    <th className="text-right px-4 py-2 font-semibold">Previsto ano</th>
                    <th className="text-right px-4 py-2 font-semibold">Realizado ano</th>
                    <th className="text-left px-4 py-2 font-semibold w-44">Aderência</th>
                    <th className="text-right px-4 py-2 font-semibold">Saldo a faturar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porResponsavel.map((r) => {
                    const c = adColor(r.aderencia)
                    return (
                      <tr key={r.id ?? r.nome} className="border-b border-gray-100">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar nome={r.nome} /><span className="font-medium text-gray-700">{r.nome}</span></div></td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{r.contratos}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{fmtM(r.valorSobGestao)}</td>
                        <td className="px-4 py-2.5 text-right text-[#1565C0] tabular-nums">{fmtM(r.previsto)}</td>
                        <td className="px-4 py-2.5 text-right text-[#16A34A] tabular-nums">{fmtM(r.realizado)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={r.aderencia} color={c.text} size="md" />
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.text }}>{r.aderencia.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{fmtM(r.saldo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-green-primary text-white font-bold text-[12px]">
                    <td className="px-4 py-2.5">Total geral</td>
                    <td className="px-4 py-2.5 text-center">{data.porResponsavel.reduce((s, r) => s + r.contratos, 0)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.porResponsavel.reduce((s, r) => s + r.valorSobGestao, 0))}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.prevFaturamentoAno)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.totalFaturadoAno)}</td>
                    <td className="px-4 py-2.5 text-left pl-4">{data.percFaturadoGeral.toFixed(1).replace('.', ',')}%</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(data.aFaturarAno)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Ocorrências contratuais lançadas por responsável */}
          <SectionTitle>Ocorrências contratuais lançadas por responsável</SectionTitle>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {data.ocorrenciasPorResponsavel.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Nenhuma ocorrência registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
                      <th className="text-left px-4 py-2 font-semibold">Responsável</th>
                      <th className="text-right px-4 py-2 font-semibold w-40">OS sob gestão</th>
                      <th className="text-right px-4 py-2 font-semibold w-44">Ocorrências lançadas (total)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ocorrenciasPorResponsavel.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar nome={r.nome} /><span className="font-medium text-gray-700">{r.nome}</span></div></td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{r.osSobGestao}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-700 tabular-nums">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-primary text-white font-bold text-[12px]">
                      <td className="px-4 py-2.5">Total geral</td>
                      <td className="px-4 py-2.5 text-right">{data.ocorrenciasPorResponsavel.reduce((s, r) => s + r.osSobGestao, 0)}</td>
                      <td className="px-4 py-2.5 text-right">{data.ocorrenciasPorResponsavel.reduce((s, r) => s + r.total, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          </>)}

          {abaInd === 'responsavel' && (<>
          {/* Multas / Penalidades recebidas */}
          <SectionTitle>Multas / Penalidades recebidas</SectionTitle>
          <MultasIndicador
            clienteId={clienteId}
            cidade={cidade}
            responsavelId={responsavelId}
            tipo={multaTipo}
            periodoDe={periodoDe}
            periodoAte={periodoAte}
          />
          </>)}

          {abaInd === 'composicao' && (<>
            <SectionTitle>Participação de cada empresa no faturamento do ano atual</SectionTitle>
            <ParticipacaoEmpresasView data={data.porCliente} />

            <div className="mt-4">
            <SectionTitle>Composição do faturamento por tipo de lançamento</SectionTitle>
            <ComposicaoFaturamentoView
              ano={ano}
              clienteId={clienteId}
              clienteFinalId={clienteFinalId}
              ramo={ramo}
              responsavelId={responsavelId}
              cidade={cidade}
              escopo={escopo}
            />
            </div>
          </>)}
        </>
      )}
      </div>
    </div>
  )
}
