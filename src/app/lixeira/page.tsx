'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface ItemLixeira {
  tipo: string
  tipoLabel: string
  id: number
  titulo: string
  contexto: string
  deleted_at: string
  deleted_by_nome: string | null
  expira_em: string
}

function diasRestantes(expiraEm: string): number {
  return Math.max(0, Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 86400000))
}

export default function LixeiraPage() {
  const [itens, setItens] = useState<ItemLixeira[]>([])
  const [retencao, setRetencao] = useState(15)
  const [loading, setLoading] = useState(true)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<ItemLixeira | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState('')

  const fetchItens = useCallback(() => {
    setLoading(true)
    fetch('/api/lixeira')
      .then((r) => r.json())
      .then((j) => { setItens(j.data?.itens ?? []); setRetencao(j.data?.retencaoDias ?? 15) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchItens() }, [fetchItens])

  const tipos = useMemo(() => Array.from(new Set(itens.map((i) => i.tipoLabel))).sort(), [itens])
  const filtrados = filtroTipo ? itens.filter((i) => i.tipoLabel === filtroTipo) : itens

  const restaurar = async (item: ItemLixeira) => {
    const key = `${item.tipo}-${item.id}`
    setRestaurando(key); setErro(null); setOk(null)
    try {
      const res = await fetch('/api/lixeira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: item.tipo, id: item.id }),
      })
      const j = await res.json()
      if (!res.ok || j.error) { setErro(j.error ?? 'Erro ao restaurar'); return }
      setOk(`"${item.titulo}" restaurado com sucesso.`)
      setConfirmando(null)
      fetchItens()
    } finally {
      setRestaurando(null)
    }
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <PageHeader
        title="Lixeira"
        subtitle={`Itens excluídos ficam aqui por ${retencao} dias e podem ser restaurados. Após o prazo, são apagados definitivamente.`}
        actions={
          <>
            {tipos.length > 1 && (
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-green-primary">
                <option value="">Todos os tipos</option>
                {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <span className="text-[11px] text-gray-400">{filtrados.length} item(ns)</span>
          </>
        }
      />

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded mb-2">{erro}</div>}
      {ok && <div className="bg-green-light border border-green-primary/30 text-green-dark text-[11px] px-3 py-2 rounded mb-2">{ok}</div>}

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-14 border border-dashed border-gray-200 rounded-md">
          🗑 A lixeira está vazia.
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((item) => {
            const dias = diasRestantes(item.expira_em)
            const key = `${item.tipo}-${item.id}`
            return (
              <div key={key} className="bg-white border border-gray-200 rounded-md p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{item.tipoLabel}</span>
                    <span className="text-[12px] font-semibold text-gray-800 truncate">{item.titulo}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{item.contexto}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Excluído por <span className="font-medium">{item.deleted_by_nome ?? '—'}</span> em {new Date(item.deleted_at).toLocaleString('pt-BR')}
                    {' · '}
                    <span className={dias <= 3 ? 'text-red-500 font-semibold' : ''}>expira em {dias} dia(s)</span>
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setConfirmando(item)} disabled={restaurando === key}>
                  {restaurando === key ? 'Restaurando…' : '↩ Restaurar'}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmando}
        title="Restaurar item"
        variant="success"
        message={confirmando ? <>O item <strong>{confirmando.titulo}</strong> voltará a aparecer normalmente no sistema.</> : null}
        confirmLabel="Restaurar"
        loading={!!restaurando}
        onConfirm={() => confirmando && restaurar(confirmando)}
        onClose={() => setConfirmando(null)}
      />
    </div>
  )
}
