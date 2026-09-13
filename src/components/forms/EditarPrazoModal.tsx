'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { formatDateInput } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
  prazoTecnica: string | null
  prazoTecnicaIndeterminado: boolean
  tecnicaEnviada: boolean
  prazoComercial: string | null
  prazoComercialIndeterminado: boolean
  comercialEnviada: boolean
}

export function EditarPrazoModal({
  open, onClose, onSuccess, solicitacaoId, numero,
  prazoTecnica, prazoTecnicaIndeterminado, tecnicaEnviada,
  prazoComercial, prazoComercialIndeterminado, comercialEnviada,
}: Props) {
  const [tecnica, setTecnica] = useState('')
  const [comercial, setComercial] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTecnica(formatDateInput(prazoTecnica))
    setComercial(formatDateInput(prazoComercial))
    setMotivo('')
    setError(null)
  }, [open, prazoTecnica, prazoComercial])

  const tecnicaOriginal = formatDateInput(prazoTecnica)
  const comercialOriginal = formatDateInput(prazoComercial)
  const tecnicaMudou = !tecnicaEnviada && tecnica !== tecnicaOriginal
  const comercialMudou = !comercialEnviada && comercial !== comercialOriginal

  const handleSubmit = async () => {
    if (!tecnicaMudou && !comercialMudou) { setError('Altere ao menos um dos prazos antes de salvar.'); return }
    if (tecnicaMudou && !tecnica) { setError('Informe a data da proposta técnica.'); return }
    if (comercialMudou && !comercial) { setError('Informe a data da proposta comercial.'); return }
    if (motivo.trim().length < 5) { setError('Informe o motivo da alteração (mínimo 5 caracteres).'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/prazo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(tecnicaMudou ? { prazo_tecnica: tecnica } : {}),
          ...(comercialMudou ? { prazo_comercial: comercial } : {}),
          motivo: motivo.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao alterar o prazo'); return }
      onSuccess(); onClose()
    } finally { setLoading(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar Prazo — ${numero}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
        </>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <Field label="Data Proposta Técnica *">
          {tecnicaEnviada ? (
            <p className="text-[11px] text-gray-400 italic py-2">Proposta já enviada — prazo não pode mais ser alterado.</p>
          ) : (
            <>
              <Input type="date" value={tecnica} onChange={(e) => setTecnica(e.target.value)} />
              {prazoTecnicaIndeterminado && (
                <p className="text-[10px] text-amber-600 mt-1">Atualmente: Não Determinado. Informar uma data substitui isso.</p>
              )}
            </>
          )}
        </Field>
        <Field label="Data Proposta Comercial *">
          {comercialEnviada ? (
            <p className="text-[11px] text-gray-400 italic py-2">Proposta já enviada — prazo não pode mais ser alterado.</p>
          ) : (
            <>
              <Input type="date" value={comercial} onChange={(e) => setComercial(e.target.value)} />
              {prazoComercialIndeterminado && (
                <p className="text-[10px] text-amber-600 mt-1">Atualmente: Não Determinado. Informar uma data substitui isso.</p>
              )}
            </>
          )}
        </Field>
      </div>

      <Field label="Motivo da alteração *">
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Explique por que o prazo está sendo alterado..."
          className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[11px] text-gray-900 focus:outline-none focus:border-green-primary resize-none"
        />
      </Field>
    </Modal>
  )
}
