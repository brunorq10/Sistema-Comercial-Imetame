'use client'

import { useMemo, useState } from 'react'
import { ReportShell } from '../ReportShell'
import { DataTable, type DataColumn } from '../DataTable'
import { FilterActions } from '../FilterActions'
import { useReportData } from '../useReportData'
import { Field, Input, Select } from '@/components/ui/Input'
import { exportToExcel } from '@/lib/exportExcel'
import { todayInput } from '@/lib/utils'

const CLASSIF_LABELS: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', OLEO_GAS: 'Óleo e Gás', FABRICACOES: 'Fabricações' }
const CLASSIF_OPTIONS = Object.entries(CLASSIF_LABELS)

interface ComercialData {
  filtros: { clientes: Array<{ id: number; nome: string }>; orcamentistas: Array<{ id: number; nome: string }> }
  com01_funil: { aguardando_analise: number; em_elaboracao: number; em_elaboracao_tecnica_pendente: number; proposta_enviada: number; contrato_ganho: number; recusada: number }
  com02_atrasadas: Array<{ id: number; classificacao: string | null; orcamentista: string | null; dias_atraso: number }>
  com03_motivos: { reprovacao: Array<{ motivo: string; label: string; total: number }>; perda: Array<{ motivo: string; label: string; total: number }> }
  com04_orcamentistas: Array<{ id: number; nome: string; em_carteira: number; enviadas: number; no_prazo: number; pct_no_prazo: number; ganhas: number; valor_ganho: number; ticket_medio: number }>
  com05_pipeline: { total: number; por_classificacao: Array<{ classificacao: string; valor: number }>; por_interesse: { ALTO: number; MEDIO: number; BAIXO: number }; maiores: Array<{ id: number; classificacao: string | null; interesse: string | null; valor: number }> }
  com06_ciclo: { media_geral: number | null; por_classificacao: Array<{ classificacao: string; media_dias: number }> }
}

function usePeriodoClassifFilter() {
  const [pendente, setPendente] = useState({ de: '', ate: '', classificacao: '' })
  const [aplicado, setAplicado] = useState({ de: '', ate: '', classificacao: '' })
  const limpar = () => { const v = { de: '', ate: '', classificacao: '' }; setPendente(v); setAplicado(v) }
  return { pendente, setPendente, aplicado, setAplicado, limpar }
}

