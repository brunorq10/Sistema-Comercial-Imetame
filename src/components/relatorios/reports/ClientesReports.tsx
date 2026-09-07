'use client'

import { useMemo, useState } from 'react'
import { ReportShell } from '../ReportShell'
import { DataTable, type DataColumn } from '../DataTable'
import { FilterActions } from '../FilterActions'
import { useReportData } from '../useReportData'
import { Field, Select } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { exportToExcel } from '@/lib/exportExcel'
import { todayInput } from '@/lib/utils'

interface ClientesData {
  filtros: { anos_disponiveis: number[]; clientes: Array<{ id: number; nome: string }> }
  ano: number
  cli01_curva_abc: Array<{ id: number; nome: string; valor: number; percentual: number; percentual_acumulado: number }>
  cli01_total_ano: number
  cli03_por_ramo: Array<{ ramo: string; label: string; valor: number }>
  cli03_por_segmento: Array<{ segmento: string; label: string; total: number }>
  cli04: { novos: { clientes: number; receita: number }; recorrentes: { clientes: number; receita: number } }
}

function useAnoFiltro(anosFallback: number[]) {
  const [pendente, setPendente] = useState('')
  const [aplicado, setAplicado] = useState('')
  return { pendente, setPendente, aplicado, setAplicado, anosFallback }
}

function AnoFiltro({ anos, value, onChange, onAplicar, onLimpar }: { anos: number[]; value: string; onChange: (v: string) => void; onAplicar: () => void; onLimpar: () => void }) {
  return (
    <>
      <Field label="Ano">
        <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-28">
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      </Field>
      <FilterActions onAplicar={onAplicar} onLimpar={onLimpar} />
    </>
  )
}

export function Cli01CurvaAbc() {
  const f = useAnoFiltro([])
  const { data, loading } = useReportData<ClientesData>('/api/relatorios/clientes', { ano: f.aplicado })
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]
  const rows = data?.cli01_curva_abc ?? []

  const columns: DataColumn<ClientesData['cli01_curva_abc'][number]>[] = [
    { key: 'nome', header: 'Cliente', type: 'text', value: (r) => r.nome },
    { key: 'valor', header: 'Faturado', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
    { key: 'pct', header: '% do Total', type: 'percent', value: (r) => r.percentual },
    { key: 'acum', header: '% Acumulado', type: 'percent', value: (r) => r.percentual_acumulado },
  ]

  return (
    <ReportShell
      titulo="Concentração de Carteira" descricao="Quais clientes representam a maior parte da minha receita, e o quanto dependo deles."
      onExport={() => exportToExcel(columns, rows, `concentracao-carteira_${data?.ano ?? todayInput()}.xlsx`, 'Curva ABC')}
      exportDisabled={loading}
      filtros={<AnoFiltro anos={anos} value={f.pendente || String(anos[0])} onChange={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { f.setPendente(''); f.setAplicado('') }} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </ReportShell>
  )
}

export function Cli02Ficha() {
  const [clienteId, setClienteId] = useState('')
  const [clienteIdAplicado, setClienteIdAplicado] = useState('')
  const { data: filtrosData } = useReportData<ClientesData>('/api/relatorios/clientes', {})

  interface Ficha {
    cliente: { id: number; nome: string; cnpj: string | null; cidade: string | null; estado: string | null; ramo_atuacao: string | null; segmento: string | null; ativo: boolean }
    resumo: { total_negocios: number; taxa_conversao_historica: number | null; total_faturado: number; total_multas: number; total_ocorrencias: number; contratos_ativos: number }
    solicitacoes: Array<{ id: number; numero: string; status: string; escopo: string | null; classificacao: string | null; data: string; valor: number | null; resultado: string | null }>
    contratos: Array<{ id: number; indice: string; escopo: string | null; cidade: string | null; status: string; classificacao: string | null; valor_contrato: number | null; data_inicio: string | null; data_fim: string | null; faturado: number; nf_ocorrencias: number; nf_multas: number; valor_multas: number }>
  }
  const { data: ficha, loading } = useReportData<Ficha>(clienteIdAplicado ? `/api/relatorios/clientes/${clienteIdAplicado}` : '', {})

  const resumoRows = ficha ? [ficha.resumo] : []
  const resumoColumns: DataColumn<Ficha['resumo']>[] = [
    { key: 'negocios', header: 'Negócios', type: 'number', value: (r) => r.total_negocios },
    { key: 'conversao', header: 'Conversão Histórica', type: 'percent', value: (r) => r.taxa_conversao_historica },
    { key: 'faturado', header: 'Total Faturado', type: 'currency', value: (r) => r.total_faturado },
    { key: 'multas', header: 'Total Multas', type: 'currency', value: (r) => r.total_multas },
    { key: 'ocorrencias', header: 'Ocorrências', type: 'number', value: (r) => r.total_ocorrencias },
    { key: 'ativos', header: 'Contratos Ativos', type: 'number', value: (r) => r.contratos_ativos },
  ]

  const solColumns: DataColumn<Ficha['solicitacoes'][number]>[] = [
    { key: 'numero', header: 'Nº', type: 'text', value: (r) => r.numero },
    { key: 'data', header: 'Data', type: 'date', value: (r) => new Date(r.data) },
    { key: 'status', header: 'Status', type: 'text', value: (r) => r.status },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => r.classificacao ?? '—' },
    { key: 'valor', header: 'Valor', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
    { key: 'resultado', header: 'Resultado', type: 'text', value: (r) => r.resultado ?? '—' },
  ]

  const ctrColumns: DataColumn<Ficha['contratos'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'escopo', header: 'Escopo', type: 'text', value: (r) => r.escopo ?? '—' },
    { key: 'cidade', header: 'Cidade', type: 'text', value: (r) => r.cidade ?? '—' },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => r.classificacao ?? '—' },
    { key: 'inicio', header: 'Início', type: 'date', value: (r) => r.data_inicio ? new Date(r.data_inicio) : null },
    { key: 'faturado', header: 'Faturado', type: 'currency', value: (r) => r.faturado, totalizer: 'sum' },
    { key: 'ocorrencias', header: 'Ocorrências', type: 'number', value: (r) => r.nf_ocorrencias, totalizer: 'sum' },
    { key: 'multas', header: 'Multas', type: 'currency', value: (r) => r.valor_multas, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Ficha do Cliente" descricao="Tudo que já aconteceu com este cliente — solicitações, contratos, faturamento, ocorrências e multas."
      onExport={ficha ? () => exportToExcel(ctrColumns, ficha.contratos, `ficha-cliente-${ficha.cliente.nome}_${todayInput()}.xlsx`, 'Contratos') : undefined}
      exportDisabled={!ficha}
      filtros={
        <>
          <Field label="Cliente" className="w-64">
            <SearchableSelect value={clienteId} onChange={setClienteId} options={filtrosData?.filtros.clientes.map((c) => ({ value: String(c.id), label: c.nome })) ?? []} placeholder="Buscar cliente..." emptyLabel="Selecione" />
          </Field>
          <FilterActions onAplicar={() => setClienteIdAplicado(clienteId)} onLimpar={() => { setClienteId(''); setClienteIdAplicado('') }} />
        </>
      }
    >
      {!clienteIdAplicado ? (
        <p className="text-[12px] text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-md">Selecione um cliente e clique em Aplicar para ver o histórico completo.</p>
      ) : loading ? (
        <p className="text-center text-gray-400 py-10">Carregando...</p>
      ) : !ficha ? (
        <p className="text-center text-gray-400 py-10">Cliente não encontrado.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase mb-1.5">Resumo — {ficha.cliente.nome}</p>
            <DataTable columns={resumoColumns} rows={resumoRows} rowKey={() => 'resumo'} maxH="100px" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase mb-1.5">Solicitações</p>
            <DataTable columns={solColumns} rows={ficha.solicitacoes} rowKey={(r) => r.id} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase mb-1.5">Contratos</p>
            <DataTable columns={ctrColumns} rows={ficha.contratos} rowKey={(r) => r.id} />
          </div>
        </div>
      )}
    </ReportShell>
  )
}

