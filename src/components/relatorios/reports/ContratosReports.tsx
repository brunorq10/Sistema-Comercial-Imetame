'use client'

import { useMemo, useState } from 'react'
import { ReportShell } from '../ReportShell'
import { DataTable, type DataColumn } from '../DataTable'
import { FilterActions } from '../FilterActions'
import { useReportData } from '../useReportData'
import { Field, Select } from '@/components/ui/Input'
import { exportToExcel } from '@/lib/exportExcel'
import { todayInput } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }
const STATUS_LABELS: Record<string, string> = { A_FATURAR: 'A faturar', PARCIAL: 'Parcial', FATURADO: 'Faturado', CANCELADO: 'Cancelado' }

interface ContratosData {
  filtros: { responsaveis: Array<{ id: number; nome: string }> }
  ctr01_lista: Array<{ id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; responsavel: string | null; classificacao: string | null; num_os: string | null; status: string; valor: number }>
  ctr02_hh: Array<{ id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; classificacao: string | null; previsto: number; realizado: number; desvio_pct: number | null }>
  ctr03_fabricacao: Array<{ contrato_id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; item: string; hh_orcado: number; hh_previsto: number; hh_realizado: number; peso_previsto: number; peso_realizado: number; pct_avanco: number }>
  ctr04_ucr: { contagem_por_faixa: Record<string, number>; contratos: Array<{ id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; regiao: string; rs_hh: number | null; classificacao_ucr: string | null }> }
  ctr05_encerrando: { janela_dias: number; cobertura: string; contratos: Array<{ id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; classificacao: string | null; data_fim: string; dias_restantes: number; propostas_em_andamento_mesmo_cliente: number }> }
}

