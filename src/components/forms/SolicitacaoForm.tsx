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
  cliente_id:        z.string().min(1, 'Selecione o cliente'),
  cliente_final_id:  z.string().min(1, 'Selecione o cliente final'),
  cidade:            z.string().min(1, 'Selecione a cidade'),
  estado:            z.string().min(1, 'Estado obrigatório'),
  data_recebimento:  z.string().min(1, 'Informe a data de recebimento'),
  segmento:          z.string().min(1, 'Segmento obrigatório'),
  origem:            z.string().min(1, 'Selecione a origem'),
  escopo:            z.string().min(1, 'Informe o escopo resumido'),
  referencia_cliente: z.string().min(1, 'Informe a referência do cliente'),
  prazo_tecnica:     z.string().min(1, 'Informe a data da proposta técnica'),
  prazo_comercial:   z.string().min(1, 'Informe a data da proposta comercial'),
  visita_tecnica:    z.enum(['SIM', 'NAO'], { required_error: 'Selecione uma opção' }),
  data_visita:       z.string().optional(),
  // campos opcionais (edição)
  classificacao:     z.string().optional(),
  interesse:         z.string().optional(),
  comprador:         z.string().optional(),
  telefone_comprador: z.string().optional(),
  email_comprador:   z.string().optional(),
  orcamentista_id:   z.string().optional(),
}).refine(
  (d) => d.visita_tecnica !== 'SIM' || (d.data_visita && d.data_visita.length > 0),
  { message: 'Informe a data da visita', path: ['data_visita'] },
)

type FormValues = z.infer<typeof schema>

interface Filial { id: number; nome: string | null; cidade: string; estado: string }
interface Cliente {
  id: number
  nome: string
  cidade: string | null
  estado: string | null
  segmento: string | null
  ramo_atuacao: string | null
  filiais: Filial[]
}
interface Orcamentista { id: number; nome: string }

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editando?: SolicitacaoListItem | null
  canAtribuir: boolean
}

