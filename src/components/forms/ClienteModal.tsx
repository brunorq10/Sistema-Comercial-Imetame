'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import type { ClienteListItem, Segmento } from '@/types'
import { SEGMENTO_LABELS } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editando?: ClienteListItem | null
}

const RAMOS = [
  { value: 'PAPEL_CELULOSE', label: 'Papel e Celulose' },
  { value: 'SIDERURGIA', label: 'Siderurgia' },
  { value: 'MINERACAO', label: 'Mineração' },
  { value: 'OLEO_GAS', label: 'Óleo e Gás' },
  { value: 'OUTROS', label: 'Outros' },
]

const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

interface FilialForm {
  cidade: string
  estado: string
}

export function ClienteModal({ open, onClose, onSuccess, editando }: Props) {
  const isEdit = !!editando

  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contatoNome, setContatoNome] = useState('')
  const [contatoEmail, setContatoEmail] = useState('')
  const [contatoTel, setContatoTel] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [ramo, setRamo] = useState('')
  const [segmento, setSegmento] = useState('')
  const [filiais, setFiliais] = useState<FilialForm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!editando) {
      setNome(''); setCnpj(''); setContatoNome(''); setContatoEmail('')
      setContatoTel(''); setCidade(''); setEstado(''); setRamo(''); setSegmento(''); setFiliais([])
      return
    }
    setNome(editando.nome)
    setCnpj(editando.cnpj ?? '')
    setContatoNome(editando.contato_nome ?? '')
    setContatoEmail(editando.contato_email ?? '')
    setContatoTel(editando.contato_telefone ?? '')
    setCidade(editando.cidade ?? '')
    setEstado(editando.estado ?? '')
    setRamo(editando.ramo_atuacao ?? '')
    setSegmento(editando.segmento ?? '')
    setFiliais([])
    fetch(`/api/clientes/${editando.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.filiais) {
          setFiliais(j.data.filiais.map((f: { cidade: string; estado: string }) => ({ cidade: f.cidade, estado: f.estado })))
        }
      })
      .catch(() => null)
  }, [open, editando])

  const addFilial = () => setFiliais((prev) => [...prev, { cidade: '', estado: '' }])
  const removeFilial = (i: number) => setFiliais((prev) => prev.filter((_, idx) => idx !== i))
  const updateFilial = (i: number, field: keyof FilialForm, value: string) =>
    setFiliais((prev) => prev.map((f, idx) => idx !== i ? f : { ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!nome.trim()) { setError('Razão Social é obrigatória'); return }
    if (!ramo) { setError('Ramo de atuação é obrigatório'); return }
    if (!cidade.trim()) { setError('Cidade é obrigatória'); return }
    if (!estado) { setError('UF é obrigatória'); return }
    for (let i = 0; i < filiais.length; i++) {
      if (!filiais[i].cidade.trim()) { setError(`Filial ${i + 1}: cidade é obrigatória`); return }
      if (!filiais[i].estado) { setError(`Filial ${i + 1}: UF é obrigatória`); return }
    }
    setLoading(true); setError(null)
    try {
      const url = isEdit ? `/api/clientes/${editando!.id}` : '/api/clientes'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cnpj: cnpj || null,
          contato_nome: contatoNome || null,
          contato_email: contatoEmail || null,
          contato_telefone: contatoTel || null,
          cidade,
          estado,
          ramo_atuacao: ramo || null,
          segmento: segmento || null,
          filiais,
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
      onClose={onClose}
      title={isEdit ? `Editar Cliente · ${editando!.codigo ?? ''} ${editando!.nome}` : 'Novo Cliente'}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Cliente'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <ModalSection>Dados da empresa</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Razão Social *" className="col-span-2">
          <Input placeholder="Ex: Petrobras S.A." value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="CNPJ">
          <Input placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </Field>
        <Field label="Ramo de atuação *">
          <Select value={ramo} onChange={(e) => setRamo(e.target.value)}>
            <option value="">Selecione...</option>
            {RAMOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Segmento">
          <Select value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Selecione...</option>
            {(Object.entries(SEGMENTO_LABELS) as [Segmento, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <div />
        <Field label="Cidade *">
          <Input placeholder="Ex: Rio de Janeiro" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </Field>
        <Field label="UF *">
          <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">—</option>
            {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </Select>
        </Field>
      </div>

      <ModalSection>Contato principal</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Nome" className="col-span-2">
          <Input placeholder="Ex: João Silva" value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" placeholder="joao@empresa.com" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input placeholder="(21) 99999-0000" value={contatoTel} onChange={(e) => setContatoTel(e.target.value)} />
        </Field>
      </div>

      <ModalSection>Filiais / Unidades</ModalSection>
      <div className="space-y-2 mb-2.5">
        {filiais.map((f, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              {i === 0 && <p className="text-[11px] text-gray-500 mb-0.5">Cidade</p>}
              <Input placeholder="Ex: Volta Redonda" value={f.cidade} onChange={(e) => updateFilial(i, 'cidade', e.target.value)} />
            </div>
            <div className="w-20">
              {i === 0 && <p className="text-[11px] text-gray-500 mb-0.5">UF</p>}
              <Select value={f.estado} onChange={(e) => updateFilial(i, 'estado', e.target.value)}>
                <option value="">—</option>
                {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </div>
            <button
              onClick={() => removeFilial(i)}
              className="text-red-400 hover:text-red-600 text-lg leading-none pb-1"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={addFilial}
          className="w-full border border-dashed border-green-primary text-green-primary text-[12px] py-1.5 rounded hover:bg-green-light transition-colors"
        >
          + Adicionar filial
        </button>
      </div>
    </Modal>
  )
}
