'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { RankingBar } from './RankingBar'
import { MiniTable } from './MiniTable'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils'

const fmtInt = (v: number) => formatNumber(v, 0)

interface ClientesData {
  filtros: { anos_disponiveis: number[]; clientes: Array<{ id: number; nome: string }> }
  ano: number
  cli01_curva_abc: Array<{ id: number; nome: string; valor: number; percentual: number; percentual_acumulado: number }>
  cli01_total_ano: number
  cli03_por_ramo: Array<{ ramo: string; label: string; valor: number }>
  cli03_por_segmento: Array<{ segmento: string; label: string; total: number }>
  cli04: { novos: { clientes: number; receita: number }; recorrentes: { clientes: number; receita: number } }
}

interface Ficha {
  cliente: { id: number; nome: string; cnpj: string | null; cidade: string | null; estado: string | null; ramo_atuacao: string | null; segmento: string | null; ativo: boolean }
  resumo: { total_negocios: number; taxa_conversao_historica: number | null; total_faturado: number; total_multas: number; total_ocorrencias: number; contratos_ativos: number }
  solicitacoes: Array<{ id: number; numero: string; status: string; escopo: string | null; classificacao: string | null; data: string; valor: number | null; resultado: string | null }>
  contratos: Array<{ id: number; indice: string; status: string; classificacao: string | null; valor_contrato: number | null; data_inicio: string | null; data_fim: string | null; faturado: number; nf_ocorrencias: number; nf_multas: number; valor_multas: number }>
}

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_ANALISE: 'Aguardando análise', EM_ELABORACAO: 'Em elaboração', PROPOSTA_ENVIADA: 'Proposta enviada',
  CONTRATO_GANHO: 'Contrato ganho', RECUSADA: 'Recusada', CANCELADA: 'Cancelada', SUSPENSA: 'Suspensa',
}

