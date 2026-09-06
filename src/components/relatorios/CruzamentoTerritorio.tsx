'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { MiniTable } from './MiniTable'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }
const fmtHH = (v: number) => `${formatNumber(v, 0)} HH`

interface CrzRow {
  id: number; indice: string; cliente: string; classificacao: string | null
  hh_orcado: number | null; hh_realizado: number | null; desvio_hh_pct: number | null
  valor_vendido: number | null; valor_faturado: number
  rs_hh_vendido: number | null; rs_hh_realizado: number | null
}

interface CruzamentoData {
  cobertura: { total_contratos_ativos: number; com_vinculo_solicitacao: number }
  filtros: { contratos_vinculados: Array<{ id: number; indice: string; cliente: string }> }
  crz01_orcado_executado: CrzRow[]
  crz02_rentabilidade: CrzRow[]
  crz03_timeline: {
    contrato: { id: number; indice: string; cliente: string }
    etapas: Array<{ label: string; data: string | null }>
  } | null
}

export function CruzamentoTerritorio() {
  const [data, setData] = useState<CruzamentoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [contratoId, setContratoId] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = contratoId ? `?contrato_id=${contratoId}` : ''
    fetch(`/api/relatorios/cruzamento${params}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .finally(() => setLoading(false))
  }, [contratoId])

  if (loading && !data) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  const pctVinculo = data.cobertura.total_contratos_ativos > 0 ? (data.cobertura.com_vinculo_solicitacao / data.cobertura.total_contratos_ativos) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5 text-[11.5px] text-amber-800">
        <strong>Cobertura: {data.cobertura.com_vinculo_solicitacao} de {data.cobertura.total_contratos_ativos} contratos ativos</strong> ({formatPercent(pctVinculo)}) têm o vínculo com a solicitação de origem preenchido — só esses entram nos relatórios abaixo. Quanto mais contratos amarrarem a solicitação que os originou, mais completa fica essa visão.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ReportCard codigo="CRZ-01" titulo="Orçado x Executado" pergunta="O que a gente vendeu em HH bate com o que foi realmente executado depois?" className="lg:col-span-2">
          <MiniTable
            maxH="280px"
            rows={data.crz01_orcado_executado}
            rowKey={(r) => r.id}
            emptyLabel="Nenhum contrato vinculado tem HH orçado e realizado suficientes ainda."
            columns={[
              { key: 'indice', header: 'Contrato', render: (r) => r.indice },
              { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
              { key: 'classif', header: 'Classif.', render: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
              { key: 'orcado', header: 'HH Orçado', align: 'right', render: (r) => r.hh_orcado != null ? fmtHH(r.hh_orcado) : '—' },
              { key: 'real', header: 'HH Realizado', align: 'right', render: (r) => r.hh_realizado != null ? fmtHH(r.hh_realizado) : '—' },
              { key: 'desvio', header: 'Desvio', align: 'right', render: (r) => r.desvio_hh_pct != null ? <span className={Math.abs(r.desvio_hh_pct) > 15 ? 'font-semibold text-red-600' : ''}>{formatPercent(r.desvio_hh_pct)}</span> : '—' },
            ]}
          />
        </ReportCard>

        <ReportCard codigo="CRZ-02" titulo="Rentabilidade Real" pergunta="O negócio que fechamos por R$/HH X está sendo executado com a margem que imaginamos?" className="lg:col-span-2">
          <MiniTable
            maxH="280px"
            rows={data.crz02_rentabilidade}
            rowKey={(r) => r.id}
            emptyLabel="Nenhum contrato vinculado tem R$/HH de venda e de execução suficientes ainda."
            columns={[
              { key: 'indice', header: 'Contrato', render: (r) => r.indice },
              { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
              { key: 'vendido', header: 'R$/HH vendido', align: 'right', render: (r) => r.rs_hh_vendido != null ? formatCurrency(r.rs_hh_vendido) : '—' },
              { key: 'real', header: 'R$/HH realizado', align: 'right', render: (r) => r.rs_hh_realizado != null ? formatCurrency(r.rs_hh_realizado) : '—' },
              {
                key: 'alerta', header: 'Situação', align: 'right',
                render: (r) => {
                  if (r.rs_hh_vendido == null || r.rs_hh_realizado == null) return '—'
                  const abaixo = r.rs_hh_realizado < r.rs_hh_vendido
                  return <span className={abaixo ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>{abaixo ? 'Abaixo do vendido' : 'Dentro/acima'}</span>
                },
              },
            ]}
          />
        </ReportCard>

        <ReportCard
          codigo="CRZ-03" titulo="Ciclo de Vida do Negócio" pergunta="Da solicitação ao encerramento do contrato, quanto tempo passou e quantas etapas teve?"
          className="lg:col-span-2"
          actions={
            <div className="w-64">
              <SearchableSelect
                value={contratoId}
                onChange={setContratoId}
                options={data.filtros.contratos_vinculados.map((c) => ({ value: String(c.id), label: `${c.indice} — ${c.cliente}` }))}
                placeholder="Buscar contrato..."
                emptyLabel="Selecione um contrato vinculado"
              />
            </div>
          }
        >
          {!data.crz03_timeline ? (
            <p className="text-[11px] text-gray-400 text-center py-8">Selecione, acima, um contrato que já tenha a solicitação de origem vinculada.</p>
          ) : (
            <div className="flex flex-col gap-0">
              {data.crz03_timeline.etapas.map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-l-2 border-gray-200 pl-3 relative">
                  <span className="absolute -left-[5px] w-2 h-2 rounded-full" style={{ background: e.data ? '#2E7D32' : '#D1D5DB' }} />
                  <span className="text-[11px] text-gray-700 flex-1">{e.label}</span>
                  <span className={`text-[11px] font-mono ${e.data ? 'text-gray-800 font-semibold' : 'text-gray-300'}`}>{e.data ? formatDate(e.data) : 'ainda não'}</span>
                </div>
              ))}
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  )
}
