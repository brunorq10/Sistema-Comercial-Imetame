'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { RankingBar } from './RankingBar'
import { formatCurrency, formatNumber, todayInput } from '@/lib/utils'

const fmtInt = (v: number) => formatNumber(v, 0)

interface OcorrenciasData {
  ocm01: { por_tipo: Array<{ tipo: string; label: string; total: number }>; por_responsabilidade: Array<{ responsabilidade: string; label: string; total: number }>; por_mes: number[]; total: number }
  ocm02: { total: number; por_tipo: Array<{ tipo: string; label: string; valor: number }>; por_mes: number[]; por_cliente: Array<{ nome: string; valor: number }> }
  ocm03: Array<{ nome: string; ocorrencias: number; valor_multas: number; contratos_ativos: number; ocorrencias_por_contrato: number }>
}

function anoAtras(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().substring(0, 10)
}

export function OcorrenciasTerritorio() {
  const [data, setData] = useState<OcorrenciasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [de, setDe] = useState(anoAtras(12))
  const [ate, setAte] = useState(todayInput())

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ de, ate })
    fetch(`/api/relatorios/ocorrencias?${params}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .finally(() => setLoading(false))
  }, [de, ate])

  if (loading && !data) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  const periodoActions = (
    <div className="flex items-center gap-1.5">
      <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]" />
      <span className="text-gray-400 text-[11px]">até</span>
      <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]" />
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard codigo="OCM-01" titulo="Ocorrências por Tipo e Responsabilidade" pergunta="O que mais atrapalha a execução dos contratos — e de quem é a responsabilidade?" actions={periodoActions} className="lg:col-span-2">
        <p className="text-[11px] text-gray-400 mb-2">{data.ocm01.total} ocorrência(s) no período</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Por tipo</p>
            <RankingBar rows={data.ocm01.por_tipo.map((t) => ({ label: t.label, value: t.total }))} format={fmtInt} color="#B45309" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Por responsabilidade</p>
            <RankingBar rows={data.ocm01.por_responsabilidade.map((t) => ({ label: t.label, value: t.total }))} format={fmtInt} color="#7C3AED" />
          </div>
        </div>
      </ReportCard>

      <ReportCard codigo="OCM-02" titulo="Impacto Financeiro de Multas" pergunta="Quanto perdemos em multas, glosas e reembolsos, e com qual cliente?">
        <p className="text-[20px] font-bold text-red-600 mb-2">{formatCurrency(data.ocm02.total)}</p>
        <RankingBar rows={data.ocm02.por_tipo.map((t) => ({ label: t.label, value: t.valor }))} format={formatCurrency} color="#A32D2D" limit={6} />
      </ReportCard>

      <ReportCard codigo="OCM-02" titulo="Multas por Cliente" pergunta="Qual cliente concentra mais impacto financeiro de multas/glosas?">
        <RankingBar rows={data.ocm02.por_cliente.map((c) => ({ label: c.nome, value: c.valor }))} format={formatCurrency} color="#A32D2D" emptyLabel="Nenhuma multa no período." />
      </ReportCard>

      <ReportCard codigo="OCM-03" titulo="Reincidência por Cliente" pergunta="Existe cliente que gera ocorrência ou multa toda hora? Isso deveria pesar na próxima negociação?" className="lg:col-span-2">
        <RankingBar
          rows={data.ocm03.map((c) => ({ label: `${c.nome} (${c.contratos_ativos} contrato${c.contratos_ativos !== 1 ? 's' : ''})`, value: c.ocorrencias_por_contrato, sub: c.valor_multas > 0 ? formatCurrency(c.valor_multas) + ' em multas' : undefined }))}
          format={(v) => v.toFixed(1) + '/contrato'}
          color="#7C3AED"
          emptyLabel="Nenhuma ocorrência ou multa registrada."
        />
      </ReportCard>
    </div>
  )
}
