'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { formatDateInput } from '@/lib/utils'
import type { SolicitacaoListItem } from '@/types'

// ── Tipos auxiliares ──────────────────────────────────────────────────────────
interface Filial { id: number; nome: string | null; cidade: string; estado: string }
interface ClienteOpt {
  id: number; nome: string
  cidade: string | null; estado: string | null
  segmento: string | null; ramo_atuacao: string | null
  filiais: Filial[]
}
interface Orcamentista { id: number; nome: string }

const SEGMENTO_LABELS: Record<string, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose',
  SIDERURGIA:     'Siderurgia',
  OLEO_GAS:       'Óleo e Gás',
  OUTROS:         'Outros',
}

// ── Zod schema ────────────────────────────────────────────────────────────────
const formSchema = z.object({
  cliente_id:         z.string().min(1, 'Selecione o cliente'),
  cliente_final_id:   z.string().min(1, 'Selecione o cliente final'),
  cidade:             z.string().min(1, 'Selecione a cidade'),
  estado:             z.string().min(1, 'Estado obrigatório'),
  data_recebimento:   z.string().min(1, 'Informe a data de recebimento'),
  segmento:           z.string().min(1, 'Segmento obrigatório'),
  origem:             z.string().min(1, 'Selecione a origem'),
  escopo:             z.string().min(1, 'Informe o escopo resumido'),
  referencia_cliente: z.string().min(1, 'Informe a referência do cliente'),
  prazo_tecnica:      z.string().min(1, 'Informe a data da proposta técnica'),
  prazo_comercial:    z.string().min(1, 'Informe a data da proposta comercial'),
  visita_tecnica:     z.enum(['SIM', 'NAO'], { required_error: 'Selecione uma opção' }),
  data_visita:        z.string().optional(),
  classificacao:      z.string().optional(),
  interesse:          z.string().optional(),
  comprador:          z.string().optional(),
  telefone_comprador: z.string().optional(),
  email_comprador:    z.string().optional(),
  orcamentista_id:    z.string().optional(),
}).refine(
  (d) => d.visita_tecnica !== 'SIM' || (d.data_visita && d.data_visita.length > 0),
  { message: 'Informe a data da visita', path: ['data_visita'] },
)

type FormValues = z.infer<typeof formSchema>
type Step = 'pergunta' | 'formulario'

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacao: SolicitacaoListItem | null
  canAtribuir: boolean
}

