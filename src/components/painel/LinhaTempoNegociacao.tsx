'use client'

import { useEffect, useState } from 'react'
import { HistoricoFaturamentoLista } from '@/components/forms/HistoricoFaturamentoModal'
import { InformacoesTabela } from '@/components/painel/InformacoesTabela'
import { OcorrenciasContratuais } from '@/components/acordos/OcorrenciasContratuais'

interface Props {
  solicitacaoId: number
  numero: string
  cliente: string
  escopo?: string | null
  canCreate: boolean
  userId: number | null
  canSupervise: boolean
}

interface ContratoLink { id: number; indice: string; cliente: string; cidade: string | null; estado: string | null }

export function LinhaTempoNegociacao({ solicitacaoId, numero, cliente, escopo, canCreate, userId, canSupervise }: Props) {
  const [aba, setAba] = useState<'sistema' | 'negociacao' | 'ocorrencias'>('negociacao')
  const [contrato, setContrato] = useState<ContratoLink | null>(null)
  const [contratoCarregado, setContratoCarregado] = useState(false)
  const subtitulo = `${numero} · ${cliente}${escopo ? ` — ${escopo}` : ''}`

  // Resolve o contrato vinculado (módulo Acordos) para a aba de Ocorrências
  useEffect(() => {
    let ativo = true
    fetch(`/api/solicitacoes/${solicitacaoId}/contrato`)
      .then(r => r.json())
      .then(j => { if (ativo && !j.error) setContrato(j.data) })
      .finally(() => { if (ativo) setContratoCarregado(true) })
    return () => { ativo = false }
  }, [solicitacaoId])

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4">
      {/* Cabeçalho (fora das abas) */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-[14px] font-bold text-gray-800">Linha do tempo da negociação</h3>
        <p className="text-[11px] text-gray-500 truncate">{subtitulo}</p>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 overflow-x-auto">
        {([['sistema', 'Histórico do Sistema'], ['negociacao', 'Linha do Tempo da Negociação'], ['ocorrencias', 'Ocorrências Contratuais']] as const).map(([val, label]) => (
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
        ) : aba === 'negociacao' ? (
          <InformacoesTabela
            solicitacaoId={solicitacaoId}
            numero={numero}
            canCreate={canCreate}
            userId={userId}
            canSupervise={canSupervise}
          />
        ) : (
          // Ocorrências Contratuais — somente visualização (read-only)
          !contratoCarregado ? (
            <p className="text-center text-[11px] text-gray-400 py-8">Carregando...</p>
          ) : contrato ? (
            <OcorrenciasContratuais
              contratoId={contrato.id}
              numero={contrato.indice}
              subtitulo={`${contrato.indice} · ${contrato.cliente}${contrato.cidade ? ` — ${contrato.cidade}${contrato.estado ? `, ${contrato.estado}` : ''}` : ''}`}
              canCreate={false}
              userId={null}
              canSupervise={false}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum contrato vinculado a esta proposta.</p>
          )
        )}
      </div>
    </div>
  )
}