export function Cli03Ranking() {
  const f = useAnoFiltro([])
  const { data, loading } = useReportData<ClientesData>('/api/relatorios/clientes', { ano: f.aplicado })
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]

  const rows = useMemo(() => {
    if (!data) return []
    return [
      ...data.cli03_por_ramo.map((r) => ({ dimensao: 'Ramo (faturamento)', item: r.label, valor: r.valor })),
      ...data.cli03_por_segmento.map((r) => ({ dimensao: 'Segmento (solicitações)', item: r.label, valor: r.total })),
    ]
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'dim', header: 'Dimensão', type: 'text', value: (r) => r.dimensao },
    { key: 'item', header: 'Item', type: 'text', value: (r) => r.item },
    { key: 'valor', header: 'Valor', type: 'number', value: (r) => r.valor },
  ]

  return (
    <ReportShell
      titulo="Ranking por Segmento e Ramo" descricao="Em qual ramo de atuação eu mais faturo, e onde tem espaço para crescer."
      onExport={() => exportToExcel(columns, rows, `ranking-segmento-ramo_${todayInput()}.xlsx`, 'Ranking')}
      exportDisabled={loading}
      filtros={<AnoFiltro anos={anos} value={f.pendente || String(anos[0])} onChange={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { f.setPendente(''); f.setAplicado('') }} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.dimensao}-${r.item}`} />}
    </ReportShell>
  )
}

export function Cli04Recorrentes() {
  const f = useAnoFiltro([])
  const { data, loading } = useReportData<ClientesData>('/api/relatorios/clientes', { ano: f.aplicado })
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]

  const rows = useMemo(() => {
    if (!data) return []
    return [
      { grupo: 'Novos', clientes: data.cli04.novos.clientes, receita: data.cli04.novos.receita },
      { grupo: 'Recorrentes', clientes: data.cli04.recorrentes.clientes, receita: data.cli04.recorrentes.receita },
    ]
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'grupo', header: 'Grupo', type: 'text', value: (r) => r.grupo },
    { key: 'clientes', header: 'Clientes', type: 'number', value: (r) => r.clientes, totalizer: 'sum' },
    { key: 'receita', header: 'Receita', type: 'currency', value: (r) => r.receita, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Clientes Recorrentes x Novos" descricao="Estou vivendo de cliente novo ou de cliente que já é meu."
      onExport={() => exportToExcel(columns, rows, `recorrentes-x-novos_${todayInput()}.xlsx`, 'Recorrentes x Novos')}
      exportDisabled={loading}
      filtros={<AnoFiltro anos={anos} value={f.pendente || String(anos[0])} onChange={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { f.setPendente(''); f.setAplicado('') }} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.grupo} />}
    </ReportShell>
  )
}
