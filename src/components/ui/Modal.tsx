'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  extraWide?: boolean
}

export function Modal({ open, onClose, title, children, footer, wide, extraWide }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className={cn(
          'bg-white rounded-lg flex flex-col shadow-2xl max-h-[92vh] overflow-hidden',
          extraWide ? 'w-[960px] max-w-[96%]' : wide ? 'w-[680px] max-w-[96%]' : 'w-[540px] max-w-[96%]',
        )}
      >
        <div className="bg-green-primary text-white px-[18px] py-[13px] font-bold text-[13px] flex items-center justify-between flex-shrink-0">
          <span>{title}</span>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-lg leading-none"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

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
