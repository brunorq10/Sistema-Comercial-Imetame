'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

interface HistoricoEntry {
  id: number
  campo: string
  valor_de: string | null
  valor_para: string | null
  alterado_em: string
  alterado_por: string
}

interface Props {
  open: boolean
  onClose: () => void
  tipo: 'subindice' | 'contrato' | 'proposta'
  itemId: number
  titulo: string
}

export function HistoricoFaturamentoModal({ open, onClose, tipo, itemId, titulo }: Props) {
  const [historico, setHistorico] = useState<HistoricoEntry[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    const endpoint = tipo === 'subindice'
      ? `/api/faturamento/subindices/${itemId}/historico`
      : tipo === 'proposta'
      ? `/api/solicitacoes/${itemId}/historico`
      : `/api/faturamento/contratos/${itemId}/historico`
    fetch(endpoint)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error)
        else setHistorico(j.data ?? [])
      })
      .catch(() => setError('Erro ao carregar histórico'))
      .finally(() => setLoading(false))
  }, [open, tipo, itemId])

  return (
    <Modal open={open} onClose={onClose} title={`Histórico de Alterações — ${titulo}`} wide>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando histórico...</p>
      ) : historico.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400 text-sm">Nenhuma alteração registrada.</p>
          <p className="text-gray-300 text-xs mt-1">Alterações futuras aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-green-primary text-white px-3 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap">
                  Data / Hora
                </th>
                <th className="bg-green-primary text-white px-3 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap">
                  Campo
                </th>
                <th className="bg-green-primary text-white px-3 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap">
                  De
                </th>
                <th className="bg-green-primary text-white px-3 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap">
                  Para
                </th>
                <th className="bg-green-primary text-white px-3 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap">
                  Alterado por
                </th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb'
                const dt = new Date(h.alterado_em)
                const dataHora = `${formatDate(h.alterado_em) ?? '—'} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                return (
                  <tr key={h.id} style={{ background: bg }} className="border-b border-gray-100">
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-500">{dataHora}</td>
                    <td className="px-3 py-[6px] whitespace-nowrap font-semibold text-gray-700">{h.campo}</td>
                    <td className="px-3 py-[6px]">
                      <span className="text-red-500 bg-red-50 rounded px-1.5 py-0.5 whitespace-nowrap">
                        {h.valor_de ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-[6px]">
                      <span className="text-green-700 bg-green-50 rounded px-1.5 py-0.5 whitespace-nowrap">
                        {h.valor_para ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-600">{h.alterado_por}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
