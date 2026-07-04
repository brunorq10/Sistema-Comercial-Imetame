'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'

interface RevisaoPendenteItem {
  id: number
  solicitacao_id: number
  numero: string
  cliente: string
  escopo_atual: string | null
  escopo_novo: string | null
  as_sold: boolean
  proxima_rev: string
  criador: string
  created_at: string
}

interface Props {
  /** Chamado após aprovar/devolver, para o painel recarregar os cards. */
  onChanged: () => void
}

export function RevisoesPendentes({ onChanged }: Props) {
  const [itens, setItens] = useState<RevisaoPendenteItem[]>([])
  const [recusando, setRecusando] = useState<number | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const fetchPendentes = useCallback(() => {
    fetch('/api/solicitacoes/revisoes-pendentes')
      .then((r) => r.json())
      .then((j) => setItens(j.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchPendentes() }, [fetchPendentes])

  const avaliar = async (id: number, acao: 'APROVAR' | 'RECUSAR') => {
    if (acao === 'RECUSAR' && justificativa.trim().length < 3) {
      setErro('Informe a justificativa da devolução (mínimo 3 caracteres)')
      return
    }
    setLoadingId(id); setErro(null)
    try {
      const res = await fetch(`/api/solicitacoes/revisoes-pendentes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, justificativa: acao === 'RECUSAR' ? justificativa.trim() : undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErro(json.error ?? 'Erro ao avaliar'); return }
      setRecusando(null); setJustificativa('')
      fetchPendentes()
      onChanged()
    } finally {
      setLoadingId(null)
    }
  }

  if (itens.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 mb-3">
      <p className="text-[12px] font-bold text-amber-800 mb-2.5">
        ⚠ Revisões aguardando sua avaliação ({itens.length})
      </p>
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded mb-2">{erro}</div>}
      <div className="space-y-2">
        {itens.map((r) => (
          <div key={r.id} className="bg-white border border-amber-200 rounded-md p-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-bold">{r.numero}</span>
                  <span className="text-[11px] text-gray-600">{r.cliente}</span>
                  <Badge variant="purple">{r.proxima_rev}</Badge>
                  {r.as_sold && <Badge variant="amber">As Sold</Badge>}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Aberta por <span className="font-medium">{r.criador}</span> em {formatDate(r.created_at)}
                </p>
                {r.escopo_novo && r.escopo_novo !== r.escopo_atual && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    <span className="text-gray-400 uppercase text-[9px]">Novo escopo:</span> {r.escopo_novo}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="sm" onClick={() => avaliar(r.id, 'APROVAR')} disabled={loadingId === r.id}>
                  {loadingId === r.id ? 'Aguarde…' : 'É revisão — Aprovar'}
                </Button>
                <Button size="sm" variant="danger"
                  onClick={() => { setRecusando(recusando === r.id ? null : r.id); setJustificativa(''); setErro(null) }}
                  disabled={loadingId === r.id}>
                  Não é revisão — Devolver
                </Button>
              </div>
            </div>

            {recusando === r.id && (
              <div className="mt-2.5 border-t border-amber-100 pt-2.5">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Justificativa da devolução *</p>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={2}
                  placeholder="Explique por que não se trata de uma revisão (ex.: apenas atualização/complementação de arquivos)…"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[11px] resize-none focus:outline-none focus:border-red-400"
                />
                <div className="flex justify-end gap-1.5 mt-1.5">
                  <Button size="sm" variant="outline" onClick={() => { setRecusando(null); setJustificativa('') }} disabled={loadingId === r.id}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => avaliar(r.id, 'RECUSAR')} disabled={loadingId === r.id}>
                    {loadingId === r.id ? 'Aguarde…' : 'Confirmar devolução'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
