'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { EfetivoMensalEditor } from '@/components/cenario/EfetivoMensalEditor'
import { CLASSIFICACAO_LABEL, admiteEfetivoMensal, type ClassificacaoCenario } from '@/lib/cenario'
import { formatDate } from '@/lib/utils'

interface PropostaDisponivel {
  solicitacao_id: number
  numero: string
  classificacao: ClassificacaoCenario
  cliente: { id: number; nome: string }
  cliente_final: { id: number; nome: string } | null
  cidade: string | null
  estado: string | null
  escopo: string | null
  orcamentista_nome: string | null
  proposta_comercial_id: number
  data_prevista_inicio_execucao: string | null
  data_prevista_fim_execucao: string | null
  efetivo_pico: number | null
  ja_lancada: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NovoLancamentoCenarioModal({ open, onClose, onSuccess }: Props) {
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [propostas, setPropostas] = useState<PropostaDisponivel[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<PropostaDisponivel | null>(null)

  // Campos do formulário (etapa 2) — pré-preenchidos, mas editáveis
  const [clienteNome, setClienteNome] = useState('')
  const [clienteFinalNome, setClienteFinalNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [escopo, setEscopo] = useState('')
  const [orcamentistaNome, setOrcamentistaNome] = useState('')
  const [orcamentistas, setOrcamentistas] = useState<{ id: number; nome: string }[]>([])
  const [classificacao, setClassificacao] = useState<ClassificacaoCenario>('OBRAS')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [efetivo, setEfetivo] = useState('')
  const [efetivoMensal, setEfetivoMensal] = useState<Record<string, number>>({})
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEtapa(1); setSelecionada(null); setBusca(''); setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    fetch('/api/users/orcamentistas').then((r) => r.json()).then((j) => setOrcamentistas(j.data ?? []))
  }, [open])

  useEffect(() => {
    if (!open || etapa !== 1) return
    setLoadingLista(true)
    const t = setTimeout(() => {
      fetch(`/api/cenario/propostas-disponiveis${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`)
        .then((r) => r.json())
        .then((j) => setPropostas(j.data ?? []))
        .finally(() => setLoadingLista(false))
    }, 250)
    return () => clearTimeout(t)
  }, [open, etapa, busca])

  const escolher = (p: PropostaDisponivel) => {
    if (p.ja_lancada) return
    setSelecionada(p)
    setClienteNome(p.cliente.nome)
    setClienteFinalNome(p.cliente_final?.nome ?? '')
    setCidade(p.cidade ?? '')
    setEstado(p.estado ?? '')
    setEscopo(p.escopo ?? '')
    setOrcamentistaNome(p.orcamentista_nome ?? '')
    setClassificacao(p.classificacao)
    setDataInicio(p.data_prevista_inicio_execucao?.substring(0, 10) ?? '')
    setDataFim(p.data_prevista_fim_execucao?.substring(0, 10) ?? '')
    setEfetivo(p.efetivo_pico != null ? String(p.efetivo_pico) : '')
    setEfetivoMensal({})
    setObservacao('')
    setError(null)
    setEtapa(2)
  }

  const handleSalvar = async () => {
    if (!selecionada) return
    if (!clienteNome.trim()) { setError('Informe o cliente'); return }
    if (!dataInicio || !dataFim) { setError('Informe início e fim previstos'); return }
    if (dataFim < dataInicio) { setError('Data de fim não pode ser anterior à data de início'); return }
    if (!efetivo || Number(efetivo) <= 0) { setError('Informe o efetivo'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/cenario/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposta_comercial_id: selecionada.proposta_comercial_id,
          cliente_nome: clienteNome.trim(),
          cliente_final_nome: clienteFinalNome.trim() || undefined,
          cidade: cidade.trim() || undefined,
          estado: estado.trim() || undefined,
          escopo: escopo.trim() || undefined,
          orcamentista_nome: orcamentistaNome.trim() || undefined,
          classificacao,
          data_inicio: dataInicio,
          data_fim: dataFim,
          efetivo: Number(efetivo),
          efetivo_mensal: admiteEfetivoMensal(classificacao) ? efetivoMensal : undefined,
          observacao: observacao.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao lançar'); return }
      onSuccess()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={etapa === 1 ? 'Novo Lançamento — Selecionar Proposta' : `Novo Lançamento — Confirmar e Ajustar · ${selecionada?.numero}`}
      wide
      footer={etapa === 2 ? (
        <>
          <Button variant="outline" onClick={() => setEtapa(1)} disabled={loading}>← Voltar</Button>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSalvar} disabled={loading}>{loading ? 'Salvando...' : 'Salvar no Cenário'}</Button>
        </>
      ) : (
        <ModalCancelButton />
      )}
    >
      {etapa === 1 ? (
        <>
          <Field label="Buscar por proposta, cliente ou escopo" className="mb-3">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para buscar..." autoFocus />
          </Field>

          {loadingLista ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : propostas.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">Nenhuma proposta enviada encontrada.</p>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {propostas.map((p) => (
                <button
                  key={p.proposta_comercial_id}
                  onClick={() => escolher(p)}
                  disabled={p.ja_lancada}
                  className={`w-full text-left px-3.5 py-2.5 transition-colors ${p.ja_lancada ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-green-light'}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-bold text-green-dark">{p.numero}</span>
                      <span className="text-[11px] text-gray-600">{p.cliente.nome}</span>
                      <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{CLASSIFICACAO_LABEL[p.classificacao]}</span>
                      {p.ja_lancada && <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-semibold">já lançada</span>}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {[p.cidade, p.estado].filter(Boolean).join('/') || '—'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{p.escopo ?? '—'}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    Previsão: {p.data_prevista_inicio_execucao ? formatDate(p.data_prevista_inicio_execucao) : '—'} a {p.data_prevista_fim_execucao ? formatDate(p.data_prevista_fim_execucao) : '—'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-2.5 rounded-md mb-4">
            O Cenário é um indicador interno — os dados abaixo vieram da proposta, mas podem ser ajustados livremente aqui (período ou efetivo diferentes do que consta na proposta), conforme sua leitura da situação.
          </div>

          <ModalSection>Identificação</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="Cliente"><Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} /></Field>
            <Field label="Cliente Final"><Input value={clienteFinalNome} onChange={(e) => setClienteFinalNome(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-2.5 mb-2.5">
            <Field label="Cidade"><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></Field>
            <Field label="UF"><Input value={estado} maxLength={2} onChange={(e) => setEstado(e.target.value.toUpperCase())} /></Field>
            <Field label="Classificação">
              <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value as ClassificacaoCenario)}>
                {Object.entries(CLASSIFICACAO_LABEL).map(([valor, label]) => (
                  <option key={valor} value={valor}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Orçamentista">
              <Select value={orcamentistaNome} onChange={(e) => setOrcamentistaNome(e.target.value)}>
                <option value="">—</option>
                {orcamentistas.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Escopo" className="mb-2.5"><Input value={escopo} onChange={(e) => setEscopo(e.target.value)} /></Field>

          <ModalSection>Período e efetivo previstos</ModalSection>
          <div className="grid grid-cols-3 gap-2.5 mb-2.5">
            <Field label="Início previsto *"><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></Field>
            <Field label="Fim previsto *"><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></Field>
            <Field label={admiteEfetivoMensal(classificacao) ? 'Efetivo (padrão) *' : 'Efetivo *'}>
              <Input type="number" min={1} value={efetivo} onChange={(e) => setEfetivo(e.target.value)} />
            </Field>
          </div>

          {admiteEfetivoMensal(classificacao) && (
            <div className="mb-2.5">
              <EfetivoMensalEditor
                dataInicio={dataInicio}
                dataFim={dataFim}
                efetivoBase={Number(efetivo) || 0}
                valores={efetivoMensal}
                onChange={setEfetivoMensal}
              />
            </div>
          )}

          <Field label="Observação (opcional) — motivo de algum ajuste" className="mb-1">
            <textarea
              className="w-full border border-gray-300 rounded px-2.5 py-[5px] text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-green-primary/40"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: período ajustado conforme cronograma real combinado com o cliente"
            />
          </Field>
        </>
      )}
    </Modal>
  )
}
