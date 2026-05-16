'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnaliseSolicitacaoModal } from '@/components/forms/AnaliseSolicitacaoModal'
import { ClassificacaoBadge, InteresseBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { Classificacao, Interesse, Origem } from '@/types'

interface SolicitacaoPendente {
  id: number
  numero: string
  created_at: string
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  origem: Origem | null
  cidade: string | null
  estado: string | null
  visita_tecnica: boolean
  dias_aguardando: number
  cliente: { id: number; nome: string }
  criador: { id: number; nome: string }
}

function DiasAguardandoBadge({ dias }: { dias: number }) {
  const cor = dias >= 5 ? 'bg-red-50 border-red-200 text-red-700' : dias >= 2 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'
  return (
    <span className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 ${cor}`}>
      {dias === 0 ? 'hoje' : `${dias}d`}
    </span>
  )
}

export default function AnalisePage() {
  const [items, setItems] = useState<SolicitacaoPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analise')
      const json = await res.json()
      setItems(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAbrir = (id: number) => {
    setSelectedId(id)
    setModalOpen(true)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-bold">Análise de Solicitações</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Solicitações aguardando aprovação do Analista Crítico
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 text-[11px] text-amber-700 font-semibold">
          {items.length} pendente{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-[13px] font-medium">Nenhuma solicitação pendente</p>
          <p className="text-[11px] mt-1">Todas as solicitações foram analisadas.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleAbrir(item.id)}
              className="bg-white border border-gray-200 border-l-[3px] border-l-amber-400 rounded-md p-3.5 cursor-pointer hover:bg-green-light transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[13px] font-bold">{item.numero}</span>
                    <span className="text-[12px] font-medium text-gray-600">— {item.cliente.nome}</span>
                    {item.classificacao && <ClassificacaoBadge value={item.classificacao} />}
                    {item.interesse && <InteresseBadge value={item.interesse} />}
                    <DiasAguardandoBadge dias={item.dias_aguardando} />
                  </div>
                  <p className="text-[11px] text-gray-600 truncate">
                    {item.escopo ?? <span className="text-gray-400 italic">Sem escopo definido</span>}
                  </p>
                  <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                    {(item.cidade || item.estado) && (
                      <span>{[item.cidade, item.estado].filter(Boolean).join(' / ')}</span>
                    )}
                    {item.visita_tecnica && <span className="text-amber-600 font-medium">Visita técnica</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-gray-400">Aguardando há</p>
                  <p className="text-[12px] font-bold text-amber-600">
                    {item.dias_aguardando === 0 ? 'Hoje' : `${item.dias_aguardando} dia${item.dias_aguardando !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Criado em</p>
                  <p className="text-[11px] font-medium">{formatDate(item.created_at)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Por</p>
                  <p className="text-[11px]">{item.criador.nome}</p>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-end">
                <button className="text-[10px] font-semibold text-green-primary hover:underline">
                  Abrir para análise →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnaliseSolicitacaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
        solicitacaoId={selectedId}
      />
    </div>
  )
}
