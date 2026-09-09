'use client'

import { ClassificacaoBadge, InteresseBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { NIVEL_LABEL } from '@/lib/probabilidade'
import type { NivelProbabilidade } from '@/types'
import type { ProbabilidadeItem } from './types'

const NIVEL_COR: Record<NivelProbabilidade, string> = {
  ALTA: '#2E7D32', MEDIA: '#E65100', BAIXA: '#C62828', BUDGET: '#6A1B9A',
}

function revisaoInfo(revisadoEm: string | null): { label: string; color: string } | null {
  if (!revisadoEm) return null
  const dias = Math.floor((Date.now() - new Date(revisadoEm).getTime()) / 86400000)
  const label = dias <= 0 ? 'revisada hoje' : dias === 1 ? 'revisada há 1 dia' : `revisada há ${dias} dias`
  const color = dias <= 7 ? '#2E7D32' : dias <= 20 ? '#E65100' : '#C62828'
  return { label, color }
}

interface Props {
  item: ProbabilidadeItem
  editavel: boolean
  onClassificar: (nivel: NivelProbabilidade) => void
  onRevisar: () => void
  onRemover: () => void
}

export function ProbabilidadeCard({ item, editavel, onClassificar, onRevisar, onRemover }: Props) {
  const cor = item.nivel ? NIVEL_COR[item.nivel] : '#BDBDBD'
  const revisao = revisaoInfo(item.revisado_em)

  return (
    <div
      className="bg-white border border-gray-200 rounded-md pl-2.5 pr-2 py-2 border-l-[3px] relative"
      style={{ borderLeftColor: cor }}
      draggable={editavel}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.solicitacao_id))}
    >
      {editavel && (
        <button
          onClick={onRemover}
          title="Remover do painel"
          className="absolute top-1.5 right-1.5 text-gray-300 hover:text-red-600 text-[13px] leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
        >
          ×
        </button>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pr-5 mb-1">
        <span className="text-[11px] font-bold text-green-dark">{item.numero}</span>
        <ClassificacaoBadge value={item.classificacao} />
      </div>

      <p className="text-[15px] font-bold text-gray-800 leading-tight mb-1">{formatCurrency(item.valor_total)}</p>

      <p className="text-[11px] font-semibold text-gray-700 truncate">{item.cliente.nome}</p>
      <p className="text-[10px] text-gray-400 mb-1">
        {[item.cidade, item.estado].filter(Boolean).join('/') || '—'}
      </p>
      <p className="text-[10px] text-gray-500 truncate mb-1.5" title={item.escopo ?? ''}>{item.escopo ?? '—'}</p>

      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[10px] text-gray-500 truncate">{item.orcamentista?.nome ?? '—'}</span>
        <InteresseBadge value={item.interesse} />
      </div>

      {editavel ? (
        <select
          value={item.nivel ?? ''}
          onChange={(e) => onClassificar(e.target.value as NivelProbabilidade)}
          className="w-full border border-gray-300 rounded px-1.5 py-1 text-[11px] bg-white focus:outline-none focus:border-green-primary"
        >
          <option value="" disabled>Classificar…</option>
          {(Object.entries(NIVEL_LABEL) as [NivelProbabilidade, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      ) : (
        <p className="text-[11px] text-gray-500">{item.nivel ? NIVEL_LABEL[item.nivel] : 'Não classificada'}</p>
      )}

      <div className="flex items-center justify-between mt-1.5">
        {revisao ? (
          <span className="text-[9px] font-semibold" style={{ color: revisao.color }}>{revisao.label}</span>
        ) : <span />}
        {editavel && item.nivel && (
          <button onClick={onRevisar} className="text-[9px] text-gray-400 hover:text-green-primary underline decoration-dotted">
            confirmar revisão
          </button>
        )}
      </div>
    </div>
  )
}
