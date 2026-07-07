'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { CLASSIFICACAO_LABELS } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  solicitacaoId: number
  numero: string
  /** true = consulta (aba Solicitações), sem edição */
  readOnly?: boolean
}

const UNIDADES = [{ v: 'KG', l: 'kg' }, { v: 'TON', l: 'ton' }, { v: 'PC', l: 'pç' }, { v: 'CJ', l: 'cj' }]
const simNao = (v: boolean | null) => (v === null ? '' : v ? 'SIM' : 'NAO')

function SN({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Selecione...</option>
        <option value="SIM">Sim</option>
        <option value="NAO">Não</option>
      </Select>
    </Field>
  )
}

export function RelatorioOSModal({ open, onClose, onSuccess, solicitacaoId, numero, readOnly }: Props) {
  const [auto, setAuto] = useState<{ classificacao: string; cliente_final: string; escopo: string; valor: number } | null>(null)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([])
  const [existente, setExistente] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [f, setF] = useState({
    cliente_faturamento_id: '', data_inicio: '', data_fim: '', responsavel_imetame: '',
    local_realizacao: '', gestor_cliente: '', unidade_medida: '', quantidade: '', ncm: '',
    pintura: '', retorno: '', memorial_calculo: '', material: '', art: '', databook: '',
    material_apoio: '', comentario: '', justificativa: '',
  })
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!open) return
    setErro(null)
    fetch('/api/clientes').then((r) => r.json()).then((j) => setClientes(j.data ?? []))
    // Dados automáticos da solicitação/proposta + relatório existente
    Promise.all([
      fetch(`/api/solicitacoes/${solicitacaoId}/relatorio-os`).then((r) => r.json()),
      fetch(`/api/propostas?modo=filtros`).then(() => null).catch(() => null),
    ]).then(([rel]) => {
      if (rel?.data) {
        const d = rel.data
        setExistente(true)
        setAuto({ classificacao: d.classificacao, cliente_final: d.cliente_final ?? '—', escopo: d.escopo, valor: d.valor_estimado })
        setF({
          cliente_faturamento_id: String(d.cliente_faturamento_id),
          data_inicio: d.data_inicio.slice(0, 10), data_fim: d.data_fim.slice(0, 10),
          responsavel_imetame: d.responsavel_imetame, local_realizacao: d.local_realizacao,
          gestor_cliente: d.gestor_cliente, unidade_medida: d.unidade_medida,
          quantidade: String(d.quantidade), ncm: d.ncm ?? '',
          pintura: simNao(d.pintura), retorno: simNao(d.retorno), memorial_calculo: simNao(d.memorial_calculo),
          material: d.material ?? '', art: simNao(d.art), databook: simNao(d.databook),
          material_apoio: simNao(d.material_apoio), comentario: d.comentario ?? '', justificativa: '',
        })
      } else {
        setExistente(false)
        // Prefill automático a partir do detalhe da solicitação
        fetch(`/api/solicitacoes/${solicitacaoId}`).then((r) => r.json()).then((j) => {
          const s = j.data
          if (!s) return
          const com = s.propostas_comerciais?.[0]
          setAuto({
            classificacao: s.classificacao ?? '',
            cliente_final: s.cliente_final?.nome ?? '—',
            escopo: s.escopo ?? '',
            valor: Number(com?.valor_total ?? 0),
          })
          setF((p) => ({ ...p, local_realizacao: [s.cidade, s.estado].filter(Boolean).join(' / ') }))
        })
      }
    })
  }, [open, solicitacaoId])

  const gravar = async () => {
    const obrig: (keyof typeof f)[] = ['cliente_faturamento_id', 'data_inicio', 'data_fim', 'responsavel_imetame',
      'local_realizacao', 'gestor_cliente', 'unidade_medida', 'quantidade', 'pintura', 'retorno',
      'memorial_calculo', 'art', 'databook', 'material_apoio']
    if (obrig.some((k) => !f[k])) { setErro('Preencha todos os campos obrigatórios (*)'); return }
    if (existente && f.justificativa.trim().length < 5) { setErro('Justificativa obrigatória para editar (mín. 5 caracteres)'); return }
    setLoading(true); setErro(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/relatorio-os`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_faturamento_id: Number(f.cliente_faturamento_id),
          data_inicio: f.data_inicio, data_fim: f.data_fim,
          responsavel_imetame: f.responsavel_imetame.trim(),
          local_realizacao: f.local_realizacao.trim(),
          gestor_cliente: f.gestor_cliente.trim(),
          unidade_medida: f.unidade_medida, quantidade: Number(f.quantidade),
          ncm: f.ncm.trim() || undefined,
          pintura: f.pintura === 'SIM', retorno: f.retorno === 'SIM',
          memorial_calculo: f.memorial_calculo === 'SIM',
          material: f.material || undefined,
          art: f.art === 'SIM', databook: f.databook === 'SIM', material_apoio: f.material_apoio === 'SIM',
          comentario: f.comentario.trim() || undefined,
          justificativa: existente ? f.justificativa.trim() : undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || j.error) { setErro(j.error ?? 'Erro ao gravar'); return }
      onSuccess?.(); onClose()
    } finally { setLoading(false) }
  }

  const ro = !!readOnly
  return (
    <Modal open={open} onClose={onClose} title={`Relatório de Abertura de OS · ${numero}`} wide
      footer={ro ? <Button variant="outline" onClick={onClose}>Fechar</Button> : (
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={gravar} disabled={loading}>{loading ? 'Gravando…' : 'Gravar'}</Button>
        </>
      )}>
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{erro}</div>}

      <ModalSection>Dados do processo (automáticos)</ModalSection>
      <div className="grid grid-cols-4 gap-2.5 mb-3 bg-[#EEF7EE] border border-[#C8E6C9] rounded p-2.5">
        <div><p className="text-[9px] text-gray-500 uppercase font-bold">Classificação *</p><p className="text-[11px] font-semibold">{auto?.classificacao ? (CLASSIFICACAO_LABELS[auto.classificacao as keyof typeof CLASSIFICACAO_LABELS] ?? auto.classificacao) : '—'}</p></div>
        <div><p className="text-[9px] text-gray-500 uppercase font-bold">Cliente Final *</p><p className="text-[11px] font-semibold">{auto?.cliente_final ?? '—'}</p></div>
        <div><p className="text-[9px] text-gray-500 uppercase font-bold">Nº Solicitação *</p><p className="text-[11px] font-semibold">{numero}</p></div>
        <div><p className="text-[9px] text-gray-500 uppercase font-bold">Valor Estimado *</p><p className="text-[11px] font-semibold text-auto-value">{auto ? formatCurrency(auto.valor) : '—'}</p></div>
        <div className="col-span-4"><p className="text-[9px] text-gray-500 uppercase font-bold">Descrição do Escopo *</p><p className="text-[11px]">{auto?.escopo ?? '—'}</p></div>
      </div>

      <ModalSection>Dados da OS</ModalSection>
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Cliente Faturamento *">
          <Select value={f.cliente_faturamento_id} onChange={(e) => set('cliente_faturamento_id')(e.target.value)} disabled={ro}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Data Início atividade *"><Input type="date" value={f.data_inicio} onChange={(e) => set('data_inicio')(e.target.value)} disabled={ro} /></Field>
        <Field label="Data Fim atividade *"><Input type="date" value={f.data_fim} onChange={(e) => set('data_fim')(e.target.value)} disabled={ro} /></Field>
        <Field label="Responsável Imetame *"><Input value={f.responsavel_imetame} onChange={(e) => set('responsavel_imetame')(e.target.value)} disabled={ro} /></Field>
        <Field label="Local realização (Cidade/Estado) *"><Input value={f.local_realizacao} onChange={(e) => set('local_realizacao')(e.target.value)} disabled={ro} /></Field>
        <Field label="Gestor do cliente *"><Input value={f.gestor_cliente} onChange={(e) => set('gestor_cliente')(e.target.value)} disabled={ro} /></Field>
        <Field label="Unidade de medida *">
          <Select value={f.unidade_medida} onChange={(e) => set('unidade_medida')(e.target.value)} disabled={ro}>
            <option value="">Selecione...</option>
            {UNIDADES.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
          </Select>
        </Field>
        <Field label="Quantidade *"><Input type="number" min={0} value={f.quantidade} onChange={(e) => set('quantidade')(e.target.value)} disabled={ro} /></Field>
        <Field label="NCM (se aplicável)"><Input value={f.ncm} onChange={(e) => set('ncm')(e.target.value)} disabled={ro} /></Field>
        <SN label="Pintura *" value={f.pintura} onChange={set('pintura')} disabled={ro} />
        <SN label="Retorno *" value={f.retorno} onChange={set('retorno')} disabled={ro} />
        <SN label="Memorial de Cálculo *" value={f.memorial_calculo} onChange={set('memorial_calculo')} disabled={ro} />
        <Field label="Material (se aplicável)">
          <Select value={f.material} onChange={(e) => set('material')(e.target.value)} disabled={ro}>
            <option value="">Selecione...</option>
            <option value="IMETAME">Imetame</option>
            <option value="TERCEIROS">Terceiros</option>
            <option value="AMBOS">Ambos</option>
          </Select>
        </Field>
        <SN label="ART *" value={f.art} onChange={set('art')} disabled={ro} />
        <SN label="Databook *" value={f.databook} onChange={set('databook')} disabled={ro} />
        <SN label="Material de apoio na pasta OS *" value={f.material_apoio} onChange={set('material_apoio')} disabled={ro} />
      </div>
      <Field label="Comentário" className="mb-2.5"><Textarea value={f.comentario} onChange={(e) => set('comentario')(e.target.value)} disabled={ro} /></Field>

      {existente && !ro && (
        <Field label="Justificativa da edição * (fica registrada no histórico com a data)">
          <Textarea value={f.justificativa} onChange={(e) => set('justificativa')(e.target.value)}
            placeholder="Explique o motivo da alteração do relatório já gravado (mín. 5 caracteres)..." />
        </Field>
      )}
    </Modal>
  )
}
