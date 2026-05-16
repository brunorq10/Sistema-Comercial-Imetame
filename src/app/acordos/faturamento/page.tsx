'use client'

import { useCallback, useEffect, useState } from 'react'
import { FaturamentoContratoTable } from '@/components/tables/FaturamentoContratoTable'
import { ContratoModal } from '@/components/forms/ContratoModal'
import { LancarNFContratoModal } from '@/components/forms/LancarNFContratoModal'
import { EditarSubIndiceModal } from '@/components/forms/EditarSubIndiceModal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import type { ContratoItem, SubIndiceItem } from '@/types'

export default function FaturamentoPage() {
  const { canLancarNF, canGerirAcordos, isAdmin } = usePermissions()
  const canEditar = canGerirAcordos || isAdmin
  const canCriar = canGerirAcordos || isAdmin

  const anoAtual = new Date().getFullYear()

  // Dados
  const [contratos, setContratos] = useState<ContratoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: number; nome: string }[]>([])

  // Filtros
  const [ano, setAno] = useState(String(anoAtual))
  const [clienteId, setClienteId] = useState('')
  const [status, setStatus] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [numAcordo, setNumAcordo] = useState('')

  // Modais
  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState<ContratoItem | null>(null)
  const [modalLancarNF, setModalLancarNF] = useState<{ contrato: ContratoItem; subindice: SubIndiceItem } | null>(null)
  const [modalEditarSub, setModalEditarSub] = useState<{ contrato: ContratoItem; subindice: SubIndiceItem } | null>(null)
  const [cancelando, setCancelando] = useState<ContratoItem | null>(null)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    fetch('/api/clientes').then((r) => r.json()).then((j) => setClientes(j.data ?? []))
    fetch('/api/users/acordos').then((r) => r.json()).then((j) => setResponsaveis(j.data ?? []))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (ano) params.set('ano', ano)
      if (clienteId) params.set('cliente_id', clienteId)
      if (status) params.set('status', status)
      if (responsavelId) params.set('responsavel_id', responsavelId)
      if (numAcordo) params.set('num_acordo', numAcordo)
      const res = await fetch(`/api/faturamento/contratos?${params.toString()}`)
      const json = await res.json()
      setContratos(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [ano, clienteId, status, responsavelId, numAcordo])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCancelar = async () => {
    if (!cancelando) return
    if (!motivoCancel || motivoCancel.trim().length < 5) {
      setCancelError('Justificativa mínima de 5 caracteres')
      return
    }
    setCancelLoading(true); setCancelError(null)
    try {
      const res = await fetch(`/api/faturamento/contratos/${cancelando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: motivoCancel }),
      })
      const json = await res.json()
      if (json.error) { setCancelError(json.error); return }
      setCancelando(null); setMotivoCancel('')
      fetchData()
    } finally {
      setCancelLoading(false)
    }
  }

  const totalContratos = contratos.length
  const totalSubindices = contratos.reduce((a, c) => a + c.subindices.length, 0)
  const temAnosSeguintes = contratos.some((c) =>
    c.subindices.some((s) => s.data_fim && new Date(s.data_fim).getFullYear() > c.ano_referencia)
  )

  const limparFiltros = () => {
    setAno(String(anoAtual))
    setClienteId('')
    setStatus('')
    setResponsavelId('')
    setNumAcordo('')
  }

  return (
    <div className="p-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Controle de Faturamento — Contratos</h2>
        {canCriar && (
          <Button size="sm" onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Colunas Índice, Cliente e Nº OS são fixas. Coluna roxa = Prev. anos seguintes (RN-23).
      </p>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Ano referência" className="min-w-[90px]">
          <Select value={ano} onChange={(e) => setAno(e.target.value)}>
            {Array.from({ length: 8 }, (_, i) => anoAtual - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cliente" className="min-w-[160px] flex-1">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Status" className="min-w-[130px]">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="A_FATURAR">A faturar</option>
            <option value="PARCIAL">Parcial</option>
            <option value="FATURADO">Faturado</option>
            <option value="CANCELADO">Cancelado</option>
          </Select>
        </Field>
        <Field label="Responsável" className="min-w-[140px]">
          <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Todos</option>
            {responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        </Field>
        <Field label="Nº Acordo" className="min-w-[130px]">
          <Input
            placeholder="AC-2024-001"
            value={numAcordo}
            onChange={(e) => setNumAcordo(e.target.value)}
          />
        </Field>
        <div className="flex-shrink-0">
          <button
            onClick={limparFiltros}
            className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {/* Info linha */}
      {!loading && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-gray-500">
            {totalContratos} contrato{totalContratos !== 1 ? 's' : ''} · {totalSubindices} sub-índice{totalSubindices !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Banner anos seguintes */}
      {!loading && temAnosSeguintes && (
        <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-2.5">
          ⚡ Alguns contratos possuem datas de fim além de {ano}. A coluna <strong>Prev. anos seg.</strong> indica esses itens (RN-23).
        </div>
      )}

      {/* Tabela / loading */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : (
        <FaturamentoContratoTable
          contratos={contratos}
          onLancarNF={(contrato, subindice) => setModalLancarNF({ contrato, subindice })}
          onEditarSubindice={(contrato, subindice) => setModalEditarSub({ contrato, subindice })}
          onEditarContrato={setModalEditar}
          onCancelarContrato={setCancelando}
          canEditar={canEditar}
          canLancarNF={canLancarNF}
        />
      )}

      {/* Modal novo/editar contrato */}
      <ContratoModal
        open={modalNovo || !!modalEditar}
        onClose={() => { setModalNovo(false); setModalEditar(null) }}
        onSuccess={fetchData}
        editando={modalEditar}
      />

      {/* Modal lançar NF */}
      {modalLancarNF && (
        <LancarNFContratoModal
          open={true}
          onClose={() => setModalLancarNF(null)}
          onSuccess={fetchData}
          contrato={modalLancarNF.contrato}
          subindice={modalLancarNF.subindice}
        />
      )}

      {/* Modal editar sub-índice */}
      {modalEditarSub && (
        <EditarSubIndiceModal
          open={true}
          onClose={() => setModalEditarSub(null)}
          onSuccess={fetchData}
          onDelete={fetchData}
          subindice={modalEditarSub.subindice}
          indiceLabel={`${modalEditarSub.contrato.indice}.${modalEditarSub.subindice.ordem}`}
        />
      )}

      {/* Modal cancelar contrato (RN-18) */}
      {cancelando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[480px] max-w-[96%] shadow-2xl">
            <div className="bg-red-600 text-white px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg">
              Cancelar Contrato · {cancelando.indice}
            </div>
            <div className="p-[18px]">
              {cancelError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{cancelError}</div>
              )}
              <p className="text-[12px] text-gray-600 mb-3">
                Esta ação cancela o contrato permanentemente. Informe a justificativa (RN-18).
              </p>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-red-400/40"
                rows={3}
                placeholder="Motivo do cancelamento (mínimo 5 caracteres)"
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
              />
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => { setCancelando(null); setMotivoCancel(''); setCancelError(null) }}
                disabled={cancelLoading}
              >
                Voltar
              </Button>
              <Button variant="danger" onClick={handleCancelar} disabled={cancelLoading}>
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
