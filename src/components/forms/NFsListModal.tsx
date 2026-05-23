'use client'

import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatDate, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AcordoListItem, NotaFiscalItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  acordo: AcordoListItem
  canInativar: boolean
}

export function NFsListModal({ open, onClose, acordo, canInativar }: Props) {
  const [nfs, setNfs] = useState<NotaFiscalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [inativando, setInativando] = useState<number | null>(null)
  const [motivoMap, setMotivoMap] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchNFs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/acordos/${acordo.id}/nfs`)
      const json = await res.json()
      setNfs(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [acordo.id])

  useEffect(() => {
    if (open) { setError(null); fetchNFs() }
  }, [open, fetchNFs])

  const handleInativar = async (nf: NotaFiscalItem) => {
    const motivo = motivoMap[nf.id]
    if (!motivo || motivo.length < 5) {
      setError('Informe o motivo da inativação (mínimo 5 caracteres)')
      return
    }
    setError(null)
    try {
      const res = await fetch(`/api/acordos/${acordo.id}/nfs/${nf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa: false, motivo_inativacao: motivo }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao inativar NF'); return }
      setInativando(null)
      fetchNFs()
    } catch {
      setError('Erro ao inativar NF — verifique sua conexão')
    }
  }

  const handleReativar = async (nf: NotaFiscalItem) => {
    setError(null)
    try {
      const res = await fetch(`/api/acordos/${acordo.id}/nfs/${nf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa: true }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao reativar NF'); return }
      fetchNFs()
    } catch {
      setError('Erro ao reativar NF — verifique sua conexão')
    }
  }

  const totalAtivas = nfs.filter((n) => n.ativa).reduce((acc, n) => acc + n.valor, 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Notas Fiscais — ${acordo.numero} · ${acordo.cliente.nome}`}
      wide
    >
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Total emitido (ativas)</p>
          <p className="text-[14px] font-bold text-green-primary mt-0.5">{formatCurrency(totalAtivas)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Saldo do contrato</p>
          <p className={cn('text-[14px] font-bold mt-0.5', acordo.saldo < 0 ? 'text-red-600' : 'text-gray-700')}>
            {formatCurrency(acordo.saldo)}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">NFs ({nfs.length} total)</p>
          <p className="text-[14px] font-bold text-gray-700 mt-0.5">
            {nfs.filter((n) => n.ativa).length} ativas
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-6 text-sm">Carregando...</p>
      ) : nfs.length === 0 ? (
        <p className="text-center text-gray-400 py-6 text-sm">Nenhuma NF lançada.</p>
      ) : (
        <div className="space-y-2">
          {nfs.map((nf) => (
            <div
              key={nf.id}
              className={cn(
                'border rounded-md p-3 text-[11px]',
                nf.ativa ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">NF {nf.numero_nf}</span>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    nf.ativa ? 'bg-green-light text-green-dark' : 'bg-gray-200 text-gray-500',
                  )}>
                    {nf.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <span className="font-bold text-green-dark">{formatCurrency(nf.valor)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-gray-500">
                <div><span className="uppercase tracking-wider text-[9px]">Emissão</span><br />{formatDate(nf.data_emissao)}</div>
                <div><span className="uppercase tracking-wider text-[9px]">Vencimento</span><br />{formatDate(nf.data_vencimento)}</div>
                <div><span className="uppercase tracking-wider text-[9px]">Lançada em</span><br />{formatDate(nf.created_at)}</div>
              </div>

              {!nf.ativa && nf.motivo_inativacao && (
                <p className="text-[10px] text-gray-400 mt-1.5 italic">Motivo: {nf.motivo_inativacao}</p>
              )}

              {canInativar && nf.ativa && (
                <div className="mt-2">
                  {inativando === nf.id ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]"
                        placeholder="Motivo da inativação (min. 5 chars)"
                        value={motivoMap[nf.id] ?? ''}
                        onChange={(e) => setMotivoMap((m) => ({ ...m, [nf.id]: e.target.value }))}
                      />
                      <Button size="sm" variant="danger" onClick={() => handleInativar(nf)}>Confirmar</Button>
                      <Button size="sm" variant="outline" onClick={() => setInativando(null)}>✕</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setInativando(nf.id)}>
                      Inativar NF
                    </Button>
                  )}
                </div>
              )}

              {canInativar && !nf.ativa && (
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => handleReativar(nf)}>Reativar NF</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
