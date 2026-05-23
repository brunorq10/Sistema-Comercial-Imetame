'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import { CLASSIFICACAO_LABELS, INTERESSE_LABELS, ORIGEM_LABELS, MOTIVO_REPROVACAO_LABELS } from '@/types'
import type { Classificacao, Interesse, Origem, MotivoReprovacao } from '@/types'

interface Orcamentista { id: number; nome: string }

interface SolicitacaoAnalise {
  id: number
  numero: string
  created_at: string
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  origem: Origem | null
  cidade: string | null
  estado: string | null
  contato: string | null
  visita_tecnica: boolean
  data_visita: string | null
  prazo_tecnica: string | null
  prazo_comercial: string | null
  status_analise: 'AGUARDANDO' | 'APROVADA' | 'REPROVADA'
  motivo_reprovacao: MotivoReprovacao | null
  obs_reprovacao: string | null
  cliente: { id: number; nome: string }
  cliente_final: { id: number; nome: string } | null
  criador: { id: number; nome: string }
  orcamentista: { id: number; nome: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number | null
}

const MOTIVOS_REPROVACAO: { value: MotivoReprovacao; label: string }[] = [
  { value: 'VOLUME_ADJUDICADO', label: 'Volume de Serviços Adjudicados Para o Período' },
  { value: 'FORA_LINHA_FORNECIMENTO', label: 'Não Faz Parte da Linha de Fornecimento' },
  { value: 'INDISPONIBILIDADE_MO', label: 'Indisponibilidade de MO' },
  { value: 'SEM_SERVICO_LOCAL', label: 'Não Temos Serviço no Local' },
  { value: 'LIMITACAO_EQUIPAMENTOS', label: 'Limitação de Equipamentos' },
  { value: 'DIFICULDADE_PARCERIA', label: 'Dificuldade de Parceria' },
  { value: 'OUTROS', label: 'Outros' },
]

export function AnaliseSolicitacaoModal({ open, onClose, onSuccess, solicitacaoId }: Props) {
  const [sol, setSol] = useState<SolicitacaoAnalise | null>(null)
  const [orcamentistas, setOrcamentistas] = useState<Orcamentista[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Campos editáveis
  const [orcamentistaId, setOrcamentistaId] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [interesse, setInteresse] = useState('')
  const [escopo, setEscopo] = useState('')
  const [prazoTecnica, setPrazoTecnica] = useState('')
  const [prazoComercial, setPrazoComercial] = useState('')
  const [visitaTecnica, setVisitaTecnica] = useState(false)
  const [dataVisita, setDataVisita] = useState('')

  // Estado reprovação
  const [modo, setModo] = useState<'visualizar' | 'reprovar'>('visualizar')
  const [motivoReprovacao, setMotivoReprovacao] = useState<MotivoReprovacao | ''>('')
  const [obsReprovacao, setObsReprovacao] = useState('')

  useEffect(() => {
    if (!open || !solicitacaoId) return

    setError(null)
    setModo('visualizar')
    setMotivoReprovacao('')
    setObsReprovacao('')
    setLoading(true)

    Promise.all([
      fetch(`/api/analise/${solicitacaoId}`).then((r) => r.json()),
      fetch('/api/users/orcamentistas').then((r) => r.json()),
    ]).then(([solJson, orcJson]) => {
      if (solJson.data) {
        const d = solJson.data as SolicitacaoAnalise
        setSol(d)
        setOrcamentistaId(d.orcamentista?.id.toString() ?? '')
        setClassificacao(d.classificacao ?? '')
        setInteresse(d.interesse ?? '')
        setEscopo(d.escopo ?? '')
        setPrazoTecnica(d.prazo_tecnica ? d.prazo_tecnica.slice(0, 10) : '')
        setPrazoComercial(d.prazo_comercial ? d.prazo_comercial.slice(0, 10) : '')
        setVisitaTecnica(d.visita_tecnica)
        setDataVisita(d.data_visita ? d.data_visita.slice(0, 10) : '')
        if (d.status_analise === 'REPROVADA') {
          setModo('reprovar')
          setMotivoReprovacao((d.motivo_reprovacao ?? '') as MotivoReprovacao | '')
          setObsReprovacao(d.obs_reprovacao ?? '')
        }
      }
      if (orcJson.data) setOrcamentistas(orcJson.data)
    }).finally(() => setLoading(false))
  }, [open, solicitacaoId])

  const handleAprovar = async () => {
    if (!orcamentistaId) { setError('Selecione o orçamentista responsável'); return }
    if (!classificacao) { setError('Preencha a Classificação'); return }
    if (!interesse) { setError('Preencha o Nível de Interesse'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/analise/${solicitacaoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'aprovar',
          orcamentista_id: Number(orcamentistaId),
          escopo: escopo || undefined,
          classificacao: classificacao || undefined,
          interesse: interesse || undefined,
          prazo_tecnica: prazoTecnica || undefined,
          prazo_comercial: prazoComercial || undefined,
          visita_tecnica: visitaTecnica,
          data_visita: dataVisita || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao aprovar'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleSalvarEdicao = async () => {
    if (!motivoReprovacao) {
      setError('Selecione o motivo da reprovação')
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/analise/${solicitacaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo_reprovacao: motivoReprovacao,
          obs_reprovacao: obsReprovacao || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleReprovar = async () => {
    if (!motivoReprovacao) {
      setError('Selecione o motivo da reprovação')
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/analise/${solicitacaoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'reprovar',
          motivo_reprovacao: motivoReprovacao,
          obs_reprovacao: obsReprovacao || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao reprovar'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!sol && !loading) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sol ? `Análise — ${sol.numero}` : 'Carregando...'}
      footer={
        sol?.status_analise === 'REPROVADA' ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={loading}>Fechar</Button>
            <Button variant="danger" onClick={handleSalvarEdicao} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </>
        ) : modo === 'reprovar' ? (
          <>
            <Button variant="outline" onClick={() => { setModo('visualizar'); setError(null) }} disabled={loading}>
              Voltar
            </Button>
            <Button variant="danger" onClick={handleReprovar} disabled={loading}>
              {loading ? 'Reprovando...' : 'Confirmar reprovação'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => { setModo('reprovar'); setError(null) }} disabled={loading}>
              Reprovar
            </Button>
            <Button onClick={handleAprovar} disabled={loading}>
              {loading ? 'Aprovando...' : 'Aprovar e atribuir'}
            </Button>
          </>
        )
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {loading && !sol ? (
        <p className="text-center text-gray-400 py-6 text-sm">Carregando...</p>
      ) : sol && (
        <>
          {/* Dados da solicitação (read-only) */}
          <ModalSection>Dados da solicitação</ModalSection>
          <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
            <InfoField label="Cliente">{sol.cliente.nome}</InfoField>
            <InfoField label="Cliente Final">{sol.cliente_final?.nome ?? '—'}</InfoField>
            <InfoField label="Criado por">{sol.criador.nome}</InfoField>
            <InfoField label="Data criação">{formatDate(sol.created_at)}</InfoField>
            <InfoField label="Contato">{sol.contato ?? '—'}</InfoField>
            <InfoField label="Cidade / UF">{[sol.cidade, sol.estado].filter(Boolean).join(' / ') || '—'}</InfoField>
            <InfoField label="Origem">{sol.origem ? ORIGEM_LABELS[sol.origem] : '—'}</InfoField>
          </div>

          {modo === 'reprovar' ? (
            <>
              <ModalSection>Motivo da reprovação *</ModalSection>
              <Field label="Selecione o motivo *" className="mb-2">
                <Select
                  value={motivoReprovacao}
                  onChange={(e) => setMotivoReprovacao(e.target.value as MotivoReprovacao | '')}
                >
                  <option value="">Selecione o motivo...</option>
                  {MOTIVOS_REPROVACAO.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Observações (opcional)">
                <textarea
                  className="w-full border border-gray-300 rounded px-2.5 py-2 text-[11px] resize-none h-20 focus:outline-none focus:border-green-primary"
                  placeholder="Informações adicionais..."
                  value={obsReprovacao}
                  onChange={(e) => setObsReprovacao(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              {/* Campos editáveis pelo analista */}
              <ModalSection>Dados a preencher / confirmar *</ModalSection>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <Field label="Escopo" className="col-span-2">
                  <Input
                    placeholder="Descrição do escopo"
                    value={escopo}
                    onChange={(e) => setEscopo(e.target.value)}
                  />
                </Field>
                <Field label="Classificação *">
                  <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="OBRAS">Obras</option>
                    <option value="PARADAS">Paradas</option>
                    <option value="OLEO_GAS">Óleo e Gás</option>
                    <option value="FABRICACOES">Fabricações</option>
                  </Select>
                </Field>
                <Field label="Interesse *">
                  <Select value={interesse} onChange={(e) => setInteresse(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="ALTO">Alto</option>
                    <option value="MEDIO">Médio</option>
                    <option value="BAIXO">Baixo</option>
                  </Select>
                </Field>
                <Field label="Prazo técnica">
                  <Input type="date" value={prazoTecnica} onChange={(e) => setPrazoTecnica(e.target.value)} />
                </Field>
                <Field label="Prazo comercial">
                  <Input type="date" value={prazoComercial} onChange={(e) => setPrazoComercial(e.target.value)} />
                </Field>
                <Field label="Visita técnica" className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visitaTecnica}
                      onChange={(e) => setVisitaTecnica(e.target.checked)}
                      className="accent-green-primary"
                    />
                    <span className="text-[11px]">Requer visita técnica</span>
                  </label>
                </Field>
                {visitaTecnica && (
                  <Field label="Data da visita" className="col-span-2">
                    <Input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} />
                  </Field>
                )}
              </div>

              <ModalSection>Orçamentista responsável *</ModalSection>
              <Field label="Selecione o orçamentista" className="mb-2">
                <Select value={orcamentistaId} onChange={(e) => setOrcamentistaId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {orcamentistas.map((o) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[11px] font-medium text-gray-700">{children}</p>
    </div>
  )
}
