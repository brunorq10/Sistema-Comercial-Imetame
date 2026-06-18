'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  extraWide?: boolean
  hasChanges?: boolean
}

export function Modal({ open, onClose, title, children, footer, wide, extraWide, hasChanges }: ModalProps) {
  const [confirmingClose, setConfirmingClose] = useState(false)
  const prevOpen = useRef(open)

  if (open !== prevOpen.current) {
    prevOpen.current = open
    if (!open) setConfirmingClose(false)
  }

  if (!open) return null

  const handleClose = () => {
    if (hasChanges) {
      setConfirmingClose(true)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div
        className={cn(
          'bg-white rounded-lg flex flex-col shadow-2xl max-h-[92vh] overflow-hidden',
          extraWide ? 'w-[960px] max-w-[96%]' : wide ? 'w-[680px] max-w-[96%]' : 'w-[540px] max-w-[96%]',
        )}
      >
        <div className="bg-green-primary text-white px-[18px] py-[13px] font-bold text-[13px] flex items-center justify-between flex-shrink-0">
          <span>{title}</span>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white text-lg leading-none"
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

        <div className="p-[18px] overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-[18px] py-3 border-t border-gray-200 flex gap-2 justify-end bg-gray-50 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
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
