'use client'

import { useCallback, useEffect, useState } from 'react'
import { SolicitacoesTable } from '@/components/tables/SolicitacoesTable'
import { SolicitacaoForm } from '@/components/forms/SolicitacaoForm'
import { CancelarSolicitacaoModal } from '@/components/forms/CancelarSolicitacaoModal'
import { NovaRevisaoModal } from '@/components/forms/NovaRevisaoModal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import type { SolicitacaoListItem, FiltrosSolicitacao, StatusSolicitacao } from '@/types'

const TABS: { label: string; status: StatusSolicitacao | null }[] = [
  { label: 'Todas', status: null },
  { label: 'Ag. análise', status: 'AGUARDANDO_ANALISE' },
  { label: 'Em elaboração', status: 'EM_ELABORACAO' },
  { label: 'Prop. enviada', status: 'PROPOSTA_ENVIADA' },
  { label: 'Contrato ganho', status: 'CONTRATO_GANHO' },
  { label: 'Recusadas', status: 'RECUSADA' },
  { label: 'Canceladas', status: 'CANCELADA' },
]

export default function SolicitacoesPage() {
  const perms = usePermissions()

  const [items, setItems] = useState<SolicitacaoListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<StatusSolicitacao | null>(null)
  const [filtros, setFiltros] = useState<FiltrosSolicitacao>({})
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosSolicitacao>({})

  const [modalForm, setModalForm] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [modalNovaRevisao, setModalNovaRevisao] = useState(false)
  const [editando, setEditando] = useState<SolicitacaoListItem | null>(null)
  const [cancelando, setCancelando] = useState<SolicitacaoListItem | null>(null)
  const [revisando, setRevisando] = useState<SolicitacaoListItem | null>(null)

  const [reenviandoId, setReenviandoId] = useState<number | null>(null)
  const [reativandoId, setReativandoId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab) params.set('status', tab)
      if (filtrosAplicados.cliente) params.set('cliente', filtrosAplicados.cliente)
      if (filtrosAplicados.classificacao) params.set('classificacao', filtrosAplicados.classificacao)
      if (filtrosAplicados.interesse) params.set('interesse', filtrosAplicados.interesse)
      if (filtrosAplicados.orcamentista_id) params.set('orcamentista_id', filtrosAplicados.orcamentista_id)
      if (filtrosAplicados.data_de) params.set('data_de', filtrosAplicados.data_de)
      if (filtrosAplicados.data_ate) params.set('data_ate', filtrosAplicados.data_ate)
      if (filtrosAplicados.busca) params.set('busca', filtrosAplicados.busca)

      const res = await fetch(`/api/solicitacoes?${params.toString()}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [tab, filtrosAplicados])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAplicarFiltros = () => setFiltrosAplicados({ ...filtros })
  const handleLimparFiltros = () => {
    setFiltros({})
    setFiltrosAplicados({})
  }

  const handleEdit = (item: SolicitacaoListItem) => {
    setEditando(item)
    setModalForm(true)
  }

  const handleNova = () => {
    setEditando(null)
    setModalForm(true)
  }

  const handleCancel = (item: SolicitacaoListItem) => {
    setCancelando(item)
    setModalCancelar(true)
  }

  const handleNovaRevisao = (item: SolicitacaoListItem) => {
    setRevisando(item)
    setModalNovaRevisao(true)
  }

  const handleReenviar = async (item: SolicitacaoListItem) => {
    if (reenviandoId) return
    setReenviandoId(item.id)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/reenviar`, { method: 'POST' })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      fetchData()
    } finally {
      setReenviandoId(null)
    }
  }

  const handleReativar = async (item: SolicitacaoListItem) => {
    if (reativandoId) return
    setReativandoId(item.id)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/reativar`, { method: 'POST' })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      fetchData()
    } finally {
      setReativandoId(null)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[15px] font-bold">Solicitações de Orçamento</h2>
        {perms.canCreateSolicitacao && (
          <Button onClick={handleNova}>+ Nova solicitação</Button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Cliente" className="min-w-[120px] flex-1">
          <Input
            placeholder="Nome do cliente"
            value={filtros.cliente ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, cliente: e.target.value }))}
          />
        </Field>
        <Field label="Classificação" className="min-w-[120px] flex-1">
          <Select
            value={filtros.classificacao ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, classificacao: e.target.value as never }))}
          >
            <option value="">Todas</option>
            <option value="OBRAS">Obras</option>
            <option value="PARADAS">Paradas</option>
            <option value="OLEO_GAS">Óleo e Gás</option>
            <option value="FABRICACOES">Fabricações</option>
          </Select>
        </Field>
        <Field label="Interesse" className="min-w-[100px] flex-1">
          <Select
            value={filtros.interesse ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, interesse: e.target.value as never }))}
          >
            <option value="">Todos</option>
            <option value="ALTO">Alto</option>
            <option value="MEDIO">Médio</option>
            <option value="BAIXO">Baixo</option>
          </Select>
        </Field>
        <Field label="Criação — de" className="min-w-[120px] flex-1">
          <Input
            type="date"
            value={filtros.data_de ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, data_de: e.target.value }))}
          />
        </Field>
        <Field label="até" className="min-w-[120px] flex-1">
          <Input
            type="date"
            value={filtros.data_ate ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, data_ate: e.target.value }))}
          />
        </Field>
        <Field label="Busca" className="min-w-[140px] flex-1">
          <Input
            placeholder="Nº, escopo, cliente..."
            value={filtros.busca ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
          />
        </Field>
        <div className="flex gap-1.5 items-end flex-shrink-0">
          <button
            onClick={handleAplicarFiltros}
            className="bg-green-primary text-white border-none rounded px-3 py-[5px] text-[11px] font-semibold cursor-pointer hover:bg-green-dark transition-colors"
          >
            Filtrar
          </button>
          <button
            onClick={handleLimparFiltros}
            className="bg-none border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {(filtrosAplicados.data_de || filtrosAplicados.data_ate || filtrosAplicados.busca) && (
        <p className="text-[10px] text-gray-500 mb-2.5 px-2.5 py-1 bg-green-light rounded border-l-[3px] border-green-primary">
          Exibindo <strong>{items.length}</strong> de <strong>{total}</strong> solicitações
        </p>
      )}

      <div className="flex gap-0 mb-3 border-b-2 border-gray-200 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.status
          const count = t.status === null ? total : items.filter((i) => {
            if (t.status === 'CANCELADA') return !!i.cancelled_at
            return i.status === t.status && !i.cancelled_at
          }).length
          return (
            <button
              key={t.label}
              onClick={() => setTab(t.status)}
              className={`px-3.5 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-0.5 transition-colors ${
                active
                  ? 'text-green-primary border-green-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : (
        <SolicitacoesTable
          data={items}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onNovaRevisao={handleNovaRevisao}
          onReenviar={perms.canCreateSolicitacao ? handleReenviar : undefined}
          onReativar={perms.canCreateSolicitacao ? handleReativar : undefined}
          canEdit={perms.canEditSolicitacao}
          canCancel={perms.canCancelSolicitacao}
          canRevisao={perms.canCriarRevisao}
        />
      )}

      <SolicitacaoForm
        open={modalForm}
        onClose={() => setModalForm(false)}
        onSuccess={fetchData}
        editando={editando}
        canAtribuir={perms.canAtribuirOrcamentista}
      />
      <CancelarSolicitacaoModal
        open={modalCancelar}
        onClose={() => setModalCancelar(false)}
        onSuccess={fetchData}
        solicitacao={cancelando}
      />
      <NovaRevisaoModal
        open={modalNovaRevisao}
        onClose={() => setModalNovaRevisao(false)}
        onSuccess={fetchData}
        solicitacao={revisando}
      />
    </div>
  )
}
