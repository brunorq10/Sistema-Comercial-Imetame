'use client'

import { useCallback, useEffect, useState } from 'react'
import { FaturamentoTable } from '@/components/tables/FaturamentoTable'
import { AcordoModal } from '@/components/forms/AcordoModal'
import { LancarNFModal } from '@/components/forms/LancarNFModal'
import { NFsListModal } from '@/components/forms/NFsListModal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrency } from '@/lib/utils'
import type { AcordoListItem } from '@/types'

export default function FaturamentoPage() {
  const { canLancarNF, canGerirAcordos, isAdmin, isGestor } = usePermissions()
  const canEditar = canGerirAcordos || isAdmin
  const canCancelar = isAdmin || isGestor
  const canCriar = canGerirAcordos || isAdmin

  const [items, setItems] = useState<AcordoListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [status, setStatus] = useState('')

  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState<AcordoListItem | null>(null)
  const [modalNFs, setModalNFs] = useState<AcordoListItem | null>(null)
  const [modalLancarNF, setModalLancarNF] = useState<AcordoListItem | null>(null)
  const [cancelando, setCancelando] = useState<AcordoListItem | null>(null)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busca) params.set('busca', busca)
      if (ano) params.set('ano', ano)
      if (status) params.set('status', status)
      const res = await fetch(`/api/acordos?${params.toString()}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [busca, ano, status])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCancelar = async () => {
    if (!cancelando) return
    if (!motivoCancel || motivoCancel.length < 5) { setCancelError('Justificativa mínima de 5 caracteres'); return }
    const res = await fetch(`/api/acordos/${cancelando.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_reason: motivoCancel }),
    })
    const json = await res.json()
    if (json.error) { setCancelError(json.error); return }
    setCancelando(null); setMotivoCancel(''); setCancelError(null)
    fetchData()
  }

  // Totalizadores do filtro atual (RN-12: apenas NFs ativas)
  const totais = items.reduce(
    (acc, a) => ({
      contratos: acc.contratos + a.valor_total,
      emitido: acc.emitido + a.total_nfs,
      saldo: acc.saldo + a.saldo,
    }),
    { contratos: 0, emitido: 0, saldo: 0 },
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Controle de Faturamento</h2>
        {canCriar && (
          <Button size="sm" onClick={() => setModalNovo(true)}>+ Novo Acordo</Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Colunas Nº, Cliente e Status são fixas. Coluna roxa = Prev. Anos Seguintes (RN-23).
      </p>

      {/* Totalizadores */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Total contratos</p>
            <p className="text-[16px] font-bold text-green-dark mt-0.5">{formatCurrency(totais.contratos)}</p>
            <p className="text-[10px] text-gray-400">{items.length} acordo{items.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Total NFs emitidas (ativas)</p>
            <p className="text-[16px] font-bold text-auto-value mt-0.5">{formatCurrency(totais.emitido)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Saldo total</p>
            <p className={`text-[16px] font-bold mt-0.5 ${totais.saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {formatCurrency(totais.saldo)}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Busca (nº, cliente ou descrição)" className="min-w-[200px] flex-1">
          <Input
            placeholder="ACD-0001 ou Petrobras..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </Field>
        <Field label="Ano" className="min-w-[90px]">
          <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2026" />
        </Field>
        <Field label="Status" className="min-w-[130px]">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="ENCERRADO">Encerrado</option>
            <option value="CANCELADO">Cancelado</option>
          </Select>
        </Field>
        <div className="flex-shrink-0">
          <button
            onClick={() => { setBusca(''); setAno(String(new Date().getFullYear())); setStatus('') }}
            className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : (
        <FaturamentoTable
          data={items}
          onVerNFs={setModalNFs}
          onLancarNF={setModalLancarNF}
          onEditar={setModalEditar}
          onCancelar={setCancelando}
          canLancarNF={canLancarNF}
          canEditar={canEditar}
          canCancelar={canCancelar}
        />
      )}

      {/* Modal novo/editar acordo */}
      <AcordoModal
        open={modalNovo || !!modalEditar}
        onClose={() => { setModalNovo(false); setModalEditar(null) }}
        onSuccess={fetchData}
        editando={modalEditar}
      />

      {/* Modal lançar NF */}
      {modalLancarNF && (
        <LancarNFModal
          open={true}
          onClose={() => setModalLancarNF(null)}
          onSuccess={fetchData}
          acordo={modalLancarNF}
        />
      )}

      {/* Modal ver NFs */}
      {modalNFs && (
        <NFsListModal
          open={true}
          onClose={() => setModalNFs(null)}
          acordo={modalNFs}
          canInativar={canLancarNF}
        />
      )}

      {/* Modal cancelar (RN-18) */}
      {cancelando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[480px] max-w-[96%] shadow-2xl">
            <div className="bg-red-600 text-white px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg">
              Cancelar Acordo · {cancelando.numero}
            </div>
            <div className="p-[18px]">
              {cancelError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{cancelError}</div>
              )}
              <p className="text-[12px] text-gray-600 mb-3">
                Esta ação cancela o acordo permanentemente. Informe a justificativa.
              </p>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none"
                rows={3}
                placeholder="Motivo do cancelamento (mínimo 5 caracteres)"
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
              />
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button variant="outline" onClick={() => { setCancelando(null); setMotivoCancel(''); setCancelError(null) }}>
                Voltar
              </Button>
              <Button variant="danger" onClick={handleCancelar}>Confirmar cancelamento</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