export function Ctr01Carteira() {
  const { data, loading } = useReportData<ContratosData>('/api/relatorios/contratos', {})
  const [responsavel, setResponsavel] = useState('')
  const [responsavelAplicado, setResponsavelAplicado] = useState('')

  const rows = useMemo(() => {
    const base = data?.ctr01_lista ?? []
    return responsavelAplicado ? base.filter((r) => r.responsavel === responsavelAplicado) : base
  }, [data, responsavelAplicado])

  const columns: DataColumn<ContratosData['ctr01_lista'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'resp', header: 'Responsável', type: 'text', value: (r) => r.responsavel ?? '—' },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
    { key: 'os', header: 'Nº OS', type: 'text', value: (r) => r.num_os ?? '—' },
    { key: 'status', header: 'Status', type: 'text', value: (r) => STATUS_LABELS[r.status] ?? r.status },
    { key: 'valor', header: 'Valor', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Carteira Ativa de Contratos" descricao="Quantos contratos tenho ativos agora, e como estão distribuídos."
      onExport={() => exportToExcel(columns, rows, `carteira-ativa_${todayInput()}.xlsx`, 'Carteira')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="Responsável">
            <Select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="w-44">
              <option value="">Todos</option>
              {data?.filtros.responsaveis.map((r) => <option key={r.id} value={r.nome}>{r.nome}</option>)}
            </Select>
          </Field>
          <FilterActions onAplicar={() => setResponsavelAplicado(responsavel)} onLimpar={() => { setResponsavel(''); setResponsavelAplicado('') }} />
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </ReportShell>
  )
}

export function Ctr02Hh() {
  const { data, loading } = useReportData<ContratosData>('/api/relatorios/contratos', {})
  const [classif, setClassif] = useState('')
  const [classifAplicado, setClassifAplicado] = useState('')

  const rows = useMemo(() => {
    const base = data?.ctr02_hh ?? []
    return classifAplicado ? base.filter((r) => r.classificacao === classifAplicado) : base
  }, [data, classifAplicado])

  const columns: DataColumn<ContratosData['ctr02_hh'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
    { key: 'previsto', header: 'HH Previsto', type: 'number', value: (r) => r.previsto, totalizer: 'sum' },
    { key: 'realizado', header: 'HH Realizado', type: 'number', value: (r) => r.realizado, totalizer: 'sum' },
    { key: 'desvio', header: 'Desvio %', type: 'percent', value: (r) => r.desvio_pct },
  ]

  return (
    <ReportShell
      titulo="Aderência de HH" descricao="Estamos usando mais ou menos homem-hora do que planejamos nos contratos de Obras e Paradas."
      onExport={() => exportToExcel(columns, rows, `aderencia-hh_${todayInput()}.xlsx`, 'Aderência HH')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="Classificação">
            <Select value={classif} onChange={(e) => setClassif(e.target.value)} className="w-40">
              <option value="">Todas</option>
              <option value="OBRAS">Obras</option>
              <option value="PARADAS">Paradas</option>
            </Select>
          </Field>
          <FilterActions onAplicar={() => setClassifAplicado(classif)} onLimpar={() => { setClassif(''); setClassifAplicado('') }} />
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </ReportShell>
  )
}

export function Ctr03Fabricacao() {
  const { data, loading } = useReportData<ContratosData>('/api/relatorios/contratos', {})
  const rows = data?.ctr03_fabricacao ?? []

  const columns: DataColumn<ContratosData['ctr03_fabricacao'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'item', header: 'Item', type: 'text', value: (r) => r.item },
    { key: 'hh_orc', header: 'HH Orçado', type: 'number', value: (r) => r.hh_orcado, totalizer: 'sum' },
    { key: 'hh_prev', header: 'HH Previsto', type: 'number', value: (r) => r.hh_previsto, totalizer: 'sum' },
    { key: 'hh_real', header: 'HH Realizado', type: 'number', value: (r) => r.hh_realizado, totalizer: 'sum' },
    { key: 'peso_prev', header: 'Peso Previsto (t)', type: 'number', value: (r) => r.peso_previsto },
    { key: 'peso_real', header: 'Peso Realizado (t)', type: 'number', value: (r) => r.peso_realizado },
    { key: 'avanco', header: '% Avanço', type: 'percent', value: (r) => r.pct_avanco },
  ]

  return (
    <ReportShell
      titulo="Avanço de Fabricação" descricao="Como está o avanço físico da fabricação, comparado ao planejado."
      onExport={() => exportToExcel(columns, rows, `avanco-fabricacao_${todayInput()}.xlsx`, 'Avanço')}
      exportDisabled={loading}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.contrato_id}-${r.item}`} />}
    </ReportShell>
  )
}

export function Ctr04Ucr() {
  const { data, loading } = useReportData<ContratosData>('/api/relatorios/contratos', {})
  const [faixa, setFaixa] = useState('')
  const [faixaAplicada, setFaixaAplicada] = useState('')

  const rows = useMemo(() => {
    const base = data?.ctr04_ucr.contratos ?? []
    return faixaAplicada ? base.filter((r) => r.classificacao_ucr === faixaAplicada) : base
  }, [data, faixaAplicada])

  const columns: DataColumn<ContratosData['ctr04_ucr']['contratos'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'regiao', header: 'Região', type: 'text', value: (r) => r.regiao },
    { key: 'rs_hh', header: 'R$/HH', type: 'currency', value: (r) => r.rs_hh },
    { key: 'ucr', header: 'Faixa UCR', type: 'text', value: (r) => r.classificacao_ucr ?? '—' },
  ]

  return (
    <ReportShell
      titulo="R$/HH por Contrato (UCR)" descricao="Qual contrato de Parada está rendendo bem, e qual está na faixa ruim da classificação UCR."
      onExport={() => exportToExcel(columns, rows, `rs-hh-ucr_${todayInput()}.xlsx`, 'UCR')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="Faixa UCR">
            <Select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="w-40">
              <option value="">Todas</option>
              {['Não Suficiente', 'A Evoluir', 'Bom', 'Ótimo', 'Esplêndido'].map((fx) => <option key={fx} value={fx}>{fx}</option>)}
            </Select>
          </Field>
          <FilterActions onAplicar={() => setFaixaAplicada(faixa)} onLimpar={() => { setFaixa(''); setFaixaAplicada('') }} />
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </ReportShell>
  )
}

export function Ctr05Encerrando() {
  const [janela, setJanela] = useState('')
  const [aplicado, setAplicado] = useState('')
  const { data, loading } = useReportData<ContratosData>('/api/relatorios/contratos', { janela: aplicado })
  const rows = data?.ctr05_encerrando.contratos ?? []

  const columns: DataColumn<ContratosData['ctr05_encerrando']['contratos'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
    { key: 'fim', header: 'Encerra em', type: 'date', value: (r) => new Date(r.data_fim) },
    { key: 'dias', header: 'Dias Restantes', type: 'number', value: (r) => r.dias_restantes },
    { key: 'pipeline', header: 'Propostas em Andamento', type: 'number', value: (r) => r.propostas_em_andamento_mesmo_cliente },
  ]

  return (
    <ReportShell
      titulo="Contratos Encerrando" descricao="Quais contratos terminam nos próximos meses, e existe algo no pipeline para substituir essa receita."
      onExport={() => exportToExcel(columns, rows, `contratos-encerrando_${todayInput()}.xlsx`, 'Encerrando')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="Janela">
            <Select value={janela || '90'} onChange={(e) => setJanela(e.target.value)} className="w-32">
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
            </Select>
          </Field>
          <FilterActions onAplicar={() => setAplicado(janela || '90')} onLimpar={() => { setJanela(''); setAplicado('') }} />
        </>
      }
    >
      {data && <p className="text-[11px] text-gray-500 mb-2">{data.ctr05_encerrando.cobertura}</p>}
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhum contrato encerrando nessa janela." />}
    </ReportShell>
  )
}
