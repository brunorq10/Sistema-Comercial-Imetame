'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { FaturamentoContratoTable } from '@/components/tables/FaturamentoContratoTable'
import { NfRegistroTable } from '@/components/tables/NfRegistroTable'
import { EditarNFModal } from '@/components/forms/EditarNFModal'
import { ContratoModal } from '@/components/forms/ContratoModal'
import { ConsolidadoMesModal } from '@/components/forms/ConsolidadoMesModal'
import { LancarNFContratoModal } from '@/components/forms/LancarNFContratoModal'
import { EditarSubIndiceModal } from '@/components/forms/EditarSubIndiceModal'
import { HistoricoFaturamentoModal } from '@/components/forms/HistoricoFaturamentoModal'
import { ComentarioSubindiceModal } from '@/components/forms/ComentarioSubindiceModal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import type { ContratoItem, SubIndiceItem, NFContratoListItem, PrevisaoAlteracaoItem } from '@/types'

type AcaoNF = { tipo: 'inativar' | 'excluir'; nf: NFContratoListItem }
type Aba = 'controle' | 'nfs' | 'aprovacoes'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']


export default function FaturamentoPage() {
  const router = useRouter()
  const { canLancarNF: _canLancarNF, canGerirAcordos, isAdmin, isLoading: sessionLoading } = usePermissions()
  // Keep last known permissions during session reload to prevent button flicker
  const canEditarRef   = useRef(false)
  const canLancarNFRef = useRef(false)
  if (!sessionLoading) {
    canEditarRef.current   = canGerirAcordos || isAdmin
    canLancarNFRef.current = _canLancarNF
  }
  const canEditar   = canEditarRef.current
  const canLancarNF = canLancarNFRef.current
  const canCriar    = canEditar

  const anoAtual = new Date().getFullYear()
  const [aba, setAba] = useState<Aba>('controle')

  // ── Dados controle ────────────────────────────────────────────────────────────
  const [contratos, setContratos] = useState<ContratoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Opções de filtro (populadas a partir dos contratos existentes)
  const [clientes,     setClientes]     = useState<{ id: number; nome: string }[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: number; nome: string }[]>([])
  const [opcoesMercado,  setOpcoesMercado]  = useState<string[]>([])
  const [opcoesOs,       setOpcoesOs]       = useState<string[]>([])
  const [opcoesAcordo,   setOpcoesAcordo]   = useState<string[]>([])
  const [opcoesProposta, setOpcoesProposta] = useState<string[]>([])

  // Filtros controle
  const [ano,          setAno]          = useState(String(anoAtual))
  const [clienteId,    setClienteId]    = useState('')
  const [mercado,      setMercado]      = useState('')
  const [status,       setStatus]       = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [numOs,        setNumOs]        = useState('')
  const [numAcordo,    setNumAcordo]    = useState('')
  const [numProposta,  setNumProposta]  = useState('')

  // ── Dados NFs ─────────────────────────────────────────────────────────────────
  const [nfs, setNfs] = useState<NFContratoListItem[]>([])
  const [nfsLoading, setNfsLoading] = useState(false)
  const [nfsError, setNfsError] = useState<string | null>(null)

  // Ações NFs
  const [nfEditando, setNfEditando] = useState<NFContratoListItem | null>(null)
  const [nfAcao, setNfAcao]             = useState<AcaoNF | null>(null)
  const [nfMotivoInativ, setNfMotivoInativ] = useState('')
  const [nfAcaoError, setNfAcaoError]       = useState<string | null>(null)
  const [nfAcaoLoading, setNfAcaoLoading]   = useState(false)

  // Filtros NFs
  const [nfAno, setNfAno] = useState(String(anoAtual))
  const [nfClienteId, setNfClienteId] = useState('')
  const [nfAtiva, setNfAtiva] = useState('')
  const [nfBusca, setNfBusca] = useState('')

  // ── Aprovações ────────────────────────────────────────────────────────────────
  const [alteracoes, setAlteracoes] = useState<PrevisaoAlteracaoItem[]>([])
  const [alteracoesLoading, setAlteracoesLoading] = useState(false)
  const [alteracoesError, setAlteracoesError] = useState<string | null>(null)
  const [historico, setHistorico] = useState<PrevisaoAlteracaoItem[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [reprovarModal, setReprovarModal] = useState<PrevisaoAlteracaoItem | null>(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [reprovarLoading, setReprovarLoading] = useState(false)
  const [reprovarError, setReprovarError] = useState<string | null>(null)

  // ── Modais ────────────────────────────────────────────────────────────────────
  const [modalConsolidado, setModalConsolidado] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState<ContratoItem | null>(null)
  const [modalLancarNF, setModalLancarNF] = useState<{ contrato: ContratoItem; subindice: SubIndiceItem } | null>(null)
  const [modalEditarSub, setModalEditarSub] = useState<{ contrato: ContratoItem; subindice: SubIndiceItem } | null>(null)
  const [cancelando, setCancelando] = useState<ContratoItem | null>(null)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [modalHistorico, setModalHistorico] = useState<{ tipo: 'subindice' | 'contrato'; id: number; titulo: string } | null>(null)
  const [modalComentario, setModalComentario] = useState<SubIndiceItem | null>(null)
  const [excluindoSub, setExcluindoSub] = useState<SubIndiceItem | null>(null)
  const [excluirSubError, setExcluirSubError] = useState<string | null>(null)
  const [excluirSubLoading, setExcluirSubLoading] = useState(false)

  useEffect(() => {
    fetch('/api/faturamento/filtros').then((r) => r.json()).then((j) => {
      if (j.data) {
        setClientes(j.data.clientes ?? [])
        setResponsaveis(j.data.responsaveis ?? [])
        setOpcoesMercado(j.data.mercados ?? [])
        setOpcoesOs(j.data.num_os ?? [])
        setOpcoesAcordo(j.data.num_acordos ?? [])
        setOpcoesProposta(j.data.num_propostas ?? [])
      }
    })
  }, [])

  // ── Fetch contratos ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const params = new URLSearchParams()
      if (ano) params.set('ano', ano)
      if (clienteId) params.set('cliente_id', clienteId)
      if (mercado) params.set('mercado', mercado)
      if (status) params.set('status', status)
      if (responsavelId) params.set('responsavel_id', responsavelId)
      if (numOs) params.set('num_os', numOs)
      if (numAcordo) params.set('num_acordo', numAcordo)
      if (numProposta) params.set('num_proposta', numProposta)
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
  }, [ano, clienteId, mercado, status, responsavelId, numOs, numAcordo, numProposta])

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

  // ── Fetch aprovações ──────────────────────────────────────────────────────────
  const fetchAlteracoes = useCallback(async () => {
    if (!canEditar) return
    setAlteracoesLoading(true); setAlteracoesError(null)
    try {
      const [resPend, resHist] = await Promise.all([
        fetch('/api/faturamento/alteracoes?status=PENDENTE'),
        fetch('/api/faturamento/alteracoes?history=true'),
      ])
      const [jsonPend, jsonHist] = await Promise.all([resPend.json(), resHist.json()])
      if (jsonPend.error) { setAlteracoesError(jsonPend.error); return }
      setAlteracoes(jsonPend.data ?? [])
      setHistorico(jsonHist.data ?? [])
    } catch (err) {
      setAlteracoesError(String(err))
    } finally {
      setAlteracoesLoading(false)
      setHistoricoLoading(false)
    }
  }, [canEditar])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (aba === 'nfs') fetchNfs() }, [aba, fetchNfs])
  useEffect(() => { if (aba === 'aprovacoes') { setHistoricoLoading(true); fetchAlteracoes() } }, [aba, fetchAlteracoes])

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

  const handleExcluirSubindiceConfirmar = async () => {
    if (!excluindoSub) return
    setExcluirSubLoading(true); setExcluirSubError(null)
    try {
      const res = await fetch(`/api/faturamento/subindices/${excluindoSub.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) { setExcluirSubError(json.error); return }
      setExcluindoSub(null)
      fetchData()
    } finally {
      setExcluirSubLoading(false)
    }
  }

  const handleAprovar = async (id: number) => {
    try {
      const res = await fetch(`/api/faturamento/alteracoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'APROVAR' }),
      })
      const json = await res.json()
      if (json.error) { setAlteracoesError(json.error); return }
      fetchAlteracoes()
      fetchData()
    } catch (err) {
      setAlteracoesError(String(err))
    }
  }

  const handleReprovarConfirmar = async () => {
    if (!reprovarModal) return
    if (!motivoRecusa || motivoRecusa.trim().length < 3) {
      setReprovarError('Informe o motivo da reprovação (mínimo 3 caracteres)')
      return
    }
    setReprovarLoading(true); setReprovarError(null)
    try {
      const res = await fetch(`/api/faturamento/alteracoes/${reprovarModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'REPROVAR', motivo_recusa: motivoRecusa }),
      })
      const json = await res.json()
      if (json.error) { setReprovarError(json.error); return }
      setReprovarModal(null); setMotivoRecusa('')
      fetchAlteracoes()
    } finally {
      setReprovarLoading(false)
    }
  }

  const MERCADO_LABELS: Record<string, string> = {
    PAPEL_CELULOSE: 'Papel e Celulose',
    SIDERURGIA:     'Siderurgia',
    MINERACAO:      'Mineração',
    OLEO_GAS:       'Óleo e Gás',
    OUTROS:         'Outros',
  }

  const limparFiltros = () => {
    setAno(String(anoAtual)); setClienteId(''); setMercado(''); setStatus(''); setResponsavelId('')
    setNumOs(''); setNumAcordo(''); setNumProposta('')
  }
  const limparFiltrosNf = () => {
    setNfAno(String(anoAtual)); setNfClienteId(''); setNfAtiva(''); setNfBusca('')
  }

  const totalContratos  = contratos.length
  const totalSubindices = contratos.reduce((a, c) => a + c.subindices.length, 0)
  const anoFiltroNum    = ano ? Number(ano) : null
  const temAnosSeguintes = contratos.some((c) =>
    c.subindices.some((s) => s.data_fim && new Date(s.data_fim).getUTCFullYear() > (anoFiltroNum ?? c.ano_referencia))
  )

  // RN-CF-27: exportar planilha Excel com dados filtrados
  const exportarExcel = () => {
    const mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const mesKeys = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

    const cabecalho = [
      'Índice', 'Cliente', 'Descrição', 'Responsável', 'Status', 'Ano', 'Nº OS', 'Nº Acordo', 'Nº Proposta',
      'Valor Contrato', 'Vlr. Total Sub-índice', 'Faturado', 'Saldo',
      ...mesesLabels.flatMap((m) => [`P ${m}`, `F ${m}`]),
    ]

    const linhas: (string | number | null)[][] = [cabecalho]

    for (const ct of contratos) {
      const anoNum = anoFiltroNum ?? ct.ano_referencia
      // Linha macro (contrato)
      const ctVlrFat = ct.subindices.reduce((a, s) =>
        a + s.notas_fiscais.filter((nf) => nf.ativa).reduce((b, nf) => b + nf.valor_atribuido, 0), 0)
      const ctMesesRow: (number | null)[] = []
      for (const mk of mesKeys) {
        const prev = ct.subindices.reduce((a, s) => a + (s[mk] ?? 0), 0)
        const mesIdx = mesKeys.indexOf(mk)
        const fat = ct.subindices.reduce((a, s) =>
          a + s.notas_fiscais.filter((nf) => nf.ativa)
            .filter((nf) => { const d = new Date(nf.data_emissao); return d.getFullYear() === anoNum && d.getMonth() === mesIdx })
            .reduce((b, nf) => b + nf.valor_atribuido, 0), 0)
        ctMesesRow.push(prev || null)
        ctMesesRow.push(fat || null)
      }
      linhas.push([
        ct.indice,
        ct.cliente.nome,
        ct.descricao ?? '',
        ct.responsavel?.nome ?? '',
        ct.status,
        ct.ano_referencia,
        ct.num_os ?? '',
        ct.num_acordo ?? '',
        ct.num_proposta ?? '',
        ct.valor_contrato ?? '',
        ct.valor_contrato ?? '',
        ctVlrFat,
        (ct.valor_contrato ?? 0) - ctVlrFat,
        ...ctMesesRow,
      ])

      for (const sub of ct.subindices) {
        const mesesRow: (number | null)[] = []
        for (const mk of mesKeys) {
          mesesRow.push(sub[mk] ?? null)
          const mesIdx = mesKeys.indexOf(mk)
          const fat = sub.notas_fiscais
            .filter((nf) => nf.ativa)
            .filter((nf) => { const d = new Date(nf.data_emissao); return d.getFullYear() === anoNum && d.getMonth() === mesIdx })
            .reduce((acc, nf) => acc + nf.valor_atribuido, 0)
          mesesRow.push(fat || null)
        }
        linhas.push([
          `  ${ct.indice}.${sub.ordem}`,
          ct.cliente.nome,
          sub.descricao,
          ct.responsavel?.nome ?? '',
          sub.status_faturamento,
          ct.ano_referencia,
          sub.num_os ?? '',
          ct.num_acordo ?? '',
          ct.num_proposta ?? '',
          ct.valor_contrato ?? '',
          sub.valor_total,
          sub.total_faturado,
          sub.valor_total - sub.total_faturado,
          ...mesesRow,
        ])
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Faturamento')
    XLSX.writeFile(wb, `faturamento_${ano || 'todos'}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const fLbl    = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'
  const tabBase = 'px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap'
  const tabAtivo  = 'border-green-primary text-green-primary'
  const tabInativo = 'border-transparent text-gray-400 hover:text-gray-600'

  return (
    <div className="flex flex-col h-full">
      {/* ── Zona congelada ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold">Controle de Faturamento</h2>
        {aba === 'controle' && (
          <div className="flex gap-2">
            {!loading && contratos.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportarExcel}>Exportar Excel</Button>
            )}
            {canCriar && (
              <>
                <Button size="sm" onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>
                <Button size="sm" onClick={() => setModalConsolidado(true)}>Consolidado mês</Button>
              </>
            )}
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
        {canEditar && (
          <button className={`${tabBase} ${aba === 'aprovacoes' ? tabAtivo : tabInativo}`} onClick={() => setAba('aprovacoes')}>
            Aprovações
            {alteracoes.length > 0 && aba !== 'aprovacoes' && (
              <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {alteracoes.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── filtros por aba (zona congelada) ─────────────────────────────────── */}
      {aba === 'controle' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 mt-1 flex flex-wrap gap-1.5 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Ano referência</label>
              <SearchableSelect
                value={ano}
                onChange={setAno}
                options={Array.from({ length: 8 }, (_, i) => anoAtual - 2 + i).map((y) => ({ value: String(y), label: String(y) }))}
                emptyLabel="Todos os anos"
              />
            </div>
            <div className="flex-[2] min-w-[160px]">
              <label className={fLbl}>Cliente</label>
              <SearchableSelect
                value={clienteId}
                onChange={setClienteId}
                options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Mercado</label>
              <SearchableSelect
                value={mercado}
                onChange={setMercado}
                options={opcoesMercado.map((m) => ({ value: m, label: MERCADO_LABELS[m] ?? m }))}
                emptyLabel="Todos"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Nº OS</label>
              <SearchableSelect
                value={numOs}
                onChange={setNumOs}
                options={opcoesOs.map((v) => ({ value: v, label: v }))}
                emptyLabel="Todas"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Nº Acordo</label>
              <SearchableSelect
                value={numAcordo}
                onChange={setNumAcordo}
                options={opcoesAcordo.map((v) => ({ value: v, label: v }))}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Nº Proposta</label>
              <SearchableSelect
                value={numProposta}
                onChange={setNumProposta}
                options={opcoesProposta.map((v) => ({ value: v, label: v }))}
                emptyLabel="Todas"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Status</label>
              <SearchableSelect
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'A_FATURAR', label: 'A faturar' },
                  { value: 'PARCIAL',   label: 'Parcial' },
                  { value: 'FATURADO',  label: 'Faturado' },
                  { value: 'CANCELADO', label: 'Cancelado' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={fLbl}>Responsável</label>
              <SearchableSelect
                value={responsavelId}
                onChange={setResponsavelId}
                options={responsaveis.map((u) => ({ value: String(u.id), label: u.nome }))}
              />
            </div>
            <div className="flex-shrink-0 flex items-end">
              <button onClick={limparFiltros} className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">
                ✕
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

        </>
      )}

      {/* filtro NFs (zona congelada) */}
      {aba === 'nfs' && (
        <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mt-1 flex flex-wrap gap-2.5 items-end">
          <Field label="Ano (emissão)" className="min-w-[110px]">
            <SearchableSelect
              value={nfAno}
              onChange={setNfAno}
              options={Array.from({ length: 8 }, (_, i) => anoAtual - 2 + i).map((y) => ({ value: String(y), label: String(y) }))}
              emptyLabel="Todos os anos"
            />
          </Field>
          <Field label="Cliente" className="min-w-[160px] flex-1">
            <SearchableSelect
              value={nfClienteId}
              onChange={setNfClienteId}
              options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))}
            />
          </Field>
          <Field label="Status" className="min-w-[120px]">
            <SearchableSelect
              value={nfAtiva}
              onChange={setNfAtiva}
              options={[
                { value: 'true',  label: 'Ativas' },
                { value: 'false', label: 'Inativas' },
              ]}
              emptyLabel="Todas"
            />
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
      )}
      </div>{/* fim zona congelada */}

      {/* ── Zona de scroll ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
        {aba === 'controle' && (
          <>
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
                onExcluirSubindice={(sub) => { setExcluindoSub(sub); setExcluirSubError(null) }}
                onHistoricoSubindice={(sub) => setModalHistorico({ tipo: 'subindice', id: sub.id, titulo: sub.descricao })}
                onHistoricoContrato={(c) => setModalHistorico({ tipo: 'contrato', id: c.id, titulo: c.indice })}
                onComentario={setModalComentario}
                canEditar={canEditar}
                canLancarNF={canLancarNF}
              />
            )}
          </>
        )}

        {aba === 'nfs' && (
          <>
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

        {aba === 'aprovacoes' && canEditar && (
          <AbaAprovacoes
            alteracoes={alteracoes}
            historico={historico}
            loading={alteracoesLoading}
            historicoLoading={historicoLoading}
            error={alteracoesError}
            onAprovar={handleAprovar}
            onReprovar={(a) => { setReprovarModal(a); setMotivoRecusa(''); setReprovarError(null) }}
          />
        )}
      </div>{/* fim zona de scroll */}

      {/* ── Modais ────────────────────────────────────────────────────────────── */}
      <ConsolidadoMesModal
        open={modalConsolidado}
        onClose={() => setModalConsolidado(false)}
        onSuccess={() => router.push('/acordos/previsao')}
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

      {nfEditando && (
        <EditarNFModal
          open={true}
          onClose={() => setNfEditando(null)}
          onSuccess={() => { fetchNfs(); if (aba === 'controle') fetchData() }}
          nf={nfEditando}
        />
      )}

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
                  A NF <strong>{nfAcao.nf.numero_nf}</strong> será excluída permanentemente. Esta ação não pode ser desfeita.
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
              <Button variant="outline" onClick={() => { setNfAcao(null); setNfMotivoInativ(''); setNfAcaoError(null) }} disabled={nfAcaoLoading}>
                Voltar
              </Button>
              <Button variant={nfAcao.tipo === 'excluir' ? 'danger' : 'primary'} onClick={handleNfAcaoConfirmar} disabled={nfAcaoLoading}>
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
              <Button variant="outline" onClick={() => { setCancelando(null); setMotivoCancel(''); setCancelError(null) }} disabled={cancelLoading}>
                Voltar
              </Button>
              <Button variant="danger" onClick={handleCancelar} disabled={cancelLoading}>
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {excluindoSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[440px] max-w-[96%] shadow-2xl">
            <div className="bg-red-600 text-white px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg">
              Excluir Sub-índice
            </div>
            <div className="p-[18px]">
              {excluirSubError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{excluirSubError}</div>
              )}
              <p className="text-[12px] text-gray-600">
                O sub-índice <strong>{excluindoSub.descricao}</strong> será excluído permanentemente junto com todas as suas notas fiscais. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button variant="outline" onClick={() => { setExcluindoSub(null); setExcluirSubError(null) }} disabled={excluirSubLoading}>
                Voltar
              </Button>
              <Button variant="danger" onClick={handleExcluirSubindiceConfirmar} disabled={excluirSubLoading}>
                {excluirSubLoading ? 'Excluindo...' : 'Confirmar exclusão'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalHistorico && (
        <HistoricoFaturamentoModal
          open={true}
          onClose={() => setModalHistorico(null)}
          tipo={modalHistorico.tipo}
          itemId={modalHistorico.id}
          titulo={modalHistorico.titulo}
        />
      )}

      {modalComentario && (
        <ComentarioSubindiceModal
          open={true}
          onClose={() => setModalComentario(null)}
          subindiceId={modalComentario.id}
          titulo={modalComentario.descricao}
          canEditar={canEditar}
          onSuccess={fetchData}
        />
      )}

      {/* Modal reprovar */}
      {reprovarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[480px] max-w-[96%] shadow-2xl">
            <div className="bg-red-600 text-white px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg">
              Reprovar alteração
            </div>
            <div className="p-[18px]">
              {reprovarError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{reprovarError}</div>
              )}
              <p className="text-[12px] text-gray-600 mb-1">
                Sub-índice: <strong>{reprovarModal.subindice.descricao}</strong>
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                Responsável: {reprovarModal.responsavel.nome}
              </p>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] block mb-1">
                Motivo da reprovação *
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-red-400/40"
                rows={3}
                placeholder="Informe o motivo (mínimo 3 caracteres)"
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
              />
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button variant="outline" onClick={() => { setReprovarModal(null); setMotivoRecusa(''); setReprovarError(null) }} disabled={reprovarLoading}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleReprovarConfirmar} disabled={reprovarLoading}>
                {reprovarLoading ? 'Reprovando...' : 'Confirmar reprovação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba de Aprovações ────────────────────────────────────────────────────────

interface AbaAprovacoes {
  alteracoes: PrevisaoAlteracaoItem[]
  historico: PrevisaoAlteracaoItem[]
  loading: boolean
  historicoLoading: boolean
  error: string | null
  onAprovar: (id: number) => void
  onReprovar: (a: PrevisaoAlteracaoItem) => void
}

function AbaAprovacoes({ alteracoes, historico, loading, historicoLoading, error, onAprovar, onReprovar }: AbaAprovacoes) {
  const [showHistorico, setShowHistorico] = useState(false)

  if (loading) return <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
  )

  return (
    <div className="space-y-4 pt-1">
      {/* Pendentes */}
      {alteracoes.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">Nenhuma alteração pendente de aprovação.</div>
      ) : (
        <>
          <p className="text-[11px] text-gray-500">
            {alteracoes.length} alteração{alteracoes.length !== 1 ? 'ões' : ''} pendente{alteracoes.length !== 1 ? 's' : ''} de aprovação
          </p>
          {alteracoes.map((a) => (
            <AlteracaoAprovacaoRow key={a.id} alteracao={a} onAprovar={onAprovar} onReprovar={onReprovar} />
          ))}
        </>
      )}

      {/* RN-CF-39: Histórico de decisões */}
      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowHistorico((v) => !v)}
          className="flex items-center gap-2 text-[11px] text-gray-500 hover:text-gray-700 font-semibold"
        >
          <span>{showHistorico ? '▾' : '▸'}</span>
          Histórico de decisões
          {historico.length > 0 && (
            <span className="text-gray-400 font-normal">({historico.length})</span>
          )}
        </button>

        {showHistorico && (
          <div className="mt-3 space-y-2">
            {historicoLoading ? (
              <p className="text-center text-gray-400 py-4 text-sm">Carregando...</p>
            ) : historico.length === 0 ? (
              <p className="text-center text-gray-400 py-4 text-sm">Nenhum histórico encontrado.</p>
            ) : (
              historico.map((a) => (
                <AlteracaoHistoricoRow key={a.id} alteracao={a} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface AlteracaoAprovacaoRowProps {
  alteracao: PrevisaoAlteracaoItem
  onAprovar: (id: number) => void
  onReprovar: (a: PrevisaoAlteracaoItem) => void
}

// ─── Linha de histórico (RN-CF-39) ───────────────────────────────────────────

function AlteracaoHistoricoRow({ alteracao }: { alteracao: PrevisaoAlteracaoItem }) {
  const [expanded, setExpanded] = useState(false)
  const aprovado = alteracao.status === 'APROVADO'
  const mesesMudados = MESES.filter((m) => {
    const de = alteracao[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
    const para = alteracao[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
    return de !== para
  })
  return (
    <div className={cn('border rounded-md p-3 text-[11px]', aprovado ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-bold text-[10px] px-1.5 py-0.5 rounded uppercase', aprovado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
              {aprovado ? 'Aprovado' : 'Reprovado'}
            </span>
            <span className="font-semibold text-gray-700">
              {alteracao.contrato?.indice ?? '—'}.{alteracao.subindice.ordem} · {alteracao.subindice.descricao}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{alteracao.contrato?.cliente.nome ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
            <span>Resp.: <strong className="text-gray-600">{alteracao.responsavel.nome}</strong></span>
            {alteracao.revisor && <span>Revisor: <strong className="text-gray-600">{alteracao.revisor.nome}</strong></span>}
            {alteracao.reviewed_at && (
              <span>{formatDate(alteracao.reviewed_at)}</span>
            )}
            {!aprovado && alteracao.motivo_recusa && (
              <span className="text-red-600">Motivo: {alteracao.motivo_recusa}</span>
            )}
            <span className="text-amber-600">{mesesMudados.length} mês{mesesMudados.length !== 1 ? 'es' : ''} alterado{mesesMudados.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-[10px] text-gray-400 hover:text-gray-600 underline flex-shrink-0">
          {expanded ? 'Ocultar' : 'Detalhes'}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="grid grid-cols-12 gap-1">
            {MESES.map((m, mi) => {
              const de = alteracao[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
              const para = alteracao[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
              const mudou = de !== para
              return (
                <div key={m} className={cn('text-center rounded p-1', mudou ? (aprovado ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200') : '')}>
                  <p className="text-[8px] uppercase text-gray-300 mb-0.5">{MESES_LABELS[mi]}</p>
                  {mudou ? (
                    <>
                      <p className="text-[9px] text-gray-400 line-through">{de != null ? formatCurrency(de) : '—'}</p>
                      <p className={cn('text-[10px] font-bold', aprovado ? 'text-green-800' : 'text-red-700')}>{para != null ? formatCurrency(para) : '—'}</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400">{para != null ? formatCurrency(para) : '—'}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AlteracaoAprovacaoRow({ alteracao, onAprovar, onReprovar }: AlteracaoAprovacaoRowProps) {
  const [expanded, setExpanded] = useState(false)

  // Detecta quais meses mudaram
  const mesesMudados = MESES.filter((m) => {
    const de = alteracao[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
    const para = alteracao[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
    return de !== para
  })

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-green-dark">
              {alteracao.contrato?.indice ?? '—'}.{alteracao.subindice.ordem}
            </span>
            <span className="text-[11px] text-gray-700">{alteracao.subindice.descricao}</span>
            <span className="text-[10px] text-gray-400">·</span>
            <span className="text-[10px] text-gray-500">{alteracao.contrato?.cliente.nome ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-gray-400">
              Resp.: <strong className="text-gray-600">{alteracao.responsavel.nome}</strong>
            </span>
            <span className="text-[10px] text-gray-400">
              {formatDateTime(alteracao.created_at)}
            </span>
            <span className="text-[10px] text-amber-700">
              {mesesMudados.length} mês{mesesMudados.length !== 1 ? 'es' : ''} alterado{mesesMudados.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            {expanded ? 'Ocultar' : 'Ver detalhes'}
          </button>
          <Button size="sm" variant="outline" onClick={() => onReprovar(alteracao)}>
            Reprovar
          </Button>
          <Button size="sm" onClick={() => onAprovar(alteracao.id)}>
            Aprovar
          </Button>
        </div>
      </div>

      {/* Detalhes dos meses quando expandido */}
      {expanded && (
        <div className="border-t border-gray-100 pt-3 mt-1">
          <div className="grid grid-cols-12 gap-1">
            {MESES.map((m, mi) => {
              const de = alteracao[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
              const para = alteracao[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
              const mudou = de !== para
              return (
                <div key={m} className={cn('text-center rounded p-1', mudou ? 'bg-amber-50 border border-amber-200' : '')}>
                  <p className="text-[8px] uppercase text-gray-300 mb-0.5">{MESES_LABELS[mi]}</p>
                  {mudou ? (
                    <>
                      <p className="text-[9px] text-gray-400 line-through">{de != null ? formatCurrency(de) : '—'}</p>
                      <p className="text-[10px] font-bold text-amber-700">{para != null ? formatCurrency(para) : '—'}</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400">{para != null ? formatCurrency(para) : '—'}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
