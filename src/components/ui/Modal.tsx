'use client'

import { createContext, useContext, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

// Shared context so Cancel buttons inside footer/children trigger the guarded close
const ModalCloseCtx = createContext<(() => void) | null>(null)

/** Drop-in cancel button that always goes through the modal's confirmation guard. */
export function ModalCancelButton({ disabled, label }: { disabled?: boolean; label?: string }) {
  const handleClose = useContext(ModalCloseCtx)
  if (!handleClose) return null
  return (
    <button
      type="button"
      onClick={handleClose}
      disabled={disabled}
      className="border border-gray-300 text-gray-700 bg-white rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {label ?? 'Cancelar'}
    </button>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  extraWide?: boolean
  hasChanges?: boolean
  /** When true, always ask for confirmation before closing (regardless of hasChanges). */
  confirmClose?: boolean
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide, extraWide, hasChanges, confirmClose }: ModalProps) {
  const [confirmingClose, setConfirmingClose] = useState(false)
  // Marca se o usuário realmente editou algum campo enquanto o modal esteve aberto.
  // Assim só perguntamos "sair sem salvar?" quando houve edição — não ao apenas abrir/fechar.
  const [interacted, setInteracted] = useState(false)
  const prevOpen = useRef(open)

  if (open !== prevOpen.current) {
    prevOpen.current = open
    // Reinicia o estado a cada abertura/fechamento
    setConfirmingClose(false)
    setInteracted(false)
  }

  if (!open) return null

  const handleClose = () => {
    // Só confirma se o modal pede guarda (hasChanges/confirmClose) E houve edição de fato.
    if ((hasChanges || confirmClose) && interacted) {
      setConfirmingClose(true)
    } else {
      onClose()
    }
  }

  return (
    // Backdrop — intentionally has no onClick so clicking outside never closes the modal
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <ModalCloseCtx.Provider value={handleClose}>
        <div
          className={cn(
            'bg-white rounded-lg flex flex-col shadow-2xl max-h-[92vh] overflow-hidden',
            extraWide ? 'w-[960px] max-w-[96%]' : wide ? 'w-[680px] max-w-[96%]' : 'w-[540px] max-w-[96%]',
          )}
        >
          <div className="bg-green-primary text-white px-[18px] py-[13px] flex items-start justify-between flex-shrink-0">
            <div className="min-w-0">
              <span className="font-bold text-[13px] block">{title}</span>
              {subtitle && <span className="text-[11px] font-normal text-white/80 block truncate">{subtitle}</span>}
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white text-lg leading-none shrink-0 ml-3"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          {confirmingClose && (
            <div className="bg-amber-50 border-b border-amber-200 px-[18px] py-3 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-[12px] text-amber-800 font-medium">Tem certeza que deseja sair? As alterações não salvas serão perdidas.</p>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmingClose(false)}
                  className="px-3 py-1.5 text-[11px] border border-amber-300 rounded text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  Continuar editando
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-[11px] bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  Sair sem salvar
                </button>
              </div>
            </div>
          )}

          <div
            className="p-[18px] overflow-y-auto flex-1"
            onChangeCapture={() => setInteracted(true)}
            onInputCapture={() => setInteracted(true)}
          >
            {children}
          </div>

          {footer && (
            <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </ModalCloseCtx.Provider>
    </div>
  )
}

export function ModalSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-3.5 mb-2 border-b border-gray-200 pb-1', className)}>
      {children}
    </p>
  )
}
