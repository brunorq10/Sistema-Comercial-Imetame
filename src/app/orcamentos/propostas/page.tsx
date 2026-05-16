'use client'

import { useCallback, useEffect, useState } from 'react'
import { PropostasTable } from '@/components/tables/PropostasTable'
import { EditarPropostaModal } from '@/components/forms/EditarPropostaModal'
import { HistoricoPropostaModal } from '@/components/forms/HistoricoPropostaModal'
import { Field, Input, Select } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import type { PropostasItem, UsuarioListItem } from '@/types'

export default function PropostasPage() {
  const { canRegistrarTecnica, canRegistrarComercial, canCancelSolicitacao } = usePermissions()
  const canEditar = canRegistrarTecnica || canRegistrarComercial

  const [items, setItems] = useState<PropostasItem[]>([])
  const [loading, setLoading] = useState(true)
  const [orcamentistas, setOrcamentistas] = useState<UsuarioListItem[]>([])
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])

  // Filtros — BRD 3.3.4
  const [busca, setBusca] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [cidade, setCidade] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [orcamentistaId, setOrcamentistaId] = useState('')
  const [status, setStatus] = useState('')
  const [resultado, setResultado] = useState('')
  const [ano, setAno] = useState('')

  const [modalEditar, setModalEditar] = useState<PropostasItem | null>(null)
  const [modalHistorico, setModalHistorico] = useState<PropostasItem | null>(null)

  useEffect(() => {
    fetch('/api/usuarios')
      .then((r) => r.json())
      .then((json) => {
        const todos: UsuarioListItem[] = json.data ?? []
        setOrcamentistas(todos.filter((u) => u.perfil === 'ORCAMENTISTA' && u.ativo))
      })
    fetch('/api/clientes')
      .then((r) => r.json())
      .then((json) => setClientes(json.data ?? []))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busca) params.set('busca', busca)
      if (clienteId) params.set('cliente_id', clienteId)
      if (cidade) params.set('cidade', cidade)
      if (classificacao) params.set('classificacao', classificacao)
      if (orcamentistaId) params.set('orcamentista_id', orcamentistaId)
      if (status) params.set('status', status)
      if (resultado) params.set('resultado', resultado)
      if (ano) params.set('ano', ano)
      const res = await fetch(`/api/propostas?${params}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [busca, clienteId, cidade, classificacao, orcamentistaId, status, resultado, ano])

  useEffect(() => { fetchData() }, [fetchData])

  const limpar = () => {
    setBusca(''); setClienteId(''); setCidade('')
    setClassificacao(''); setOrcamentistaId('')
    setStatus(''); setResultado(''); setAno('')
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Propostas</h2>
        <span className="text-[11px] text-gray-400">
          {items.length} proposta{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Filtros (BRD 3.3.4) ──────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Busca (nº)" className="min-w-[120px]">
          <Input placeholder="PROP-0001..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </Field>

        <Field label="Cliente" className="min-w-[150px] flex-1">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Field>

        <Field label="Cidade" className="min-w-[120px]">
          <Input placeholder="Ex: Vitória..." value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </Field>

        <Field label="Classificação" className="min-w-[130px]">
          <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value)}>
            <option value="">Todas</option>
            <option value="OBRAS">Obras</option>
            <option value="PARADAS">Paradas</option>
            <option value="OLEO_GAS">Óleo e Gás</option>
            <option value="FABRICACOES">Fabricações</option>
          </Select>
        </Field>

        <Field label="Orçamentista" className="min-w-[140px]">
          <Select value={orcamentistaId} onChange={(e) => setOrcamentistaId(e.target.value)}>
            <option value="">Todos</option>
            {orcamentistas.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </Select>
        </Field>

        <Field label="Status" className="min-w-[140px]">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="EM_ELABORACAO">Em elaboração</option>
            <option value="PROPOSTA_ENVIADA">Prop. enviada</option>
            <option value="CONTRATO_GANHO">Contrato ganho</option>
            <option value="RECUSADA">Recusada</option>
          </Select>
        </Field>

        <Field label="Resultado" className="min-w-[120px]">
          <Select value={resultado} onChange={(e) => setResultado(e.target.value)}>
            <option value="">Todos</option>
            <option value="AGUARDANDO">Aguardando</option>
            <option value="GANHOU">Ganhou</option>
            <option value="PERDEU">Perdeu</option>
          </Select>
        </Field>

        <Field label="Ano (env. técnica)" className="min-w-[110px]">
          <Select value={ano} onChange={(e) => setAno(e.target.value)}>
            <option value="">Todos</option>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </Field>

        <div className="flex-shrink-0">
          <button
            onClick={limpar}
            className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : (
        <PropostasTable
          data={items}
          onEditar={setModalEditar}
          onHistorico={setModalHistorico}
          canEditar={canEditar}
        />
      )}

      {/* ── Modal histórico de revisões ──────────────────────────────── */}
      {modalHistorico && (
        <HistoricoPropostaModal
          open={true}
          item={modalHistorico}
          onClose={() => setModalHistorico(null)}
        />
      )}

      {/* ── Modal de edição ──────────────────────────────────────────── */}
      {modalEditar && (
        <EditarPropostaModal
          open={true}
          onClose={() => setModalEditar(null)}
          onSuccess={() => { setModalEditar(null); fetchData() }}
          item={modalEditar}
          canRegistrarTecnica={canRegistrarTecnica}
          canRegistrarComercial={canRegistrarComercial}
          canCancelar={canCancelSolicitacao}
        />
      )}
    </div>
  )
}
