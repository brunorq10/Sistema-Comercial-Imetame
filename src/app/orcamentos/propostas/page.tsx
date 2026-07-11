'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { formatDate } from '@/lib/utils'
import { Pagination } from '@/components/ui/Pagination'
import { PropostasTable } from '@/components/tables/PropostasTable'
import { EditarPropostaModal } from '@/components/forms/EditarPropostaModal'
import { HistoricoFaturamentoModal } from '@/components/forms/HistoricoFaturamentoModal'
import { RelatorioOSModal } from '@/components/forms/RelatorioOSModal'
import { usePermissions } from '@/hooks/usePermissions'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { filtrarOpcoes, type LinhaCascata } from '@/lib/cascata'
import type { PropostasItem } from '@/types'

const opClassificacao = [
  { value: 'OBRAS',       label: 'Obras' },
  { value: 'PARADAS',     label: 'Paradas' },
  { value: 'OLEO_GAS',    label: 'Óleo e Gás' },
  { value: 'FABRICACOES', label: 'Fabricações' },
]
const opResultado = [
  { value: 'AGUARDANDO', label: 'Aguardando' },
  { value: 'GANHOU',     label: 'Ganhou' },
  { value: 'PERDEU',     label: 'Perdeu' },
]

export default function PropostasPage() {
  const router = useRouter()
  const { canRegistrarTecnica, canRegistrarComercial, canCancelSolicitacao } = usePermissions()
  const canEditar = canRegistrarTecnica || canRegistrarComercial

  const [items, setItems]     = useState<PropostasItem[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [pages, setPages]     = useState(1)
  const [loading, setLoading] = useState(true)

  const [clientes,      setClientes]      = useState<{ id: number; nome: string }[]>([])
  const [orcamentistas, setOrcamentistas] = useState<{ id: number; nome: string }[]>([])
  const [numeros,       setNumeros]       = useState<string[]>([])
  const [cidades,       setCidades]       = useState<string[]>([])
  const [escopos,       setEscopos]       = useState<string[]>([])
  const [linhasFiltro,  setLinhasFiltro]  = useState<LinhaCascata[]>([])

  // Filtros de edição — todos multi-select
  const [numero,          setNumero]          = useState<string[]>([])
  const [clienteIds,      setClienteIds]      = useState<string[]>([])
  const [cidade,          setCidade]          = useState<string[]>([])
  const [classificacoes,  setClassificacoes]  = useState<string[]>([])
  const [orcamentistaIds, setOrcamentistaIds] = useState<string[]>([])
  const [resultados,      setResultados]      = useState<string[]>([])
  const [escopo,          setEscopo]          = useState<string[]>([])

  type Aplicados = {
    numero: string[]; clienteIds: string[]; cidade: string[]
    classificacoes: string[]; orcamentistaIds: string[]; resultados: string[]; escopo: string[]
  }
  const [aplicados, setAplicados] = useState<Aplicados>({
    numero: [], clienteIds: [], cidade: [], classificacoes: [], orcamentistaIds: [], resultados: [], escopo: [],
  })

  const [modalEditar, setModalEditar] = useState<PropostasItem | null>(null)
  const [modalHistAlteracoes, setModalHistAlteracoes] = useState<PropostasItem | null>(null)
  const [modalOS, setModalOS] = useState<PropostasItem | null>(null)
  const [confirmReativar, setConfirmReativar] = useState<PropostasItem | null>(null)
  const [reativarLoading, setReativarLoading] = useState(false)
  const [reativarError, setReativarError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/propostas?modo=filtros').then(r => r.json()).then(j => {
      if (j.data) {
        setClientes(j.data.clientes ?? [])
        setOrcamentistas(j.data.orcamentistas ?? [])
        setNumeros(j.data.numeros ?? [])
        setCidades(j.data.cidades ?? [])
        setEscopos(j.data.escopos ?? [])
        setLinhasFiltro(j.data.linhas ?? [])
      }
    })
  }, [])

  // Filtros em cascata: opções de cada filtro refletem as seleções dos demais
  const selecoes = useMemo(() => ({
    numero, cliente_id: clienteIds, cidade, classificacao: classificacoes,
    orcamentista_id: orcamentistaIds, resultado: resultados, escopo,
  }), [numero, clienteIds, cidade, classificacoes, orcamentistaIds, resultados, escopo])

  const opNumero = useMemo(() =>
    filtrarOpcoes(numeros.map(n => ({ value: n, label: n })), linhasFiltro, selecoes, 'numero'),
    [numeros, linhasFiltro, selecoes])
  const opCliente = useMemo(() =>
    filtrarOpcoes(clientes.map(c => ({ value: String(c.id), label: c.nome })), linhasFiltro, selecoes, 'cliente_id'),
    [clientes, linhasFiltro, selecoes])
  const opCidade = useMemo(() =>
    filtrarOpcoes(cidades.map(c => ({ value: c, label: c })), linhasFiltro, selecoes, 'cidade'),
    [cidades, linhasFiltro, selecoes])
  const opClassif = useMemo(() =>
    filtrarOpcoes(opClassificacao, linhasFiltro, selecoes, 'classificacao'),
    [linhasFiltro, selecoes])
  const opOrcamentista = useMemo(() =>
    filtrarOpcoes(orcamentistas.map(o => ({ value: String(o.id), label: o.nome })), linhasFiltro, selecoes, 'orcamentista_id'),
    [orcamentistas, linhasFiltro, selecoes])
  const opRes = useMemo(() =>
    filtrarOpcoes(opResultado, linhasFiltro, selecoes, 'resultado'),
    [linhasFiltro, selecoes])
  const opEscopo = useMemo(() =>
    filtrarOpcoes(escopos.map(e => ({ value: e, label: e })), linhasFiltro, selecoes, 'escopo'),
    [escopos, linhasFiltro, selecoes])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      aplicados.numero.forEach(n => params.append('numero', n))
      aplicados.cidade.forEach(c => params.append('cidade', c))
      aplicados.escopo.forEach(e => params.append('escopo', e))
      aplicados.clienteIds.forEach(id  => params.append('cliente_id', id))
      aplicados.orcamentistaIds.forEach(id => params.append('orcamentista_id', id))
      aplicados.classificacoes.forEach(c => params.append('classificacao', c))
      aplicados.resultados.forEach(r   => params.append('resultado', r))
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await fetch(`/api/propostas?${params}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setTotal(json.total ?? 0)
      setPages(json.pages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [aplicados, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleFiltrar = () => {
    setAplicados({ numero, clienteIds, cidade, classificacoes, orcamentistaIds, resultados, escopo })
    setPage(1)
  }

  const limpar = () => {
    setNumero([]); setClienteIds([]); setCidade([])
    setClassificacoes([]); setOrcamentistaIds([])
    setResultados([]); setEscopo([])
    setAplicados({ numero: [], clienteIds: [], cidade: [], classificacoes: [], orcamentistaIds: [], resultados: [], escopo: [] })
    setPage(1)
  }

  // Reativa a proposta: suspensa → reativa a solicitação; cancelada (legado) → limpa o cancelamento
  const executarReativacao = async (item: PropostasItem) => {
    setReativarLoading(true); setReativarError(null)
    try {
      const res = item.suspensa && !item.proposta_cancelada_at
        ? await fetch(`/api/solicitacoes/${item.id}/reativar`, { method: 'POST' })
        : await fetch(`/api/propostas/${item.id}/cancelar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao: 'reativar' }),
          })
      const json = await res.json()
      if (!res.ok || json.error) { setReativarError(json.error ?? 'Erro ao reativar proposta'); return }
      setConfirmReativar(null)
      fetchData()
    } finally { setReativarLoading(false) }
  }

  const exportarExcel = () => {
    const rows = items.map((p) => ({
      'Número': p.numero,
      'Data Criação': formatDate(p.created_at),
      'Cliente': p.cliente.nome,
      'Cliente Final': p.cliente_final?.nome ?? '',
      'Cidade/UF': [p.cidade, p.estado].filter(Boolean).join(' / '),
      'Escopo': p.escopo ?? '',
      'Classificação': p.classificacao ?? '',
      'Interesse': p.interesse ?? '',
      'Orçamentista': p.orcamentista?.nome ?? '',
      'Versão Técnica': p.versao_tecnica != null ? p.versao_tecnica - 1 : '',
      'HH Total': p.hh_total ?? '',
      'Versão Comercial': p.versao_comercial != null ? p.versao_comercial - 1 : '',
      'Valor Total (R$)': p.valor_total ?? '',
      'Resultado': p.resultado ?? '',
      'Status': p.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Propostas')
    XLSX.writeFile(wb, `propostas_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <PageHeader
          title="Propostas"
          actions={
            <>
              <span className="text-[11px] text-gray-400">{items.length} proposta{items.length !== 1 ? 's' : ''}</span>
              {!loading && items.length > 0 && (
                <Button size="sm" variant="outline" onClick={exportarExcel}>Exportar Excel</Button>
              )}
            </>
          }
        />

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 flex flex-wrap gap-1.5 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className={fLbl}>Nº Proposta</label>
            <SearchableMultiSelect values={numero} onChange={setNumero}
              options={opNumero} emptyLabel="Todas" />
          </div>
          <div className="flex-[2] min-w-[160px]">
            <label className={fLbl}>Cliente</label>
            <SearchableMultiSelect values={clienteIds} onChange={setClienteIds}
              options={opCliente} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className={fLbl}>Cidade/UF</label>
            <SearchableMultiSelect values={cidade} onChange={setCidade}
              options={opCidade} emptyLabel="Todas" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className={fLbl}>Classificação</label>
            <SearchableMultiSelect values={classificacoes} onChange={setClassificacoes}
              options={opClassif} emptyLabel="Todas" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className={fLbl}>Orçamentista</label>
            <SearchableMultiSelect values={orcamentistaIds} onChange={setOrcamentistaIds}
              options={opOrcamentista} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className={fLbl}>Resultado</label>
            <SearchableMultiSelect values={resultados} onChange={setResultados}
              options={opRes} />
          </div>
          <div className="flex-[2] min-w-[160px]">
            <label className={fLbl}>Escopo</label>
            <SearchableMultiSelect values={escopo} onChange={setEscopo}
              options={opEscopo} placeholder="Digite para filtrar…" />
          </div>
          <div className="flex-shrink-0 flex items-end gap-1">
            <Button size="sm" onClick={handleFiltrar}>Filtrar</Button>
            <button onClick={limpar}
              className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <PropostasTable
                data={items}
                onEditar={setModalEditar}
                onHistorico={(item) => router.push(`/orcamentos/propostas/${item.id}/historico`)}
                onHistoricoAlteracoes={setModalHistAlteracoes}
                onRelatorioOS={setModalOS}
                onReativar={canCancelSolicitacao ? (item) => { setReativarError(null); setConfirmReativar(item) } : undefined}
                canEditar={canEditar}
              />
            </div>
            <Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} />
          </>
        )}
      </div>

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

      {modalOS && (
        <RelatorioOSModal
          open
          onClose={() => setModalOS(null)}
          onSuccess={fetchData}
          solicitacaoId={modalOS.id}
          numero={modalOS.numero}
        />
      )}

      {confirmReativar && (
        <ConfirmDialog
          open
          title={`Reativar proposta · ${confirmReativar.numero}`}
          message={confirmReativar.suspensa && !confirmReativar.proposta_cancelada_at
            ? <>A proposta <strong>{confirmReativar.numero}</strong> está suspensa. Ao reativar, a solicitação volta ao andamento normal e a proposta deixa de aparecer como suspensa. Confirmar?</>
            : <>A proposta <strong>{confirmReativar.numero}</strong> está cancelada. Ao reativar, ela volta a valer normalmente. Confirmar?</>}
          variant="success"
          confirmLabel="Reativar"
          loading={reativarLoading}
          error={reativarError}
          onConfirm={() => executarReativacao(confirmReativar)}
          onClose={() => setConfirmReativar(null)}
        />
      )}

      {modalHistAlteracoes && (
        <HistoricoFaturamentoModal
          open={true}
          onClose={() => setModalHistAlteracoes(null)}
          tipo="proposta"
          itemId={modalHistAlteracoes.id}
          titulo={modalHistAlteracoes.numero}
        />
      )}
    </div>
  )
}
