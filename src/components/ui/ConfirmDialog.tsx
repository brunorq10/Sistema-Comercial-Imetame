'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

type Variant = 'danger' | 'warning' | 'info' | 'success'

const HEADER_BG: Record<Variant, string> = {
  danger: 'bg-red-600',
  warning: 'bg-orange-500',
  info: 'bg-[#1565C0]',
  success: 'bg-green-primary',
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: ReactNode
  variant?: Variant
  confirmLabel?: string
  /** null oculta o botão de cancelar (modo "aviso": apenas OK). */
  cancelLabel?: string | null
  /** Campo de texto opcional (ex.: justificativa, novo nome). */
  input?: { label: string; placeholder?: string; initial?: string; required?: boolean; multiline?: boolean }
  loading?: boolean
  error?: string | null
  onConfirm: (inputValue: string) => void
  onClose: () => void
}

// Diálogo padrão de confirmação/aviso — substitui window.confirm/alert/prompt
// e os overlays manuais, mantendo o mesmo visual em todo o sistema.
export function ConfirmDialog({
  open, title, message, variant = 'warning', confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar', input, loading, error, onConfirm, onClose,
}: ConfirmDialogProps) {
  const [valor, setValor] = useState('')

  useEffect(() => {
    if (open) setValor(input?.initial ?? '')
  }, [open, input?.initial])

  if (!open) return null
  const inputInvalido = !!input?.required && valor.trim().length < 3

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-3">
      <div className="bg-white rounded-lg w-[440px] max-w-full shadow-2xl">
        <div className={`px-[18px] py-[13px] font-bold text-[13px] rounded-t-lg text-white ${HEADER_BG[variant]}`}>
          {title}
        </div>
        <div className="p-[18px]">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>}
          {message && <div className="text-[12px] text-gray-600">{message}</div>}
          {input && (
            <div className={message ? 'mt-3' : ''}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">{input.label}{input.required ? ' *' : ''}</p>
              {input.multiline ? (
                <textarea autoFocus rows={2} value={valor} onChange={(e) => setValor(e.target.value)} placeholder={input.placeholder}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[12px] resize-none focus:outline-none focus:border-green-primary" />
              ) : (
                <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder={input.placeholder}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-green-primary" />
              )}
            </div>
          )}
        </div>
        <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 rounded-b-lg">
          {cancelLabel !== null && (
            <Button variant="outline" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          )}
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => onConfirm(valor.trim())}
            disabled={loading || inputInvalido}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
