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

const IconEye = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
)
const IconEyeOff = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
  </svg>
)

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
  const [mostrarSenha, setMostrarSenha] = useState(false)
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
    setMostrarSenha(false)
  }, [open, editando])

  const handleSubmit = async () => {
    if (!nome.trim()) { setError('Nome é obrigatório'); return }
    if (!email.trim()) { setError('E-mail é obrigatório'); return }
    if (!perfil) { setError('Selecione o perfil de acesso'); return }
    if (!isEdit && !senha) { setError('Senha inicial é obrigatória'); return }
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
      title={isEdit ? `Editar Usuário · ${editando!.nome}` : 'Novo Usuário'}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Usuário'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <ModalSection>Dados do usuário</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Nome completo *" className="col-span-2">
          <Input placeholder="Ex: Maria Oliveira" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="E-mail corporativo *">
          <Input type="email" placeholder="maria@imetame.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Função">
          <Input placeholder="Ex: Engenheira de Orçamentos" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
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
              <p className="text-[12px] font-medium text-gray-700">Definir como Analista Crítico</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Apenas um usuário pode ter esse papel. Ele terá acesso à aba de Análise de Solicitações e poderá aprovar ou reprovar solicitações antes de irem para o orçamentista.
              </p>
            </div>
          </label>
        </>
      )}

      <ModalSection>{isEdit ? 'Redefinir senha (opcional)' : 'Senha inicial *'}</ModalSection>
      <Field label={isEdit ? 'Nova senha — deixe em branco para não alterar' : 'Senha (mín. 6 caracteres) *'}>
        <div className="relative">
          <Input
            type={mostrarSenha ? 'text' : 'password'}
            placeholder={isEdit ? '••••••••' : 'mínimo 6 caracteres'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
          </button>
        </div>
      </Field>
    </Modal>
  )
}

