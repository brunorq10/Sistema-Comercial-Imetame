'use client'

import { useCallback, useEffect, useState } from 'react'
import { PropostasTable } from '@/components/tables/PropostasTable'
import { EditarPropostaModal } from '@/components/forms/EditarPropostaModal'
import { HistoricoPropostaModal } from '@/components/forms/HistoricoPropostaModal'
import { usePermissions } from '@/hooks/usePermissions'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
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
  const { canRegistrarTecnica, canRegistrarComercial, canCancelSolicitacao } = usePermissions()
  const canEditar = canRegistrarTecnica || canRegistrarComercial

  const [items, setItems]     = useState<PropostasItem[]>([])
  const [loading, setLoading] = useState(true)

  // Opções de filtro (vindas da própria tabela de propostas)
  const [clientes,      setClientes]      = useState<{ id: number; nome: string }[]>([])
  const [orcamentistas, setOrcamentistas] = useState<{ id: number; nome: string }[]>([])
  const [numeros,       setNumeros]       = useState<string[]>([])
  const [cidades,       setCidades]       = useState<string[]>([])
  const [escopos,       setEscopos]       = useState<string[]>([])

  // Filtros — estados de edição (o que o usuário vê nos controles)
  const [numero,         setNumero]         = useState('')
  const [clienteId,      setClienteId]      = useState('')
  const [cidade,         setCidade]         = useState('')
  const [classificacao,  setClassificacao]  = useState('')
  const [orcamentistaId, setOrcamentistaId] = useState('')
  const [resultado,      setResultado]      = useState('')
  const [escopo,         setEscopo]         = useState('')

  // Filtros aplicados (o que fetchData realmente usa)
  type Aplicados = { numero: string; clienteId: string; cidade: string; classificacao: string; orcamentistaId: string; resultado: string; escopo: string }
  const [aplicados, setAplicados] = useState<Aplicados>({ numero: '', clienteId: '', cidade: '', classificacao: '', orcamentistaId: '', resultado: '', escopo: '' })

  const [modalEditar,    setModalEditar]    = useState<PropostasItem | null>(null)
  const [modalHistorico, setModalHistorico] = useState<PropostasItem | null>(null)

  useEffect(() => {
    fetch('/api/propostas?modo=filtros').then(r => r.json()).then(j => {
      if (j.data) {
        setClientes(j.data.clientes ?? [])
        setOrcamentistas(j.data.orcamentistas ?? [])
        setNumeros(j.data.numeros ?? [])
        setCidades(j.data.cidades ?? [])
        setEscopos(j.data.escopos ?? [])
      }
    })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (aplicados.numero)         params.set('numero', aplicados.numero)
      if (aplicados.clienteId)      params.set('cliente_id', aplicados.clienteId)
      if (aplicados.cidade)         params.set('cidade', aplicados.cidade)
      if (aplicados.classificacao)  params.set('classificacao', aplicados.classificacao)
      if (aplicados.orcamentistaId) params.set('orcamentista_id', aplicados.orcamentistaId)
      if (aplicados.resultado)      params.set('resultado', aplicados.resultado)
      if (aplicados.escopo)         params.set('escopo', aplicados.escopo)
      const res = await fetch(`/api/propostas?${params}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [aplicados])

  useEffect(() => { fetchData() }, [fetchData])

  const handleFiltrar = () =>
    setAplicados({ numero, clienteId, cidade, classificacao, orcamentistaId, resultado, escopo })

  const limpar = () => {
    setNumero(''); setClienteId(''); setCidade('')
    setClassificacao(''); setOrcamentistaId('')
    setResultado(''); setEscopo('')
    setAplicados({ numero: '', clienteId: '', cidade: '', classificacao: '', orcamentistaId: '', resultado: '', escopo: '' })
  }

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Propostas</h2>
        <span className="text-[11px] text-gray-400">
          {items.length} proposta{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 mb-3 flex gap-1.5 items-end">

        <div className="flex-1 min-w-0">
          <label className={fLbl}>Nº Proposta</label>
          <SearchableSelect
            value={numero}
            onChange={setNumero}
            options={numeros.map(n => ({ value: n, label: n }))}
            emptyLabel="Todas"
          />
        </div>

        <div className="flex-[2] min-w-0">
          <label className={fLbl}>Cliente</label>
          <SearchableSelect
            value={clienteId}
            onChange={setClienteId}
            options={clientes.map(c => ({ value: String(c.id), label: c.nome }))}
          />
        </div>

        <div className="flex-1 min-w-0">
          <label className={fLbl}>Cidade/UF</label>
          <SearchableSelect
            value={cidade}
            onChange={setCidade}
            options={cidades.map(c => ({ value: c, label: c }))}
            emptyLabel="Todas"
          />
        </div>

        <div className="flex-1 min-w-0">
          <label className={fLbl}>Classificação</label>
          <SearchableSelect
            value={classificacao}
            onChange={setClassificacao}
            options={opClassificacao}
            emptyLabel="Todas"
          />
        </div>

        <div className="flex-1 min-w-0">
          <label className={fLbl}>Orçamentista</label>
          <SearchableSelect
            value={orcamentistaId}
            onChange={setOrcamentistaId}
            options={orcamentistas.map(o => ({ value: String(o.id), label: o.nome }))}
          />
        </div>

        <div className="flex-1 min-w-0">
          <label className={fLbl}>Resultado</label>
          <SearchableSelect
            value={resultado}
            onChange={setResultado}
            options={opResultado}
          />
        </div>

        <div className="flex-[2] min-w-0">
          <label className={fLbl}>Escopo</label>
          <SearchableSelect
            value={escopo}
            onChange={setEscopo}
            options={escopos.map(e => ({ value: e, label: e }))}
            placeholder="Digite para filtrar…"
          />
        </div>

        <div className="flex-shrink-0 flex items-end gap-1">
          <button onClick={handleFiltrar}
            className="bg-green-primary text-white border-none rounded px-2.5 py-[5px] text-[11px] font-semibold cursor-pointer hover:bg-green-dark transition-colors whitespace-nowrap">
            Filtrar
          </button>
          <button onClick={limpar}
            className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────── */}
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

      {modalHistorico && (
        <HistoricoPropostaModal
          open={true}
          item={modalHistorico}
          onClose={() => setModalHistorico(null)}
        />
      )}

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
