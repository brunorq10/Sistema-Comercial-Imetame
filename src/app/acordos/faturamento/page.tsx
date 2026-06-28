'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { FaturamentoContratoTable } from '@/components/tables/FaturamentoContratoTable'
import { NfRegistroTable } from '@/components/tables/NfRegistroTable'
import { MultasRegistroTable, type MultaListItem } from '@/components/tables/MultasRegistroTable'
import { LancarMultaModal } from '@/components/forms/LancarMultaModal'
import { TIPOS_MULTA } from '@/lib/multas'
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
type AcaoMulta = { tipo: 'inativar' | 'excluir'; multa: MultaListItem }
type Aba = 'controle' | 'nfs' | 'multas' | 'aprovacoes'

export interface NfAprovacaoItem {
  id: number
  numero_nf: string
  tipo_documento: string
  valor_total_nf: number
  percentual: number
  valor_atribuido: number
  data_emissao: string
  data_vencimento: string
  status_aprovacao: string
  motivo_recusa: string | null
  created_at: string
  revisado_em: string | null
  solicitante: string
  revisor: string | null
  subindice: { id: number; ordem: number; descricao: string; valor_total: number }
  contrato: { id: number; indice: string; descricao: string | null; cliente_nome: string } | null
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']


export default function FaturamentoPage() {
  const router = useRouter()
  const { canLancarNF: _canLancarNF, pode, isLoading: sessionLoading } = usePermissions()
  // Keep last known permissions during session reload to prevent button flicker
  const canEditarRef   = useRef(false)
  const canLancarNFRef = useRef(false)
  if (!sessionLoading) {
    // Controle de Faturamento: editar/criar itens é exclusivo da gestão (matriz)
    canEditarRef.current   = pode('acordos.faturamento.item.editar')
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

  // ── Dados Multas/Penalidades ───────────────────────────────────────────────
  const [multas, setMultas] = useState<MultaListItem[]>([])
  const [multasLoading, setMultasLoading] = useState(false)
  const [multaEditando, setMultaEditando] = useState<MultaListItem | null>(null)
  const [multaAcao, setMultaAcao] = useState<AcaoMulta | null>(null)
  const [multaMotivo, setMultaMotivo] = useState('')
  const [multaAcaoLoading, setMultaAcaoLoading] = useState(false)
  // Filtros multas
  const [multaDe, setMultaDe] = useState('')
  const [multaAte, setMultaAte] = useState('')
  const [multaTipo, setMultaTipo] = useState('')
  const [multaStatus, setMultaStatus] = useState('')
  const [multaBusca, setMultaBusca] = useState('')

  // ── Aprovações ────────────────────────────────────────────────────────────────
  const [alteracoes, setAlteracoes] = useState<PrevisaoAlteracaoItem[]>([])
  const [alteracoesLoading, setAlteracoesLoading] = useState(false)
  const [alteracoesError, setAlteracoesError] = useState<string | null>(null)
  const [historico, setHistorico] = useState<PrevisaoAlteracaoItem[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [reprovarModal, setReprovarModal] = useState<PrevisaoAlteracaoItem | null>(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  // Aprovações de lançamento de faturamento (NFs)
  const [nfPendentes, setNfPendentes] = useState<NfAprovacaoItem[]>([])
  const [nfHistorico, setNfHistorico] = useState<NfAprovacaoItem[]>([])
  const [reprovarNfModal, setReprovarNfModal] = useState<NfAprovacaoItem | null>(null)
  const [motivoNf, setMotivoNf] = useState('')
  const [nfDecisao, setNfDecisao] = useState(false)
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

  // ── Fetch Multas/Penalidades ───────────────────────────────────────────────
  const fetchMultas = useCallback(async () => {
    setMultasLoading(true)
    try {
      const params = new URLSearchParams()
      if (multaDe) params.set('de', multaDe)
      if (multaAte) params.set('ate', multaAte)
      if (multaTipo) params.set('tipo', multaTipo)
      if (multaStatus) params.set('status', multaStatus)
      if (multaBusca) params.set('q', multaBusca)
      const res = await fetch(`/api/faturamento/multas?${params.toString()}`)
      const json = await res.json()
      if (!json.error) setMultas(json.data?.items ?? [])
    } finally {
      setMultasLoading(false)
    }
  }, [multaDe, multaAte, multaTipo, multaStatus, multaBusca])

  // ── Fetch aprovações ──────────────────────────────────────────────────────────
  const fetchAlteracoes = useCallback(async () => {
    if (!canEditar) return
    setAlteracoesLoading(true); setAlteracoesError(null)
    try {
      const [resPend, resHist, resNf, resNfHist] = await Promise.all([
        fetch('/api/faturamento/alteracoes?status=PENDENTE'),
        fetch('/api/faturamento/alteracoes?history=true'),
        fetch('/api/faturamento/nfs/aprovacoes'),
        fetch('/api/faturamento/nfs/aprovacoes?history=true'),
      ])
      const [jsonPend, jsonHist, jsonNf, jsonNfHist] = await Promise.all([resPend.json(), resHist.json(), resNf.json(), resNfHist.json()])
      if (jsonPend.error) { setAlteracoesError(jsonPend.error); return }
      setAlteracoes(jsonPend.data ?? [])
      setHistorico(jsonHist.data ?? [])
      setNfPendentes(jsonNf.data ?? [])
      setNfHistorico(jsonNfHist.data ?? [])
    } catch (err) {
      setAlteracoesError(String(err))
    } finally {
      setAlteracoesLoading(false)
      setHistoricoLoading(false)
    }
  }, [canEditar])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (aba === 'nfs') fetchNfs() }, [aba, fetchNfs])
  useEffect(() => { if (aba === 'multas') fetchMultas() }, [aba, fetchMultas])
  useEffect(() => { if (aba === 'aprovacoes') { setHistoricoLoading(true); fetchAlteracoes() } }, [aba, fetchAlteracoes])

  const handleMultaAcao = async () => {
    if (!multaAcao) return
    const inativando = multaAcao.tipo === 'inativar' && multaAcao.multa.ativa
    if (inativando && multaMotivo.trim().length < 3) { setMultaMotivo(multaMotivo); return }
    setMultaAcaoLoading(true)
    try {
      if (multaAcao.tipo === 'excluir') {
        const res = await fetch(`/api/faturamento/multas/${multaAcao.multa.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) { alert(json.error ?? 'Erro ao excluir'); return }
      } else {
        const novaAtiva = !multaAcao.multa.ativa
        const res = await fetch(`/api/faturamento/multas/${multaAcao.multa.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativa: novaAtiva, motivo_inativacao: novaAtiva ? null : multaMotivo.trim() }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) { alert(json.error ?? 'Erro ao salvar'); return }
      }
      setMultaAcao(null); setMultaMotivo(''); fetchMultas()
    } finally { setMultaAcaoLoading(false) }
  }

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

  const handleAprovarNf = async (id: number) => {
    setNfDecisao(true)
    try {
      const res = await fetch(`/api/faturamento/nfs/aprovacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'APROVAR' }),
      })
      const json = await res.json()
      if (json.error) { setAlteracoesError(json.error); return }
      fetchAlteracoes()
      fetchData()
    } catch (err) {
      setAlteracoesError(String(err))
    } finally {
      setNfDecisao(false)
    }
  }

  const handleReprovarNfConfirmar = async () => {
    if (!reprovarNfModal) return
    if (!motivoNf || motivoNf.trim().length < 3) { setReprovarError('Informe o motivo da reprovação (mínimo 3 caracteres)'); return }
    setNfDecisao(true); setReprovarError(null)
    try {
      const res = await fetch(`/api/faturamento/nfs/aprovacoes/${reprovarNfModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'REPROVAR', motivo: motivoNf }),
      })
      const json = await res.json()
      if (json.error) { setReprovarError(json.error); return }
      setReprovarNfModal(null); setMotivoNf('')
      fetchAlteracoes(); fetchData()
    } finally {
      setNfDecisao(false)
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
        <button className={`${tabBase} ${aba === 'multas' ? tabAtivo : tabInativo}`} onClick={() => setAba('multas')}>
          Registro de Multas/Penalidades
        </button>
        {canEditar && (
          <button className={`${tabBase} ${aba === 'aprovacoes' ? tabAtivo : tabInativo}`} onClick={() => setAba('aprovacoes')}>
            Aprovações
            {(alteracoes.length + nfPendentes.length) > 0 && aba !== 'aprovacoes' && (
              <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {alteracoes.length + nfPendentes.length}
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

      {/* filtro Multas (zona congelada) */}
      {aba === 'multas' && (
        <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mt-1 flex flex-wrap gap-2.5 items-end">
          <Field label="Período (de)" className="min-w-[130px]">
            <Input type="date" value={multaDe} onChange={(e) => setMultaDe(e.target.value)} />
          </Field>
          <Field label="Período (até)" className="min-w-[130px]">
            <Input type="date" value={multaAte} onChange={(e) => setMultaAte(e.target.value)} />
          </Field>
          <Field label="Tipo" className="min-w-[130px]">
            <SearchableSelect
              value={multaTipo}
              onChange={setMultaTipo}
              options={TIPOS_MULTA.map((t) => ({ value: t.value, label: t.label }))}
              emptyLabel="Todos"
            />
          </Field>
          <Field label="Status" className="min-w-[120px]">
            <SearchableSelect
              value={multaStatus}
              onChange={setMultaStatus}
              options={[{ value: 'ativas', label: 'Ativas' }, { value: 'inativas', label: 'Inativas' }]}
              emptyLabel="Todas"
            />
          </Field>
          <Field label="Buscar" className="min-w-[160px] flex-1">
            <Input placeholder="Descrição, índice, cliente..." value={multaBusca} onChange={(e) => setMultaBusca(e.target.value)} />
          </Field>
          <div className="flex-shrink-0">
            <button onClick={() => { setMultaDe(''); setMultaAte(''); setMultaTipo(''); setMultaStatus(''); setMultaBusca('') }} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors">
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

        {aba === 'multas' && (
          multasLoading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : (
            <MultasRegistroTable
              multas={multas}
              canEditar={canEditar}
              canExcluir={pode('acordos.nf.excluir')}
              onEditar={setMultaEditando}
              onInativar={(m) => { setMultaAcao({ tipo: 'inativar', multa: m }); setMultaMotivo('') }}
              onExcluir={(m) => setMultaAcao({ tipo: 'excluir', multa: m })}
            />
          )
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
            nfPendentes={nfPendentes}
            nfHistorico={nfHistorico}
            nfDecisao={nfDecisao}
            onAprovarNf={handleAprovarNf}
            onReprovarNf={(nf) => { setReprovarNfModal(nf); setMotivoNf(''); setReprovarError(null) }}
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

      {multaEditando && (
        <LancarMultaModal
          open={true}
          onClose={() => setMultaEditando(null)}
          onSuccess={fetchMultas}
          contratoId={multaEditando.contrato_id}
          subtitulo={`${multaEditando.contrato_indice} · ${multaEditando.cliente_nome}`}
          editando={multaEditando}
        />
      )}

      {multaAcao && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[440px] max-w-[96%] shadow-2xl">
            <div className={`px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg text-white ${
              multaAcao.tipo === 'excluir' ? 'bg-red-600' : multaAcao.multa.ativa ? 'bg-orange-500' : 'bg-blue-600'
            }`}>
              {multaAcao.tipo === 'excluir' ? 'Excluir lançamento' : multaAcao.multa.ativa ? 'Inativar lançamento' : 'Reativar lançamento'}
            </div>
            <div className="p-[18px]">
              {multaAcao.tipo === 'excluir' && (
                <p className="text-[12px] text-gray-600">Este lançamento será excluído permanentemente. Esta ação não pode ser desfeita.</p>
              )}
              {multaAcao.tipo === 'inativar' && multaAcao.multa.ativa && (
                <>
                  <p className="text-[12px] text-gray-600 mb-3">O lançamento permanecerá no registro mas deixará de ser contabilizado. Informe o motivo.</p>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-orange-400/40"
                    rows={2}
                    placeholder="Motivo da inativação (mínimo 3 caracteres)"
                    value={multaMotivo}
                    onChange={(e) => setMultaMotivo(e.target.value)}
                  />
                </>
              )}
              {multaAcao.tipo === 'inativar' && !multaAcao.multa.ativa && (
                <p className="text-[12px] text-gray-600">Este lançamento será reativado e voltará a ser contabilizado.</p>
              )}
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button variant="outline" onClick={() => { setMultaAcao(null); setMultaMotivo('') }} disabled={multaAcaoLoading}>Voltar</Button>
              <Button variant={multaAcao.tipo === 'excluir' ? 'danger' : 'primary'} onClick={handleMultaAcao} disabled={multaAcaoLoading || (multaAcao.tipo === 'inativar' && multaAcao.multa.ativa && multaMotivo.trim().length < 3)}>
                {multaAcaoLoading ? 'Aguarde...' : multaAcao.tipo === 'excluir' ? 'Confirmar exclusão' : multaAcao.multa.ativa ? 'Confirmar inativação' : 'Confirmar reativação'}
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

      {/* Reprovar lançamento de faturamento (NF) */}
      {reprovarNfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-[480px] max-w-[96%] shadow-2xl">
            <div className="bg-red-600 text-white px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg">
              Reprovar lançamento de faturamento
            </div>
            <div className="p-[18px]">
              {reprovarError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{reprovarError}</div>
              )}
              <p className="text-[12px] text-gray-600 mb-1">
                {reprovarNfModal.contrato?.indice ?? '—'}.{reprovarNfModal.subindice.ordem} · <strong>{reprovarNfModal.subindice.descricao}</strong>
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                NF {reprovarNfModal.numero_nf} · {formatCurrency(reprovarNfModal.valor_atribuido)} · Solicitante: {reprovarNfModal.solicitante}
              </p>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] block mb-1">
                Motivo da reprovação *
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-red-400/40"
                rows={3}
                placeholder="Informe o motivo (mínimo 3 caracteres)"
                value={motivoNf}
                onChange={(e) => setMotivoNf(e.target.value)}
              />
            </div>
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
              <Button variant="outline" onClick={() => { setReprovarNfModal(null); setMotivoNf(''); setReprovarError(null) }} disabled={nfDecisao}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleReprovarNfConfirmar} disabled={nfDecisao}>
                {nfDecisao ? 'Reprovando...' : 'Confirmar reprovação'}
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
  nfPendentes: NfAprovacaoItem[]
  nfHistorico: NfAprovacaoItem[]
  nfDecisao: boolean
  onAprovarNf: (id: number) => void
  onReprovarNf: (nf: NfAprovacaoItem) => void
}

function AbaAprovacoes({ alteracoes, historico, loading, historicoLoading, error, onAprovar, onReprovar, nfPendentes, nfHistorico, nfDecisao, onAprovarNf, onReprovarNf }: AbaAprovacoes) {
  const [showHistorico, setShowHistorico] = useState(false)
  const totalHist = historico.length + nfHistorico.length

  if (loading) return <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
  )

  const totalPend = alteracoes.length + nfPendentes.length

  return (
    <div className="space-y-4 pt-1">
      {totalPend === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">Nenhuma aprovação pendente.</div>
      )}

      {/* Lançamentos de faturamento pendentes */}
      {nfPendentes.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
            Lançamentos de faturamento — {nfPendentes.length} pendente{nfPendentes.length !== 1 ? 's' : ''}
          </p>
          {nfPendentes.map((nf) => (
            <NfAprovacaoRow key={nf.id} nf={nf} loading={nfDecisao} onAprovar={onAprovarNf} onReprovar={onReprovarNf} />
          ))}
        </>
      )}

      {/* Alterações de previsão pendentes */}
      {alteracoes.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide pt-1">
            Alterações de previsão — {alteracoes.length} pendente{alteracoes.length !== 1 ? 's' : ''}
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
          {totalHist > 0 && (
            <span className="text-gray-400 font-normal">({totalHist})</span>
          )}
        </button>

        {showHistorico && (
          <div className="mt-3 space-y-2">
            {historicoLoading ? (
              <p className="text-center text-gray-400 py-4 text-sm">Carregando...</p>
            ) : totalHist === 0 ? (
              <p className="text-center text-gray-400 py-4 text-sm">Nenhum histórico encontrado.</p>
            ) : (
              <>
                {nfHistorico.map((nf) => (
                  <NfHistoricoRow key={`nf-${nf.id}`} nf={nf} />
                ))}
                {historico.map((a) => (
                  <AlteracaoHistoricoRow key={a.id} alteracao={a} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Linha de aprovação de lançamento de faturamento (NF) ────────────────────
function NfAprovacaoRow({ nf, loading, onAprovar, onReprovar }: {
  nf: NfAprovacaoItem; loading: boolean
  onAprovar: (id: number) => void; onReprovar: (nf: NfAprovacaoItem) => void
}) {
  const faturadoPos = nf.subindice.valor_total > 0 ? (nf.valor_atribuido / nf.subindice.valor_total) * 100 : 0
  return (
    <div className="bg-white border border-blue-200 rounded-md p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 uppercase">Faturamento</span>
            <span className="text-[11px] font-bold text-green-dark">{nf.contrato?.indice ?? '—'}.{nf.subindice.ordem}</span>
            <span className="text-[11px] text-gray-700">{nf.subindice.descricao}</span>
            <span className="text-[10px] text-gray-400">·</span>
            <span className="text-[10px] text-gray-500">{nf.contrato?.cliente_nome ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-gray-400">Solicitante: <strong className="text-gray-600">{nf.solicitante}</strong></span>
            <span className="text-[10px] text-gray-400">{formatDateTime(nf.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => onReprovar(nf)} disabled={loading}>Reprovar</Button>
          <Button size="sm" onClick={() => onAprovar(nf.id)} disabled={loading}>Aprovar</Button>
        </div>
      </div>

      {/* Resumo: escopo + dados da NF */}
      <div className="bg-gray-50 border border-gray-100 rounded p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Escopo do contrato</p>
          <p className="text-[11px] text-gray-700 truncate" title={nf.contrato?.descricao ?? ''}>{nf.contrato?.descricao ?? '—'}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Documento</p>
          <p className="text-[11px] text-gray-700">{nf.tipo_documento} {nf.numero_nf}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Emissão / Venc.</p>
          <p className="text-[11px] text-gray-700">{formatDate(nf.data_emissao)} · {formatDate(nf.data_vencimento)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Valor total da NF</p>
          <p className="text-[11px] text-gray-700">{formatCurrency(nf.valor_total_nf)} <span className="text-gray-400">({Number(nf.percentual).toFixed(2)}%)</span></p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Valor a faturar neste item</p>
          <p className="text-[12px] font-bold text-[#1565C0]">{formatCurrency(nf.valor_atribuido)}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Valor do evento</p>
          <p className="text-[11px] text-gray-700">{formatCurrency(nf.subindice.valor_total)} <span className="text-gray-400">({faturadoPos.toFixed(1)}% do evento)</span></p>
        </div>
      </div>
      <p className="text-[9px] text-gray-400 mt-1">Enquanto pendente, este lançamento <strong>não entra no faturamento</strong>. Só passa a contar após a aprovação.</p>
    </div>
  )
}

// Linha de histórico de decisão de um lançamento de faturamento (NF)
function NfHistoricoRow({ nf }: { nf: NfAprovacaoItem }) {
  const aprovado = nf.status_aprovacao === 'APROVADO'
  return (
    <div className={cn('border rounded-md p-3 text-[11px]', aprovado ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('font-bold text-[10px] px-1.5 py-0.5 rounded uppercase', aprovado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
          {aprovado ? 'Aprovado' : 'Reprovado'}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 uppercase">Faturamento</span>
        <span className="font-semibold text-gray-700">{nf.contrato?.indice ?? '—'}.{nf.subindice.ordem} · {nf.subindice.descricao}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">{nf.tipo_documento} {nf.numero_nf} — {formatCurrency(nf.valor_atribuido)}</span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400 flex-wrap">
        <span>Solicitante: <strong className="text-gray-600">{nf.solicitante}</strong></span>
        {nf.revisor && <span>Revisor: <strong className="text-gray-600">{nf.revisor}</strong></span>}
        {nf.revisado_em && <span>{formatDate(nf.revisado_em)}</span>}
        {!aprovado && nf.motivo_recusa && <span className="text-red-600">Motivo: {nf.motivo_recusa}</span>}
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
  const [expanded, setExpanded] = useState(true)

  const mv = (suf: 'de' | 'para', m: string) => Number(alteracao[`${m}_${suf}` as keyof PrevisaoAlteracaoItem]) || 0

  // Detecta quais meses mudaram
  const mesesMudados = MESES.filter((m) => {
    const de = alteracao[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
    const para = alteracao[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
    return de !== para
  })

  // Previsão completa do item (todos os anos); fallback p/ apenas o ano alterado
  const previsaoAnos = alteracao.item_previsao && alteracao.item_previsao.length > 0
    ? alteracao.item_previsao
    : [{ subindice_id: alteracao.subindice_id, ano: 0, ordem: alteracao.subindice.ordem, is_altered: true,
         meses: Object.fromEntries(MESES.map((m) => [m, mv('de', m)])) as Record<string, number | null> }]

  // Totais de previsão: antes (Σ de) e proposto (Σ para)
  const totalDe = MESES.reduce((s, m) => s + (Number(alteracao[`${m}_de` as keyof PrevisaoAlteracaoItem]) || 0), 0)
  const totalPara = MESES.reduce((s, m) => s + (Number(alteracao[`${m}_para` as keyof PrevisaoAlteracaoItem]) || 0), 0)
  const diff = totalPara - totalDe

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

      {/* Resumo: contrato (item principal) + escopo + subitem + valor previsto (antes → agora) */}
      <div className="bg-gray-50 border border-gray-100 rounded p-2.5 mb-1 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
        <div className="min-w-0 space-y-1.5">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Contrato (item principal)</p>
            <p className="text-[11px] text-gray-700">
              <strong className="text-green-dark">{alteracao.contrato?.indice ?? '—'}</strong>
              {alteracao.contrato?.cliente?.nome ? ` · ${alteracao.contrato.cliente.nome}` : ''}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Escopo do contrato</p>
            <p className="text-[11px] text-gray-700 truncate" title={alteracao.contrato?.descricao ?? ''}>
              {alteracao.contrato?.descricao ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Subitem alterado</p>
            <p className="text-[11px] text-gray-700 truncate" title={alteracao.subindice.descricao}>
              <strong className="text-gray-800">{alteracao.contrato?.indice ?? '—'}.{alteracao.subindice.ordem}</strong> — {alteracao.subindice.descricao}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0 self-start">
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Total previsto antes</p>
            <p className="text-[12px] font-semibold text-gray-500 line-through">{formatCurrency(totalDe)}</p>
          </div>
          <span className="text-gray-400">→</span>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Proposto agora</p>
            <p className="text-[12px] font-bold text-green-700">{formatCurrency(totalPara)}</p>
          </div>
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded',
            Math.abs(diff) < 0.01 ? 'bg-gray-100 text-gray-500'
            : diff > 0 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700')}>
            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
          </span>
        </div>
      </div>

      {/* Previsão completa do item — todos os anos, com de → para no ano alterado */}
      {expanded && (
        <div className="border-t border-gray-100 pt-3 mt-2">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">
            Previsão do item — todos os anos {previsaoAnos.length > 1 ? `(${previsaoAnos.length} anos)` : ''} · valores em R$
          </p>
          <div className="overflow-x-auto border border-gray-100 rounded">
            <table className="text-[10px] border-collapse w-full min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-2 py-1 text-left font-semibold sticky left-0 bg-gray-50 whitespace-nowrap">Ano / Linha</th>
                  {MESES_LABELS.map((l) => <th key={l} className="px-2 py-1 text-right font-semibold whitespace-nowrap">{l}</th>)}
                  <th className="px-2 py-1 text-right font-semibold whitespace-nowrap bg-gray-100">Total</th>
                </tr>
              </thead>
              <tbody>
                {previsaoAnos.flatMap((yr) => {
                  if (yr.is_altered) {
                    const sumDe = MESES.reduce((s, m) => s + mv('de', m), 0)
                    const sumPara = MESES.reduce((s, m) => s + mv('para', m), 0)
                    return [
                      <tr key={`${yr.subindice_id}-atual`} className="border-t border-gray-100">
                        <td className="px-2 py-1 sticky left-0 bg-white whitespace-nowrap font-medium text-gray-600">{yr.ano > 0 ? yr.ano : ''} · Atual</td>
                        {MESES.map((m) => { const de = mv('de', m); return <td key={m} className="px-2 py-1 text-right text-gray-400">{de > 0 ? formatCurrency(de) : '—'}</td> })}
                        <td className="px-2 py-1 text-right font-semibold text-gray-500 bg-gray-50">{formatCurrency(sumDe)}</td>
                      </tr>,
                      <tr key={`${yr.subindice_id}-prop`} className="border-t border-amber-100 bg-amber-50/40">
                        <td className="px-2 py-1 sticky left-0 bg-amber-50/40 whitespace-nowrap font-bold text-amber-800">{yr.ano > 0 ? yr.ano : ''} · Proposto</td>
                        {MESES.map((m) => { const de = mv('de', m); const para = mv('para', m); const mudou = Math.abs(de - para) > 0.01; return <td key={m} className={cn('px-2 py-1 text-right', mudou ? 'font-bold text-amber-700 bg-amber-100/70' : 'text-gray-500')}>{para > 0 ? formatCurrency(para) : '—'}</td> })}
                        <td className="px-2 py-1 text-right font-bold text-amber-800 bg-amber-100/50">{formatCurrency(sumPara)}</td>
                      </tr>,
                    ]
                  }
                  const sum = MESES.reduce((s, m) => s + (Number(yr.meses[m]) || 0), 0)
                  return [
                    <tr key={yr.subindice_id} className="border-t border-gray-100">
                      <td className="px-2 py-1 sticky left-0 bg-white whitespace-nowrap text-gray-600">Previsão {yr.ano}</td>
                      {MESES.map((m) => { const v = Number(yr.meses[m]) || 0; return <td key={m} className="px-2 py-1 text-right text-gray-500">{v > 0 ? formatCurrency(v) : '—'}</td> })}
                      <td className="px-2 py-1 text-right font-semibold text-gray-600 bg-gray-50">{formatCurrency(sum)}</td>
                    </tr>,
                  ]
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-gray-400 mt-1">As linhas <strong>Atual</strong> e <strong>Proposto</strong> mostram o de → para do ano alterado; os demais anos exibem a previsão vigente.</p>
        </div>
      )}
    </div>
  )
}
