'use client'

import { cn } from '@/lib/utils'
import type { IndicadoresCenario, ClassificacaoCenario } from '@/lib/cenario'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function Card({ label, value, sub, accent, active, onClick }: {
  label: string; value: string; sub?: string; accent?: string; active?: boolean; onClick?: () => void
}) {
  const cor = accent ?? '#2E7D32'
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-200 rounded-md px-3 py-2 border-l-[3px] min-w-0 transition-all select-none',
        onClick && 'cursor-pointer hover:bg-gray-50',
      )}
      style={{
        borderLeftColor: cor,
        ...(active ? { background: `${cor}14`, boxShadow: `0 0 0 2px ${cor}40`, borderColor: `${cor}80` } : {}),
      }}
    >
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.03em] mb-0.5 truncate">{label}</p>
      <p className="text-[19px] font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

interface Props {
  ind: IndicadoresCenario
  filtro?: ClassificacaoCenario | null
  onFiltroChange?: (c: ClassificacaoCenario | null) => void
}

export function CenarioCards({ ind, filtro, onFiltroChange }: Props) {
  const toggle = (c: ClassificacaoCenario) => onFiltroChange?.(filtro === c ? null : c)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-3">
      <Card
        label="Itens"
        value={String(ind.totalItens)}
        sub={`${ind.totalContratos} contrato${ind.totalContratos === 1 ? '' : 's'} · ${ind.totalPropostas} proposta${ind.totalPropostas === 1 ? '' : 's'}`}
        active={onFiltroChange ? filtro == null : undefined}
        onClick={onFiltroChange ? () => onFiltroChange(null) : undefined}
      />
      <Card label="Paradas" value={String(ind.qtdParadas)} accent="#B45309" active={filtro === 'PARADAS'} onClick={onFiltroChange ? () => toggle('PARADAS') : undefined} />
      <Card label="Obras" value={String(ind.qtdObras)} accent="#1565C0" active={filtro === 'OBRAS'} onClick={onFiltroChange ? () => toggle('OBRAS') : undefined} />
      <Card label="Fabricação" value={String(ind.qtdFabricacoes)} accent="#00897B" active={filtro === 'FABRICACOES'} onClick={onFiltroChange ? () => toggle('FABRICACOES') : undefined} />
      <Card label="Óleo e Gás" value={String(ind.qtdOleoGas)} accent="#455A64" active={filtro === 'OLEO_GAS'} onClick={onFiltroChange ? () => toggle('OLEO_GAS') : undefined} />
      <Card
        label="Efetivo no Pico"
        value={ind.pico.toLocaleString('pt-BR')}
        sub={ind.mesPico ? `${MESES_ABREV[ind.mesPico.mes - 1]}/${ind.mesPico.ano}` : '—'}
        accent="#6A1B9A"
      />
    </div>
  )
}
