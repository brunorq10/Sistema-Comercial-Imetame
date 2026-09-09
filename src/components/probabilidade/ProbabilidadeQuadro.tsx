'use client'

import { formatCurrency } from '@/lib/utils'
import { ProbabilidadeCard } from './ProbabilidadeCard'
import type { ProbabilidadeItem } from './types'
import type { NivelProbabilidade } from '@/types'

interface Props {
  icone: string
  titulo: string
  descricao: string
  rodape: string
  cor: string
  itens: ProbabilidadeItem[]
  editavel: boolean
  onClassificar: (solicitacaoId: number, nivel: NivelProbabilidade) => void
  onRevisar: (solicitacaoId: number) => void
  onRemover: (item: ProbabilidadeItem) => void
  onDropNivel: (solicitacaoId: number) => void
}

export function ProbabilidadeQuadro({
  icone, titulo, descricao, rodape, cor, itens, editavel, onClassificar, onRevisar, onRemover, onDropNivel,
}: Props) {
  const total = itens.reduce((s, i) => s + (i.valor_total ?? 0), 0)

  return (
    <div
      className="bg-gray-50 border border-gray-200 rounded-md flex flex-col min-h-[160px]"
      onDragOver={(e) => { if (editavel) e.preventDefault() }}
      onDrop={(e) => {
        if (!editavel) return
        e.preventDefault()
        const id = Number(e.dataTransfer.getData('text/plain'))
        if (id) onDropNivel(id)
      }}
    >
      <div className="px-3 pt-3 pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span>{icone}</span>
            <span className="text-[12px] font-bold" style={{ color: cor }}>{titulo}</span>
          </div>
          <span className="text-[13px] font-bold text-gray-700 flex-shrink-0">{itens.length}</span>
        </div>
        <p className="text-[9px] text-gray-400 mt-0.5">{descricao}</p>
        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{formatCurrency(total)}</p>
      </div>

      <div className="flex-1 p-2 flex flex-col gap-2">
        {itens.length === 0 ? (
          <p className="text-center text-gray-400 text-[10px] py-6">Nenhuma proposta neste nível.</p>
        ) : (
          itens.map((item) => (
            <ProbabilidadeCard
              key={item.solicitacao_id}
              item={item}
              editavel={editavel}
              onClassificar={(nivel) => onClassificar(item.solicitacao_id, nivel)}
              onRevisar={() => onRevisar(item.solicitacao_id)}
              onRemover={() => onRemover(item)}
            />
          ))
        )}
      </div>

      <p className="text-[9px] text-gray-400 italic px-3 pb-2.5">{rodape}</p>
    </div>
  )
}
