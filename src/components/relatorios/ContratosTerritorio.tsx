'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { RankingBar } from './RankingBar'
import { MiniTable } from './MiniTable'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }
const fmtInt = (v: number) => formatNumber(v, 0)
const fmtHH = (v: number) => `${formatNumber(v, 0)} HH`
const UCR_ORDER = ['Não Suficiente', 'A Evoluir', 'Bom', 'Ótimo', 'Esplêndido']
const UCR_COLOR: Record<string, string> = { 'Não Suficiente': '#D4554F', 'A Evoluir': '#BE9B1E', Bom: '#5FA06D', Ótimo: '#5E9BD2', Esplêndido: '#8779C8' }

interface ContratosData {
  filtros: { responsaveis: Array<{ id: number; nome: string }> }
  ctr01_carteira: { total_contratos: number; valor_total: number; por_classificacao: Array<{ classificacao: string; contratos: number; valor: number }>; por_responsavel: Array<{ nome: string; contratos: number; valor: number }> }
  ctr02_hh: Array<{ id: number; indice: string; cliente: string; classificacao: string | null; previsto: number; realizado: number; desvio_pct: number | null }>
  ctr03_fabricacao: Array<{ contrato_id: number; indice: string; cliente: string; item: string; hh_orcado: number; hh_previsto: number; hh_realizado: number; peso_previsto: number; peso_realizado: number; pct_avanco: number }>
  ctr04_ucr: { contagem_por_faixa: Record<string, number>; contratos: Array<{ id: number; indice: string; cliente: string; regiao: string; rs_hh: number | null; classificacao_ucr: string | null }> }
  ctr05_encerrando: { janela_dias: number; cobertura: string; contratos: Array<{ id: number; indice: string; cliente: string; classificacao: string | null; data_fim: string; dias_restantes: number; propostas_em_andamento_mesmo_cliente: number }> }
}

