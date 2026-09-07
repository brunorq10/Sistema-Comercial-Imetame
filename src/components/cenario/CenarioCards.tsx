'use client'

import { cn } from '@/lib/utils'
import type { IndicadoresCenario } from '@/lib/cenario'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 border-l-[3px] min-w-0" style={{ borderLeftColor: accent ?? '#2E7D32' }}>
      <p className="text-[9px] text-gray-400 uppercase tracking-[0.03em] mb-0.5 truncate">{label}</p>
      <p className="text-[15px] font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

export function CenarioCards({ ind }: { ind: IndicadoresCenario }) {
  const saldoNeg = ind.saldoNoPico < 0
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
      <Card
        label="Itens no cenário"
        value={String(ind.totalItens)}
        sub={`${ind.totalContratos} contrato${ind.totalContratos === 1 ? '' : 's'} · ${ind.totalPropostas} proposta${ind.totalPropostas === 1 ? '' : 's'}`}
      />
      <Card label="Quantidade de Paradas" value={String(ind.qtdParadas)} accent="#B45309" />
      <Card label="Quantidade de Obras" value={String(ind.qtdObras)} accent="#1565C0" />
      <Card label="Capacidade de efetivo" value={ind.capacidade.toLocaleString('pt-BR')} />
      <Card
        label="Pico comprometido"
        value={ind.pico.toLocaleString('pt-BR')}
        sub={ind.mesPico ? `${MESES_ABREV[ind.mesPico.mes - 1]}/${ind.mesPico.ano}` : '—'}
        accent="#6A1B9A"
      />
      <Card
        label="Saldo no pico"
        value={ind.saldoNoPico.toLocaleString('pt-BR')}
        sub="capacidade − pico"
        accent={saldoNeg ? '#C62828' : '#2E7D32'}
      />
      <Card
        label="Meses acima da capacidade"
        value={String(ind.mesesAcimaCapacidade)}
        accent={ind.mesesAcimaCapacidade > 0 ? '#C62828' : '#2E7D32'}
      />
    </div>
  )
}
