'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { RankingBar } from './RankingBar'
import { MiniTable } from './MiniTable'
import { formatCurrency, formatPercent } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }
const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmtCompacto = (v: number) => v === 0 ? '—' : (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k'

interface FaturamentoData {
  filtros: { anos_disponiveis: number[]; responsaveis: Array<{ id: number; nome: string }>; clientes: Array<{ id: number; nome: string }>; mes_ref_label: string }
  ano: number
  mes_ref: number
  fat01_mensal: Array<{ mes: number; label: string; previsto: number; faturado: number; percentual: number }>
  fat01_total: { previsto: number; faturado: number; percentual: number }
  fat02_saldo: Array<{ id: number; indice: string; cliente: string; responsavel: string | null; classificacao: string | null; valor_total: number; faturado: number; saldo: number; status_faturamento: string }>
  fat03_evolucao: Array<{ ano: number; meses: number[]; total: number }>
  fat04_por_classificacao: Array<{ classificacao: string; faturado: number; previsto: number }>
  fat05_aderencia: Array<{ id: number; indice: string; cliente: string; previsto_mes: number; faturado_mes: number; desvio: number; desvio_pct: number | null }>
  fat06_pendencias: Array<{ id: number; tipo: string; numero_nf: string; contrato: string; cliente: string; dias_em_espera: number }>
}

export function FaturamentoTerritorio() {
  const [data, setData] = useState<FaturamentoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ano, setAno] = useState('')
  const [mesRef, setMesRef] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (ano) params.set('ano', ano)
    if (mesRef) params.set('mes_ref', mesRef)
    fetch(`/api/relatorios/faturamento?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setData(j.data ?? null)
        if (!ano && j.data?.ano) setAno(String(j.data.ano))
        if (!mesRef && j.data?.mes_ref) setMesRef(String(j.data.mes_ref))
      })
      .finally(() => setLoading(false))
  }, [ano, mesRef])

  if (loading && !data) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard
        codigo="FAT-01" titulo="Previsto x Realizado do Ano" pergunta="Estamos faturando o que planejamos este ano? Quanto falta?"
        className="lg:col-span-2"
        actions={
          <select value={ano} onChange={(e) => setAno(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]">
            {data.filtros.anos_disponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        }
      >
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-md p-2.5 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Previsto</p>
            <p className="text-[15px] font-bold text-blue-700 mt-0.5">{formatCurrency(data.fat01_total.previsto)}</p>
          </div>
          <div className="bg-gray-50 rounded-md p-2.5 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Faturado</p>
            <p className="text-[15px] font-bold text-green-primary mt-0.5">{formatCurrency(data.fat01_total.faturado)}</p>
          </div>
          <div className="bg-gray-50 rounded-md p-2.5 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">% do ano</p>
            <p className="text-[15px] font-bold text-gray-800 mt-0.5">{formatPercent(data.fat01_total.percentual)}</p>
          </div>
        </div>
        <MiniTable
          rows={data.fat01_mensal}
          rowKey={(r) => r.mes}
          columns={[
            { key: 'mes', header: 'Mês', render: (r) => r.label },
            { key: 'prev', header: 'Previsto', align: 'right', render: (r) => formatCurrency(r.previsto) },
            { key: 'fat', header: 'Faturado', align: 'right', render: (r) => formatCurrency(r.faturado) },
            { key: 'pct', header: '%', align: 'right', render: (r) => <span className={r.percentual >= 100 ? 'text-green-700 font-semibold' : ''}>{formatPercent(r.percentual)}</span> },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="FAT-02" titulo="Saldo a Faturar" pergunta="De cada contrato ativo, quanto já foi faturado e quanto ainda falta?">
        <MiniTable
          maxH="300px"
          rows={data.fat02_saldo}
          rowKey={(r) => r.id}
          columns={[
            { key: 'indice', header: 'Contrato', render: (r) => r.indice },
            { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
            { key: 'resp', header: 'Responsável', render: (r) => r.responsavel ?? '—' },
            { key: 'saldo', header: 'Saldo', align: 'right', render: (r) => <span className="font-semibold text-amber-700">{formatCurrency(r.saldo)}</span> },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="FAT-03" titulo="Evolução Multi-Ano" pergunta="Como o faturamento evoluiu nos últimos anos — estamos crescendo?">
        <div className="overflow-x-auto">
          <table className="w-full text-[10.5px] border-collapse">
            <thead>
              <tr>
                <th className="text-left px-1.5 py-1 text-gray-400 font-semibold">Ano</th>
                {MESES_CURTO.map((m) => <th key={m} className="text-right px-1.5 py-1 text-gray-400 font-semibold">{m}</th>)}
                <th className="text-right px-1.5 py-1 text-gray-500 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.fat03_evolucao.map((row) => (
                <tr key={row.ano} className="border-t border-gray-100">
                  <td className="px-1.5 py-1 font-semibold text-gray-700">{row.ano}</td>
                  {row.meses.map((v, i) => <td key={i} className="text-right px-1.5 py-1 text-gray-600 tabular-nums">{fmtCompacto(v)}</td>)}
                  <td className="text-right px-1.5 py-1 font-bold text-green-primary tabular-nums">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>

      <ReportCard codigo="FAT-04" titulo="Faturamento por Classificação" pergunta="De onde vem o faturamento — Obras, Paradas, Fabricação ou Óleo e Gás?">
        <RankingBar
          rows={data.fat04_por_classificacao.map((c) => ({ label: CLASSIF_LABELS[c.classificacao] ?? c.classificacao, value: c.faturado, sub: `previsto ${formatCurrency(c.previsto)}` }))}
          format={formatCurrency}
        />
      </ReportCard>

      <ReportCard
        codigo="FAT-05" titulo="Aderência da Previsão" pergunta="Quais contratos ou responsáveis erram a previsão, todo mês, para cima ou para baixo?"
        className="lg:col-span-2"
        actions={
          <select value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]">
            {MESES_CURTO.map((m, i) => <option key={i} value={i + 1}>{m}/{data.ano}</option>)}
          </select>
        }
      >
        <MiniTable
          maxH="260px"
          rows={data.fat05_aderencia}
          rowKey={(r) => r.id}
          emptyLabel="Nenhum contrato com previsto ou faturado nesse mês."
          columns={[
            { key: 'indice', header: 'Contrato', render: (r) => r.indice },
            { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
            { key: 'prev', header: 'Previsto', align: 'right', render: (r) => formatCurrency(r.previsto_mes) },
            { key: 'fat', header: 'Faturado', align: 'right', render: (r) => formatCurrency(r.faturado_mes) },
            { key: 'desvio', header: 'Desvio', align: 'right', render: (r) => <span className={r.desvio < 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>{formatCurrency(r.desvio)}</span> },
            { key: 'pct', header: 'Desvio %', align: 'right', render: (r) => r.desvio_pct != null ? formatPercent(r.desvio_pct) : '—' },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="FAT-06" titulo="NFs Pendentes de Aprovação" pergunta="Quantas NFs estão esperando minha aprovação, e há quanto tempo?" className="lg:col-span-2">
        <MiniTable
          maxH="240px"
          rows={data.fat06_pendencias}
          rowKey={(r) => `${r.tipo}-${r.id}`}
          emptyLabel="Nenhuma pendência de aprovação."
          columns={[
            { key: 'tipo', header: 'Tipo', render: (r) => r.tipo },
            { key: 'nf', header: 'NF', render: (r) => r.numero_nf },
            { key: 'contrato', header: 'Contrato', render: (r) => r.contrato },
            { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
            { key: 'dias', header: 'Dias em espera', align: 'right', render: (r) => <span className={r.dias_em_espera > 5 ? 'font-semibold text-red-600' : ''}>{r.dias_em_espera}</span> },
          ]}
        />
      </ReportCard>
    </div>
  )
}
