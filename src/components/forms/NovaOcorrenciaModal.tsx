'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { todayInput } from '@/lib/utils'
import { TIPOS_OCORRENCIA, RESPONSABILIDADES, IMPACTOS_OCORRENCIA } from '@/lib/ocorrencias'
import { AnexosUploader, type AnexoNovo } from '@/components/forms/AnexosUploader'

interface Props {
  open: boolean
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (nova: any) => void
  contratoId: number
  numero: string
  subtitulo: string
  proximoCodigo: string
}

const svg = (d: React.ReactNode) => (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width={20} height={20} {...p}>{d}</svg>
)
const TIPO_ICONS: Record<string, ReturnType<typeof svg>> = {
  FALTA_ENERGIA: svg(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  CHUVA: svg(<><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" /><path d="M8 19v2M12 19v2M16 19v2" /></>),
  ENTREGA_MATERIAL: svg(<><path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>),
  PARALISACAO_TERCEIROS: svg(<><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="m16 11 5 5M21 11l-5 5" /></>),
  INDISPONIBILIDADE_LOCAL: svg(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><line x1="4.5" y1="4.5" x2="19.5" y2="19.5" /></>),
  OUTROS: svg(<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>),
}

const AMBAR = '#B45309'
const AMBAR_BG = '#FEF6EC'

export function NovaOcorrenciaModal({ open, onClose, onSuccess, contratoId, numero, subtitulo, proximoCodigo }: Props) {
  const [tipo, setTipo] = useState<string | null>(null)
  const [responsabilidade, setResponsabilidade] = useState<string | null>(null)
  const [data, setData] = useState(todayInput())
  const [descricao, setDescricao] = useState('')
  const [impactos, setImpactos] = useState<string[]>([])
  const [dataNotif, setDataNotif] = useState('')
  const [anexos, setAnexos] = useState<AnexoNovo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleImpacto = (v: string) =>
    setImpactos((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const handleSubmit = async () => {
    if (!tipo) { setError('Selecione o tipo de ocorrência'); return }
    if (!responsabilidade) { setError('Selecione a responsabilidade'); return }
    if (!data) { setError('Informe a data do evento'); return }
    if (!descricao.trim()) { setError('Informe a descrição'); return }
    if (impactos.length === 0) { setError('Selecione pelo menos um impacto'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/acordos/contratos/${contratoId}/ocorrencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, responsabilidade, data, descricao: descricao.trim(), impactos,
          data_notificacao_cliente: dataNotif || null,
          anexos,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess(json.data)
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova Ocorrência Contratual"
      subtitle={subtitulo}
      hasChanges
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar Ocorrência'}</Button>
        </>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      {/* Código (read-only) */}
      <div className="mb-4 bg-green-light/60 border border-green-200 rounded-md px-3 py-2">
        <span className="text-[15px] font-bold text-green-dark">{proximoCodigo}</span>
        <p className="text-[10px] text-gray-500 mt-0.5">Gerado automaticamente ao salvar — sequencial por contrato</p>
      </div>

      {/* 1. Tipo */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Tipo de Ocorrência *</label>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TIPOS_OCORRENCIA.map((t) => {
          const sel = tipo === t.value
          const Icon = TIPO_ICONS[t.value]
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className="relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors"
              style={{ borderColor: sel ? AMBAR : '#E5E7EB', backgroundColor: sel ? AMBAR_BG : '#fff', color: sel ? AMBAR : '#374151' }}
            >
              {sel && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: AMBAR }} />}
              {Icon && <Icon style={{ color: sel ? AMBAR : '#9CA3AF' }} />}
              <span className="text-[12px] font-semibold leading-tight">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* 2. Responsabilidade */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Responsabilidade *</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {RESPONSABILIDADES.map((r) => {
          const sel = responsabilidade === r.value
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => setResponsabilidade(r.value)}
              className="rounded-md px-3 py-1.5 text-[12px] font-semibold border transition-colors"
              style={sel
                ? { backgroundColor: r.cor, borderColor: r.cor, color: '#fff' }
                : { backgroundColor: '#fff', borderColor: '#D1D5DB', color: '#6B7280' }}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {/* 3. Data do evento */}
      <Field label="Data do Evento *" className="mb-4">
        <Input type="date" value={data} max={todayInput()} onChange={(e) => setData(e.target.value)} />
      </Field>

      {/* 4. Descrição */}
      <Field label="Descrição *" className="mb-4">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={4}
          placeholder="Descreva o que aconteceu..."
          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[11px] text-gray-900 focus:outline-none focus:border-green-primary resize-none"
        />
      </Field>

      {/* 5. Impactos */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Impactos (selecione um ou mais) *</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {IMPACTOS_OCORRENCIA.map((imp) => {
          const sel = impactos.includes(imp.value)
          return (
            <button
              key={imp.value}
              type="button"
              onClick={() => toggleImpacto(imp.value)}
              className={
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ' +
                (sel ? 'bg-green-primary border-green-primary text-white' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100')
              }
            >
              {sel && <span className="text-[9px]">✓</span>}
              {imp.label}
            </button>
          )
        })}
      </div>

      {/* 6. Data de notificação */}
      <Field label="Data de Notificação ao Cliente (opcional)" className="mb-1">
        <Input type="date" value={dataNotif} onChange={(e) => setDataNotif(e.target.value)} />
      </Field>
      <p className="text-[10px] text-gray-400 mb-4">Importante registrar, já que muitos contratos exigem aviso formal dentro de um prazo a partir do evento.</p>

      {/* 7. Anexos */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5 block">Evidências / Anexos</label>
      <AnexosUploader
        value={anexos}
        onChange={setAnexos}
        onError={setError}
        hint="Fotos, RDO, e-mails, comunicações oficiais — múltiplos arquivos"
      />
    </Modal>
  )
}
