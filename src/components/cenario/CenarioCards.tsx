'use client'

import { cn } from '@/lib/utils'
import type { IndicadoresCenario } from '@/lib/cenario'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-2 py-2 border-l-[3px] w-[125px] flex-shrink-0" style={{ borderLeftColor: accent ?? '#2E7D32' }}>
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.03em] mb-0.5 truncate">{label}</p>
      <p className="text-[19px] font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

export function CenarioCards({ ind }: { ind: IndicadoresCenario }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <Card
        label="Itens"
        value={String(ind.totalItens)}
        sub={`${ind.totalContratos} contrato${ind.totalContratos === 1 ? '' : 's'} · ${ind.totalPropostas} proposta${ind.totalPropostas === 1 ? '' : 's'}`}
      />
      <Card label="Paradas" value={String(ind.qtdParadas)} accent="#B45309" />
      <Card label="Obras" value={String(ind.qtdObras)} accent="#1565C0" />
      <Card label="Fabricação" value={String(ind.qtdFabricacoes)} accent="#00897B" />
      <Card label="Óleo e Gás" value={String(ind.qtdOleoGas)} accent="#455A64" />
      <Card
        label="Efetivo no Pico"
        value={ind.pico.toLocaleString('pt-BR')}
        sub={ind.mesPico ? `${MESES_ABREV[ind.mesPico.mes - 1]}/${ind.mesPico.ano}` : '—'}
        accent="#6A1B9A"
      />
    </div>
  )
}