const SEGMENTO_LABELS: Record<string, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose',
  SIDERURGIA:     'Siderurgia',
  OLEO_GAS:       'Óleo e Gás',
  OUTROS:         'Outros',
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

  const visitaTecnica    = watch('visita_tecnica')
  const clienteFinalId   = watch('cliente_final_id')
  const cidadeSelecionada = watch('cidade')

  // Filiais do cliente final selecionado
  const clienteFinal = clientes.find((c) => String(c.id) === clienteFinalId)
  const filiaisDisponiveis: Filial[] = clienteFinal?.filiais ?? []

  // Auto-fill estado quando cidade muda
  useEffect(() => {
    if (!cidadeSelecionada || !filiaisDisponiveis.length) return
    const filial = filiaisDisponiveis.find((f) => f.cidade === cidadeSelecionada)
    if (filial) setValue('estado', filial.estado)
  }, [cidadeSelecionada, filiaisDisponiveis, setValue])

  // Auto-fill segmento quando cliente final muda
  useEffect(() => {
    if (!clienteFinal) return
    const seg = clienteFinal.segmento ?? clienteFinal.ramo_atuacao ?? ''
    // MINERACAO não existe em Segmento → mapear para OUTROS
    const mapped = seg === 'MINERACAO' ? 'OUTROS' : seg
    if (mapped) setValue('segmento', mapped)
    // Limpa cidade ao trocar cliente final
    setValue('cidade', '')
    setValue('estado', '')
  }, [clienteFinalId, clienteFinal, setValue])

  useEffect(() => {
    if (!open) return
    fetch('/api/clientes')
      .then((r) => r.json())
      .then((r) => setClientes(r.data ?? []))
    fetch('/api/users/orcamentistas')
      .then((r) => r.json())
      .then((r) => setOrcamentistas(r.data ?? []))

    if (editando) {
      reset({
        cliente_id:         String(editando.cliente.id),
        cliente_final_id:   editando.cliente_final ? String(editando.cliente_final.id) : '',
        cidade:             editando.cidade ?? '',
        estado:             editando.estado ?? '',
        data_recebimento:   formatDateInput(editando.data_recebimento),
        segmento:           editando.segmento ?? '',
        origem:             editando.origem ?? '',
        escopo:             editando.escopo ?? '',
        referencia_cliente: editando.referencia_cliente ?? '',
        prazo_tecnica:      formatDateInput(editando.prazo_tecnica),
        prazo_comercial:    formatDateInput(editando.prazo_comercial),
        visita_tecnica:     editando.visita_tecnica ? 'SIM' : 'NAO',
        data_visita:        formatDateInput(editando.data_visita),
        classificacao:      editando.classificacao ?? '',
        interesse:          editando.interesse ?? '',
        orcamentista_id:    editando.orcamentista ? String(editando.orcamentista.id) : '',
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
        cliente_id:         Number(values.cliente_id),
        cliente_final_id:   Number(values.cliente_final_id),
        cidade:             values.cidade,
        estado:             values.estado,
        data_recebimento:   values.data_recebimento,
        segmento:           values.segmento,
        origem:             values.origem,
        escopo:             values.escopo,
        referencia_cliente: values.referencia_cliente,
        prazo_tecnica:      values.prazo_tecnica,
        prazo_comercial:    values.prazo_comercial,
        visita_tecnica:     values.visita_tecnica === 'SIM',
        data_visita:        values.visita_tecnica === 'SIM' ? values.data_visita : undefined,
        classificacao:      values.classificacao || undefined,
        interesse:          values.interesse || undefined,
        comprador:          values.comprador || undefined,
        telefone_comprador: values.telefone_comprador || undefined,
        email_comprador:    values.email_comprador || undefined,
        orcamentista_id:    values.orcamentista_id ? Number(values.orcamentista_id) : undefined,
      }

      const url    = editando ? `/api/solicitacoes/${editando.id}` : '/api/solicitacoes'
      const method = editando ? 'PUT' : 'POST'

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()

      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }

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
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar solicitação'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* ── Identificação ───────────────────────────────────────────────────── */}
      <ModalSection>Identificação</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Cliente *" error={errors.cliente_id?.message}>
          <Select {...register('cliente_id')}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Cliente Final *" error={errors.cliente_final_id?.message}>
          <Select {...register('cliente_final_id')}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
      </div>

      {/* ── Localização ─────────────────────────────────────────────────────── */}
      <ModalSection>Localização</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Cidade *" error={errors.cidade?.message}>
          <Select {...register('cidade')} disabled={!clienteFinalId}>
            <option value="">{clienteFinalId ? 'Selecione a cidade...' : 'Selecione o cliente final primeiro'}</option>
            {filiaisDisponiveis.map((f) => (
              <option key={f.id} value={f.cidade}>
                {f.cidade}{f.nome ? ` — ${f.nome}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado *" error={errors.estado?.message}>
          <Input
            {...register('estado')}
            maxLength={2}
            className="bg-[#EEF7EE] text-[#1565C0] font-semibold"
            readOnly
            placeholder="Preenchido automaticamente"
          />
        </Field>
      </div>

      {/* ── Dados da Solicitação ────────────────────────────────────────────── */}
      <ModalSection>Dados da Solicitação</ModalSection>
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        <Field label="Data de Recebimento *" error={errors.data_recebimento?.message}>
          <Input type="date" {...register('data_recebimento')} />
        </Field>
        <Field label="Segmento *" error={errors.segmento?.message}>
          <Select {...register('segmento')} className="bg-[#EEF7EE] text-[#1565C0] font-semibold">
            <option value="">Selecione...</option>
            {Object.entries(SEGMENTO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Origem *" error={errors.origem?.message}>
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

      <div className="grid grid-cols-1 gap-2.5 mb-2.5">
        <Field label="Escopo Resumido *" error={errors.escopo?.message}>
          <Textarea {...register('escopo')} placeholder="Descreva o escopo da solicitação..." />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2.5 mb-2.5">
        <Field label="Referência do Cliente *" error={errors.referencia_cliente?.message}>
          <Input {...register('referencia_cliente')} placeholder="Número do processo, RFQ, etc." />
        </Field>
      </div>

      {/* ── Prazos ──────────────────────────────────────────────────────────── */}
      <ModalSection>Prazos</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Data Proposta Técnica *" error={errors.prazo_tecnica?.message}>
          <Input type="date" {...register('prazo_tecnica')} />
        </Field>
        <Field label="Data Proposta Comercial *" error={errors.prazo_comercial?.message}>
          <Input type="date" {...register('prazo_comercial')} />
        </Field>
      </div>

      {/* ── Visita Técnica ──────────────────────────────────────────────────── */}
      <ModalSection>Visita Técnica</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Haverá visita técnica? *" error={errors.visita_tecnica?.message}>
          <Select {...register('visita_tecnica')}>
            <option value="">Selecione...</option>
            <option value="SIM">Sim</option>
            <option value="NAO">Não</option>
          </Select>
        </Field>
        {visitaTecnica === 'SIM' && (
          <Field label="Data da Visita *" error={errors.data_visita?.message}>
            <Input type="date" {...register('data_visita')} />
          </Field>
        )}
      </div>

      {/* ── Contato do comprador (criador, opcional) ────────────────────────── */}
      <ModalSection>Contato do Comprador (opcional)</ModalSection>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Comprador">
          <Input {...register('comprador')} placeholder="Nome do comprador" />
        </Field>
        <Field label="Telefone">
          <Input {...register('telefone_comprador')} placeholder="(27) 99999-9999" />
        </Field>
        <Field label="E-mail" className="col-span-2">
          <Input {...register('email_comprador')} type="email" placeholder="comprador@empresa.com" />
        </Field>
      </div>

      {/* ── Analista Crítico ─────────────────────────────────────────────────── */}
      {canAtribuir && (
        <>
          <ModalSection>Classificação — Analista Crítico</ModalSection>
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
            <Field label="Nível de Interesse">
              <Select {...register('interesse')}>
                <option value="">Selecione...</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Médio</option>
                <option value="BAIXO">Baixo</option>
              </Select>
            </Field>
          </div>

          <ModalSection>Atribuição — Analista Crítico</ModalSection>
          <div className="grid grid-cols-1 gap-2.5 mb-2.5">
            <Field label="Atribuir orçamentista">
              <Select {...register('orcamentista_id')}>
                <option value="">Sem atribuição</option>
                {orcamentistas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
          </div>
        </>
      )}
    </Modal>
  )
}
