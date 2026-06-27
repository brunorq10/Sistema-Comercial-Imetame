'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TIPO_MULTA_MAP } from '@/lib/multas'
import { LancarMultaModal } from '@/components/forms/LancarMultaModal'
import type { MultaEdit } from '@/components/forms/MultaForm'

interface Multa extends MultaEdit {
  ativa: boolean
  motivo_inativacao: string | null
  autor: string
}

interface Props {
  contratoId: number
  indice: string
  cliente: string
  canLancar: boolean
}

export function MultasContratoSection({ contratoId, indice, cliente, canLancar }: Props) {
  const [multas, setMultas] = useState<Multa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  const fetchMultas = useCallback(() => {
    setLoading(true)
    fetch(`/api/faturamento/contratos/${contratoId}/multas`)
      .then(r => r.json())
      .then(j => { if (!j.error) setMultas(j.data ?? []) })
      .finally(() => setLoading(false))
  }, [contratoId])

  useEffect(() => { fetchMultas() }, [fetchMultas])

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⚠ Multas / Penalidades</h2>
        {canLancar && (
          <button onClick={() => setModal(true)} className="bg-green-primary hover:bg-green-dark text-white text-[12px] font-semibold rounded px-3 py-1.5 transition-colors">
            + Lançar Multa/Penalidade
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-[11px] text-gray-400 py-6">Carregando...</p>
      ) : multas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma multa/penalidade lançada para este contrato.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: 760 }}>
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left font-semibold px-3 py-2">Tipo</th>
                <th className="text-left font-semibold px-3 py-2">Descrição</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Dt. Ocorrência</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Dt. Notificação</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Dt. Desconto</th>
                <th className="text-left font-semibold px-3 py-2">Valor</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {multas.map((m) => {
                const cfg = TIPO_MULTA_MAP[m.tipo]
                return (
                  <tr key={m.id} className={m.ativa ? '' : 'text-gray-400'}>
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5" style={{ color: cfg?.cor ?? '#6B7280', backgroundColor: cfg?.corBg ?? '#F3F4F6' }}>{cfg?.label ?? m.tipo}</span>
                    </td>
                    <td className="px-3 py-2 max-w-[260px] truncate" title={m.descricao}>{m.descricao}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.data_ocorrencia)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.data_notificacao_cliente ? formatDate(m.data_notificacao_cliente) : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.data_desconto ? formatDate(m.data_desconto) : '—'}</td>
                    <td className={`px-3 py-2 font-semibold ${m.ativa ? 'text-auto-value' : ''}`}>{formatCurrency(m.valor_total)}</td>
                    <td className="px-3 py-2">
                      {m.ativa
                        ? <span className="text-[9px] font-semibold text-green-700 bg-green-50 rounded-full px-1.5 py-0.5">Ativa</span>
                        : <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">Inativa</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <LancarMultaModal
          open
          onClose={() => setModal(false)}
          onSuccess={fetchMultas}
          contratoId={contratoId}
          subtitulo={`${indice} · ${cliente}`}
        />
      )}
    </section>
  )
}
