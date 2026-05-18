'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Input'

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ConsolidadoMesModal({ open, onClose, onSuccess }: Props) {
  const hoje    = new Date()
  const [mes,   setMes]   = useState(String(hoje.getMonth() + 1))
  const [ano,   setAno]   = useState(String(hoje.getFullYear()))
  const [force, setForce] = useState(false)
  const [jaExiste, setJaExiste] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  // Verifica se já existe consolidado ao trocar mês/ano
  useEffect(() => {
    if (!open) return
    setJaExiste(false); setError(null); setForce(false)
    if (!mes || !ano) return
    fetch(`/api/faturamento/consolidados?mes=${mes}&ano=${ano}`)
      .then((r) => r.json())
      .then((j) => setJaExiste(!!j.data))
      .catch(() => {})
  }, [open, mes, ano])

  const handleConfirmar = async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/faturamento/consolidados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: Number(mes), ano: Number(ano), force }),
      })
      const json = await res.json()
      if (json.error === 'JA_EXISTE') {
        setJaExiste(true)
        setError('Já existe um consolidado para este mês. Marque "Substituir" para recriar.')
        return
      }
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao gerar consolidado'); return }
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const anoAtual = hoje.getFullYear()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar Consolidado do Mês"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Gerando...' : 'Confirmar consolidado'}
          </Button>
        </>
      }
    >
      <p className="text-[12px] text-gray-500 mb-4">
        O consolidado captura um <strong>fotografia</strong> dos valores previstos de todos os sub-índices
        para o mês selecionado. O previsto ficará <strong>congelado</strong> — apenas o valor faturado
        se atualizará dinamicamente na aba Consolidado x Realizado.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Mês">
          <Select value={mes} onChange={(e) => setMes(e.target.value)}>
            {MESES_NOMES.map((nome, i) => (
              <option key={i + 1} value={i + 1}>{nome}</option>
            ))}
          </Select>
        </Field>
        <Field label="Ano">
          <Select value={ano} onChange={(e) => setAno(e.target.value)}>
            {Array.from({ length: 6 }, (_, i) => anoAtual - 1 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </Field>
      </div>

      {jaExiste && (
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2.5 mb-3">
          <p className="text-[11px] text-amber-700 font-semibold mb-1.5">
            ⚠ Já existe um consolidado para {MESES_NOMES[Number(mes) - 1]}/{ano}.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => { setForce(e.target.checked); setError(null) }}
              className="accent-amber-600"
            />
            <span className="text-[11px] text-amber-700">Substituir o consolidado existente</span>
          </label>
        </div>
      )}

      {error && !jaExiste && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">{error}</div>
      )}
      {error && jaExiste && !force && (
        <p className="text-[11px] text-red-600 mt-1">{error}</p>
      )}
    </Modal>
  )
}
