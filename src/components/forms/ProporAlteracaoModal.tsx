'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CurrencyInput } from '@/components/ui/Input'
import type { SubIndiceItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type MesKey = typeof MESES[number]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  subindice: SubIndiceItem
  indiceLabel: string
}

export function ProporAlteracaoModal({ open, onClose, onSuccess, subindice, indiceLabel }: Props) {
  const [meses, setMeses] = useState<Record<MesKey, string>>(
    Object.fromEntries(MESES.map((m) => [m, ''])) as Record<MesKey, string>,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open && subindice) {
      // Pré-popula com os valores atuais
      const inicial = Object.fromEntries(
        MESES.map((m) => [m, subindice[m] != null ? String(subindice[m]) : ''])
      ) as Record<MesKey, string>
      setMeses(inicial)
      setError(null)
      setSuccess(false)
    }
  }, [open, subindice])

  const disponivel = subindice.valor_total - subindice.total_faturado

  const somaMeses = MESES.reduce((acc, m) => {
    const v = Number(meses[m] || 0)
    return acc + v
  }, 0)

  const filled = MESES.filter((m) => meses[m] && Number(meses[m]) > 0)
  const mesesOk = filled.length === 0 || Math.abs(somaMeses - disponivel) <= 0.01

  const handleSave = async () => {
    if (filled.length > 0 && !mesesOk) {
      setError(`A soma dos meses (R$ ${fmt(somaMeses)}) deve ser igual ao disponível para previsão (R$ ${fmt(disponivel)})`)
      return
    }

    setLoading(true); setError(null)
    try {
      const valores_para = Object.fromEntries(
        MESES.map((m) => [m, meses[m] ? Number(meses[m]) : null])
      )
      const res = await fetch('/api/faturamento/alteracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subindice_id: subindice.id, valores_para }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Erro ao enviar alteração')
        return
      }
      setSuccess(true)
      onSuccess()
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1800)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={`Propor alteração — ${indiceLabel}`}
      wide
      footer={
        success ? undefined : (
          <>
            <ModalCancelButton disabled={loading} />
            <Button onClick={handleSave} disabled={loading || success}>
              {loading ? 'Enviando...' : 'Enviar para aprovação'}
            </Button>
          </>
        )
      }
    >
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 text-[12px] px-4 py-3 rounded text-center font-semibold">
          Alteração enviada para aprovação com sucesso!
        </div>
      )}

      {!success && (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
          )}

          {/* Resumo do subitem */}
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Valor Total</p>
              <p className="text-[13px] font-bold text-gray-800">R$ {fmt(subindice.valor_total)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Já Faturado</p>
              <p className="text-[13px] font-bold text-[#1565C0]">R$ {fmt(subindice.total_faturado)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Disponível p/ Previsão</p>
              <p className="text-[13px] font-bold text-green-dark">R$ {fmt(Math.max(0, disponivel))}</p>
            </div>
          </div>

          <ModalSection>Nova previsão mensal</ModalSection>

          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {MESES.map((m, mi) => (
              <div key={m}>
                <p className="text-[9px] uppercase text-center mb-0.5 text-gray-400">
                  {MESES_LABELS[mi]}
                </p>
                <CurrencyInput
                  value={meses[m]}
                  onChange={(v) => setMeses((prev) => ({ ...prev, [m]: v }))}
                  className="text-center px-1.5 py-[3px] text-[11px]"
                />
              </div>
            ))}
          </div>

          {filled.length > 0 && (
            <p className={`mt-1 text-[10px] text-right ${mesesOk ? 'text-green-600' : 'text-orange-600'}`}>
              Soma meses: R$ {fmt(somaMeses)}{mesesOk ? ' ✓' : ` · Disponível: R$ ${fmt(disponivel)}`}
            </p>
          )}

          {/* Valores atuais para referência */}
          <ModalSection>Previsão atual (referência)</ModalSection>
          <div className="grid grid-cols-6 gap-1.5">
            {MESES.map((m, mi) => {
              const valor = subindice[m]
              return (
                <div key={m} className="text-center">
                  <p className="text-[9px] uppercase text-gray-300 mb-0.5">{MESES_LABELS[mi]}</p>
                  <p className="text-[11px] text-gray-400 py-[3px]">
                    {valor != null ? fmt(valor) : '—'}
                  </p>
                </div>
              )
            })}
          </div>

          <p className="text-[10px] text-gray-400 mt-4 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            Sua proposta ficará pendente de aprovação pela Gestão de Acordos. Você acompanha o status no painel.
          </p>
        </>
      )}
    </Modal>
  )
}

