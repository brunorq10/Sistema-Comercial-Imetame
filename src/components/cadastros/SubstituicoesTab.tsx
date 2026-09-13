'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SubstituicaoTemporariaModal } from '@/components/forms/SubstituicaoTemporariaModal'
import { TransferenciaModal } from '@/components/forms/TransferenciaModal'
import { formatDate } from '@/lib/utils'
import type { SubstituicaoTemporariaItem, TransferenciaListItem, UsuarioListItem } from '@/types'

type FiltroStatus = 'VIGENTE' | 'AGENDADA' | 'ENCERRADA'

function statusTemporaria(s: SubstituicaoTemporariaItem): FiltroStatus {
  const hoje = new Date()
  if (s.encerrada_em || new Date(s.data_fim) < hoje) return 'ENCERRADA'
  if (new Date(s.data_inicio) > hoje) return 'AGENDADA'
  return 'VIGENTE'
}
function statusTransferencia(t: TransferenciaListItem): FiltroStatus {
  return t.efetivada_em ? 'ENCERRADA' : 'AGENDADA'
}

const FILTROS: { value: FiltroStatus; label: string }[] = [
  { value: 'VIGENTE', label: 'Vigentes' },
  { value: 'AGENDADA', label: 'Agendadas' },
  { value: 'ENCERRADA', label: 'Encerradas / Concluídas' },
]

export function SubstituicoesTab() {
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([])
  const [temporarias, setTemporarias] = useState<SubstituicaoTemporariaItem[]>([])
  const [transferencias, setTransferencias] = useState<TransferenciaListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filtro, setFiltro] = useState<FiltroStatus>('VIGENTE')
  const [erro, setErro] = useState<string | null>(null)

  const [modalTemporaria, setModalTemporaria] = useState(false)
  const [modalTransferencia, setModalTransferencia] = useState<'TRANSFERENCIA' | 'TROCA' | null>(null)
  const [acaoTemp, setAcaoTemp] = useState<{ id: number; acao: 'encerrar' | 'prorrogar' } | null>(null)
  const [novaDataFim, setNovaDataFim] = useState('')
  const [acaoLoading, setAcaoLoading] = useState(false)
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  const fetchTudo = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const [r0, r1, r2] = await Promise.all([
        fetch('/api/usuarios'),
        fetch('/api/substituicoes/temporarias'),
        fetch('/api/substituicoes/transferencias'),
      ])
      const [j0, j1, j2] = await Promise.all([r0.json(), r1.json(), r2.json()])
      if (!r0.ok || j0.error) { setErro(j0.error ?? 'Erro ao buscar usuários'); return }
      if (!r1.ok || j1.error) { setErro(j1.error ?? 'Erro ao buscar substituições'); return }
      if (!r2.ok || j2.error) { setErro(j2.error ?? 'Erro ao buscar transferências'); return }
      setUsuarios(j0.data ?? [])
      setTemporarias(j1.data ?? [])
      setTransferencias(j2.data ?? [])
    } catch {
      setErro('Falha ao buscar dados. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  const temporariasFiltradas = temporarias.filter((s) => statusTemporaria(s) === filtro)
  const transferenciasFiltradas = transferencias.filter((t) => statusTransferencia(t) === filtro)

  const confirmarAcao = async (valor: string) => {
    if (!acaoTemp) return
    setAcaoLoading(true); setAcaoErro(null)
    try {
      const body = acaoTemp.acao === 'encerrar'
        ? { acao: 'encerrar', motivo: valor }
        : { acao: 'prorrogar', nova_data_fim: novaDataFim, motivo: valor }
      const res = await fetch(`/api/substituicoes/temporarias/${acaoTemp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setAcaoErro(json.error ?? 'Erro ao salvar'); return }
      setAcaoTemp(null); setNovaDataFim('')
      fetchTudo()
    } finally {
      setAcaoLoading(false)
    }
  }

  return (
    <>
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-4">{erro}</div>}

      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
              filtro === f.value ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setModalTemporaria(true)}>+ Substituição temporária</Button>
          <Button variant="outline" size="sm" onClick={() => setModalTransferencia('TRANSFERENCIA')}>+ Transferência definitiva</Button>
          <Button variant="outline" size="sm" onClick={() => setModalTransferencia('TROCA')}>+ Troca definitiva</Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Envolvidos</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período / Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Carregando...</td></tr>
            ) : temporariasFiltradas.length === 0 && transferenciasFiltradas.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Nenhuma operação encontrada.</td></tr>
            ) : (
              <>
                {temporariasFiltradas.map((s) => (
                  <tr key={`t${s.id}`} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3"><Badge variant="blue">Substituição temporária</Badge></td>
                    <td className="px-4 py-3 text-gray-700">{s.titular.nome} → <span className="font-medium">{s.substituto.nome}</span></td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(s.data_inicio)} a {formatDate(s.data_fim)}</td>
                    <td className="px-4 py-3 text-gray-600">{s.motivo_tipo}{s.motivo_detalhe ? ` — ${s.motivo_detalhe}` : ''}</td>
                    <td className="px-4 py-3">
                      {statusTemporaria(s) !== 'ENCERRADA' && (
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setNovaDataFim(''); setAcaoTemp({ id: s.id, acao: 'prorrogar' }) }} className="text-xs text-blue-600 hover:underline">Prorrogar</button>
                          <button onClick={() => setAcaoTemp({ id: s.id, acao: 'encerrar' })} className="text-xs text-red-500 hover:underline">Encerrar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {transferenciasFiltradas.map((t) => (
                  <tr key={`x${t.id}`} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3"><Badge variant={t.tipo === 'TROCA' ? 'purple' : 'green'}>{t.tipo === 'TROCA' ? 'Troca definitiva' : 'Transferência definitiva'}</Badge></td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.origem.nome} {t.tipo === 'TROCA' ? '↔' : '→'} <span className="font-medium">{t.destino.nome}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(t.data_efetivacao)}{t.efetivada_em ? '' : ' (agendada)'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.motivo} · {t.itens.length} item(ns)</td>
                    <td className="px-4 py-3" />
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <SubstituicaoTemporariaModal open={modalTemporaria} onClose={() => setModalTemporaria(false)} onSuccess={fetchTudo} usuarios={usuarios} />
      {modalTransferencia && (
        <TransferenciaModal
          open={!!modalTransferencia}
          tipo={modalTransferencia}
          onClose={() => setModalTransferencia(null)}
          onSuccess={fetchTudo}
          usuarios={usuarios}
        />
      )}

      <ConfirmDialog
        open={!!acaoTemp}
        title={acaoTemp?.acao === 'encerrar' ? 'Encerrar substituição antecipadamente' : 'Prorrogar substituição'}
        variant={acaoTemp?.acao === 'encerrar' ? 'danger' : 'info'}
        confirmLabel={acaoLoading ? 'Salvando...' : acaoTemp?.acao === 'encerrar' ? 'Encerrar' : 'Prorrogar'}
        loading={acaoLoading}
        error={acaoErro}
        input={{ label: 'Motivo', required: true, multiline: true }}
        message={acaoTemp?.acao === 'prorrogar' ? (
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Nova data de fim</p>
            <input type="date" value={novaDataFim} onChange={(e) => setNovaDataFim(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-green-primary" />
          </div>
        ) : undefined}
        onConfirm={confirmarAcao}
        onClose={() => { setAcaoTemp(null); setAcaoErro(null) }}
      />
    </>
  )
}
