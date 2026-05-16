'use client'

import { useCallback, useEffect, useState } from 'react'
import { FaturamentoContratoTable } from '@/components/tables/FaturamentoContratoTable'
import { NfRegistroTable } from '@/components/tables/NfRegistroTable'
import { PrevisaoRealizadoTable, type PrevisaoRealizadoItem } from '@/components/tables/PrevisaoRealizadoTable'
import { EditarNFModal } from '@/components/forms/EditarNFModal'
import { ContratoModal } from '@/components/forms/ContratoModal'
import { ConsolidadoMesModal } from '@/components/forms/ConsolidadoMesModal'
import { LancarNFContratoModal } from '@/components/forms/LancarNFContratoModal'
import { EditarSubIndiceModal } from '@/components/forms/EditarSubIndiceModal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import type { ContratoItem, SubIndiceItem, NFContratoListItem } from '@/types'

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type AcaoNF = { tipo: 'inativar' | 'excluir'; nf: NFContratoListItem }

type Aba = 'controle' | 'nfs' | 'previsao'

type ConsolidadoListItem = { id: number; mes: number; ano: number; created_at: string; qt_itens: number }

export default function FaturamentoPage() {
  const { canLancarNF, canGerirAcordos, isAdmin } = usePermissions()
  const canEditar = canGerirAcordos || isAdmin
  const canCriar = canGerirAcordos || isAdmin

  const anoAtual = new Date().getFullYear()
  const [aba, setAba] = useState<Aba>('controle')

  // ── Dados controle ────────────────────────────────────────────────────────────
  const [contratos, setContratos] = useState<ContratoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: number; nome: string }[]>([])

  // Filtros controle
  const [ano, setAno] = useState(String(anoAtual))
  const [clienteId, setClienteId] = useState('')
  const [status, setStatus] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [numAcordo, setNumAcordo] = useState('')

  // ── Dados NFs ─────────────────────────────────────────────────────────────────
  const [nfs, setNfs] = useState<NFContratoListItem[]>([])
  const [nfsLoading, setNfsLoading] = useState(false)
  const [nfsError, setNfsError] = useState<string | null>(null)

  // Ações NFs
  const [nfEditando, setNfEditando] = useState<NFContratoListItem | null>(null)
  const [nfAcao, setNfAcao]       = useState<AcaoNF | null>(null)
  const [nfMotivoInativ, setNfMotivoInativ] = useState('')
  const [nfAcaoError, setNfAcaoError]       = useState<string | null>(null)
  const [nfAcaoLoading, setNfAcaoLoading]   = useState(false)

  // Filtros NFs
  const [nfAno, setNfAno] = useState(String(anoAtual))
  const [nfClienteId, setNfClienteId] = useState('')
  const [nfAtiva, setNfAtiva] = useState('')
  const [nfBusca, setNfBusca] = useState('')

  // ── Dados Previsão x Realizado ────────────────────────────────────────────────
  const [modalConsolidado, setModalConsolidado] = useState(false)
  const [consolidadosDisponiveis, setConsolidadosDisponiveis] = useState<ConsolidadoListItem[]>([])
  const [consolidadoSelecionado, setConsolidadoSelecionado] = useState('')
  const [consolidadoData, setConsolidadoData] = useState<PrevisaoRealizadoItem[] | null>(null)
  const [previsaoLoading, setPrevisaoLoading] = useState(false)
  const [previsaoError, setPrevisaoError] = useState<string | null>(null)

  // ── Modais ────────────────────────────────────────────────────────────────────
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

  // ── Fetch contratos ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const params = new URLSearchParams()
      if (ano) params.set('ano', ano)
      if (clienteId) params.set('cliente_id', clienteId)
      if (status) params.set('status', status)
      if (responsavelId) params.set('responsavel_id', responsavelId)
      if (numAcordo) params.set('num_acordo', numAcordo)
      const res = await fetch(`/api/faturamento/contratos?${params.toString()}`)
      const text = await res.text()
      try {
        const json = JSON.parse(text)
        if (json.error) { setLoadError(json.error); return }
        setContratos(json.data ?? [])
      } catch {
        setLoadError(`Resposta inválida do servidor: ${text.substring(0, 200)}`)
      }
    } catch (err) {
      setLoadError(String(err))
    } finally {
      setLoading(false)
    }
  }, [ano, clienteId, status, responsavelId, numAcordo])

  // ── Fetch NFs ─────────────────────────────────────────────────────────────────
  const fetchNfs = useCallback(async () => {
    setNfsLoading(true); setNfsError(null)
    try {
      const params = new URLSearchParams()
      if (nfAno) params.set('ano', nfAno)
      if (nfClienteId) params.set('cliente_id', nfClienteId)
      if (nfAtiva !== '') params.set('ativa', nfAtiva)
      if (nfBusca) params.set('busca', nfBusca)
      const res = await fetch(`/api/faturamento/nfs?${params.toString()}`)
      const json = await res.json()
      if (json.error) { setNfsError(json.error); return }
      setNfs(json.data ?? [])
    } catch (err) {
      setNfsError(String(err))
    } finally {
      setNfsLoading(false)
    }
  }, [nfAno, nfClienteId, nfAtiva, nfBusca])

  const fetchConsolidados = useCallback(async () => {
    try {
      const res = await fetch('/api/faturamento/consolidados')
      const json = await res.json()
      setConsolidadosDisponiveis(json.data ?? [])
    } catch {
      setConsolidadosDisponiveis([])
    }
  }, [])

  const fetchConsolidadoDetalhe = useCallback(async (mesAno: string) => {
    if (!mesAno) { setConsolidadoData(null); return }
    const [mes, ano] = mesAno.split('-')
    setPrevisaoLoading(true); setPrevisaoError(null)
    try {
      const res = await fetch(`/api/faturamento/consolidados?mes=${mes}&ano=${ano}`)
      const json = await res.json()
      if (json.error) { setPrevisaoError(json.error); return }
      setConsolidadoData(json.data?.itens ?? null)
    } catch (err) {
      setPrevisaoError(String(err))
    } finally {
      setPrevisaoLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (aba === 'nfs') fetchNfs() }, [aba, fetchNfs])
  useEffect(() => { if (aba === 'previsao') fetchConsolidados() }, [aba, fetchConsolidados])
  useEffect(() => { fetchConsolidadoDetalhe(consolidadoSelecionado) }, [consolidadoSelecionado, fetchConsolidadoDetalhe])

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
  const anoFiltroNum = ano ? Number(ano) : null
  const temAnosSeguintes = contratos.some((c) =>
    c.subindices.some((s) => s.data_fim && new Date(s.data_fim).getUTCFullYear() > (anoFiltroNum ?? c.ano_referencia))
  )

  const handleNfAcaoConfirmar = async () => {
    if (!nfAcao) return
    setNfAcaoLoading(true); setNfAcaoError(null)
    try {
      if (nfAcao.tipo === 'excluir') {
        const res = await fetch(`/api/faturamento/nfs/${nfAcao.nf.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.error) { setNfAcaoError(json.error); return }
      } else {
        const toggleAtiva = !nfAcao.nf.ativa
        if (!toggleAtiva && (!nfMotivoInativ || nfMotivoInativ.trim().length < 3)) {
          setNfAcaoError('Informe o motivo da inativação (mínimo 3 caracteres)')
          return
        }
        const res = await fetch(`/api/faturamento/nfs/${nfAcao.nf.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativa: toggleAtiva, motivo_inativacao: nfMotivoInativ.trim() || undefined }),
        })
        const json = await res.json()
        if (json.error) { setNfAcaoError(json.error); return }
      }
      setNfAcao(null); setNfMotivoInativ('')
      fetchNfs()
    } finally {
      setNfAcaoLoading(false)
    }
  }

  const limparFiltros = () => {
    setAno(String(anoAtual)); setClienteId(''); setStatus(''); setResponsavelId(''); setNumAcordo('')
  }
  const limparFiltrosNf = () => {
    setNfAno(String(anoAtual)); setNfClienteId(''); setNfAtiva(''); setNfBusca('')
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────
  const tabBase = 'px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap'
  const tabAtivo = 'border-green-primary text-green-primary'
  const tabInativo = 'border-transparent text-gray-400 hover:text-gray-600'

  return (
    <div className="p-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold">Controle de Faturamento</h2>
        {canCriar && aba === 'controle' && (
          <div className="flex flex-col gap-1.5 items-end">
            <Button size="sm" onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>
            <button
              onClick={() => setModalConsolidado(true)}
              className="border border-green-primary text-green-primary rounded px-3 py-[5px] text-[11px] font-semibold cursor-pointer hover:bg-green-light transition-colors whitespace-nowrap"
            >
              Consolidado mês
            </button>
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-0 border-b border-gray-200 mb-4">
        <button className={`${tabBase} ${aba === 'controle' ? tabAtivo : tabInativo}`} onClick={() => setAba('controle')}>
          Controle de Faturamento
        </button>
        <button className={`${tabBase} ${aba === 'nfs' ? tabAtivo : tabInativo}`} onClick={() => setAba('nfs')}>
          Registro de NF
        </button>
        <button className={`${tabBase} ${aba === 'previsao' ? tabAtivo : tabInativo}`} onClick={() => setAba('previsao')}>
          Previsão x Realizado
        </button>
      </div>

      {/* ── ABA: Controle ─────────────────────────────────────────────────────── */}
      {aba === 'controle' && (
        <>
          <p className="text-[11px] text-gray-400 mb-3">
            Colunas fixas até Descrição / Evento. Role horizontalmente para ver colunas mensais. Coluna roxa = Prev. anos seguintes (RN-23).
          </p>

          <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
            <Field label="Ano referência" className="min-w-[110px]">
              <Select value={ano} onChange={(e) => setAno(e.target.value)}>
                <option value="">Todos os anos</option>
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
              <Input placeholder="AC-2024-001" value={numAcordo} onChange={(e) => setNumAcordo(e.target.value)} />
            </Field>
            <div className="flex-shrink-0">
              <button onClick={limparFiltros} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">
                ✕ Limpar
              </button>
            </div>
          </div>

          {!loading && (
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-gray-500">
                {totalContratos} contrato{totalContratos !== 1 ? 's' : ''} · {totalSubindices} sub-índice{totalSubindices !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {!loading && ano && temAnosSeguintes && (
            <div className="bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] text-[11px] px-3 py-2 rounded mb-2.5">
              ⚡ Alguns contratos possuem datas de fim além de {ano}. A coluna <strong>Prev. anos seg.</strong> indica esses itens (RN-23).
            </div>
          )}

          {loadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3 font-mono break-all">
              Erro ao carregar: {loadError}
            </div>
          )}
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : (
            <FaturamentoContratoTable
              contratos={contratos}
              anoFiltro={ano ? Number(ano) : undefined}
              onLancarNF={(contrato, subindice) => setModalLancarNF({ contrato, subindice })}
              onEditarSubindice={(contrato, subindice) => setModalEditarSub({ contrato, subindice })}
              onEditarContrato={setModalEditar}
              onCancelarContrato={setCancelando}
              canEditar={canEditar}
              canLancarNF={canLancarNF}
            />
          )}
        </>
      )}

      {/* ── ABA: Registro de NF ───────────────────────────────────────────────── */}
      {aba === 'nfs' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
            <Field label="Ano (emissão)" className="min-w-[110px]">
              <Select value={nfAno} onChange={(e) => setNfAno(e.target.value)}>
                <option value="">Todos os anos</option>
                {Array.from({ length: 8 }, (_, i) => anoAtual - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cliente" className="min-w-[160px] flex-1">
              <Select value={nfClienteId} onChange={(e) => setNfClienteId(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Status" className="min-w-[120px]">
              <Select value={nfAtiva} onChange={(e) => setNfAtiva(e.target.value)}>
                <option value="">Todas</option>
                <option value="true">Ativas</option>
                <option value="false">Inativas</option>
              </Select>
            </Field>
            <Field label="Nº NF" className="min-w-[140px]">
              <Input placeholder="Buscar NF..." value={nfBusca} onChange={(e) => setNfBusca(e.target.value)} />
            </Field>
            <div className="flex-shrink-0">
              <button onClick={limparFiltrosNf} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">
                ✕ Limpar
              </button>
            </div>
          </div>

          {nfsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3 font-mono break-all">
              Erro ao carregar: {nfsError}
            </div>
          )}
          {nfsLoading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : (
            <NfRegistroTable
              nfs={nfs}
              canEditar={canEditar}
              onEditar={setNfEditando}
              onInativar={(nf) => { setNfAcao({ tipo: 'inativar', nf }); setNfMotivoInativ(''); setNfAcaoError(null) }}
              onExcluir={(nf)  => { setNfAcao({ tipo: 'excluir',  nf }); setNfAcaoError(null) }}
            />
          )}
        </>
      )}

      {/* ── ABA: Previsão x Realizado ────────────────────────────────────────── */}
      {aba === 'previsao' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
            <Field label="Consolidado (mês/ano)" className="min-w-[240px]">
              <Select value={consolidadoSelecionado} onChange={(e) => setConsolidadoSelecionado(e.target.value)}>
                <option value="">Selecione um consolidado...</option>
                {consolidadosDisponiveis.map((c) => (
                  <option key={c.id} value={`${c.mes}-${c.ano}`}>
                    {MESES_NOMES[c.mes - 1]}/{c.ano} · {c.qt_itens} ite{c.qt_itens !== 1 ? 'ns' : 'm'}
                  </option>
                ))}
              </Select>
            </Field>
            {consolidadosDisponiveis.length === 0 && (
              <p className="text-[11px] text-gray-400 self-end pb-[5px]">
                Nenhum consolidado gerado ainda. Use o botão <strong>Consolidado mês</strong> na aba Controle.
              </p>
            )}
          </div>

          {previsaoError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
              Erro ao carregar: {previsaoError}
            </div>
          )}
          {previsaoLoading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : consolidadoData ? (
            <PrevisaoRealizadoTable itens={consolidadoData} />
          ) : !consolidadoSelecionado ? (
            <p className="text-center text-gray-400 py-12 text-sm">Selecione um mês consolidado para visualizar os dados.</p>
          ) : null}
        </>
      )}

      {/* ── Modais ────────────────────────────────────────────────────────────── */}
      <ConsolidadoMesModal
        open={modalConsolidado}
        onClose={() => setModalConsolidado(false)}
        onSuccess={() => {
          setModalConsolidado(false)
          fetchConsolidados()
          setAba('previsao')
        }}
      />

      <ContratoModal
        open={modalNovo || !!modalEditar}
        onClose={() => { setModalNovo(false); setModalEditar(null) }}
        onSuccess={fetchData}
        editando={modalEditar}
      />

      {modalLancarNF && (
        <LancarNFContratoModal
          open={true}
          onClose={() => setModalLancarNF(null)}
          onSuccess={fetchData}
          contrato={modalLancarNF.contrato}
          subindice={modalLancarNF.subindice}
        />
      )}

      {modalEditarSub && (
        <EditarSubIndiceModal
          open={true}
          onClose={() => setModalEditarSub(null)}
          onSuccess={fetchData}
          onDelete={fetchData}
          subindice={modalEditarSub.subindice}
          indiceLabel={`${modalEditarSub.contrato.indice}.${modalEditarSub.subindice.ordem}`}
          anoRef={modalEditarSub.contrato.ano_referencia}
        />
      )}

      {/* Modal editar NF */}
      {nfEditando && (
        <EditarNFModal
          open={true}
          onClose={() => setNfEditando(null)}
          onSuccess={() => { fetchNfs(); if (aba === 'controle') fetchData() }}
          nf={nfEditando}
        />
      )}

      {/* Dialog inativar / reativar / excluir NF */}
      {nfAcao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[440px] max-w-[96%] shadow-2xl">
            <div className={`px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg text-white ${
              nfAcao.tipo === 'excluir' ? 'bg-red-600' : nfAcao.nf.ativa ? 'bg-orange-500' : 'bg-blue-600'
            }`}>
              {nfAcao.tipo === 'excluir'
                ? `Excluir NF · ${nfAcao.nf.numero_nf}`
                : nfAcao.nf.ativa
                  ? `Inativar NF · ${nfAcao.nf.numero_nf}`
                  : `Reativar NF · ${nfAcao.nf.numero_nf}`}
            </div>
            <div className="p-[18px]">
              {nfAcaoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{nfAcaoError}</div>
              )}
              {nfAcao.tipo === 'excluir' && (
                <p className="text-[12px] text-gray-600">
                  A NF <strong>{nfAcao.nf.numero_nf}</strong> será excluída permanentemente e deixará de constar no controle e faturamento. Esta ação não pode ser desfeita.
                </p>
              )}
              {nfAcao.tipo === 'inativar' && nfAcao.nf.ativa && (
                <>
                  <p className="text-[12px] text-gray-600 mb-3">
                    A NF permanecerá no registro mas deixará de contabilizar no faturamento. Informe o motivo.
                  </p>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-orange-400/40"
                    rows={2}
                    placeholder="Motivo da inativação (mínimo 3 caracteres)"
                    value={nfMotivoInativ}
                    onChange={(e) => setNfMotivoInativ(e.target.value)}
                  />
                </>
              )}
              {nfAcao.tipo === 'inativar' && !nfAcao.nf.ativa && (
                <p className="text-[12px] text-gray-600">
                  A NF <strong>{nfAcao.nf.numero_nf}</strong> será reativada e voltará a contabilizar no faturamento.
                </p>
              )}
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => { setNfAcao(null); setNfMotivoInativ(''); setNfAcaoError(null) }}
                disabled={nfAcaoLoading}
              >
                Voltar
              </Button>
              <Button
                variant={nfAcao.tipo === 'excluir' ? 'danger' : 'primary'}
                onClick={handleNfAcaoConfirmar}
                disabled={nfAcaoLoading}
              >
                {nfAcaoLoading ? 'Aguarde...' : nfAcao.tipo === 'excluir' ? 'Confirmar exclusão' : nfAcao.nf.ativa ? 'Confirmar inativação' : 'Confirmar reativação'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
