'use client'

import { useState } from 'react'
import { HistoricoFaturamentoLista } from '@/components/forms/HistoricoFaturamentoModal'
import { InformacoesTabela } from '@/components/painel/InformacoesTabela'

interface Props {
  solicitacaoId: number
  numero: string
  cliente: string
  escopo?: string | null
  canCreate: boolean
  userId: number | null
  canSupervise: boolean
}

export function LinhaTempoNegociacao({ solicitacaoId, numero, cliente, escopo, canCreate, userId, canSupervise }: Props) {
  const [aba, setAba] = useState<'sistema' | 'negociacao'>('negociacao')
  const subtitulo = `${numero} · ${cliente}${escopo ? ` — ${escopo}` : ''}`

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4">
      {/* Cabeçalho (fora das abas) */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-[14px] font-bold text-gray-800">Linha do tempo da negociação</h3>
        <p className="text-[11px] text-gray-500 truncate">{subtitulo}</p>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 overflow-x-auto">
        {([['sistema', 'Histórico do Sistema'], ['negociacao', 'Linha do Tempo da Negociação']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setAba(val)}
            className={
              'text-[12px] font-semibold px-3 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors ' +
              (aba === val ? 'border-green-primary text-green-primary' : 'border-transparent text-gray-400 hover:text-gray-600')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        {aba === 'sistema' ? (
          <HistoricoFaturamentoLista tipo="proposta" itemId={solicitacaoId} maxH="560px" />
        ) : (
          <InformacoesTabela
            solicitacaoId={solicitacaoId}
            numero={numero}
            canCreate={canCreate}
            userId={userId}
            canSupervise={canSupervise}
          />
        )}
      </div>
    </div>
  )
}
