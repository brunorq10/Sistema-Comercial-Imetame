'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { PERFIL_LABELS } from '@/types'
import type { UsuarioListItem } from '@/types'

const MOTIVOS = [
  { value: 'FERIAS', label: 'Férias' },
  { value: 'AFASTAMENTO', label: 'Afastamento' },
  { value: 'LICENCA', label: 'Licença' },
  { value: 'OUTRO', label: 'Outro' },
] as const

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  usuarios: UsuarioListItem[]
}

export function SubstituicaoTemporariaModal({ open, onClose, onSuccess, usuarios }: Props) {
  const [titularId, setTitularId] = useState('')
  const [substitutoId, setSubstitutoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [motivoTipo, setMotivoTipo] = useState<typeof MOTIVOS[number]['value'] | ''>('')
  const [motivoDetalhe, setMotivoDetalhe] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitularId(''); setSubstitutoId(''); setDataInicio(''); setDataFim('')
      setMotivoTipo(''); setMotivoDetalhe(''); setError(null)
    }
  }, [open])

  const titular = usuarios.find((u) => String(u.id) === titularId)
  // Só mostra como opção de substituto quem tem o mesmo perfil do titular —
  // regra de negócio: substituto precisa de acesso compatível ao(s) módulo(s)
  // do titular (ehDonoOuSubstituto só concede acesso quando o perfil bate).
  const substitutosCompativeis = titular ? usuarios.filter((u) => u.perfil === titular.perfil && u.id !== titular.id) : []

  const handleSubmit = async () => {
    if (!titularId) { setError('Selecione o titular'); return }
    if (!substitutoId) { setError('Selecione o substituto'); return }
    if (!dataInicio || !dataFim) { setError('Informe o período da substituição'); return }
    if (!motivoTipo) { setError('Selecione o motivo'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/substituicoes/temporarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titular_id: Number(titularId),
          substituto_id: Number(substitutoId),
          data_inicio: dataInicio,
          data_fim: dataFim,
          motivo_tipo: motivoTipo,
          motivo_detalhe: motivoDetalhe || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title="Nova Substituição Temporária"
      subtitle="Titularidade não muda — o substituto ganha acesso igual ao titular durante o período"
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : 'Criar Substituição'}</Button>
        </>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      <ModalSection>Envolvidos</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Titular (será substituído) *">
          <SearchableSelect
            value={titularId}
            onChange={(v) => { setTitularId(v); setSubstitutoId('') }}
            options={usuarios.map((u) => ({ value: String(u.id), label: `${u.nome} — ${PERFIL_LABELS[u.perfil]}` }))}
            placeholder="Buscar usuário..."
            emptyLabel="Nenhum selecionado"
          />
        </Field>
        <Field label="Substituto *">
          <SearchableSelect
            value={substitutoId}
            onChange={setSubstitutoId}
            options={substitutosCompativeis.map((u) => ({ value: String(u.id), label: `${u.nome} — ${PERFIL_LABELS[u.perfil]}` }))}
            placeholder={titular ? 'Buscar usuário...' : 'Selecione o titular primeiro'}
            emptyLabel="Nenhum selecionado"
          />
          {titular && substitutosCompativeis.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1">Nenhum outro usuário com o perfil {PERFIL_LABELS[titular.perfil]} está disponível.</p>
          )}
        </Field>
      </div>

      <ModalSection>Período</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Data de início *">
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
            className="w-full px-2.5 py-[7px] border border-gray-300 rounded text-xs text-gray-900 bg-white outline-none focus:border-green-primary" />
        </Field>
        <Field label="Data de fim *">
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
            className="w-full px-2.5 py-[7px] border border-gray-300 rounded text-xs text-gray-900 bg-white outline-none focus:border-green-primary" />
        </Field>
      </div>

      <ModalSection>Motivo</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Motivo *">
          <Select value={motivoTipo} onChange={(e) => setMotivoTipo(e.target.value as typeof motivoTipo)}>
            <option value="">Selecione...</option>
            {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Detalhe (opcional)">
          <Textarea rows={1} value={motivoDetalhe} onChange={(e) => setMotivoDetalhe(e.target.value)} placeholder="Observação adicional" />
        </Field>
      </div>
    </Modal>
  )
}
