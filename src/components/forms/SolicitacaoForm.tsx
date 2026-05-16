'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { formatDateInput } from '@/lib/utils'
import type { SolicitacaoListItem } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  cliente_id: z.string().min(1, 'Selecione o cliente'),
  cliente_final_id: z.string().optional(),
  data_recebimento: z.string().optional(),
  segmento: z.string().optional(),
  contato: z.string().optional(),
  referencia_cliente: z.string().optional(),
  comprador: z.string().optional(),
  telefone_comprador: z.string().optional(),
  email_comprador: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  origem: z.string().optional(),
  escopo: z.string().optional(),
  classificacao: z.string().optional(),
  interesse: z.string().optional(),
  prazo_tecnica: z.string().optional(),
  prazo_tecnica_indeterminado: z.boolean().optional(),
  prazo_comercial: z.string().optional(),
  prazo_comercial_indeterminado: z.boolean().optional(),
  orcamentista_id: z.string().optional(),
  visita_tecnica: z.boolean().optional(),
  data_visita: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Cliente { id: number; nome: string; cidade?: string | null; estado?: string | null }
interface Orcamentista { id: number; nome: string }

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editando?: SolicitacaoListItem | null
  canAtribuir: boolean
}

export function SolicitacaoForm({ open, onClose, onSuccess, editando, canAtribuir }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [orcamentistas, setOrcamentistas] = useState<Orcamentista[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const visitaTecnica = watch('visita_tecnica')
  const prazoTecnicaIndet = watch('prazo_tecnica_indeterminado')
  const prazoComercialIndet = watch('prazo_comercial_indeterminado')
  const clienteFinalId = watch('cliente_final_id')

  // RN-09: Auto-fill Cidade/Estado when Cliente Final is selected
  useEffect(() => {
    if (!clienteFinalId) return
    const cf = clientes.find((c) => String(c.id) === clienteFinalId)
    if (cf) {
      if (cf.cidade) setValue('cidade', cf.cidade)
      if (cf.estado) setValue('estado', cf.estado)
    }
  }, [clienteFinalId, clientes, setValue])

  useEffect(() => {
    if (!open) return
    fetch('/api/clientes').then((r) => r.json()).then((r) => setClientes(r.data ?? []))
    fetch('/api/users/orcamentistas').then((r) => r.json()).then((r) => setOrcamentistas(r.data ?? []))

    if (editando) {
      reset({
        cliente_id: String(editando.cliente.id),
        cliente_final_id: editando.cliente_final ? String(editando.cliente_final.id) : '',
        segmento: (editando as unknown as { segmento?: string }).segmento ?? '',
        contato: editando.contato ?? '',
        cidade: editando.cidade ?? '',
        estado: editando.estado ?? '',
        escopo: editando.escopo ?? '',
        prazo_tecnica: formatDateInput(editando.prazo_tecnica),
        prazo_tecnica_indeterminado: editando.prazo_tecnica_indeterminado,
        prazo_comercial: formatDateInput(editando.prazo_comercial),
        prazo_comercial_indeterminado: editando.prazo_comercial_indeterminado,
        orcamentista_id: editando.orcamentista ? String(editando.orcamentista.id) : '',
        visita_tecnica: editando.visita_tecnica,
      })
    } else {
      reset({})
    }
  }, [open, editando, reset])

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        cliente_id: Number(values.cliente_id),
        cliente_final_id: values.cliente_final_id ? Number(values.cliente_final_id) : undefined,
        data_recebimento: values.data_recebimento || undefined,
        segmento: values.segmento || undefined,
        contato: values.contato || undefined,
        referencia_cliente: values.referencia_cliente || undefined,
        comprador: values.comprador || undefined,
        telefone_comprador: values.telefone_comprador || undefined,
        email_comprador: values.email_comprador || undefined,
        cidade: values.cidade || undefined,
        estado: values.estado || undefined,
        origem: values.origem || undefined,
        escopo: values.escopo || undefined,
        classificacao: values.classificacao || undefined,
        interesse: values.interesse || undefined,
        prazo_tecnica: values.prazo_tecnica_indeterminado ? undefined : (values.prazo_tecnica || undefined),
        prazo_tecnica_indeterminado: values.prazo_tecnica_indeterminado ?? false,
        prazo_comercial: values.prazo_comercial_indeterminado ? undefined : (values.prazo_comercial || undefined),
        prazo_comercial_indeterminado: values.prazo_comercial_indeterminado ?? false,
        orcamentista_id: values.orcamentista_id ? Number(values.orcamentista_id) : undefined,
        visita_tecnica: values.visita_tecnica ?? false,
        data_visita: values.data_visita || undefined,
      }

      const url = editando ? `/api/solicitacoes/${editando.id}` : '/api/solicitacoes'
      const method = editando ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Erro ao salvar')
        return
      }

      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const title = editando ? `Editar Solicitação — ${editando.numero}` : 'Nova Solicitação'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar solicitação'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Identificação */}
      <ModalSection>Identificação</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Cliente *" error={errors.cliente_id?.message}>
          <Select {...register('cliente_id')}>
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cliente Final">
          <Select {...register('cliente_final_id')}>
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Data de Recebimento">
          <Input type="date" {...register('data_recebimento')} />
        </Field>
        <Field label="Segmento">
          <Select {...register('segmento')}>
            <option value="">Selecione...</option>
            <option value="PAPEL_CELULOSE">Papel e Celulose</option>
            <option value="SIDERURGIA">Siderurgia</option>
            <option value="OLEO_GAS">Óleo e Gás</option>
            <option value="OUTROS">Outros</option>
          </Select>
        </Field>
        <Field label="Origem">
          <Select {...register('origem')}>
            <option value="">Selecione...</option>
            <option value="EMAIL">E-mail</option>
            <option value="TELEFONE">Telefone</option>
            <option value="VISITA">Visita</option>
            <option value="INDICACAO">Indicação</option>
            <option value="OUTRO">Outro</option>
          </Select>
        </Field>
      </div>

      {/* Localização (auto-preenchida pelo Cliente Final) */}
      <ModalSection>Localização</ModalSection>
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Cidade">
          <Input {...register('cidade')} placeholder="Ex: Vitória" />
        </Field>
        <Field label="Estado">
          <Input {...register('estado')} placeholder="Ex: ES" maxLength={2} />
        </Field>
        <Field label="Referência do Cliente">
          <Input {...register('referencia_cliente')} placeholder="Número do processo, etc." />
        </Field>
      </div>

      {/* Escopo e Classificação */}
      <ModalSection>Escopo e Classificação</ModalSection>
      <div className="grid grid-cols-1 gap-2.5 mb-2.5">
        <Field label="Escopo resumido">
          <Textarea {...register('escopo')} placeholder="Descreva o escopo..." />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Classificação">
          <Select {...register('classificacao')}>
            <option value="">Selecione...</option>
            <option value="OBRAS">Obras</option>
            <option value="PARADAS">Paradas</option>
            <option value="OLEO_GAS">Óleo e Gás</option>
            <option value="FABRICACOES">Fabricações</option>
          </Select>
        </Field>
        <Field label="Interesse">
          <Select {...register('interesse')}>
            <option value="">Selecione...</option>
            <option value="ALTO">Alto</option>
            <option value="MEDIO">Médio</option>
            <option value="BAIXO">Baixo</option>
          </Select>
        </Field>
      </div>

      {/* Prazos */}
      <ModalSection>Prazos</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <Field label="Prazo — Proposta Técnica">
            <Input type="date" {...register('prazo_tecnica')} disabled={prazoTecnicaIndet} />
          </Field>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input type="checkbox" {...register('prazo_tecnica_indeterminado')} className="w-3.5 h-3.5" />
            <span className="text-[10px] text-gray-500">Não Determinado</span>
          </label>
        </div>
        <div>
          <Field label="Prazo — Proposta Comercial">
            <Input type="date" {...register('prazo_comercial')} disabled={prazoComercialIndet} />
          </Field>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input type="checkbox" {...register('prazo_comercial_indeterminado')} className="w-3.5 h-3.5" />
            <span className="text-[10px] text-gray-500">Não Determinado</span>
          </label>
        </div>
      </div>

      {/* Visita Técnica */}
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Visita técnica">
          <div className="flex items-center gap-2 py-2">
            <input type="checkbox" id="visita" {...register('visita_tecnica')} className="w-4 h-4" />
            <label htmlFor="visita" className="text-xs text-gray-700">Sim, haverá visita técnica</label>
          </div>
        </Field>
        {visitaTecnica && (
          <Field label="Data da visita">
            <Input type="date" {...register('data_visita')} />
          </Field>
        )}
      </div>

      {/* Contato / Comprador (opcionais) */}
      <ModalSection>Contato (opcional)</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Contato / Comprador">
          <Input {...register('comprador')} placeholder="Nome do comprador" />
        </Field>
        <Field label="Telefone do Comprador">
          <Input {...register('telefone_comprador')} placeholder="(27) 99999-9999" />
        </Field>
        <Field label="E-mail do Comprador" className="col-span-2">
          <Input {...register('email_comprador')} placeholder="comprador@empresa.com" type="email" />
        </Field>
        <Field label="Referência / Contato interno" className="col-span-2">
          <Input {...register('contato')} placeholder="Nome do contato interno" />
        </Field>
      </div>

      {canAtribuir && (
        <>
          <ModalSection>Atribuição</ModalSection>
          <div className="grid grid-cols-1 gap-2.5 mb-2.5">
            <Field label="Atribuir orçamentista">
              <Select {...register('orcamentista_id')}>
                <option value="">Sem atribuição</option>
                {orcamentistas.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      )}
    </Modal>
  )
}
