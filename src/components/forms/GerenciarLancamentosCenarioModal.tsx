'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Input, Select } from '@/components/ui/Input'
import { EfetivoMensalEditor } from '@/components/cenario/EfetivoMensalEditor'
import { CLASSIFICACAO_LABEL, admiteEfetivoMensal, type ClassificacaoCenario } from '@/lib/cenario'
import { formatDate } from '@/lib/utils'

interface LancamentoItem {
  id: number
  cliente_nome: string
  cliente_final_nome: string | null
  cidade: string | null
  estado: string | null
  escopo: string | null
  orcamentista_nome: string | null
  classificacao: ClassificacaoCenario
  origem: 'CONTRATO' | 'PROPOSTA'
  data_inicio: string
  data_fim: string
  efetivo: number
  efetivo_mensal: Record<string, number> | null
  observacao: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Abre já em edição direta deste lançamento (ex.: clique no ✎ da linha da tabela). */
  abrirEditandoId?: number | null
}

export function GerenciarLancamentosCenarioModal({ open, onClose, onSuccess, abrirEditandoId }: Props) {
  const [lista, setLista] = useState<LancamentoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState<LancamentoItem | null>(null)
  const [excluindo, setExcluindo] = useState<LancamentoItem | null>(null)
  const [excluirError, setExcluirError] = useState<string | null>(null)
  const [excluirLoading, setExcluirLoading] = useState(false)

  const fetchLista = (selecionarId?: number | null) => {
    setLoading(true)
    fetch('/api/cenario')
      .then((r) => r.json())
      .then((j) => {
        const itens: LancamentoItem[] = j.data?.lancamentos ?? []
        setLista(itens)
        if (selecionarId) setEditando(itens.find((i) => i.id === selecionarId) ?? null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (open) { setEditando(null); fetchLista(abrirEditandoId) } }, [open, abrirEditandoId])

  const handleExcluir = async (motivo: string) => {
    if (!excluindo) return
    if (motivo.trim().length < 5) { setExcluirError('Informe o motivo (mínimo 5 caracteres)'); return }
    setExcluirLoading(true); setExcluirError(null)
    try {
      const res = await fetch(`/api/cenario/lancamentos/${excluindo.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setExcluirError(json.error ?? 'Erro ao excluir'); return }
      setExcluindo(null)
      fetchLista()
      onSuccess()
    } finally {
      setExcluirLoading(false)
    }
  }

  return (
    <>
      <Modal open={open} confirmClose onClose={onClose} title={editando ? `Editar Lançamento · ${editando.cliente_nome}` : 'Editar Cenário'} wide
        footer={!editando ? <ModalCancelButton label="Fechar" /> : undefined}
      >
        {editando ? (
          <LancamentoEditForm
            item={editando}
            onVoltar={() => setEditando(null)}
            onSalvo={() => { setEditando(null); fetchLista(); onSuccess() }}
          />
        ) : loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">Nenhum lançamento no cenário ainda.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((l) => (
              <div key={l.id} className="border border-gray-200 rounded-md p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-bold text-gray-700">{l.cliente_nome}</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{CLASSIFICACAO_LABEL[l.classificacao]}</span>
                    <span
                      className="text-[9px] rounded px-1.5 py-0.5 font-bold"
                      style={{ background: l.origem === 'CONTRATO' ? '#E3F0FB' : '#FEF3E2', color: l.origem === 'CONTRATO' ? '#1565C0' : '#B45309' }}
                    >
                      {l.origem === 'CONTRATO' ? 'Contrato' : 'Proposta'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{l.escopo ?? '—'}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    {formatDate(l.data_inicio)} a {formatDate(l.data_fim)} · Efetivo {l.efetivo.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditando(l)}>✎ Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => { setExcluindo(l); setExcluirError(null) }}>✕ Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!excluindo}
        title="Excluir lançamento do Cenário"
        message="Isto remove apenas o lançamento do Cenário — a proposta ou o contrato de origem não são afetados e a proposta volta disponível para um novo lançamento."
        variant="danger"
        confirmLabel="Confirmar exclusão"
        input={{ label: 'Motivo da exclusão', required: true, multiline: true }}
        loading={excluirLoading}
        error={excluirError}
        onConfirm={handleExcluir}
        onClose={() => setExcluindo(null)}
      />
    </>
  )
}

function LancamentoEditForm({ item, onVoltar, onSalvo }: { item: LancamentoItem; onVoltar: () => void; onSalvo: () => void }) {
  const [clienteNome, setClienteNome] = useState(item.cliente_nome)
  const [clienteFinalNome, setClienteFinalNome] = useState(item.cliente_final_nome ?? '')
  const [cidade, setCidade] = useState(item.cidade ?? '')
  const [estado, setEstado] = useState(item.estado ?? '')
  const [escopo, setEscopo] = useState(item.escopo ?? '')
  const [orcamentistaNome, setOrcamentistaNome] = useState(item.orcamentista_nome ?? '')
  const [orcamentistas, setOrcamentistas] = useState<{ id: number; nome: string }[]>([])
  const [classificacao, setClassificacao] = useState<ClassificacaoCenario>(item.classificacao)
  const [dataInicio, setDataInicio] = useState(item.data_inicio.substring(0, 10))
  const [dataFim, setDataFim] = useState(item.data_fim.substring(0, 10))
  const [efetivo, setEfetivo] = useState(String(item.efetivo))
  const [efetivoMensal, setEfetivoMensal] = useState<Record<string, number>>(item.efetivo_mensal ?? {})
  const [observacao, setObservacao] = useState(item.observacao ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/users/orcamentistas').then((r) => r.json()).then((j) => setOrcamentistas(j.data ?? []))
  }, [])

  const handleSalvar = async () => {
    if (!clienteNome.trim()) { setError('Informe o cliente'); return }
    if (!dataInicio || !dataFim) { setError('Informe início e fim'); return }
    if (dataFim < dataInicio) { setError('Data de fim não pode ser anterior à data de início'); return }
    if (!efetivo || Number(efetivo) <= 0) { setError('Informe o efetivo'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/cenario/lancamentos/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nome: clienteNome.trim(),
          cliente_final_nome: clienteFinalNome.trim() || null,
          cidade: cidade.trim() || null,
          estado: estado.trim() || null,
          escopo: escopo.trim() || null,
          orcamentista_nome: orcamentistaNome.trim() || null,
          classificacao,
          data_inicio: dataInicio,
          data_fim: dataFim,
          efetivo: Number(efetivo),
          efetivo_mensal: admiteEfetivoMensal(classificacao) ? efetivoMensal : null,
          observacao: observacao.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSalvo()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

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

      <ModalSection>Período e efetivo</ModalSection>
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

      <Field label="Observação (opcional)" className="mb-4">
        <textarea
          className="w-full border border-gray-300 rounded px-2.5 py-[5px] text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-green-primary/40"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onVoltar} disabled={loading}>← Voltar à lista</Button>
        <Button onClick={handleSalvar} disabled={loading}>{loading ? 'Salvando...' : 'Salvar alterações'}</Button>
      </div>
    </div>
  )
}
