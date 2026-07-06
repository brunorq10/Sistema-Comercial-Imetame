'use client'

import { useCallback, useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Pagination } from '@/components/ui/Pagination'
import { SolicitacoesTable } from '@/components/tables/SolicitacoesTable'
import { SolicitacaoForm } from '@/components/forms/SolicitacaoForm'
import { CancelarSolicitacaoModal } from '@/components/forms/CancelarSolicitacaoModal'
import { NovaRevisaoModal } from '@/components/forms/NovaRevisaoModal'
import { AnaliseSolicitacaoModal } from '@/components/forms/AnaliseSolicitacaoModal'
import { ClassificacaoBadge, InteresseBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { usePermissions } from '@/hooks/usePermissions'
import { SearchableSelect, SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate } from '@/lib/utils'
import type { SolicitacaoListItem, FiltrosSolicitacao, StatusSolicitacao, Classificacao, Interesse, Origem } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type View = 'solicitacoes' | 'analise'


interface SolicitacaoPendente {
  id: number
  numero: string
  created_at: string
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  origem: Origem | null
  cidade: string | null
  estado: string | null
  visita_tecnica: boolean
  dias_aguardando: number
  cliente: { id: number; nome: string }
  criador: { id: number; nome: string }
}

function DiasAguardandoBadge({ dias }: { dias: number }) {
  const cls = dias >= 5
    ? 'bg-red-50 border-red-200 text-red-700'
    : dias >= 2
    ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-gray-50 border-gray-200 text-gray-500'
  return (
    <span className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 ${cls}`}>
      {dias === 0 ? 'hoje' : `${dias}d`}
    </span>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function SolicitacoesPage() {
  const perms = usePermissions()

  const [view, setView] = useState<View>('solicitacoes')

  // ── Estado: Solicitações ──────────────────────────────────────────────────
  const [items, setItems] = useState<SolicitacaoListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<StatusSolicitacao | null>(null)
  const [filtros, setFiltros] = useState<FiltrosSolicitacao>({})
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosSolicitacao>({})

  // Opções de filtro
  const [clientes,      setClientes]      = useState<{ id: number; nome: string }[]>([])
  const [responsaveis,  setResponsaveis]  = useState<{ id: number; nome: string }[]>([])
  const [orcamentistas, setOrcamentistas] = useState<{ id: number; nome: string }[]>([])
  const [modalForm, setModalForm] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [modalNovaRevisao, setModalNovaRevisao] = useState(false)
  const [editando, setEditando] = useState<SolicitacaoListItem | null>(null)
  const [cancelando, setCancelando] = useState<SolicitacaoListItem | null>(null)
  const [revisando, setRevisando] = useState<SolicitacaoListItem | null>(null)
  const [reenviandoId, setReenviandoId] = useState<number | null>(null)
  const [reativandoId, setReativandoId] = useState<number | null>(null)
  const [confirmReenviar, setConfirmReenviar] = useState<SolicitacaoListItem | null>(null)
  const [confirmReativar, setConfirmReativar] = useState<SolicitacaoListItem | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  // ── Estado: Análise ───────────────────────────────────────────────────────
  const [pendentes, setPendentes] = useState<SolicitacaoPendente[]>([])
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [analiseModal, setAnaliseModal] = useState(false)
  const [analiseId, setAnaliseId] = useState<number | null>(null)

  // ── Fetch opções de filtro ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/solicitacoes?modo=filtros').then(r => r.json()).then(j => {
      if (j.data) {
        setClientes(j.data.clientes ?? [])
        setResponsaveis(j.data.responsaveis ?? [])
        setOrcamentistas(j.data.orcamentistas ?? [])
      }
    })
  }, [])

  // ── Fetch solicitações ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const statusEfetivo = tab ?? filtrosAplicados.status ?? undefined
      if (statusEfetivo) params.set('status', statusEfetivo)
      if (filtrosAplicados.ano) params.set('ano', filtrosAplicados.ano)
      if (filtrosAplicados.cliente_id?.length) params.set('cliente_id', filtrosAplicados.cliente_id.join(','))
      if (filtrosAplicados.classificacao?.length) params.set('classificacao', filtrosAplicados.classificacao.join(','))
      if (filtrosAplicados.interesse?.length) params.set('interesse', filtrosAplicados.interesse.join(','))
      if (filtrosAplicados.data_de) params.set('data_de', filtrosAplicados.data_de)
      if (filtrosAplicados.data_ate) params.set('data_ate', filtrosAplicados.data_ate)
      if (filtrosAplicados.responsavel_id?.length) params.set('responsavel_id', filtrosAplicados.responsavel_id.join(','))
      if (filtrosAplicados.orcamentista_id?.length) params.set('orcamentista_id', filtrosAplicados.orcamentista_id.join(','))
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await fetch(`/api/solicitacoes?${params.toString()}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setTotal(json.total ?? 0)
      setPages(json.pages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [tab, filtrosAplicados, page])

  // ── Fetch pendentes de análise ────────────────────────────────────────────
  const fetchPendentes = useCallback(async () => {
    setLoadingAnalise(true)
    try {
      const res = await fetch('/api/analise')
      const json = await res.json()
      setPendentes(json.data ?? [])
    } finally {
      setLoadingAnalise(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (view === 'analise') fetchPendentes() }, [view, fetchPendentes])

  const handleAplicarFiltros = () => {
    const applied = { ...filtros }
    setFiltrosAplicados(applied)
    setTab(applied.status ? (applied.status as StatusSolicitacao) : null)
    setPage(1)
  }
  const handleLimparFiltros = () => {
    setFiltros({})
    setFiltrosAplicados({})
    setTab(null)
    setPage(1)
  }

  const handleEdit             = (item: SolicitacaoListItem) => { setEditando(item); setModalForm(true) }
  const handleNova             = () => { setEditando(null); setModalForm(true) }
  const handleCancel           = (item: SolicitacaoListItem) => { setCancelando(item); setModalCancelar(true) }
  const handleNovaRevisao      = (item: SolicitacaoListItem) => { setRevisando(item); setModalNovaRevisao(true) }
  const handleEditarReprovacao = (id: number) => { setAnaliseId(id); setAnaliseModal(true) }

  const exportarExcel = () => {
    const rows = items.map((i) => ({
      'Número': i.numero,
      'Data Criação': formatDate(i.created_at),
      'Versão': `Rev${String(i.versao_atual - 1).padStart(2, '0')}`,
      'Cliente': i.cliente.nome,
      'Cliente Final': i.cliente_final?.nome ?? '',
      'Cidade': i.cidade ?? '',
      'UF': i.estado ?? '',
      'Escopo': i.escopo ?? '',
      'Classificação': i.classificacao ?? '',
      'Interesse': i.interesse ?? '',
      'Orçamentista': i.orcamentista?.nome ?? '',
      'Status': i.status,
      'Status Análise': i.status_analise,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitações')
    XLSX.writeFile(wb, `solicitacoes_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const handleReenviar = (item: SolicitacaoListItem) => setConfirmReenviar(item)
  const handleReativar = (item: SolicitacaoListItem) => setConfirmReativar(item)

  const executarReenvio = async (item: SolicitacaoListItem) => {
    if (reenviandoId) return
    setReenviandoId(item.id)
    setConfirmReenviar(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/reenviar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.error) { setPageError(json.error ?? 'Erro ao reenviar solicitação'); return }
      fetchData()
    } finally { setReenviandoId(null) }
  }

  const executarReativacao = async (item: SolicitacaoListItem) => {
    if (reativandoId) return
    setReativandoId(item.id)
    setConfirmReativar(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/reativar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.error) { setPageError(json.error ?? 'Erro ao reativar solicitação'); return }
      fetchData()
    } finally { setReativandoId(null) }
  }

  const viewTabBase   = 'px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap'
  const viewTabAtivo  = 'border-green-primary text-green-primary'
  const viewTabInativo = 'border-transparent text-gray-400 hover:text-gray-600'

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'
  const fCtrl = 'w-full px-1.5 py-[5px] border border-gray-300 rounded text-[11px] text-gray-900 bg-white outline-none focus:border-green-primary transition-colors'

  return (
    <div className="flex flex-col h-full">
      {/* ── Zona congelada ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4">
      {/* Banner de erro page-level */}
      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3 flex items-center justify-between">
          <span>{pageError}</span>
          <button onClick={() => setPageError(null)} className="ml-2 text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Cabeçalho */}
      <PageHeader
        title="Solicitações de Orçamento"
        actions={
          <>
            {!loading && items.length > 0 && view === 'solicitacoes' && (
              <Button size="sm" variant="outline" onClick={exportarExcel}>Exportar Excel</Button>
            )}
            {perms.canCreateSolicitacao && view === 'solicitacoes' && (
              <Button size="sm" onClick={handleNova}>+ Nova solicitação</Button>
            )}
          </>
        }
      />

      {/* Abas de view */}
      <div className="flex gap-0 border-b border-gray-200 mb-4">
        <button
          className={`${viewTabBase} ${view === 'solicitacoes' ? viewTabAtivo : viewTabInativo}`}
          onClick={() => setView('solicitacoes')}
        >
          Solicitações
        </button>
        {perms.isAnalistaCritico && (
          <button
            className={`${viewTabBase} ${view === 'analise' ? viewTabAtivo : viewTabInativo}`}
            onClick={() => setView('analise')}
          >
            Análise de Solicitações
            {pendentes.length > 0 && (
              <span className="ml-1.5 bg-amber-400 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {pendentes.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── VIEW: Solicitações — filtros e status tabs (zona congelada) ─────── */}
      {view === 'solicitacoes' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 mb-3 flex flex-wrap gap-1.5 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Ano ref.</label>
              <SearchableSelect
                value={filtros.ano ?? ''}
                onChange={(v) => setFiltros((f) => ({ ...f, ano: v }))}
                options={Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => ({ value: String(y), label: String(y) }))}
              />
            </div>
            <div className="flex-[2] min-w-[160px]">
              <label className={fLbl}>Cliente</label>
              <SearchableMultiSelect
                values={filtros.cliente_id ?? []}
                onChange={(v) => setFiltros((f) => ({ ...f, cliente_id: v }))}
                options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Classificação</label>
              <SearchableMultiSelect
                values={filtros.classificacao ?? []}
                onChange={(v) => setFiltros((f) => ({ ...f, classificacao: v }))}
                options={[
                  { value: 'OBRAS',       label: 'Obras' },
                  { value: 'PARADAS',     label: 'Paradas' },
                  { value: 'OLEO_GAS',    label: 'Óleo e Gás' },
                  { value: 'FABRICACOES', label: 'Fabricações' },
                ]}
                emptyLabel="Todas"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Interesse</label>
              <SearchableMultiSelect
                values={filtros.interesse ?? []}
                onChange={(v) => setFiltros((f) => ({ ...f, interesse: v }))}
                options={[
                  { value: 'ALTO',  label: 'Alto' },
                  { value: 'MEDIO', label: 'Médio' },
                  { value: 'BAIXO', label: 'Baixo' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Criação de</label>
              <input type="date" className={fCtrl} value={filtros.data_de ?? ''} onChange={(e) => setFiltros((f) => ({ ...f, data_de: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Até</label>
              <input type="date" className={fCtrl} value={filtros.data_ate ?? ''} onChange={(e) => setFiltros((f) => ({ ...f, data_ate: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Responsável</label>
              <SearchableMultiSelect
                values={filtros.responsavel_id ?? []}
                onChange={(v) => setFiltros((f) => ({ ...f, responsavel_id: v }))}
                options={responsaveis.map((u) => ({ value: String(u.id), label: u.nome }))}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Status</label>
              <SearchableSelect
                value={filtros.status ?? ''}
                onChange={(v) => setFiltros((f) => ({ ...f, status: v as never }))}
                options={[
                  { value: 'AGUARDANDO_ANALISE', label: 'Em análise' },
                  { value: 'EM_ELABORACAO',      label: 'Em elaboração' },
                  { value: 'PROPOSTA_ENVIADA',   label: 'Prop. enviada' },
                  { value: 'CONTRATO_GANHO',     label: 'Contrato ganho' },
                  { value: 'RECUSADA',           label: 'Recusada' },
                  { value: 'SUSPENSA',           label: 'Suspensa' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Orçamentista</label>
              <SearchableMultiSelect
                values={filtros.orcamentista_id ?? []}
                onChange={(v) => setFiltros((f) => ({ ...f, orcamentista_id: v }))}
                options={orcamentistas.map((u) => ({ value: String(u.id), label: u.nome }))}
              />
            </div>
            <div className="flex gap-1 items-end flex-shrink-0">
              <Button size="sm" onClick={handleAplicarFiltros}>Filtrar</Button>
              <button onClick={handleLimparFiltros} className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">✕ Limpar</button>
            </div>
          </div>

        </>
      )}
      </div>{/* fim zona congelada */}

      {/* ── Zona de scroll ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
      {view === 'solicitacoes' && (
        <>
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0">
                <SolicitacoesTable
                  data={items}
                  onEdit={handleEdit}
                  onCancel={handleCancel}
                  onNovaRevisao={handleNovaRevisao}
                  onReenviar={perms.canCreateSolicitacao ? handleReenviar : undefined}
                  onReativar={perms.canCreateSolicitacao ? handleReativar : undefined}
                  onEditarReprovacao={perms.isAnalistaCritico ? handleEditarReprovacao : undefined}
                  canEdit={perms.canEditSolicitacao}
                  canCancel={perms.canCancelSolicitacao}
                  canRevisao={perms.canCriarRevisao}
                />
              </div>
              <Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} />
            </div>
          )}
        </>
      )}

      {/* ── VIEW: Análise de Solicitações ──────────────────────────────────── */}
      {view === 'analise' && perms.isAnalistaCritico && (
        <div className="h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-gray-500">
              Solicitações aguardando aprovação do Analista Crítico
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 text-[11px] text-amber-700 font-semibold">
              {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loadingAnalise ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : pendentes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-[13px] font-medium">Nenhuma solicitação pendente</p>
              <p className="text-[11px] mt-1">Todas as solicitações foram analisadas.</p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {pendentes.map((item) => (
                <div
                  key={item.id}
                  onClick={() => { setAnaliseId(item.id); setAnaliseModal(true) }}
                  className="bg-white border border-gray-200 border-l-[3px] border-l-amber-400 rounded-md p-3.5 cursor-pointer hover:bg-green-light transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[13px] font-bold">{item.numero}</span>
                        <span className="text-[12px] font-medium text-gray-600">— {item.cliente.nome}</span>
                        {item.classificacao && <ClassificacaoBadge value={item.classificacao} />}
                        {item.interesse && <InteresseBadge value={item.interesse} />}
                        <DiasAguardandoBadge dias={item.dias_aguardando} />
                      </div>
                      <p className="text-[11px] text-gray-600 truncate">
                        {item.escopo ?? <span className="text-gray-400 italic">Sem escopo definido</span>}
                      </p>
                      <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                        {(item.cidade || item.estado) && (
                          <span>{[item.cidade, item.estado].filter(Boolean).join(' / ')}</span>
                        )}
                        {item.visita_tecnica && <span className="text-amber-600 font-medium">Visita técnica</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-400">Aguardando há</p>
                      <p className="text-[12px] font-bold text-amber-600">
                        {item.dias_aguardando === 0 ? 'Hoje' : `${item.dias_aguardando} dia${item.dias_aguardando !== 1 ? 's' : ''}`}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">Criado em</p>
                      <p className="text-[11px] font-medium">{formatDate(item.created_at)}</p>
                      <p className="text-[10px] text-gray-400 mt-1">Por</p>
                      <p className="text-[11px]">{item.criador.nome}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-end">
                    <button className="text-[10px] font-semibold text-green-primary hover:underline">
                      Abrir para análise →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AnaliseSolicitacaoModal
            open={analiseModal}
            onClose={() => setAnaliseModal(false)}
            onSuccess={() => { fetchPendentes(); fetchData() }}
            solicitacaoId={analiseId}
          />
        </div>
      )}

      </div>{/* fim zona de scroll */}

      {/* ── Modais ────────────────────────────────────────────────────────── */}
      <SolicitacaoForm
        open={modalForm}
        onClose={() => setModalForm(false)}
        onSuccess={fetchData}
        editando={editando}
        canAtribuir={perms.canAtribuirOrcamentista}
        canTransferir={perms.canTransferirOrcamentista}
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
        canAtribuir={perms.canAtribuirOrcamentista}
      />

      {/* Modal confirmação — reenviar */}
      {confirmReenviar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="text-[14px] font-bold mb-1">Reenviar para análise</h3>
            <p className="text-[12px] text-gray-600 mb-4">
              A solicitação <strong>{confirmReenviar.numero}</strong> será reenviada ao Analista Crítico. Confirmar?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmReenviar(null)}
                className="px-3 py-1.5 text-[11px] border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => executarReenvio(confirmReenviar)}
                disabled={reenviandoId === confirmReenviar.id}
                className="px-3 py-1.5 text-[11px] bg-green-primary text-white rounded hover:bg-green-dark disabled:opacity-50"
              >
                {reenviandoId === confirmReenviar.id ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação — reativar */}
      {confirmReativar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="text-[14px] font-bold mb-1">Reativar solicitação</h3>
            <p className="text-[12px] text-gray-600 mb-4">
              A solicitação <strong>{confirmReativar.numero}</strong> será reativada e voltará ao status anterior ao cancelamento. Confirmar?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmReativar(null)}
                className="px-3 py-1.5 text-[11px] border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => executarReativacao(confirmReativar)}
                disabled={reativandoId === confirmReativar.id}
                className="px-3 py-1.5 text-[11px] bg-green-primary text-white rounded hover:bg-green-dark disabled:opacity-50"
              >
                {reativandoId === confirmReativar.id ? 'Reativando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
