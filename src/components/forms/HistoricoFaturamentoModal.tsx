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

type AuditTipo = 'subindice' | 'contrato' | 'proposta'

interface Props {
  open: boolean
  onClose: () => void
  tipo: AuditTipo
  itemId: number
  titulo: string
}

// Lista de auditlog reutilizável (sem o invólucro do modal). Usada no modal de
// faturamento e inline na aba "Histórico do Sistema" da Linha do Tempo.
export function HistoricoFaturamentoLista({ tipo, itemId, maxH = '480px' }: { tipo: AuditTipo; itemId: number; maxH?: string }) {
  const [historico, setHistorico] = useState<HistoricoEntry[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
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
  }, [tipo, itemId])

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
  if (loading) return <p className="text-center text-gray-400 py-10 text-sm">Carregando histórico...</p>
  if (historico.length === 0) return (
    <div className="text-center py-10">
      <p className="text-gray-400 text-sm">Nenhuma alteração registrada.</p>
      <p className="text-gray-300 text-xs mt-1">Alterações futuras aparecerão aqui automaticamente.</p>
    </div>
  )

  return (
    <div className="overflow-auto" style={{ maxHeight: maxH }}>
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
  )
}

export function HistoricoFaturamentoModal({ open, onClose, tipo, itemId, titulo }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={`Histórico de Alterações — ${titulo}`} wide>
      {open && <HistoricoFaturamentoLista tipo={tipo} itemId={itemId} />}
    </Modal>
  )
}