function PeriodoClassifFiltros({ pendente, setPendente, onAplicar, onLimpar }: {
  pendente: { de: string; ate: string; classificacao: string }
  setPendente: (v: { de: string; ate: string; classificacao: string }) => void
  onAplicar: () => void; onLimpar: () => void
}) {
  return (
    <>
      <Field label="De"><Input type="date" value={pendente.de} onChange={(e) => setPendente({ ...pendente, de: e.target.value })} className="w-36" /></Field>
      <Field label="Até"><Input type="date" value={pendente.ate} onChange={(e) => setPendente({ ...pendente, ate: e.target.value })} className="w-36" /></Field>
      <Field label="Classificação">
        <Select value={pendente.classificacao} onChange={(e) => setPendente({ ...pendente, classificacao: e.target.value })} className="w-40">
          <option value="">Todas</option>
          {CLASSIF_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <FilterActions onAplicar={onAplicar} onLimpar={onLimpar} />
    </>
  )
}

export function Com01Funil() {
  const f = usePeriodoClassifFilter()
  const { data, loading } = useReportData<ComercialData>('/api/relatorios/comercial', f.aplicado)

  const rows = useMemo(() => {
    if (!data) return []
    const fu = data.com01_funil
    return [
      { etapa: 'Aguardando análise', quantidade: fu.aguardando_analise },
      { etapa: `Em elaboração (${fu.em_elaboracao_tecnica_pendente} sem técnica)`, quantidade: fu.em_elaboracao },
      { etapa: 'Proposta enviada', quantidade: fu.proposta_enviada },
      { etapa: 'Contrato ganho', quantidade: fu.contrato_ganho },
      { etapa: 'Recusada', quantidade: fu.recusada },
    ]
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'etapa', header: 'Etapa', type: 'text', value: (r) => r.etapa },
    { key: 'qtd', header: 'Quantidade', type: 'number', value: (r) => r.quantidade, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Funil de Solicitações" descricao="Quantas solicitações estão em cada etapa, e onde elas estão empacando."
      onExport={() => exportToExcel(columns, rows, `funil-solicitacoes_${todayInput()}.xlsx`, 'Funil')}
      exportDisabled={loading}
      filtros={<PeriodoClassifFiltros pendente={f.pendente} setPendente={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={f.limpar} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.etapa} />}
    </ReportShell>
  )
}

export function Com02Atrasadas() {
  const f = usePeriodoClassifFilter()
  const [orcamentista, setOrcamentista] = useState('')
  const [orcamentistaAplicado, setOrcamentistaAplicado] = useState('')
  const { data, loading } = useReportData<ComercialData>('/api/relatorios/comercial', f.aplicado)

  const rows = useMemo(() => {
    const base = data?.com02_atrasadas ?? []
    return orcamentistaAplicado ? base.filter((r) => r.orcamentista === orcamentistaAplicado) : base
  }, [data, orcamentistaAplicado])

  const columns: DataColumn<ComercialData['com02_atrasadas'][number]>[] = [
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => CLASSIF_LABELS[r.classificacao ?? ''] ?? '—' },
    { key: 'orc', header: 'Orçamentista', type: 'text', value: (r) => r.orcamentista ?? '—' },
    { key: 'dias', header: 'Dias de Atraso', type: 'number', value: (r) => r.dias_atraso, totalizer: 'avg' },
  ]

  return (
    <ReportShell
      titulo="Propostas Paradas e Atrasadas" descricao="Propostas sem envio, vencidas ou perto de vencer, e de quem é a responsabilidade."
      onExport={() => exportToExcel(columns, rows, `propostas-atrasadas_${todayInput()}.xlsx`, 'Atrasadas')}
      exportDisabled={loading}
      filtros={
        <>
          <PeriodoClassifFiltros pendente={f.pendente} setPendente={f.setPendente} onAplicar={() => { f.setAplicado(f.pendente); setOrcamentistaAplicado(orcamentista) }} onLimpar={() => { f.limpar(); setOrcamentista(''); setOrcamentistaAplicado('') }} />
          <Field label="Orçamentista">
            <Select value={orcamentista} onChange={(e) => setOrcamentista(e.target.value)} className="w-44">
              <option value="">Todos</option>
              {data?.filtros.orcamentistas.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
            </Select>
          </Field>
        </>
      }
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhuma proposta atrasada — carteira em dia." />}
    </ReportShell>
  )
}

export function Com03Motivos() {
  const f = usePeriodoClassifFilter()
  const { data, loading } = useReportData<ComercialData>('/api/relatorios/comercial', f.aplicado)

  const rows = useMemo(() => {
    if (!data) return []
    return [
      ...data.com03_motivos.reprovacao.map((m) => ({ etapa: 'Reprovação (análise)', motivo: m.label, total: m.total })),
      ...data.com03_motivos.perda.map((m) => ({ etapa: 'Perda (proposta enviada)', motivo: m.label, total: m.total })),
    ]
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'etapa', header: 'Etapa', type: 'text', value: (r) => r.etapa },
    { key: 'motivo', header: 'Motivo', type: 'text', value: (r) => r.motivo },
    { key: 'total', header: 'Quantidade', type: 'number', value: (r) => r.total, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Motivos de Perda e Recusa" descricao="Por que estamos perdendo negócio — preço, prazo, escopo, concorrência."
      onExport={() => exportToExcel(columns, rows, `motivos-perda-recusa_${todayInput()}.xlsx`, 'Motivos')}
      exportDisabled={loading}
      filtros={<PeriodoClassifFiltros pendente={f.pendente} setPendente={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={f.limpar} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.etapa}-${r.motivo}`} />}
    </ReportShell>
  )
}

export function Com04Orcamentistas() {
  const f = usePeriodoClassifFilter()
  const { data, loading } = useReportData<ComercialData>('/api/relatorios/comercial', f.aplicado)
  const rows = data?.com04_orcamentistas ?? []

  const columns: DataColumn<ComercialData['com04_orcamentistas'][number]>[] = [
    { key: 'nome', header: 'Orçamentista', type: 'text', value: (r) => r.nome },
    { key: 'carteira', header: 'Em Carteira', type: 'number', value: (r) => r.em_carteira, totalizer: 'sum' },
    { key: 'enviadas', header: 'Enviadas', type: 'number', value: (r) => r.enviadas, totalizer: 'sum' },
    { key: 'pct_prazo', header: '% no Prazo', type: 'percent', value: (r) => r.pct_no_prazo },
    { key: 'ganhas', header: 'Ganhas', type: 'number', value: (r) => r.ganhas, totalizer: 'sum' },
    { key: 'valor_ganho', header: 'Valor Ganho', type: 'currency', value: (r) => r.valor_ganho, totalizer: 'sum' },
    { key: 'ticket', header: 'Ticket Médio', type: 'currency', value: (r) => r.ticket_medio },
  ]

  return (
    <ReportShell
      titulo="Desempenho por Orçamentista" descricao="Quem está entregando no prazo, quem está com fila grande, e quem está ganhando mais."
      onExport={() => exportToExcel(columns, rows, `desempenho-orcamentistas_${todayInput()}.xlsx`, 'Orçamentistas')}
      exportDisabled={loading}
      filtros={<PeriodoClassifFiltros pendente={f.pendente} setPendente={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={f.limpar} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </ReportShell>
  )
}

export function Com05Pipeline() {
  const f = usePeriodoClassifFilter()
  const { data, loading } = useReportData<ComercialData>('/api/relatorios/comercial', f.aplicado)

  const rows = useMemo(() => {
    if (!data) return []
    return data.com05_pipeline.maiores.map((m) => ({ ...m, classificacao_label: CLASSIF_LABELS[m.classificacao ?? ''] ?? '—' }))
  }, [data])

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'id', header: 'Nº Solicitação', type: 'number', value: (r) => r.id },
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => r.classificacao_label },
    { key: 'interesse', header: 'Interesse', type: 'text', value: (r) => r.interesse ?? '—' },
    { key: 'valor', header: 'Valor', type: 'currency', value: (r) => r.valor, totalizer: 'sum' },
  ]

  return (
    <ReportShell
      titulo="Pipeline em Valor" descricao="Quanto vale, em R$, tudo que ainda está em negociação."
      onExport={() => exportToExcel(columns, rows, `pipeline-em-valor_${todayInput()}.xlsx`, 'Pipeline')}
      exportDisabled={loading}
      filtros={<PeriodoClassifFiltros pendente={f.pendente} setPendente={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={f.limpar} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : (
        <>
          {data && <p className="text-[12px] text-gray-600 mb-2">Total em negociação: <strong className="text-green-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.com05_pipeline.total)}</strong></p>}
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel="Nenhuma proposta em negociação no momento." />
        </>
      )}
    </ReportShell>
  )
}

export function Com06Ciclo() {
  const f = usePeriodoClassifFilter()
  const { data, loading } = useReportData<ComercialData>('/api/relatorios/comercial', f.aplicado)
  const rows = data?.com06_ciclo.por_classificacao.map((c) => ({ classificacao: CLASSIF_LABELS[c.classificacao] ?? c.classificacao, media_dias: c.media_dias })) ?? []

  const columns: DataColumn<typeof rows[number]>[] = [
    { key: 'classif', header: 'Classificação', type: 'text', value: (r) => r.classificacao },
    { key: 'media', header: 'Prazo Médio (dias)', type: 'number', value: (r) => r.media_dias },
  ]

  return (
    <ReportShell
      titulo="Ciclo Comercial" descricao="Quanto tempo levamos, em média, do recebimento até a proposta comercial sair."
      onExport={() => exportToExcel(columns, rows, `ciclo-comercial_${todayInput()}.xlsx`, 'Ciclo')}
      exportDisabled={loading}
      filtros={<PeriodoClassifFiltros pendente={f.pendente} setPendente={f.setPendente} onAplicar={() => f.setAplicado(f.pendente)} onLimpar={f.limpar} />}
    >
      {loading ? <p className="text-center text-gray-400 py-10">Carregando...</p> : (
        <>
          {data?.com06_ciclo.media_geral != null && <p className="text-[12px] text-gray-600 mb-2">Média geral: <strong className="text-green-primary">{data.com06_ciclo.media_geral.toFixed(0)} dias</strong></p>}
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.classificacao} />
        </>
      )}
    </ReportShell>
  )
}
