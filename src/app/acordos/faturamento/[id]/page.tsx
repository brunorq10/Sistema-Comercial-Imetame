'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CLASSIFICACAO_LABELS, RAMO_ATUACAO_LABELS } from '@/types'
import type { ContratoItem, SubIndiceItem, NFContratoItem } from '@/types'

const ContratoFaturamentoChart = dynamic(
  () => import('@/components/faturamento/ContratoFaturamentoChart').then((m) => m.ContratoFaturamentoChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Carregando gráfico...</div> },
)

// ── Types ─────────────────────────────────────────────────────────────────────
interface NFDetalhe extends NFContratoItem { created_at: string }
interface SubDetalhe extends Omit<SubIndiceItem, 'notas_fiscais'> { notas_fiscais: NFDetalhe[] }

interface PropostaTecnicaInfo {
  id: number; versao: number
  hh_direto: number | null; hh_indireto: number | null; hh_total: number | null
  peso_montagem: number | null
  peso_equipamentos: number | null; peso_tubulacoes: number | null
  peso_suportes: number | null; peso_estruturas: number | null
  data_envio: string | null
}
interface PropostaComercialInfo {
  id: number; versao: number; proposta_tecnica_id: number | null
  valor_montagem_mecanica: number | null; valor_terceiros: number | null; valor_total: number | null
  data_envio: string | null; resultado: string | null
}
interface SolicitacaoInfo {
  id: number; numero: string
  propostas_tecnicas: PropostaTecnicaInfo[]
  propostas_comerciais: PropostaComercialInfo[]
}
interface ContratoDetalhe extends Omit<ContratoItem, 'subindices'> {
  created_at: string
  solicitacao_id: number | null
  solicitacao: SolicitacaoInfo | null
  subindices: SubDetalhe[]
}
interface HistoricoEntry {
  id: number; campo: string; valor_de: string | null
  valor_para: string | null; alterado_em: string; alterado_por: string
}
interface TimelineEvent {
  data: string; tipo: 'NF' | 'NF_INATIVA' | 'CONTRATO' | 'EDICAO'
  titulo: string; descricao: string
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

function buildAnualData(subindices: SubDetalhe[], anoRef: number) {
  const anosSet = new Set<number>()
  subindices.forEach((s) => {
    anosSet.add(s.data_inicio ? parseInt(s.data_inicio.substring(0, 4), 10) : anoRef)
    s.notas_fiscais.forEach((nf) => anosSet.add(new Date(nf.data_emissao).getFullYear()))
  })
  return Array.from(anosSet).sort().map((ano) => ({
    ano,
    previsto: subindices
      .filter((s) => (s.data_inicio ? parseInt(s.data_inicio.substring(0, 4), 10) : anoRef) === ano)
      .reduce((a, s) => a + MESES.reduce((b, m) => b + (s[m] ?? 0), 0), 0),
    faturado: subindices
      .flatMap((s) => s.notas_fiscais)
      .filter((nf) => nf.ativa && new Date(nf.data_emissao).getFullYear() === ano)
      .reduce((a, nf) => a + nf.valor_atribuido, 0),
  }))
}

const STATUS_FAT_MAP = {
  A_FATURAR: { label: 'A faturar', cls: 'bg-orange-100 text-orange-700' },
  FATURADO:  { label: 'Faturado',  cls: 'bg-green-100 text-green-700' },
  PARCIAL:   { label: 'Parcial',   cls: 'bg-blue-100 text-blue-700' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
}

function getSubAno(s: SubDetalhe, anoRef: number) {
  return s.data_inicio ? parseInt(s.data_inicio.substring(0, 4), 10) : anoRef
}

function getMonthlyData(subindices: SubDetalhe[], ano: number, anoRef: number) {
  const previsto = MESES.map((m) =>
    subindices.filter((s) => getSubAno(s, anoRef) === ano).reduce((a, s) => a + (s[m] ?? 0), 0)
  )
  const faturado = Array(12).fill(0) as number[]
  subindices.forEach((s) =>
    s.notas_fiscais
      .filter((nf) => nf.ativa && new Date(nf.data_emissao).getFullYear() === ano)
      .forEach((nf) => { faturado[new Date(nf.data_emissao).getMonth()] += nf.valor_atribuido })
  )
  return { previsto, faturado }
}

function buildTimeline(contrato: ContratoDetalhe, historico: HistoricoEntry[]): TimelineEvent[] {
  const events: TimelineEvent[] = [{
    data: contrato.created_at, tipo: 'CONTRATO', titulo: 'Contrato criado',
    descricao: [
      contrato.descricao ?? contrato.indice,
      contrato.responsavel ? `Responsável: ${contrato.responsavel.nome}` : null,
      contrato.num_os ?? null,
    ].filter(Boolean).join(' · '),
  }]
  contrato.subindices.forEach((s) =>
    s.notas_fiscais.forEach((nf) =>
      events.push({
        data: nf.created_at, tipo: nf.ativa ? 'NF' : 'NF_INATIVA',
        titulo: `NF lançada — ${contrato.indice}.${s.ordem}`,
        descricao: `${nf.numero_nf} · ${formatCurrency(nf.valor_atribuido)} · ${Number(nf.percentual).toFixed(0)}% atribuído ao item`,
      })
    )
  )
  historico.forEach((h) =>
    events.push({
      data: h.alterado_em, tipo: 'EDICAO',
      titulo: `Campo alterado: ${h.campo}`,
      descricao: `${h.valor_de ?? '—'} → ${h.valor_para ?? '—'} · por ${h.alterado_por}`,
    })
  )
  return events.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
}

function getDistinctAnos(contrato: ContratoDetalhe): number[] {
  const s = new Set<number>()
  contrato.subindices.forEach((sub) =>
    s.add(sub.data_inicio ? parseInt(sub.data_inicio.substring(0, 4), 10) : contrato.ano_referencia)
  )
  contrato.subindices.flatMap((sub) => sub.notas_fiscais).forEach((nf) =>
    s.add(new Date(nf.data_emissao).getFullYear())
  )
  return Array.from(s).sort()
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ContratoVisaoGeralPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [contrato, setContrato] = useState<ContratoDetalhe | null>(null)
  const [historico, setHistorico] = useState<HistoricoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [anoSel, setAnoSel] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [cRes, hRes] = await Promise.all([
      fetch(`/api/faturamento/contratos/${id}`),
      fetch(`/api/faturamento/contratos/${id}/historico`),
    ])
    const cJson = await cRes.json()
    const hJson = await hRes.json()
    if (cJson.data) {
      setContrato(cJson.data)
      const anos = getDistinctAnos(cJson.data)
      if (anos.length > 0) setAnoSel(anos[anos.length - 1])
    }
    if (hJson.data) setHistorico(hJson.data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const allNFs    = useMemo(() => contrato?.subindices.flatMap((s) => s.notas_fiscais) ?? [], [contrato])
  const activeNFs = useMemo(() => allNFs.filter((nf) => nf.ativa), [allNFs])

  const totalContrato = useMemo(() => {
    if (!contrato) return 0
    return contrato.valor_contrato ?? contrato.subindices.reduce((a, s) => a + s.valor_total, 0)
  }, [contrato])

  const totalFaturado  = useMemo(() => activeNFs.reduce((a, nf) => a + nf.valor_atribuido, 0), [activeNFs])
  const saldo          = totalContrato - totalFaturado
  const percRealizado  = totalContrato > 0 ? (totalFaturado / totalContrato) * 100 : 0

  const anosDisponiveis = useMemo(() => contrato ? getDistinctAnos(contrato) : [], [contrato])
  const chartData = useMemo(() => {
    if (!contrato || !anoSel) return null
    return getMonthlyData(contrato.subindices, anoSel, contrato.ano_referencia)
  }, [contrato, anoSel])

  const anualData = useMemo(() =>
    contrato ? buildAnualData(contrato.subindices, contrato.ano_referencia) : [], [contrato])

  const timeline = useMemo(() =>
    contrato ? buildTimeline(contrato, historico) : [], [contrato, historico])

  if (loading) return <div className="p-6 max-w-7xl mx-auto text-center py-20 text-gray-400">Carregando...</div>
  if (!contrato) return <div className="p-6 max-w-7xl mx-auto text-center py-20 text-gray-400">Contrato não encontrado.</div>

  const statusInfo = STATUS_FAT_MAP[contrato.status] ?? STATUS_FAT_MAP.A_FATURAR

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">
            <button onClick={() => router.push('/acordos/faturamento')} className="hover:underline">
              Controle de faturamento
            </button>
            {' › '}{contrato.indice}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{contrato.indice} — {contrato.cliente.nome}</h1>
          {contrato.descricao && <p className="text-sm text-gray-500 mt-0.5">{contrato.descricao}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.cls}`}>{statusInfo.label}</span>
          <button
            onClick={() => router.push('/acordos/faturamento')}
            className="border border-gray-300 text-gray-600 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-1.5"
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* Resumo financeiro */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">▣ Resumo Financeiro</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Valor total do contrato" value={formatCurrency(totalContrato)} color="text-blue-600" sub="valor contratado total" />
          <SummaryCard label="Total faturado" value={formatCurrency(totalFaturado)} color="text-green-700" sub="NFs ativas lançadas" />
          <SummaryCard label="Saldo a faturar" value={formatCurrency(Math.max(0, saldo))} color={saldo > 0 ? 'text-orange-600' : 'text-green-600'} sub="valor restante" />
          <SummaryCard label="% realizado" value={`${percRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} color="text-gray-800" sub="do valor total" />
        </div>
        <div className="mt-3 bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progresso do faturamento</span>
            <span>{formatCurrency(totalFaturado)} / {formatCurrency(totalContrato)}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, percRealizado)}%` }} />
          </div>
        </div>
      </section>

      {/* Gráfico */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⬛ Faturamento Mensal</h2>
          <div className="flex gap-1">
            {anosDisponiveis.map((ano) => (
              <button key={ano} onClick={() => setAnoSel(ano)}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${anoSel === ano ? 'bg-green-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >{ano}</button>
            ))}
            <button onClick={() => setAnoSel(null)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${anoSel === null ? 'bg-green-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >Todos</button>
          </div>
        </div>
        {anoSel !== null && chartData ? (
          <ContratoFaturamentoChart modo="mensal" previsto={chartData.previsto} faturado={chartData.faturado} />
        ) : (
          <ContratoFaturamentoChart modo="anual" previsto={anualData.map((d) => d.previsto)} faturado={anualData.map((d) => d.faturado)} labels={anualData.map((d) => String(d.ano))} />
        )}
      </section>

      {/* Grid: info + eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Informações</h2>
          <InfoRow label="Nº OS" value={contrato.num_os} />
          <InfoRow label="Nº Acordo" value={contrato.num_acordo} />
          <InfoRow label="Nº Proposta" value={contrato.num_proposta} />
          <InfoRow label="Responsável" value={contrato.responsavel?.nome} />
          <InfoRow label="Mercado" value={contrato.cliente.ramo_atuacao ? RAMO_ATUACAO_LABELS[contrato.cliente.ramo_atuacao as keyof typeof RAMO_ATUACAO_LABELS] : null} />
          <InfoRow label="Classificação" value={contrato.classificacao ? CLASSIFICACAO_LABELS[contrato.classificacao] : null} />
          <InfoRow label="Data início" value={formatDate(contrato.data_inicio)} />
          <InfoRow label="Data fim" value={formatDate(contrato.data_fim)} />
          <InfoRow label="Ano referência" value={String(contrato.ano_referencia)} />
          {anualData.length > 1 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase mb-1">Previsão por ano</p>
              {anualData.map((a) => (
                <div key={a.ano} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-500">{a.ano}</span>
                  <span className="font-medium text-blue-600">{formatCurrency(a.previsto)}</span>
                </div>
              ))}
            </div>
          )}
          <VincularSolicitacao
            contratoId={Number(id)}
            solicitacaoAtual={contrato.solicitacao}
            onVinculado={fetchData}
          />
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">≡ Eventos de Medição</h2>
          <EventosMedicaoTable contrato={contrato} totalContrato={totalContrato} />
        </div>
      </div>

      {/* Proposta que originou o contrato */}
      {contrato.solicitacao && (
        <PropostaSection solicitacao={contrato.solicitacao} />
      )}

      {/* Histórico */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">∿ Histórico do Contrato</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum evento registrado.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-4">
              {timeline.map((ev, i) => <TimelineItem key={i} event={ev} />)}
            </div>
          </div>
        )}
      </section>

    </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-700 text-right">{value ?? '—'}</span>
    </div>
  )
}

function EventosMedicaoTable({ contrato, totalContrato }: { contrato: ContratoDetalhe; totalContrato: number }) {
  const thCls = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50'
  const tdCls = 'px-3 py-2.5 text-[12px] whitespace-nowrap border-b border-gray-100'

  return (
    <div className="border border-gray-200 rounded-md overflow-x-auto">
      <table className="w-full border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className={thCls}>Índice</th>
            <th className={thCls}>Descrição</th>
            <th className={thCls}>Valor Total</th>
            <th className={thCls}>Faturado</th>
            <th className={thCls}>Saldo</th>
            <th className={thCls}>Status</th>
            <th className={thCls}>Progresso</th>
          </tr>
        </thead>
        <tbody>
          {contrato.subindices.map((s) => {
            const perc = s.valor_total > 0 ? (s.total_faturado / s.valor_total) * 100 : 0
            const saldo = s.valor_total - s.total_faturado
            const statusInfo = { A_FATURAR: { label: 'A faturar', cls: 'text-orange-600' }, FATURADO: { label: 'Faturado', cls: 'text-green-700' }, PARCIAL: { label: 'Parcial', cls: 'text-blue-600' } }[s.status_faturamento]
            return (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className={tdCls}>
                  <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{contrato.indice}.{s.ordem}</span>
                </td>
                <td className={`${tdCls} max-w-[200px]`}>
                  <span className="truncate block font-medium text-gray-800" title={s.descricao}>{s.descricao}</span>
                </td>
                <td className={tdCls}><span className="font-semibold text-blue-600">{formatCurrency(s.valor_total)}</span></td>
                <td className={tdCls}><span className="font-semibold text-green-700">{formatCurrency(s.total_faturado)}</span></td>
                <td className={tdCls}><span className={saldo > 0 ? 'text-orange-600' : 'text-green-600'}>{formatCurrency(Math.abs(saldo))}</span></td>
                <td className={tdCls}><span className={`text-[11px] font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span></td>
                <td className={`${tdCls} min-w-[100px]`}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary rounded-full" style={{ width: `${Math.min(100, perc)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8 text-right">{perc.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50">
            <td colSpan={2} className="px-3 py-2 text-[11px] font-bold text-gray-600 border-t border-gray-200">TOTAL</td>
            <td className="px-3 py-2 text-[12px] font-bold text-blue-600 border-t border-gray-200">{formatCurrency(totalContrato)}</td>
            <td className="px-3 py-2 text-[12px] font-bold text-green-700 border-t border-gray-200">
              {formatCurrency(contrato.subindices.reduce((a, s) => a + s.total_faturado, 0))}
            </td>
            <td colSpan={3} className="border-t border-gray-200" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Vincular Solicitação ──────────────────────────────────────────────────────
function VincularSolicitacao({ contratoId, solicitacaoAtual, onVinculado }: {
  contratoId: number
  solicitacaoAtual: SolicitacaoInfo | null
  onVinculado: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<{ id: number; numero: string; cliente: string }[]>([])
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleBusca = (v: string) => {
    setBusca(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (v.length < 2) { setResultados([]); return }
      const res = await fetch(`/api/solicitacoes?modo=autocomplete&busca=${encodeURIComponent(v)}`)
      const json = await res.json()
      setResultados(json.data ?? [])
    }, 300)
  }

  const handleVincular = async (solicitacaoId: number | null) => {
    setSaving(true)
    await fetch(`/api/faturamento/contratos/${contratoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitacao_id: solicitacaoId }),
    })
    setSaving(false)
    setEditing(false)
    setBusca('')
    setResultados([])
    onVinculado()
  }

  if (!editing) {
    return (
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Solicitação vinculada</span>
          <button onClick={() => setEditing(true)} className="text-[10px] text-blue-500 hover:underline">
            {solicitacaoAtual ? 'Alterar' : '+ Vincular'}
          </button>
        </div>
        {solicitacaoAtual ? (
          <p className="text-xs font-semibold text-gray-700 mt-0.5">{solicitacaoAtual.numero}</p>
        ) : (
          <p className="text-xs text-gray-300 mt-0.5">Nenhuma</p>
        )}
      </div>
    )
  }

  return (
    <div className="pt-2 border-t border-gray-100 space-y-1.5">
      <p className="text-xs text-gray-400">Buscar solicitação</p>
      <input
        autoFocus
        value={busca}
        onChange={(e) => handleBusca(e.target.value)}
        placeholder="Digite o número..."
        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {resultados.length > 0 && (
        <div className="border border-gray-200 rounded divide-y divide-gray-100">
          {resultados.map((r) => (
            <button
              key={r.id}
              onClick={() => handleVincular(r.id)}
              disabled={saving}
              className="w-full text-left px-2 py-1.5 hover:bg-blue-50 flex flex-col"
            >
              <span className="text-xs font-semibold text-gray-800">{r.numero}</span>
              <span className="text-[10px] text-gray-400">{r.cliente}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {solicitacaoAtual && (
          <button onClick={() => handleVincular(null)} disabled={saving} className="text-[10px] text-red-400 hover:underline">
            Desvincular
          </button>
        )}
        <button onClick={() => { setEditing(false); setBusca(''); setResultados([]) }} className="text-[10px] text-gray-400 hover:underline ml-auto">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Proposta Section ──────────────────────────────────────────────────────────
const RESULTADO_LABELS: Record<string, { label: string; cls: string }> = {
  GANHOU:  { label: 'Ganhou', cls: 'text-green-700 bg-green-50 border-green-200' },
  PERDEU:  { label: 'Perdeu', cls: 'text-red-600 bg-red-50 border-red-200' },
  STANDBY: { label: 'Standby', cls: 'text-orange-600 bg-orange-50 border-orange-200' },
  CANCELADA: { label: 'Cancelada', cls: 'text-gray-500 bg-gray-50 border-gray-200' },
}

function PropostaSection({ solicitacao }: { solicitacao: SolicitacaoInfo }) {
  const pt = solicitacao.propostas_tecnicas[0] ?? null
  const pc = solicitacao.propostas_comerciais[0] ?? null

  const hhTotalRaw = pt?.hh_total ?? ((pt?.hh_direto ?? 0) + (pt?.hh_indireto ?? 0))
  const hhTotal = hhTotalRaw || null
  const pesoTotal = pt?.peso_montagem ?? null
  const hhPorTon = hhTotal && pesoTotal && pesoTotal > 0 ? hhTotal / pesoTotal : null

  const valorMontagem = pc?.valor_montagem_mecanica ?? null
  const valorTerceiros = pc?.valor_terceiros ?? null
  const valorTotal = pc?.valor_total ?? null
  const valorSemTerceiros = valorTotal && valorTerceiros ? valorTotal - valorTerceiros : valorMontagem
  const rsPorKg = valorMontagem && pesoTotal && pesoTotal > 0 ? (valorMontagem / (pesoTotal * 1000)) : null
  const rsPorHHSemTerceiros = valorSemTerceiros && hhTotal && hhTotal > 0 ? valorSemTerceiros / hhTotal : null
  const rsPorHHComTerceiros = valorTotal && hhTotal && hhTotal > 0 ? valorTotal / hhTotal : null

  const categorias = [
    { label: 'Equipamentos', val: pt?.peso_equipamentos },
    { label: 'Tubulações', val: pt?.peso_tubulacoes },
    { label: 'Estruturas', val: pt?.peso_estruturas },
    { label: 'Suportes', val: pt?.peso_suportes },
  ].filter((c) => c.val != null && c.val > 0)

  const resultadoInfo = pc?.resultado ? (RESULTADO_LABELS[pc.resultado] ?? null) : null

  const revisoes = [...solicitacao.propostas_tecnicas].sort((a, b) => b.versao - a.versao)

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        ▦ Proposta que originou o contrato
        <span className="font-normal text-gray-400 normal-case">— Solicitação {solicitacao.numero}</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Proposta técnica */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Proposta técnica</p>
            {pt && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">v{pt.versao} atual</span>}
          </div>
          {pt ? (
            <>
              <PropostaRow label="Data de envio" value={formatDate(pt.data_envio) ?? '—'} />
              {hhTotal   && <PropostaRow label="HH Total" value={`${hhTotal.toLocaleString('pt-BR')} HH`} highlight />}
              {pesoTotal && <PropostaRow label="Peso total" value={`${pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`} highlight />}
              {hhPorTon  && <PropostaRow label="HH/ton" value={`${hhPorTon.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} HH/t`} highlight />}

              {categorias.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">Categorias de montagem</p>
                  {categorias.map((c) => {
                    const perc = pesoTotal && pesoTotal > 0 ? (c.val! / pesoTotal) * 100 : 0
                    return (
                      <div key={c.label} className="flex justify-between text-xs py-0.5">
                        <span className="text-gray-600">{c.label}</span>
                        <span className="font-medium text-gray-800">
                          {c.val!.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
                          <span className="text-gray-400 ml-1">({perc.toFixed(0)}%)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {revisoes.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">Histórico de revisões</p>
                  <div className="space-y-1.5">
                    {revisoes.map((r, i) => (
                      <div key={r.id} className={`flex items-center gap-2 text-xs ${i === 0 ? 'font-semibold' : 'text-gray-500'}`}>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${i === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          v{r.versao}{i === 0 ? ' atual' : ''}
                        </span>
                        <span>{formatDate(r.data_envio) ?? 'Sem data'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma proposta técnica registrada.</p>
          )}
        </div>

        {/* Proposta comercial */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Proposta comercial</p>
            {pc && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">v{pc.versao} atual</span>}
          </div>
          {pc ? (
            <>
              <PropostaRow label="Data de envio" value={formatDate(pc.data_envio) ?? '—'} />
              {pc.proposta_tecnica_id && (
                <PropostaRow label="Revisão técnica ref." value={`v${solicitacao.propostas_tecnicas.find((p) => p.id === pc.proposta_tecnica_id)?.versao ?? '?'}`} />
              )}

              <div className="pt-1 border-t border-gray-100 space-y-1.5">
                {valorTotal      && <PropostaRow label="Valor total" value={formatCurrency(valorTotal)} bold />}
                {valorMontagem   && <PropostaRow label="Valor montagem" value={formatCurrency(valorMontagem)} />}
                {valorTerceiros  && <PropostaRow label="Valor terceiros" value={formatCurrency(valorTerceiros)} />}
                {valorSemTerceiros && <PropostaRow label="Valor sem terceiros" value={formatCurrency(valorSemTerceiros)} highlight />}
              </div>

              {(rsPorKg || rsPorHHSemTerceiros || rsPorHHComTerceiros) && (
                <div className="pt-1 border-t border-gray-100 space-y-1.5">
                  {rsPorKg              && <PropostaRow label="R$/kg — montagem" value={`R$ ${rsPorKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg`} highlight />}
                  {rsPorHHSemTerceiros  && <PropostaRow label="R$/HH — sem terceiros" value={`R$ ${rsPorHHSemTerceiros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />}
                  {rsPorHHComTerceiros  && <PropostaRow label="R$/HH — com terceiros" value={`R$ ${rsPorHHComTerceiros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />}
                </div>
              )}

              {resultadoInfo && (
                <div className={`mt-2 border rounded-lg px-3 py-2.5 ${resultadoInfo.cls}`}>
                  <p className="text-xs font-bold">{resultadoInfo.label}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma proposta comercial registrada.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function PropostaRow({ label, value, highlight, bold }: { label: string; value: string; highlight?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs text-right ${bold ? 'font-bold text-gray-900' : highlight ? 'font-semibold text-blue-600' : 'font-medium text-gray-800'}`}>{value}</span>
    </div>
  )
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const dotColor = { NF: 'bg-orange-400', NF_INATIVA: 'bg-gray-300', CONTRATO: 'bg-green-primary', EDICAO: 'bg-blue-400' }[event.tipo]
  const dt = new Date(event.data)
  const dataFormatada = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return (
    <div className="flex gap-4 pl-1">
      <div className="relative flex-shrink-0 w-3.5 flex justify-center pt-1">
        <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow ${dotColor}`} />
      </div>
      <div className="flex-1 pb-0.5">
        <p className="text-[10px] text-gray-400 mb-0.5">{dataFormatada}</p>
        <p className="text-[13px] font-semibold text-gray-800">{event.titulo}</p>
        <p className="text-[11px] text-gray-500">{event.descricao}</p>
      </div>
    </div>
  )
}