// ── Componente ────────────────────────────────────────────────────────────────
export function NovaRevisaoModal({ open, onClose, onSuccess, solicitacao, canAtribuir }: Props) {
  const [step, setStep] = useState<Step>('pergunta')
  const [asSold, setAsSold] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<ClienteOpt[]>([])
  const [orcamentistas, setOrcamentistas] = useState<Orcamentista[]>([])
  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  const visitaTecnica    = watch('visita_tecnica')
  const clienteFinalId   = watch('cliente_final_id')
  const cidadeSelecionada = watch('cidade')

  const clienteFinal = clientes.find((c) => String(c.id) === clienteFinalId)
  const filiaisDisponiveis: Filial[] = (() => {
    if (!clienteFinal) return []
    if (clienteFinal.filiais.length > 0) return clienteFinal.filiais
    if (clienteFinal.cidade) return [{ id: 0, nome: null, cidade: clienteFinal.cidade, estado: clienteFinal.estado ?? '' }]
    return []
  })()

  useEffect(() => {
    if (!cidadeSelecionada || !filiaisDisponiveis.length) return
    const filial = filiaisDisponiveis.find((f) => f.cidade === cidadeSelecionada)
    if (filial) setValue('estado', filial.estado)
  }, [cidadeSelecionada, filiaisDisponiveis, setValue])

  useEffect(() => {
    if (!clienteFinal) return
    const seg = clienteFinal.segmento ?? clienteFinal.ramo_atuacao ?? ''
    const mapped = seg === 'MINERACAO' ? 'OUTROS' : seg
    if (mapped) setValue('segmento', mapped)
    // Só limpa cidade/estado se a cidade atual NÃO pertencer ao cliente final
    // (preserva o prefill vindo da última revisão)
    const cidadesValidas = clienteFinal.filiais.length > 0
      ? clienteFinal.filiais.map((f) => f.cidade)
      : [clienteFinal.cidade].filter((c): c is string => !!c)
    if (cidadeSelecionada && cidadesValidas.includes(cidadeSelecionada)) return
    setValue('cidade', '')
    setValue('estado', '')
  }, [clienteFinalId, clienteFinal, cidadeSelecionada, setValue])

  useEffect(() => {
    if (!open) {
      setStep('pergunta')
      setAsSold(false)
      setError(null)
      return
    }
    fetch('/api/clientes').then((r) => r.json()).then((r) => setClientes(r.data ?? []))
    fetch('/api/users/orcamentistas').then((r) => r.json()).then((r) => setOrcamentistas(r.data ?? []))
    if (solicitacao) {
      reset({
        cliente_id:         String(solicitacao.cliente.id),
        cliente_final_id:   solicitacao.cliente_final ? String(solicitacao.cliente_final.id) : '',
        cidade:             solicitacao.cidade ?? '',
        estado:             solicitacao.estado ?? '',
        data_recebimento:   formatDateInput(solicitacao.data_recebimento),
        segmento:           solicitacao.segmento ?? '',
        origem:             solicitacao.origem ?? '',
        escopo:             solicitacao.escopo ?? '',
        referencia_cliente: solicitacao.referencia_cliente ?? '',
        prazo_tecnica:      formatDateInput(solicitacao.prazo_tecnica),
        prazo_comercial:    formatDateInput(solicitacao.prazo_comercial),
        visita_tecnica:     solicitacao.visita_tecnica ? 'SIM' : 'NAO',
        data_visita:        formatDateInput(solicitacao.data_visita),
        comprador:          solicitacao.comprador ?? '',
        telefone_comprador: solicitacao.telefone_comprador ?? '',
        email_comprador:    solicitacao.email_comprador ?? '',
        classificacao:      solicitacao.classificacao ?? '',
        interesse:          solicitacao.interesse ?? '',
        orcamentista_id:    solicitacao.orcamentista ? String(solicitacao.orcamentista.id) : '',
      })
    }
  }, [open, solicitacao, reset])

  const handleEscolhaTipo = (escolhido: boolean) => {
    setAsSold(escolhido)
    setStep('formulario')
  }

  const onSubmit = async (values: FormValues) => {
    if (!solicitacao) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        as_sold:            asSold,
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
        data_visita:        values.visita_tecnica === 'SIM' ? (values.data_visita ?? null) : null,
        classificacao:      values.classificacao || null,
        interesse:          values.interesse || null,
        comprador:          values.comprador || null,
        telefone_comprador: values.telefone_comprador || null,
        email_comprador:    values.email_comprador || null,
        orcamentista_id:    values.orcamentista_id ? Number(values.orcamentista_id) : null,
      }
      const res = await fetch(`/api/solicitacoes/${solicitacao.id}/nova-revisao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao criar revisão'); return }
      if (json.message) { setAvisoSucesso(json.message); return }
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!solicitacao) return null

  // Aviso padrão pós-envio: a revisão vai para avaliação do orçamentista
  if (avisoSucesso) {
    return (
      <ConfirmDialog
        open
        title="Revisão enviada para avaliação"
        variant="success"
        message={avisoSucesso}
        confirmLabel="Entendi"
        cancelLabel={null}
        onConfirm={() => { setAvisoSucesso(null); onSuccess(); onClose() }}
        onClose={() => { setAvisoSucesso(null); onSuccess(); onClose() }}
      />
    )
  }

  const nextLabel = asSold
    ? 'As Sold.'
    : `Rev${String(solicitacao.versao_atual).padStart(2, '0')}`

  // ── Passo 1: pergunta ────────────────────────────────────────────────────────
  if (step === 'pergunta') {
    return (
      <Modal open={open}
      confirmClose onClose={onClose} title={`Nova Revisão — ${solicitacao.numero}`}>
        <div className="space-y-2 text-[12px] text-gray-700 mb-5">
          <p className="font-semibold">Esta revisão será uma proposta <span className="text-green-dark">As Sold.</span>?</p>
          <p className="text-[11px] text-gray-500">
            &quot;As Sold.&quot; indica a proposta final fechada. Após ela, não haverá mais revisões.
            Exemplo: Rev00 → Rev01 → <strong>As Sold.</strong>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleEscolhaTipo(true)}
            className="flex-1 border-2 border-gray-200 rounded-md px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <p className="text-[12px] font-bold text-gray-700">Sim — proposta As Sold.</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Versão final consolidada.</p>
          </button>
          <button
            onClick={() => handleEscolhaTipo(false)}
            className="flex-1 border-2 border-gray-200 rounded-md px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <p className="text-[12px] font-bold text-gray-700">Não — revisão normal</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Continua o processo de elaboração.</p>
          </button>
        </div>

        <div className="flex justify-end mt-5">
          <ModalCancelButton />
        </div>
      </Modal>
    )
  }

  // ── Passo 2: formulário completo ─────────────────────────────────────────────
  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={`Nova Revisão ${nextLabel} — ${solicitacao.numero}`}
      wide
      footer={
        <>
          <Button variant="outline" onClick={() => setStep('pergunta')} disabled={loading}>
            ← Voltar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? 'Criando...' : `Criar revisão ${nextLabel}`}
          </Button>
        </>
      }
    >
      {asSold && (
        <div className="bg-green-light border border-green-primary rounded-md px-3 py-2 mb-4 text-[11px] text-green-dark font-semibold">
          Esta revisão será marcada como <strong>As Sold.</strong> — versão final consolidada. Não serão permitidas novas revisões após esta.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* ── Identificação ──────────────────────────────────────────────────── */}
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

      {/* ── Localização ────────────────────────────────────────────────────── */}
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

      {/* ── Dados da Solicitação ───────────────────────────────────────────── */}
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

      {/* ── Contato do comprador ────────────────────────────────────────────── */}
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

      {/* ── Classificação ───────────────────────────────────────────────────── */}
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
        </>
      )}

      {/* ── Orçamentista ────────────────────────────────────────────────────── */}
      {canAtribuir && (
        <>
          <ModalSection>Atribuição — Analista Crítico</ModalSection>
          <div className="grid grid-cols-1 gap-2.5 mb-2.5">
            <Field label="Orçamentista">
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

