'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'

interface ComentarioMeta {
  comentarios: string | null
  updated_at: string | null
  updated_by: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  subindiceId: number
  titulo: string
  canEditar: boolean
  onSuccess: () => void
}

export function ComentarioSubindiceModal({ open, onClose, subindiceId, titulo, canEditar, onSuccess }: Props) {
  const [meta, setMeta]         = useState<ComentarioMeta | null>(null)
  const [texto, setTexto]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch(`/api/faturamento/subindices/${subindiceId}/comentario`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return }
        setMeta(j.data)
        setTexto(j.data.comentarios ?? '')
      })
      .catch(() => setError('Erro ao carregar comentário'))
      .finally(() => setLoading(false))
  }, [open, subindiceId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/faturamento/subindices/${subindiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentarios: texto.trim() || null }),
      })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const formatDataHora = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    const data = formatDate(iso) ?? '—'
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${data} às ${hora}`
  }

  return (
    <Modal open={open} onClose={onClose} title={`Comentários — ${titulo}`} wide>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            className={`w-full border border-gray-300 rounded-md px-3 py-2.5 text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-green-primary/30 min-h-[140px] ${
              !canEditar ? 'bg-gray-50 text-gray-600 cursor-default' : ''
            }`}
            placeholder="Nenhum comentário registrado."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={!canEditar}
          />

          {meta && (meta.updated_at || meta.updated_by) && (
            <p className="text-[10px] text-gray-400 text-right">
              Última atualização:{' '}
              {[formatDataHora(meta.updated_at), meta.updated_by ? `por ${meta.updated_by}` : null]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}

          {canEditar && (
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar comentário'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
