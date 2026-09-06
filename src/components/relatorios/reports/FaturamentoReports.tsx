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
const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const STATUS_FAT_LABELS: Record<string, string> = { A_FATURAR: 'A faturar', PARCIAL: 'Parcial', FATURADO: 'Faturado' }

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

function useAno() {
  const [pendente, setPendente] = useState('')
  const [aplicado, setAplicado] = useState('')
  return { pendente, setPendente, aplicado, setAplicado }
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

export function Fat01Mensal() {
  const f = useAno()
  const { data, loading } = useReportData<FaturamentoData>('/api/relatorios/faturamento', { ano: f.aplicado })
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]
  const rows = data?.fat01_mensal ?? []

  const columns: DataColumn<FaturamentoData['fat01_mensal'][number]>[] = [
    { key: 'mes', header: 'Mês', type: 'text', value: (r) => r.label },
    { key: 'prev', header: 'Previsto', type: 'currency', value: (r) => r.previsto, totalizer: 'sum' },
    { key: 'fat', header: 'Faturado', type: 'currency', value: (r) => r.faturado, totalizer: 'sum' },
    { key: 'pct', header: '% Atingimento', type: 'percent', value: (r) => r.percentual },
  ]

  return (
    <ReportShell
      titulo="Previsto x Realizado do Ano" descricao="Estamos faturando o que planejamos este ano? Quanto falta?"
      onExport={() => exportToExcel(columns, rows, `previsto-realizado_${data?.ano ?? todayInput()}.xlsx`, 'Previsto x Realizado')}
      exportDisabled={loading}
      filtros={<AnoFiltro anos={anos} value={f.pendente || String(anos[0])} onChange={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { f.setPendente(''); f.setAplicado('') }} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.mes} />}
    </ReportShell>
  )
}

export function Fat02Saldo() {
  const { data, loading } = useReportData<FaturamentoData>('/api/relatorios/faturamento', {})
  const [responsavel, setResponsavel] = useState('')
  const [responsavelAplicado, setResponsavelAplicado] = useState('')

  const rows = useMemo(() => {
    const base = data?.fat02_saldo ?? []
    return responsavelAplicado ? base.filter((r) => r.responsavel === responsavelAplicado) : base
  }, [data, responsavelAplicado])

  const columns: DataColumn<FaturamentoData['fat02_saldo'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'resp', header: 'Responsável', type: 'text', value: (r) => r.responsavel ?? '—' },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
    { key: 'total', header: 'Valor Total', type: 'currency', value: (r) => r.valor_total, totalizer: 'sum' },
    { key: 'faturado', header: 'Faturado', type: 'currency', value: (r) => r.faturado, totalizer: 'sum' },
    { key: 'saldo', header: 'Saldo', type: 'currency', value: (r) => r.saldo, totalizer: 'sum' },
    { key: 'status', header: 'Status', type: 'text', value: (r) => STATUS_FAT_LABELS[r.status_faturamento] ?? r.status_faturamento },
  ]

  return (
    <ReportShell
      titulo="Saldo a Faturar" descricao="De cada contrato ativo, quanto já foi faturado e quanto ainda falta."
      onExport={() => exportToExcel(columns, rows, `saldo-a-faturar_${todayInput()}.xlsx`, 'Saldo')}
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

export function Fat03Evolucao() {
  const f = useAno()
  const { data, loading } = useReportData<FaturamentoData>('/api/relatorios/faturamento', { ano: f.aplicado })
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]
  const rows = data?.fat03_evolucao ?? []

  const columns: DataColumn<FaturamentoData['fat03_evolucao'][number]>[] = [
    { key: 'ano', header: 'Ano', type: 'text', value: (r) => String(r.ano) },
    ...MESES_CURTO.map((label, i): DataColumn<FaturamentoData['fat03_evolucao'][number]> => ({
      key: `m${i}`, header: label, type: 'currency', value: (r) => r.meses[i],
    })),
    { key: 'total', header: 'Total', type: 'currency', value: (r) => r.total, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Evolução Multi-Ano" descricao="Como o faturamento evoluiu nos últimos anos — estamos crescendo?"
      onExport={() => exportToExcel(columns, rows, `evolucao-multi-ano_${todayInput()}.xlsx`, 'Evolução')}
      exportDisabled={loading}
      filtros={<AnoFiltro anos={anos} value={f.pendente || String(anos[0])} onChange={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { f.setPendente(''); f.setAplicado('') }} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.ano} />}
    </ReportShell>
  )
}