export function ContratosTerritorio() {
  const [data, setData] = useState<ContratosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [janela, setJanela] = useState('90')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/contratos?janela=${janela}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .finally(() => setLoading(false))
  }, [janela])

  if (loading && !data) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard codigo="CTR-01" titulo="Carteira Ativa de Contratos" pergunta="Quantos contratos tenho ativos agora, e como estão distribuídos?">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded-md p-2.5 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Contratos ativos</p>
            <p className="text-[18px] font-bold text-gray-800">{data.ctr01_carteira.total_contratos}</p>
          </div>
          <div className="bg-gray-50 rounded-md p-2.5 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Valor sob gestão</p>
            <p className="text-[15px] font-bold text-green-primary mt-0.5">{formatCurrency(data.ctr01_carteira.valor_total)}</p>
          </div>
        </div>
        <RankingBar rows={data.ctr01_carteira.por_classificacao.map((c) => ({ label: `${CLASSIF_LABELS[c.classificacao] ?? c.classificacao} (${c.contratos})`, value: c.valor }))} format={formatCurrency} />
      </ReportCard>

      <ReportCard codigo="CTR-01" titulo="Carteira por Responsável" pergunta="Como a carteira ativa está distribuída entre os responsáveis de Acordos?">
        <RankingBar rows={data.ctr01_carteira.por_responsavel.map((r) => ({ label: `${r.nome} (${r.contratos})`, value: r.valor }))} format={formatCurrency} color="#1565C0" />
      </ReportCard>

      <ReportCard codigo="CTR-02" titulo="Aderência de HH (Obras e Paradas)" pergunta="Estamos usando mais ou menos homem-hora do que planejamos?" className="lg:col-span-2">
        <MiniTable
          maxH="280px"
          rows={data.ctr02_hh}
          rowKey={(r) => r.id}
          columns={[
            { key: 'indice', header: 'Contrato', render: (r) => r.indice },
            { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
            { key: 'classif', header: 'Classif.', render: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
            { key: 'prev', header: 'Previsto', align: 'right', render: (r) => fmtHH(r.previsto) },
            { key: 'real', header: 'Realizado', align: 'right', render: (r) => fmtHH(r.realizado) },
            { key: 'desvio', header: 'Desvio', align: 'right', render: (r) => r.desvio_pct != null ? <span className={Math.abs(r.desvio_pct) > 15 ? 'font-semibold text-red-600' : ''}>{formatPercent(r.desvio_pct)}</span> : '—' },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="CTR-03" titulo="Avanço de Fabricação" pergunta="Como está o avanço físico da fabricação, comparado ao planejado?" className="lg:col-span-2">
        <MiniTable
          maxH="280px"
          rows={data.ctr03_fabricacao}
          rowKey={(r) => `${r.contrato_id}-${r.item}`}
          columns={[
            { key: 'indice', header: 'Contrato', render: (r) => r.indice },
            { key: 'item', header: 'Item', render: (r) => r.item },
            { key: 'hh_orc', header: 'HH Orçado', align: 'right', render: (r) => fmtHH(r.hh_orcado) },
            { key: 'hh_prev', header: 'HH Previsto', align: 'right', render: (r) => fmtHH(r.hh_previsto) },
            { key: 'hh_real', header: 'HH Realizado', align: 'right', render: (r) => fmtHH(r.hh_realizado) },
            { key: 'avanco', header: '% Avanço (peso)', align: 'right', render: (r) => <span className={r.pct_avanco < 50 ? 'text-amber-700 font-semibold' : 'text-green-700 font-semibold'}>{formatPercent(r.pct_avanco)}</span> },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="CTR-04" titulo="R$/HH por Contrato (UCR)" pergunta="Qual contrato de Parada está rendendo bem, e qual está na faixa ruim da classificação UCR?">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {UCR_ORDER.map((f) => (
            <span key={f} className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: `${UCR_COLOR[f]}22`, color: UCR_COLOR[f] }}>
              {f}: {data.ctr04_ucr.contagem_por_faixa[f] ?? 0}
            </span>
          ))}
        </div>
        <MiniTable
          maxH="220px"
          rows={data.ctr04_ucr.contratos}
          rowKey={(r) => r.id}
          columns={[
            { key: 'indice', header: 'Contrato', render: (r) => r.indice },
            { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
            { key: 'rs_hh', header: 'R$/HH', align: 'right', render: (r) => r.rs_hh != null ? formatCurrency(r.rs_hh) : '—' },
            {
              key: 'ucr', header: 'Faixa UCR', align: 'right',
              render: (r) => r.classificacao_ucr ? <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: `${UCR_COLOR[r.classificacao_ucr]}22`, color: UCR_COLOR[r.classificacao_ucr] }}>{r.classificacao_ucr}</span> : '—',
            },
          ]}
        />
      </ReportCard>

      <ReportCard
        codigo="CTR-05" titulo="Contratos Encerrando" pergunta="Quais contratos terminam nos próximos meses, e existe algo no pipeline para substituir essa receita?"
        actions={
          <select value={janela} onChange={(e) => setJanela(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]">
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
          </select>
        }
      >
        <p className="text-[10px] text-gray-400 mb-2">{data.ctr05_encerrando.cobertura}</p>
        <MiniTable
          maxH="220px"
          rows={data.ctr05_encerrando.contratos}
          rowKey={(r) => r.id}
          emptyLabel="Nenhum contrato encerrando nessa janela."
          columns={[
            { key: 'indice', header: 'Contrato', render: (r) => r.indice },
            { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
            { key: 'fim', header: 'Encerra em', align: 'right', render: (r) => `${formatDate(r.data_fim)} (${r.dias_restantes}d)` },
            { key: 'pipeline', header: 'Propostas do cliente', align: 'right', render: (r) => r.propostas_em_andamento_mesmo_cliente > 0 ? <span className="text-green-700 font-semibold">{fmtInt(r.propostas_em_andamento_mesmo_cliente)}</span> : <span className="text-red-600 font-semibold">0</span> },
          ]}
        />
      </ReportCard>
    </div>
  )
}
