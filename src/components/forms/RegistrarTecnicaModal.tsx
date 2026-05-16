'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, AutoInput } from '@/components/ui/Input'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
}

export function RegistrarTecnicaModal({ open, onClose, onSuccess, solicitacaoId, numero }: Props) {
  const [hhDireto, setHhDireto] = useState('')
  const [hhIndireto, setHhIndireto] = useState('')
  const [pesoMontagem, setPesoMontagem] = useState('')
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // RN-07: HH Total = Direto + Indireto; % Indireto = Indireto / Total
  const hd = Number(hhDireto) || 0
  const hi = Number(hhIndireto) || 0
  const hhTotal = hd + hi > 0 ? hd + hi : null
  const percIndireto = hhTotal ? ((hi / hhTotal) * 100).toFixed(1) + '%' : null

  const handleSubmit = async () => {
    if (!hhDireto || !hhIndireto) {
      setError('HH Direto e HH Indireto são obrigatórios')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-tecnica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hh_direto: Number(hhDireto),
          hh_indireto: Number(hhIndireto),
          peso_montagem: pesoMontagem ? Number(pesoMontagem) : undefined,
          data_envio: dataEnvio,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }

      setHhDireto(''); setHhIndireto(''); setPesoMontagem(''); setDataEnvio(new Date().toISOString().split('T')[0])
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar Envio — Proposta Técnica · ${numero}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="HH Direto">
          <Input
            type="number"
            placeholder="Ex: 3200"
            value={hhDireto}
            onChange={(e) => setHhDireto(e.target.value)}
          />
        </Field>
        <Field label="HH Indireto">
          <Input
            type="number"
            placeholder="Ex: 1600"
            value={hhIndireto}
            onChange={(e) => setHhIndireto(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="HH Total (automático)">
          <AutoInput value={hhTotal !== null ? String(hhTotal) : ''} placeholder="—" />
          <p className="text-[10px] text-gray-400 text-center mt-0.5">HH Direto + HH Indireto</p>
        </Field>
        <Field label="% Indireto (automático)">
          <AutoInput value={percIndireto ?? ''} placeholder="—" />
          <p className="text-[10px] text-gray-400 text-center mt-0.5">HH Indireto ÷ HH Total</p>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Peso Total Montagem (t)">
          <Input
            type="number"
            placeholder="Ex: 148,5"
            value={pesoMontagem}
            onChange={(e) => setPesoMontagem(e.target.value)}
          />
        </Field>
        <Field label="Data de envio — técnica">
          <Input
            type="date"
            value={dataEnvio}
            onChange={(e) => setDataEnvio(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
