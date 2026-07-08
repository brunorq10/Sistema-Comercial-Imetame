'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface AcaoMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  /** Primeira opção (ação mais frequente): fonte mais forte e ícone em destaque. */
  destaque?: boolean
  /** Ação destrutiva: vermelha, por último, separada por divisória. */
  destrutiva?: boolean
  /** Permissões: item oculto quando false. */
  visivel?: boolean
}

const MENU_W = 200
const ITEM_H = 34

// Menu suspenso padrão da coluna Ações (kebab ⋮). Renderizado em portal com
// posição fixa — não é cortado por containers com overflow — e abre para cima
// quando não há espaço abaixo. Fecha com clique fora, Esc e scroll.
export function AcoesMenu({ items }: { items: AcaoMenuItem[] }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const visiveis = items.filter((i) => i.visivel !== false)
  const normais = visiveis.filter((i) => !i.destrutiva)
  const destrutivas = visiveis.filter((i) => i.destrutiva)

  const abrir = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const altura = (normais.length + destrutivas.length) * ITEM_H + (destrutivas.length ? 9 : 0) + 12
    const abreParaCima = r.bottom + altura + 8 > window.innerHeight
    setPos({
      top: abreParaCima ? r.top - altura - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)),
    })
  }

  useEffect(() => {
    if (!pos) return
    const fechar = () => setPos(null)
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      fechar()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [pos])

  if (visiveis.length === 0) return null

  const Item = ({ item }: { item: AcaoMenuItem }) => (
    <button
      onClick={(e) => { e.stopPropagation(); setPos(null); item.onClick() }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 text-left text-[12px] transition-colors',
        `h-[${ITEM_H}px]`,
        item.destrutiva
          ? 'text-red-600 hover:bg-red-50'
          : item.destaque
            ? 'font-semibold text-gray-800 hover:bg-green-light'
            : 'text-gray-600 hover:bg-gray-50',
      )}
      style={{ height: ITEM_H }}
    >
      <span className={cn('w-4 text-center flex-shrink-0', item.destaque && !item.destrutiva && 'text-green-primary')}>
        {item.icon}
      </span>
      {item.label}
    </button>
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : abrir() }}
        title="Ações"
        className={cn(
          'w-7 h-7 inline-flex items-center justify-center rounded border text-[15px] leading-none transition-colors mx-auto',
          pos ? 'border-green-primary text-green-primary bg-green-light' : 'border-gray-300 text-gray-500 hover:bg-gray-100',
        )}
      >
        ⋮
      </button>
      {pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[80] bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: MENU_W }}
          onClick={(e) => e.stopPropagation()}
        >
          {normais.map((item, i) => <Item key={i} item={item} />)}
          {destrutivas.length > 0 && <div className="border-t border-gray-100 my-1" />}
          {destrutivas.map((item, i) => <Item key={`d-${i}`} item={item} />)}
        </div>,
        document.body,
      )}
    </>
  )
}
