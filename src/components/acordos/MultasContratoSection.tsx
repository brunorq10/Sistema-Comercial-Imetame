'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TIPO_MULTA_MAP } from '@/lib/multas'
import { LancarMultaModal } from '@/components/forms/LancarMultaModal'
import { AcoesMenu } from '@/components/ui/AcoesMenu'
import { Button } from '@/components/ui/Button'
import { Overlay } from '@/components/ui/Overlay'
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
  canEditar: boolean
  canExcluir: boolean
}

type AcaoMulta = { tipo: 'inativar' | 'excluir'; multa: Multa }

export function MultasContratoSection({ contratoId, indice, cliente, canLancar, canEditar, canExcluir }: Props) {
  const [multas, setMultas] = useState<Multa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [multaEditando, setMultaEditando] = useState<Multa | null>(null)
  const [multaAcao, setMultaAcao] = useState<AcaoMulta | null>(null)
  const [multaMotivo, setMultaMotivo] = useState('')
  const [multaAcaoLoading, setMultaAcaoLoading] = useState(false)
  const [multaAcaoError, setMultaAcaoError] = useState<string | null>(null)

  const fetchMultas = useCallback(() => {
    setLoading(true)
    fetch(`/api/faturamento/contratos/${contratoId}/multas`)
      .then(r => r.json())
      .then(j => { if (!j.error) setMultas(j.data ?? []) })
      .finally(() => setLoading(false))
  }, [contratoId])

  useEffect(() => { fetchMultas() }, [fetchMultas])

  const handleMultaAcao = async () => {
    if (!multaAcao) return
    const inativando = multaAcao.tipo === 'inativar' && multaAcao.multa.ativa
    if (inativando && multaMotivo.trim().length < 3) {
      setMultaAcaoError('Informe o motivo da inativação (mínimo 3 caracteres)')
      return
    }
    setMultaAcaoLoading(true); setMultaAcaoError(null)
    try {
      if (multaAcao.tipo === 'excluir') {
        const res = await fetch(`/api/faturamento/multas/${multaAcao.multa.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) { setMultaAcaoError(json.error ?? 'Erro ao excluir'); return }
      } else {
        const novaAtiva = !multaAcao.multa.ativa
        const res = await fetch(`/api/faturamento/multas/${multaAcao.multa.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativa: novaAtiva, motivo_inativacao: novaAtiva ? null : multaMotivo.trim() }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) { setMultaAcaoError(json.error ?? 'Erro ao salvar'); return }
      }
      setMultaAcao(null); setMultaMotivo('')
      fetchMultas()
    } finally {
      setMultaAcaoLoading(false)
    }
  }

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
                {(canEditar || canExcluir) && <th className="text-left font-semibold px-3 py-2 w-[48px]">Ações</th>}
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
                    {(canEditar || canExcluir) && (
                      <td className="px-3 py-2 text-center">
                        <AcoesMenu items={[
                          { label: 'Editar multa', icon: '✎', destaque: true, visivel: canEditar, onClick: () => setMultaEditando(m) },
                          { label: m.ativa ? 'Inativar' : 'Reativar', icon: m.ativa ? '⊘' : '↺', visivel: canEditar, onClick: () => { setMultaAcao({ tipo: 'inativar', multa: m }); setMultaMotivo(''); setMultaAcaoError(null) } },
                          { label: 'Excluir', icon: '🗑', destrutiva: true, visivel: canExcluir, onClick: () => { setMultaAcao({ tipo: 'excluir', multa: m }); setMultaAcaoError(null) } },
                        ]} />
                      </td>
                    )}
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

      {multaEditando && (
        <LancarMultaModal
          open
          onClose={() => setMultaEditando(null)}
          onSuccess={fetchMultas}
          contratoId={contratoId}
          subtitulo={`${indice} · ${cliente}`}
          editando={multaEditando}
        />
      )}

      {multaAcao && (
        <Overlay>
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[440px] max-w-[96%] shadow-2xl">
            <div className={`px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg text-white ${
              multaAcao.tipo === 'excluir' ? 'bg-red-600' : multaAcao.multa.ativa ? 'bg-orange-500' : 'bg-blue-600'
            }`}>
              {multaAcao.tipo === 'excluir' ? 'Excluir lançamento' : multaAcao.multa.ativa ? 'Inativar lançamento' : 'Reativar lançamento'}
            </div>
            <div className="p-[18px]">
              {multaAcaoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{multaAcaoError}</div>
              )}
              {multaAcao.tipo === 'excluir' && (
                <p className="text-[12px] text-gray-600">Este lançamento será excluído permanentemente. Esta ação não pode ser desfeita.</p>
              )}
              {multaAcao.tipo === 'inativar' && multaAcao.multa.ativa && (
                <>
                  <p className="text-[12px] text-gray-600 mb-3">O lançamento permanecerá no registro mas deixará de ser contabilizado. Informe o motivo.</p>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-orange-400/40"
                    rows={2}
                    placeholder="Motivo da inativação (mínimo 3 caracteres)"
                    value={multaMotivo}
                    onChange={(e) => setMultaMotivo(e.target.value)}
                  />
                </>
              )}
              {multaAcao.tipo === 'inativar' && !multaAcao.multa.ativa && (
                <p className="text-[12px] text-gray-600">Este lançamento será reativado e voltará a ser contabilizado.</p>
              )}
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button variant="outline" onClick={() => { setMultaAcao(null); setMultaMotivo(''); setMultaAcaoError(null) }} disabled={multaAcaoLoading}>Voltar</Button>
              <Button variant={multaAcao.tipo === 'excluir' ? 'danger' : 'primary'} onClick={handleMultaAcao} disabled={multaAcaoLoading || (multaAcao.tipo === 'inativar' && multaAcao.multa.ativa && multaMotivo.trim().length < 3)}>
                {multaAcaoLoading ? 'Aguarde...' : multaAcao.tipo === 'excluir' ? 'Confirmar exclusão' : multaAcao.multa.ativa ? 'Confirmar inativação' : 'Confirmar reativação'}
              </Button>
            </div>
          </div>
        </div>
        </Overlay>
      )}
    </section>
  )
}
