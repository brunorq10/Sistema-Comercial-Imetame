'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { PERFIL_LABELS } from '@/types'
import type { UsuarioListItem, Perfil } from '@/types'

const PERFIS: Perfil[] = [
  'ADM_COMERCIAL', 'GESTAO_COMERCIAL',
  'ORCAMENTISTA', 'GESTAO_ACORDOS', 'ACORDOS', 'ADM_GERAL',
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editando?: UsuarioListItem | null
  isAdmin?: boolean
}

export function UsuarioModal({ open, onClose, onSuccess, editando, isAdmin }: Props) {
  const isEdit = !!editando

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [funcao, setFuncao] = useState('')
  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [senha, setSenha] = useState('')
  const [isAnalistaCritico, setIsAnalistaCritico] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && editando) {
      setNome(editando.nome)
      setEmail(editando.email)
      setFuncao(editando.funcao ?? '')
      setPerfil(editando.perfil)
      setIsAnalistaCritico(editando.is_analista_critico)
      setSenha('')
    }
    if (open && !editando) {
      setNome(''); setEmail(''); setFuncao(''); setPerfil(''); setSenha('')
      setIsAnalistaCritico(false)
    }
    setError(null)
  }, [open, editando])

  const handleSubmit = async () => {
    if (!nome.trim()) { setError('Nome Ã© obrigatÃ³rio'); return }
    if (!email.trim()) { setError('E-mail Ã© obrigatÃ³rio'); return }
    if (!perfil) { setError('Selecione o perfil de acesso'); return }
    if (!isEdit && !senha) { setError('Senha inicial Ã© obrigatÃ³ria'); return }
    if (senha && senha.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return }

    setLoading(true); setError(null)
    try {
      const url = isEdit ? `/api/usuarios/${editando!.id}` : '/api/usuarios'
      const body: Record<string, unknown> = {
        nome, email, funcao: funcao || null, perfil,
        is_analista_critico: isAnalistaCritico,
      }
      if (!isEdit) body.senha = senha
      if (isEdit && senha) body.nova_senha = senha

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      title={isEdit ? `Editar UsuÃ¡rio Â· ${editando!.nome}` : 'Novo UsuÃ¡rio'}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar UsuÃ¡rio'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <ModalSection>Dados do usuÃ¡rio</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Nome completo *" className="col-span-2">
          <Input placeholder="Ex: Maria Oliveira" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="E-mail corporativo *">
          <Input type="email" placeholder="maria@imetame.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="FunÃ§Ã£o">
          <Input placeholder="Ex: Engenheira de OrÃ§amentos" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
        </Field>
        <Field label="Perfil de acesso *" className="col-span-2">
          <Select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            <option value="">Selecione...</option>
            {PERFIS.map((p) => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}
          </Select>
        </Field>
      </div>

      {isAdmin && (
        <>
          <ModalSection>Papel especial</ModalSection>
          <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnalistaCritico}
              onChange={(e) => setIsAnalistaCritico(e.target.checked)}
              className="mt-0.5 accent-green-primary"
            />
            <div>
              <p className="text-[12px] font-medium text-gray-700">Definir como Analista CrÃ­tico</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Apenas um usuÃ¡rio pode ter esse papel. Ele terÃ¡ acesso Ã  aba de AnÃ¡lise de SolicitaÃ§Ãµes e poderÃ¡ aprovar ou reprovar solicitaÃ§Ãµes antes de irem para o orÃ§amentista.
              </p>
            </div>
          </label>
        </>
      )}

      <ModalSection>{isEdit ? 'Redefinir senha (opcional)' : 'Senha inicial *'}</ModalSection>
      <Field label={isEdit ? 'Nova senha â€” deixe em branco para nÃ£o alterar' : 'Senha (mÃ­n. 6 caracteres)'}>
        <Input
          type="password"
          placeholder={isEdit ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : 'mÃ­nimo 6 caracteres'}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </Field>
    </Modal>
  )
}

