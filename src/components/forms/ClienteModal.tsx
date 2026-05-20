'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import type { ClienteListItem } from '@/types'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && editando) {
      setNome(editando.nome)
      setCnpj(editando.cnpj ?? '')
      setContatoNome(editando.contato_nome ?? '')
      setContatoEmail(editando.contato_email ?? '')
      setContatoTel(editando.contato_telefone ?? '')
      setCidade(editando.cidade ?? '')
      setEstado(editando.estado ?? '')
      setRamo(editando.ramo_atuacao ?? '')
    }
    if (open && !editando) {
      setNome(''); setCnpj(''); setContatoNome(''); setContatoEmail('')
      setContatoTel(''); setCidade(''); setEstado(''); setRamo('')
    }
    setError(null)
  }, [open, editando])

  const handleSubmit = async () => {
    if (!nome.trim())  { setError('Razão Social é obrigatória'); return }
    if (!cnpj.trim())  { setError('CNPJ é obrigatório'); return }
    if (!ramo)         { setError('Ramo de atuação é obrigatório'); return }
    if (!cidade.trim()) { setError('Cidade é obrigatória'); return }
    if (!estado)       { setError('UF é obrigatória'); return }
    setLoading(true); setError(null)
    try {
      const url = isEdit ? `/api/clientes/${editando!.id}` : '/api/clientes'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cnpj,
          contato_nome: contatoNome || null,
          contato_email: contatoEmail || null,
          contato_telefone: contatoTel || null,
          cidade,
          estado,
          ramo_atuacao: ramo || null,
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
        <Field label="CNPJ *">
          <Input placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </Field>
        <Field label="Ramo de atuação *">
          <Select value={ramo} onChange={(e) => setRamo(e.target.value)}>
            <option value="">Selecione...</option>
            {RAMOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
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
      <div className="grid grid-cols-2 gap-2.5">
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
    </Modal>
  )
}
