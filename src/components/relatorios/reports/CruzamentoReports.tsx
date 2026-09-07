'use client'

import { useState } from 'react'
import { ReportShell } from '../ReportShell'
import { DataTable, type DataColumn } from '../DataTable'
import { FilterActions } from '../FilterActions'
import { useReportData } from '../useReportData'
import { Field } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { exportToExcel } from '@/lib/exportExcel'
import { todayInput } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }

interface CrzRow {
  id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; classificacao: string | null
  hh_orcado: number | null; hh_realizado: number | null; desvio_hh_pct: number | null
  valor_vendido: number | null; valor_faturado: number
  rs_hh_vendido: number | null; rs_hh_realizado: number | null
}

interface CruzamentoData {
  cobertura: { total_contratos_ativos: number; com_vinculo_solicitacao: number }
  filtros: { contratos_vinculados: Array<{ id: number; indice: string; cliente: string }> }
  crz01_orcado_executado: CrzRow[]
  crz02_rentabilidade: CrzRow[]
  crz03_timeline: { contrato: { id: number; indice: string; cliente: string }; etapas: Array<{ label: string; data: string | null }> } | null
}

function CoberturaNota({ data }: { data: CruzamentoData }) {
  const pct = data.cobertura.total_contratos_ativos > 0 ? (data.cobertura.com_vinculo_solicitacao / data.cobertura.total_contratos_ativos) * 100 : 0
  return (
    <p className="text-[11px] text-gray-500 mb-2">
      Cobertura: {data.cobertura.com_vinculo_solicitacao} de {data.cobertura.total_contratos_ativos} contratos ativos ({pct.toFixed(0)}%) têm o vínculo com a solicitação de origem preenchido — só esses entram na lista abaixo.
    </p>
  )
}

export function Crz01OrcadoExecutado() {
  const { data, loading } = useReportData<CruzamentoData>('/api/relatorios/cruzamento', {})
  const rows = data?.crz01_orcado_executado ?? []

  const columns: DataColumn<CrzRow>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
    { key: 'orcado', header: 'HH Orçado', type: 'number', value: (r) => r.hh_orcado, totalizer: 'sum' },
    { key: 'real', header: 'HH Realizado', type: 'number', value: (r) => r.hh_realizado, totalizer: 'sum' },
    { key: 'desvio', header: 'Desvio %', type: 'percent', value: (r) => r.desvio_hh_pct },
  ]

  return (
    <ReportShell
      titulo="Orçado x Executado" descricao="O que a gente vendeu em HH bate com o que foi realmente executado depois."
      onExport={() => exportToExcel(columns, rows, `orcado-x-executado_${todayInput()}.xlsx`, 'Orçado x Executado')}
      exportDisabled={loading}
    >
      {data && <CoberturaNota data={data} />}
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhum contrato vinculado tem HH orçado e realizado suficientes ainda." />}
    </ReportShell>
  )
}

export function Crz02Rentabilidade() {
  const { data, loading } = useReportData<CruzamentoData>('/api/relatorios/cruzamento', {})
  const rows = data?.crz02_rentabilidade ?? []

  const columns: DataColumn<CrzRow>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'vendido', header: 'R$/HH Vendido', type: 'currency', value: (r) => r.rs_hh_vendido },
    { key: 'real', header: 'R$/HH Realizado', type: 'currency', value: (r) => r.rs_hh_realizado },
    {
      key: 'situacao', header: 'Situação', type: 'text',
      value: (r) => r.rs_hh_vendido == null || r.rs_hh_realizado == null ? null : (r.rs_hh_realizado < r.rs_hh_vendido ? 'Abaixo do vendido' : 'Dentro/acima'),
    },
  ]

  return (
    <ReportShell
      titulo="Rentabilidade Real" descricao="O negócio que fechamos por R$/HH X está sendo executado com a margem que imaginamos."
      onExport={() => exportToExcel(columns, rows, `rentabilidade-real_${todayInput()}.xlsx`, 'Rentabilidade')}
      exportDisabled={loading}
    >
      {data && <CoberturaNota data={data} />}
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhum contrato vinculado tem R$/HH de venda e de execução suficientes ainda." />}
    </ReportShell>
  )
}

export function Crz03Timeline() {
  const [contratoId, setContratoId] = useState('')
  const [contratoIdAplicado, setContratoIdAplicado] = useState('')
  const { data, loading } = useReportData<CruzamentoData>('/api/relatorios/cruzamento', { contrato_id: contratoIdAplicado })

  const rows = data?.crz03_timeline?.etapas.map((e, i) => ({ ordem: i + 1, ...e })) ?? []

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'ordem', header: '#', type: 'number', value: (r) => r.ordem },
    { key: 'etapa', header: 'Etapa', type: 'text', value: (r) => r.label },
    { key: 'data', header: 'Data', type: 'date', value: (r) => r.data ? new Date(r.data) : null },
  ]

  return (
    <ReportShell
      titulo="Ciclo de Vida do Negócio" descricao="Da solicitação ao encerramento do contrato, quanto tempo passou e quantas etapas teve."
      onExport={data?.crz03_timeline ? () => exportToExcel(columns, rows, `ciclo-vida-${data.crz03_timeline!.contrato.indice}_${todayInput()}.xlsx`, 'Ciclo de Vida') : undefined}
      exportDisabled={!data?.crz03_timeline}
      filtros={
        <>
          <Field label="Contrato" className="w-64">
            <SearchableSelect value={contratoId} onChange={setContratoId} options={data?.filtros.contratos_vinculados.map((c) => ({ value: String(c.id), label: `${c.indice} — ${c.cliente}` })) ?? []} placeholder="Buscar contrato..." emptyLabel="Selecione um contrato vinculado" />
          </Field>
          <FilterActions onAplicar={() => setContratoIdAplicado(contratoId)} onLimpar={() => { setContratoId(''); setContratoIdAplicado('') }} />
        </>
      }
    >
      {data && <CoberturaNota data={data} />}
      {!contratoIdAplicado ? (
        <p className="text-[12px] text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-md">Selecione, acima, um contrato que já tenha a solicitação de origem vinculada.</p>
      ) : loading ? (
        <p className="text-center text-gray-400 py-10">Carregando...</p>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.ordem} />
      )}
    </ReportShell>
  )
}
