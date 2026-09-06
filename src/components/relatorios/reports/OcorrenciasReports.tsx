'use client'

import { useMemo, useState } from 'react'
import { ReportShell } from '../ReportShell'
import { DataTable, type DataColumn } from '../DataTable'
import { FilterActions } from '../FilterActions'
import { useReportData } from '../useReportData'
import { Field, Input, Select } from '@/components/ui/Input'
import { exportToExcel } from '@/lib/exportExcel'
import { todayInput } from '@/lib/utils'

interface OcorrenciasData {
  ocm01_lista: Array<{ id: number; codigo: string; contrato: string; cliente: string; tipo: string; tipo_label: string; responsabilidade: string; responsabilidade_label: string; data: string; descricao: string }>
  ocm01_por_tipo: Array<{ tipo: string; label: string; total: number }>
  ocm01_por_responsabilidade: Array<{ responsabilidade: string; label: string; total: number }>
  ocm02_lista: Array<{ id: number; contrato: string; cliente: string; tipo: string; tipo_label: string; descricao: string; data: string; valor: number }>
  ocm02_total: number
  ocm02_por_tipo: Array<{ tipo: string; label: string; valor: number }>
  ocm03: Array<{ nome: string; ocorrencias: number; valor_multas: number; contratos_ativos: number; ocorrencias_por_contrato: number }>
}

function anoAtras(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().substring(0, 10)
}

function usePeriodoFiltro() {
  const [pendente, setPendente] = useState({ de: anoAtras(12), ate: todayInput() })
  const [aplicado, setAplicado] = useState({ de: anoAtras(12), ate: todayInput() })
  return { pendente, setPendente, aplicado, setAplicado }
}

export function Ocm01Ocorrencias() {
  const f = usePeriodoFiltro()
  const { data, loading } = useReportData<OcorrenciasData>('/api/relatorios/ocorrencias', f.aplicado)
  const [respFiltro, setRespFiltro] = useState('')
  const [respAplicado, setRespAplicado] = useState('')

  const rows = useMemo(() => {
    const base = data?.ocm01_lista ?? []
    return respAplicado ? base.filter((r) => r.responsabilidade === respAplicado) : base
  }, [data, respAplicado])

  const columns: DataColumn<OcorrenciasData['ocm01_lista'][number]>[] = [
    { key: 'codigo', header: 'Código', type: 'text', value: (r) => r.codigo },
    { key: 'contrato', header: 'Contrato', type: 'text', value: (r) => r.contrato },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'tipo', header: 'Tipo', type: 'text', value: (r) => r.tipo_label },
    { key: 'resp', header: 'Responsabilidade', type: 'text', value: (r) => r.responsabilidade_label },
    { key: 'data', header: 'Data', type: 'date', value: (r) => new Date(r.data) },
    { key: 'descricao', header: 'Descrição', type: 'text', value: (r) => r.descricao },
  ]

  return (
    <ReportShell
      titulo="Ocorrências Contratuais" descricao="O que mais atrapalha a execução dos contratos, e de quem é a responsabilidade."
      onExport={() => exportToExcel(columns, rows, `ocorrencias-contratuais_${todayInput()}.xlsx`, 'Ocorrências')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="De"><Input type="date" value={f.pendente.de} onChange={(e) => f.setPendente({ ...f.pendente, de: e.target.value })} className="w-36" /></Field>
          <Field label="Até"><Input type="date" value={f.pendente.ate} onChange={(e) => f.setPendente({ ...f.pendente, ate: e.target.value })} className="w-36" /></Field>
          <Field label="Responsabilidade">
            <Select value={respFiltro} onChange={(e) => setRespFiltro(e.target.value)} className="w-40">
              <option value="">Todas</option>
              <option value="CLIENTE">Cliente</option>
              <option value="IMETAME">Imetame</option>
              <option value="TERCEIROS">Terceiros</option>
              <option value="FORCA_MAIOR">Força Maior</option>
              <option value="A_APURAR">A apurar</option>
            </Select>
          </Field>
          <FilterActions onAplicar={() => { f.setAplicado(f.pendente); setRespAplicado(respFiltro) }} onLimpar={() => { const v = { de: anoAtras(12), ate: todayInput() }; f.setPendente(v); f.setAplicado(v); setRespFiltro(''); setRespAplicado('') }} />
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </ReportShell>
  )
}

export function Ocm02Multas() {
  const f = usePeriodoFiltro()
  const { data, loading } = useReportData<OcorrenciasData>('/api/relatorios/ocorrencias', f.aplicado)
  const rows = data?.ocm02_lista ?? []

  const columns: DataColumn<OcorrenciasData['ocm02_lista'][number]>[] = [
    { key: 'contrato', header: 'Contrato', type: 'text', value: (r) => r.contrato },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'tipo', header: 'Tipo', type: 'text', value: (r) => r.tipo_label },
    { key: 'descricao', header: 'Descrição', type: 'text', value: (r) => r.descricao },
    { key: 'data', header: 'Data', type: 'date', value: (r) => new Date(r.data) },
    { key: 'valor', header: 'Valor', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Multas e Penalidades" descricao="Quanto perdemos em multas, glosas e reembolsos, e com qual cliente."
      onExport={() => exportToExcel(columns, rows, `multas-penalidades_${todayInput()}.xlsx`, 'Multas')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="De"><Input type="date" value={f.pendente.de} onChange={(e) => f.setPendente({ ...f.pendente, de: e.target.value })} className="w-36" /></Field>
          <Field label="Até"><Input type="date" value={f.pendente.ate} onChange={(e) => f.setPendente({ ...f.pendente, ate: e.target.value })} className="w-36" /></Field>
          <FilterActions onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { const v = { de: anoAtras(12), ate: todayInput() }; f.setPendente(v); f.setAplicado(v) }} />
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhuma multa lançada no período." />}
    </ReportShell>
  )
}

export function Ocm03Reincidencia() {
  const { data, loading } = useReportData<OcorrenciasData>('/api/relatorios/ocorrencias', {})
  const rows = data?.ocm03 ?? []

  const columns: DataColumn<OcorrenciasData['ocm03'][number]>[] = [
    { key: 'nome', header: 'Cliente', type: 'text', value: (r) => r.nome },
    { key: 'ativos', header: 'Contratos Ativos', type: 'number', value: (r) => r.contratos_ativos },
    { key: 'ocorrencias', header: 'Ocorrências', type: 'number', value: (r) => r.ocorrencias, totalizer: 'sum' },
    { key: 'por_contrato', header: 'Ocorrências/Contrato', type: 'number', value: (r) => Number(r.ocorrencias_por_contrato.toFixed(2)) },
    { key: 'multas', header: 'Valor de Multas', type: 'currency', value: (r) => r.valor_multas, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Reincidência por Cliente" descricao="Existe cliente que gera ocorrência ou multa toda hora? Isso deveria pesar na próxima negociação."
      onExport={() => exportToExcel(columns, rows, `reincidencia-cliente_${todayInput()}.xlsx`, 'Reincidência')}
      exportDisabled={loading}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.nome} emptyLabel="Nenhuma ocorrência ou multa registrada." />}
    </ReportShell>
  )
}
