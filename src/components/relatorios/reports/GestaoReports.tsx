'use client'

import { useMemo } from 'react'
import { ReportShell } from '../ReportShell'
import { DataTable, type DataColumn } from '../DataTable'
import { useReportData } from '../useReportData'
import { exportToExcel } from '@/lib/exportExcel'
import { todayInput } from '@/lib/utils'

interface GestaoData {
  gst01: {
    orcamentistas: Array<{ nome: string; total: number }>
    responsaveis_acordos: Array<{ nome: string; contratos: number; valor: number }>
  }
  gst02: { ano_atual: number; garantido_proximos_anos: number; pipeline_em_negociacao: number }
}

export function Gst01Carga() {
  const { data, loading } = useReportData<GestaoData>('/api/relatorios/gestao', {})

  const rows = useMemo(() => {
    if (!data) return []
    return [
      ...data.gst01.orcamentistas.map((o) => ({ time: 'Comercial', nome: o.nome, itens: o.total, valor: null as number | null })),
      ...data.gst01.responsaveis_acordos.map((r) => ({ time: 'Acordos', nome: r.nome, itens: r.contratos, valor: r.valor })),
    ]
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'time', header: 'Time', type: 'text', value: (r) => r.time },
    { key: 'nome', header: 'Pessoa', type: 'text', value: (r) => r.nome },
    { key: 'itens', header: 'Itens sob Responsabilidade', type: 'number', value: (r) => r.itens, totalizer: 'sum' },
    { key: 'valor', header: 'Valor sob Gestão', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Carga de Trabalho" descricao="Quantas solicitações e contratos cada pessoa está tocando agora."
      onExport={() => exportToExcel(columns, rows, `carga-de-trabalho_${todayInput()}.xlsx`, 'Carga')}
      exportDisabled={loading}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.time}-${r.nome}`} />}
    </ReportShell>
  )
}

export function Gst02Projecao() {
  const { data, loading } = useReportData<GestaoData>('/api/relatorios/gestao', {})

  const rows = useMemo(() => {
    if (!data) return []
    return [
      { item: `Garantido — anos após ${data.gst02.ano_atual}`, valor: data.gst02.garantido_proximos_anos },
      { item: 'Pipeline em negociação (ainda sem resultado)', valor: data.gst02.pipeline_em_negociacao },
    ]
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'item', header: 'Item', type: 'text', value: (r) => r.item },
    { key: 'valor', header: 'Valor', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Projeção de Faturamento Futuro" descricao="Com o que já está contratado hoje, quanto está garantido de faturar nos próximos anos."
      onExport={() => exportToExcel(columns, rows, `projecao-faturamento_${todayInput()}.xlsx`, 'Projeção')}
      exportDisabled={loading}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.item} />}
    </ReportShell>
  )
}