export function Fat04PorClassificacao() {
  const f = useAno()
  const { data, loading } = useReportData<FaturamentoData>('/api/relatorios/faturamento', { ano: f.aplicado })
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]
  const rows = data?.fat04_por_classificacao.map((c) => ({ ...c, label: CLASSIF_LABELS[c.classificacao] ?? c.classificacao })) ?? []

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => r.label },
    { key: 'previsto', header: 'Previsto', type: 'currency', value: (r) => r.previsto, totalizer: 'sum' },
    { key: 'faturado', header: 'Faturado', type: 'currency', value: (r) => r.faturado, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Faturamento por Classificação" descricao="De onde vem o faturamento — Obras, Paradas, Fabricação ou Óleo e Gás."
      onExport={() => exportToExcel(columns, rows, `faturamento-por-classificacao_${todayInput()}.xlsx`, 'Por Classificação')}
      exportDisabled={loading}
      filtros={<AnoFiltro anos={anos} value={f.pendente || String(anos[0])} onChange={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={() => { f.setPendente(''); f.setAplicado('') }} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.classificacao} />}
    </ReportShell>
  )
}

export function Fat05Aderencia() {
  const [ano, setAno] = useState('')
  const [mes, setMes] = useState('')
  const [aplicado, setAplicado] = useState<{ ano: string; mes_ref: string }>({ ano: '', mes_ref: '' })
  const { data, loading } = useReportData<FaturamentoData>('/api/relatorios/faturamento', aplicado)
  const anos = data?.filtros.anos_disponiveis ?? [new Date().getFullYear()]
  const rows = data?.fat05_aderencia ?? []

  const columns: DataColumn<FaturamentoData['fat05_aderencia'][number]>[] = [
    { key: 'indice', header: 'Contrato', type: 'text', value: (r) => r.indice },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'previsto', header: 'Previsto', type: 'currency', value: (r) => r.previsto_mes, totalizer: 'sum' },
    { key: 'faturado', header: 'Faturado', type: 'currency', value: (r) => r.faturado_mes, totalizer: 'sum' },
    { key: 'desvio', header: 'Desvio', type: 'currency', value: (r) => r.desvio, totalizer: 'sum' },
    { key: 'desvio_pct', header: 'Desvio %', type: 'percent', value: (r) => r.desvio_pct },
  ]

  return (
    <ReportShell
      titulo="Aderência da Previsão" descricao="Quais contratos ou responsáveis erram a previsão, todo mês, para cima ou para baixo."
      onExport={() => exportToExcel(columns, rows, `aderencia-previsao_${data?.ano ?? ''}-${data?.mes_ref ?? ''}.xlsx`, 'Aderência')}
      exportDisabled={loading}
      filtros={
        <>
          <Field label="Ano">
            <Select value={ano || String(anos[0])} onChange={(e) => setAno(e.target.value)} className="w-28">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="Mês">
            <Select value={mes || String(new Date().getMonth() + 1)} onChange={(e) => setMes(e.target.value)} className="w-32">
              {MESES_CURTO.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
          </Field>
          <FilterActions onAplicar={() => setAplicado({ ano, mes_ref: mes })} onLimpar={() => { setAno(''); setMes(''); setAplicado({ ano: '', mes_ref: '' }) }} />
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhum contrato com previsto ou faturado nesse mês." />}
    </ReportShell>
  )
}

export function Fat06Pendencias() {
  const { data, loading } = useReportData<FaturamentoData>('/api/relatorios/faturamento', {})
  const rows = data?.fat06_pendencias ?? []

  const columns: DataColumn<FaturamentoData['fat06_pendencias'][number]>[] = [
    { key: 'tipo', header: 'Tipo', type: 'text', value: (r) => r.tipo },
    { key: 'nf', header: 'NF', type: 'text', value: (r) => r.numero_nf },
    { key: 'contrato', header: 'Contrato', type: 'text', value: (r) => r.contrato },
    { key: 'cliente', header: 'Cliente', type: 'text', value: (r) => r.cliente },
    { key: 'dias', header: 'Dias em Espera', type: 'number', value: (r) => r.dias_em_espera, totalizer: 'avg' },
  ]

  return (
    <ReportShell
      titulo="NFs Pendentes de Aprovação" descricao="Quantas NFs estão esperando aprovação, e há quanto tempo."
      onExport={() => exportToExcel(columns, rows, `nfs-pendentes_${todayInput()}.xlsx`, 'Pendências')}
      exportDisabled={loading}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.tipo}-${r.id}`} emptyLabel="Nenhuma pendência de aprovação." />}
    </ReportShell>
  )
}
