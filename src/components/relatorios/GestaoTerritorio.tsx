'use client'

import { useEffect, useState } from 'react'
import { ReportCard } from './ReportCard'
import { RankingBar } from './RankingBar'
import { formatCurrency, formatNumber } from '@/lib/utils'

const fmtInt = (v: number) => formatNumber(v, 0)

interface GestaoData {
  gst01: {
    orcamentistas: Array<{ nome: string; total: number }>
    responsaveis_acordos: Array<{ nome: string; contratos: number; valor: number }>
  }
  gst02: { ano_atual: number; garantido_proximos_anos: number; pipeline_em_negociacao: number }
}

export function GestaoTerritorio() {
  const [data, setData] = useState<GestaoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/relatorios/gestao')
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
  if (!data) return <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar os dados.</p>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard codigo="GST-01" titulo="Carga de Trabalho — Comercial" pergunta="Quantas solicitações cada orçamentista está tocando agora?">
        <RankingBar rows={data.gst01.orcamentistas.map((o) => ({ label: o.nome, value: o.total }))} format={fmtInt} color="#1565C0" />
      </ReportCard>

      <ReportCard codigo="GST-01" titulo="Carga de Trabalho — Acordos" pergunta="Quantos contratos e quanto valor cada responsável de Acordos tem sob gestão?">
        <RankingBar rows={data.gst01.responsaveis_acordos.map((r) => ({ label: `${r.nome} (${r.contratos})`, value: r.valor }))} format={formatCurrency} />
      </ReportCard>

      <ReportCard codigo="GST-02" titulo="Projeção de Faturamento Futuro" pergunta="Com o que já está contratado hoje, quanto está garantido de faturar nos próximos anos?" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Garantido — próximos anos</p>
            <p className="text-[20px] font-bold text-green-primary mt-1">{formatCurrency(data.gst02.garantido_proximos_anos)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Contratos multi-ano já lançados, além de {data.gst02.ano_atual}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[9px] text-gray-400 uppercase font-semibold">Pipeline em negociação</p>
            <p className="text-[20px] font-bold text-blue-700 mt-1">{formatCurrency(data.gst02.pipeline_em_negociacao)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Propostas enviadas, ainda sem resultado</p>
          </div>
        </div>
      </ReportCard>
    </div>
  )
}
