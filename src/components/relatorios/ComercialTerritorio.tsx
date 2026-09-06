'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { RankingBar } from './RankingBar'
import { MiniTable } from './MiniTable'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }
const fmtInt = (v: number) => formatNumber(v, 0)

interface ComercialData {
  com01_funil: { aguardando_analise: number; em_elaboracao: number; em_elaboracao_tecnica_pendente: number; proposta_enviada: number; contrato_ganho: number; recusada: number }
  com02_atrasadas: Array<{ id: number; classificacao: string | null; orcamentista: string | null; dias_atraso: number }>
  com03_motivos: { reprovacao: Array<{ motivo: string; label: string; total: number }>; perda: Array<{ motivo: string; label: string; total: number }> }
  com04_orcamentistas: Array<{ id: number; nome: string; em_carteira: number; enviadas: number; no_prazo: number; pct_no_prazo: number; ganhas: number; valor_ganho: number; ticket_medio: number }>
  com05_pipeline: { total: number; por_classificacao: Array<{ classificacao: string; valor: number }>; por_interesse: { ALTO: number; MEDIO: number; BAIXO: number }; maiores: Array<{ id: number; classificacao: string | null; interesse: string | null; valor: number }> }
  com06_ciclo: { media_geral: number | null; por_classificacao: Array<{ classificacao: string; media_dias: number }> }
}

export function ComercialTerritorio() {
  const [data, setData] = useState<ComercialData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/relatorios/comercial')
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  const funilRows = [
    { label: 'Aguardando análise', value: data.com01_funil.aguardando_analise },
    { label: `Em elaboração (${data.com01_funil.em_elaboracao_tecnica_pendente} sem técnica)`, value: data.com01_funil.em_elaboracao },
    { label: 'Proposta enviada', value: data.com01_funil.proposta_enviada },
    { label: 'Contrato ganho', value: data.com01_funil.contrato_ganho },
    { label: 'Recusada', value: data.com01_funil.recusada, highlight: true },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard codigo="COM-01" titulo="Funil de Solicitações" pergunta="Quantas solicitações estão em cada etapa, e onde elas estão empacando?">
        <RankingBar rows={funilRows} format={fmtInt} />
      </ReportCard>

      <ReportCard codigo="COM-02" titulo="Propostas Paradas e Atrasadas" pergunta="Quais propostas estão sem envio, vencidas ou perto de vencer — e de quem é a responsabilidade?">
        <MiniTable
          maxH="260px"
          rows={data.com02_atrasadas}
          rowKey={(r) => r.id}
          emptyLabel="Nenhuma proposta atrasada — carteira em dia."
          columns={[
            { key: 'classificacao', header: 'Classif.', render: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
            { key: 'orcamentista', header: 'Orçamentista', render: (r) => r.orcamentista ?? '—' },
            { key: 'dias', header: 'Dias de atraso', align: 'right', render: (r) => <span className="font-semibold text-red-600">{r.dias_atraso}</span> },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="COM-03" titulo="Motivos de Perda e Recusa" pergunta="Por que estamos perdendo negócio — preço, prazo, escopo, concorrência?">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Reprovação (análise)</p>
            <RankingBar rows={data.com03_motivos.reprovacao.map((m) => ({ label: m.label, value: m.total }))} format={fmtInt} color="#B45309" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Perda (proposta enviada)</p>
            <RankingBar rows={data.com03_motivos.perda.map((m) => ({ label: m.label, value: m.total }))} format={fmtInt} color="#A32D2D" />
          </div>
        </div>
      </ReportCard>

      <ReportCard codigo="COM-04" titulo="Desempenho por Orçamentista" pergunta="Quem está entregando no prazo, quem está com fila grande, e quem está ganhando mais?">
        <MiniTable
          maxH="260px"
          rows={data.com04_orcamentistas}
          rowKey={(r) => r.id}
          columns={[
            { key: 'nome', header: 'Orçamentista', render: (r) => r.nome },
            { key: 'carteira', header: 'Carteira', align: 'right', render: (r) => fmtInt(r.em_carteira) },
            { key: 'prazo', header: '% no prazo', align: 'right', render: (r) => formatPercent(r.pct_no_prazo) },
            { key: 'ganhas', header: 'Ganhas', align: 'right', render: (r) => fmtInt(r.ganhas) },
            { key: 'valor', header: 'Valor ganho', align: 'right', render: (r) => <span className="font-semibold">{formatCurrency(r.valor_ganho)}</span> },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="COM-05" titulo="Pipeline em Valor" pergunta="Quanto vale, em R$, tudo que ainda está em negociação?">
        <p className="text-[22px] font-bold text-green-primary mb-2">{formatCurrency(data.com05_pipeline.total)}</p>
        <RankingBar
          rows={data.com05_pipeline.por_classificacao.map((c) => ({ label: CLASSIF_LABELS[c.classificacao] ?? c.classificacao, value: c.valor }))}
          format={formatCurrency}
        />
      </ReportCard>

      <ReportCard codigo="COM-06" titulo="Ciclo Comercial" pergunta="Quanto tempo levamos, em média, do recebimento até a proposta comercial sair?">
        <p className="text-[22px] font-bold text-green-primary mb-2">
          {data.com06_ciclo.media_geral != null ? `${formatNumber(data.com06_ciclo.media_geral, 0)} dias` : '—'}
        </p>
        <RankingBar
          rows={data.com06_ciclo.por_classificacao.map((c) => ({ label: CLASSIF_LABELS[c.classificacao] ?? c.classificacao, value: c.media_dias }))}
          format={(v) => `${formatNumber(v, 0)} dias`}
          color="#1565C0"
        />
      </ReportCard>
    </div>
  )
}