export function ClientesTerritorio() {
  const [data, setData] = useState<ClientesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ano, setAno] = useState<string>('')

  const [clienteId, setClienteId] = useState('')
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [fichaLoading, setFichaLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/clientes${ano ? `?ano=${ano}` : ''}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data ?? null); if (!ano && j.data?.ano) setAno(String(j.data.ano)) })
      .finally(() => setLoading(false))
  }, [ano])

  useEffect(() => {
    if (!clienteId) { setFicha(null); return }
    setFichaLoading(true)
    fetch(`/api/relatorios/clientes/${clienteId}`)
      .then((r) => r.json())
      .then((j) => setFicha(j.data ?? null))
      .finally(() => setFichaLoading(false))
  }, [clienteId])

  if (loading && !data) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard
        codigo="CLI-01" titulo="Concentração de Carteira" pergunta="Quais clientes representam a maior parte da minha receita, e o quanto dependo deles?"
        actions={
          <select value={ano} onChange={(e) => setAno(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]">
            {data.filtros.anos_disponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        }
        className="lg:col-span-2"
      >
        <p className="text-[11px] text-gray-400 mb-2">Faturado em {data.ano}: <strong className="text-gray-700">{formatCurrency(data.cli01_total_ano)}</strong></p>
        <MiniTable
          maxH="320px"
          rows={data.cli01_curva_abc}
          rowKey={(r) => r.id}
          columns={[
            { key: 'nome', header: 'Cliente', render: (r) => r.nome },
            { key: 'valor', header: 'Faturado', align: 'right', render: (r) => formatCurrency(r.valor) },
            { key: 'pct', header: '% do total', align: 'right', render: (r) => formatPercent(r.percentual) },
            {
              key: 'acum', header: '% acumulado', align: 'right',
              render: (r) => <span className={r.percentual_acumulado <= 80 ? 'font-semibold text-amber-700' : 'text-gray-500'}>{formatPercent(r.percentual_acumulado)}</span>,
            },
          ]}
        />
      </ReportCard>

      <ReportCard codigo="CLI-03" titulo="Ranking por Segmento/Ramo" pergunta="Em qual ramo de atuação eu mais faturo, e onde tem espaço para crescer?">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Faturado por ramo ({data.ano})</p>
            <RankingBar rows={data.cli03_por_ramo.map((r) => ({ label: r.label, value: r.valor }))} format={formatCurrency} />
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Solicitações por segmento ({data.ano})</p>
            <RankingBar rows={data.cli03_por_segmento.map((r) => ({ label: r.label, value: r.total }))} format={fmtInt} color="#1565C0" />
          </div>
        </div>
      </ReportCard>

      <ReportCard codigo="CLI-04" titulo="Clientes Recorrentes x Novos" pergunta="Estou vivendo de cliente novo ou de cliente que já é meu?">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Novos em {data.ano}</p>
            <p className="text-[20px] font-bold text-blue-700">{data.cli04.novos.clientes}</p>
            <p className="text-[10px] text-gray-500 mt-1">{formatCurrency(data.cli04.novos.receita)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Recorrentes</p>
            <p className="text-[20px] font-bold text-green-primary">{data.cli04.recorrentes.clientes}</p>
            <p className="text-[10px] text-gray-500 mt-1">{formatCurrency(data.cli04.recorrentes.receita)}</p>
          </div>
        </div>
      </ReportCard>

      <ReportCard
        codigo="CLI-02" titulo="Ficha do Cliente" pergunta="Tudo que já aconteceu com este cliente — numa tela só."
        className="lg:col-span-2"
        actions={
          <div className="w-64">
            <SearchableSelect
              value={clienteId}
              onChange={setClienteId}
              options={data.filtros.clientes.map((c) => ({ value: String(c.id), label: c.nome }))}
              placeholder="Buscar cliente..."
              emptyLabel="Selecione um cliente"
            />
          </div>
        }
      >
        {!clienteId ? (
          <p className="text-[11px] text-gray-400 text-center py-8">Selecione um cliente para ver o histórico completo.</p>
        ) : fichaLoading ? (
          <p className="text-[11px] text-gray-400 text-center py-8">Carregando...</p>
        ) : !ficha ? (
          <p className="text-[11px] text-gray-400 text-center py-8">Não foi possível carregar.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Negócios', value: fmtInt(ficha.resumo.total_negocios) },
                { label: 'Conversão histórica', value: ficha.resumo.taxa_conversao_historica != null ? formatPercent(ficha.resumo.taxa_conversao_historica) : '—' },
                { label: 'Total faturado', value: formatCurrency(ficha.resumo.total_faturado) },
                { label: 'Multas', value: formatCurrency(ficha.resumo.total_multas) },
                { label: 'Contratos ativos', value: fmtInt(ficha.resumo.contratos_ativos) },
              ].map((k) => (
                <div key={k.label} className="bg-gray-50 rounded-md p-2.5 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">{k.label}</p>
                  <p className="text-[13px] font-bold text-gray-800 mt-0.5">{k.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Solicitações ({ficha.solicitacoes.length})</p>
              <MiniTable
                maxH="220px"
                rows={ficha.solicitacoes}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'numero', header: 'Nº', render: (r) => r.numero },
                  { key: 'data', header: 'Data', render: (r) => formatDate(r.data) },
                  { key: 'status', header: 'Status', render: (r) => STATUS_LABELS[r.status] ?? r.status },
                  { key: 'valor', header: 'Valor', align: 'right', render: (r) => r.valor != null ? formatCurrency(r.valor) : '—' },
                ]}
              />
            </div>

            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Contratos ({ficha.contratos.length})</p>
              <MiniTable
                maxH="220px"
                rows={ficha.contratos}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'indice', header: 'Índice', render: (r) => r.indice },
                  { key: 'inicio', header: 'Início', render: (r) => formatDate(r.data_inicio) },
                  { key: 'faturado', header: 'Faturado', align: 'right', render: (r) => formatCurrency(r.faturado) },
                  { key: 'ocorrencias', header: 'Ocorrências', align: 'right', render: (r) => fmtInt(r.nf_ocorrencias) },
                  { key: 'multas', header: 'Multas', align: 'right', render: (r) => r.valor_multas > 0 ? formatCurrency(r.valor_multas) : '—' },
                ]}
              />
            </div>
          </div>
        )}
      </ReportCard>
    </div>
  )
}
