'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CLASSIFICACAO_LABELS, RAMO_ATUACAO_LABELS } from '@/types'
import type { ContratoItem, SubIndiceItem, NFContratoItem } from '@/types'
import { usePermissions } from '@/hooks/usePermissions'
import { OcorrenciasContratuais } from '@/components/acordos/OcorrenciasContratuais'
import { InformacoesTabela } from '@/components/painel/InformacoesTabela'
import { MultasContratoSection } from '@/components/acordos/MultasContratoSection'

const ContratoFaturamentoBarChart = dynamic(
  () => import('@/components/faturamento/ContratoFaturamentoChart').then((m) => m.ContratoFaturamentoBarChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Carregando gráfico...</div> },
)
const ContratoFaturamentoLineChart = dynamic(
  () => import('@/components/faturamento/ContratoFaturamentoChart').then((m) => m.ContratoFaturamentoLineChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Carregando gráfico...</div> },
)

// ── Types ─────────────────────────────────────────────────────────────────────
interface NFDetalhe extends NFContratoItem { created_at: string }
interface SubDetalhe extends Omit<SubIndiceItem, 'notas_fiscais'> { notas_fiscais: NFDetalhe[] }
interface ContratoDetalhe extends Omit<ContratoItem, 'subindices'> {
  created_at: string
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
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') === 'painel' ? '/acordos/painel' : '/acordos/faturamento'
  const backLabel = searchParams.get('from') === 'painel' ? 'Meu Painel' : 'Controle de faturamento'
  const [contrato, setContrato] = useState<ContratoDetalhe | null>(null)
  const [historico, setHistorico] = useState<HistoricoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [anoSel, setAnoSel] = useState<number | null>(null)
  const [abaHist, setAbaHist] = useState<'historico' | 'ocorrencias' | 'negociacao'>('historico')
  const { userId, pode } = usePermissions()

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
            <button onClick={() => router.push(backTo)} className="hover:underline">
              {backLabel}
            </button>
            {' › '}{contrato.indice}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{contrato.indice} — {contrato.cliente.nome}</h1>
          {contrato.descricao && <p className="text-sm text-gray-500 mt-0.5">{contrato.descricao}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.cls}`}>{statusInfo.label}</span>
          <button
            onClick={() => router.push(backTo)}
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

      {/* Seletor de ano compartilhado pelos gráficos */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Período</h2>
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

      {/* Gráfico — Faturamento Mensal */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">⬛ Faturamento Mensal</h2>
        {anoSel !== null && chartData ? (
          <ContratoFaturamentoBarChart previsto={chartData.previsto} faturado={chartData.faturado} />
        ) : (
          <ContratoFaturamentoBarChart previsto={anualData.map((d) => d.previsto)} faturado={anualData.map((d) => d.faturado)} labels={anualData.map((d) => String(d.ano))} />
        )}
      </section>

      {/* Gráfico — Acumulado */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">∿ Acumulado</h2>
        {anoSel !== null && chartData ? (
          <ContratoFaturamentoLineChart previsto={chartData.previsto} faturado={chartData.faturado} />
        ) : (
          <ContratoFaturamentoLineChart previsto={anualData.map((d) => d.previsto)} faturado={anualData.map((d) => d.faturado)} labels={anualData.map((d) => String(d.ano))} />
        )}
      </section>

      {/* Informações */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Informações</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
          <InfoRow label="Nº Acordo" value={contrato.num_acordo} />
          <InfoRow label="Nº Proposta" value={contrato.num_proposta} />
          <InfoRow label="Data base" value={formatDate(contrato.solicitacao?.data_base ?? null)} />
          <InfoRow label="Responsável" value={contrato.responsavel?.nome} />
          <InfoRow label="Mercado" value={contrato.cliente.ramo_atuacao ? RAMO_ATUACAO_LABELS[contrato.cliente.ramo_atuacao as keyof typeof RAMO_ATUACAO_LABELS] : null} />
          <InfoRow label="Classificação" value={contrato.classificacao ? CLASSIFICACAO_LABELS[contrato.classificacao] : null} />
          <InfoRow label="Data início" value={formatDate(contrato.data_inicio)} />
          <InfoRow label="Data fim" value={formatDate(contrato.data_fim)} />
          <InfoRow label="Ano referência" value={String(contrato.ano_referencia)} />
        </div>
        {anualData.length > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase mb-1">Previsão por ano</p>
            <div className="flex gap-6">
              {anualData.map((a) => (
                <div key={a.ano} className="flex gap-2 text-xs">
                  <span className="text-gray-500">{a.ano}</span>
                  <span className="font-medium text-blue-600">{formatCurrency(a.previsto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Eventos de Medição */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">≡ Eventos de Medição</h2>
        <EventosMedicaoTable contrato={contrato} totalContrato={totalContrato} />
      </div>

      {/* Notas Fiscais */}
      {contrato.subindices.some((s) => s.notas_fiscais.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">$ Notas Fiscais Lançadas</h2>
          <NFsContratoTable contrato={contrato} />
        </div>
      )}

      {/* Multas / Penalidades */}
      <MultasContratoSection
        contratoId={contrato.id}
        indice={contrato.indice}
        cliente={contrato.cliente.nome}
        canLancar={pode('acordos.faturamento.item.editar')}
      />

      {/* Histórico + Ocorrências + Negociação (abas) */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
          {([['historico', 'Histórico do Contrato'], ['ocorrencias', 'Ocorrências Contratuais'], ['negociacao', 'Linha do Tempo da Negociação']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setAbaHist(val)}
              className={
                'text-[12px] font-semibold px-3 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors ' +
                (abaHist === val
                  ? 'border-green-primary text-green-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-600')
              }
            >
              {label}
            </button>
          ))}
        </div>

        {abaHist === 'historico' ? (
          timeline.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum evento registrado.</p>
          ) : (
            // Limita a ~8 eventos visíveis; o excedente entra na rolagem vertical.
            <div className="relative overflow-y-auto max-h-[420px] pr-1">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
              <div className="space-y-4">
                {timeline.map((ev, i) => <TimelineItem key={i} event={ev} />)}
              </div>
            </div>
          )
        ) : abaHist === 'ocorrencias' ? (
          <OcorrenciasContratuais
            contratoId={contrato.id}
            numero={contrato.indice}
            subtitulo={`${contrato.indice} · ${contrato.cliente.nome}${contrato.cidade ? ` — ${contrato.cidade}${contrato.estado ? `, ${contrato.estado}` : ''}` : ''}`}
            canCreate={pode('acordos.ocorrencia.criar', { ehDono: contrato.responsavel?.id === userId })}
            userId={userId}
            canSupervise={pode('acordos.ocorrencia.excluir')}
          />
        ) : (
          // Linha do Tempo da Negociação — somente visualização (read-only)
          contrato.solicitacao ? (
            <InformacoesTabela
              solicitacaoId={contrato.solicitacao.id}
              numero={contrato.solicitacao.numero}
              canCreate={false}
              userId={null}
              canSupervise={false}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma proposta/negociação vinculada a este contrato.</p>
          )
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
  const thCls = 'px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50'
  const tdCls = 'px-2 py-2 text-[11px] whitespace-nowrap border-b border-gray-100'

  return (
    <div className="border border-gray-200 rounded-md overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th className={thCls}>Índice</th>
            <th className={thCls}>Descrição</th>
            <th className={thCls}>Nº OS</th>
            <th className={thCls}>Total</th>
            <th className={thCls}>Faturado</th>
            <th className={thCls}>Saldo</th>
            <th className={thCls}>Status</th>
            <th className={thCls}>%</th>
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
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1 py-0.5 rounded">{contrato.indice}.{s.ordem}</span>
                </td>
                <td className={`${tdCls} overflow-hidden`}>
                  <span className="truncate block font-medium text-gray-800" title={s.descricao}>{s.descricao}</span>
                </td>
                <td className={tdCls}>
                  {s.num_os ? <span className="text-gray-700 font-mono text-[10px]">{s.num_os}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={tdCls}><span className="font-semibold text-blue-600">{formatCurrency(s.valor_total)}</span></td>
                <td className={tdCls}><span className="font-semibold text-green-700">{formatCurrency(s.total_faturado)}</span></td>
                <td className={tdCls}><span className={saldo > 0 ? 'text-orange-600' : 'text-green-600'}>{formatCurrency(Math.abs(saldo))}</span></td>
                <td className={tdCls}><span className={`text-[10px] font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span></td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary rounded-full" style={{ width: `${Math.min(100, perc)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-6 text-right shrink-0">{perc.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50">
            <td colSpan={3} className="px-2 py-2 text-[11px] font-bold text-gray-600 border-t border-gray-200">TOTAL</td>
            <td className="px-2 py-2 text-[11px] font-bold text-blue-600 border-t border-gray-200">{formatCurrency(totalContrato)}</td>
            <td className="px-2 py-2 text-[11px] font-bold text-green-700 border-t border-gray-200">
              {formatCurrency(contrato.subindices.reduce((a, s) => a + s.total_faturado, 0))}
            </td>
            <td colSpan={3} className="border-t border-gray-200" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function NFsContratoTable({ contrato }: { contrato: ContratoDetalhe }) {
  const thCls = 'px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50 sticky top-0 z-10'
  const tdCls = 'px-2 py-2 text-[11px] whitespace-nowrap border-b border-gray-100'

  const allNFs = contrato.subindices.flatMap((s) =>
    s.notas_fiscais.map((nf) => ({ ...nf, subIndice: s }))
  ).sort((a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime())

  // Limita a ~8 notas visíveis; o excedente entra na rolagem vertical.
  return (
    <div className="border border-gray-200 rounded-md overflow-auto max-h-[340px]">
      <table className="w-full border-collapse" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th className={thCls}>Sub-índice</th>
            <th className={thCls}>Tipo</th>
            <th className={thCls}>Nº Doc.</th>
            <th className={thCls}>Dt. Emissão</th>
            <th className={thCls}>Dt. Vencimento</th>
            <th className={thCls}>Vlr. Total</th>
            <th className={thCls}>%</th>
            <th className={thCls}>Vlr. Atribuído</th>
            <th className={thCls}>Status</th>
          </tr>
        </thead>
        <tbody>
          {allNFs.map((nf) => (
            <tr key={nf.id} className={nf.ativa ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60'}>
              <td className={tdCls}>
                <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                  {contrato.indice}.{nf.subIndice.ordem}
                </span>
                <span className="ml-1.5 text-[11px] text-gray-500">{nf.subIndice.descricao}</span>
              </td>
              <td className={tdCls}>
                <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1 py-0.5">{(nf as any).tipo_documento ?? 'NF'}</span>
              </td>
              <td className={tdCls}>
                <span className={`font-semibold ${nf.ativa ? 'text-green-dark' : 'line-through text-gray-400'}`}>{nf.numero_nf}</span>
              </td>
              <td className={tdCls}>{formatDate(nf.data_emissao)}</td>
              <td className={tdCls}>{formatDate(nf.data_vencimento)}</td>
              <td className={tdCls}><span className="text-gray-700">{formatCurrency(nf.valor_total_nf)}</span></td>
              <td className={tdCls}>{Number(nf.percentual).toFixed(1)}%</td>
              <td className={tdCls}><span className={nf.ativa ? 'font-semibold text-auto-value' : 'text-gray-400'}>{formatCurrency(nf.valor_atribuido)}</span></td>
              <td className={tdCls}>
                {nf.ativa
                  ? <span className="text-[10px] font-semibold text-green-700">Ativa</span>
                  : <span className="text-[10px] text-gray-400">Inativa</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50">
            <td colSpan={7} className="px-2 py-2 text-[11px] font-bold text-gray-600 border-t border-gray-200">TOTAL FATURADO (ativas)</td>
            <td className="px-2 py-2 text-[11px] font-bold text-green-700 border-t border-gray-200">
              {formatCurrency(allNFs.filter((nf) => nf.ativa).reduce((a, nf) => a + nf.valor_atribuido, 0))}
            </td>
            <td className="border-t border-gray-200" />
          </tr>
        </tfoot>
      </table>
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
