'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SSOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SSOption[]
  placeholder?: string
  emptyLabel?: string
  className?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecionar…',
  emptyLabel = 'Todos',
  className,
}: Props) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''
  const inputDisplay  = open ? query : selectedLabel

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFocus = () => {
    setOpen(true)
    setQuery('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setOpen(true)
    if (e.target.value === '') onChange('')
  }

  const handleSelect = (opt: SSOption | null) => {
    onChange(opt?.value ?? '')
    setQuery('')
    setOpen(false)
  }

  const base =
    'w-full px-1.5 py-[5px] pr-5 border border-gray-300 rounded text-[11px] text-gray-900 bg-white outline-none focus:border-green-primary transition-colors'

  return (
    <div className="relative" ref={ref}>
      <input
        ref={inputRef}
        className={cn(base, className)}
        placeholder={value ? '' : placeholder}
        value={inputDisplay}
        onFocus={handleFocus}
        onChange={handleChange}
        autoComplete="off"
      />
      {/* seta / limpar */}
      {value ? (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); handleSelect(null) }}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-[9px] leading-none"
        >
          ✕
        </button>
      ) : (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[8px] pointer-events-none">▼</span>
      )}

      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto text-[11px]">
          {/* opção "todos" */}
          <li
            onMouseDown={() => handleSelect(null)}
            className={cn(
              'px-2.5 py-1.5 cursor-pointer hover:bg-green-light text-gray-400 italic',
              !value && 'bg-green-light text-gray-500 font-medium not-italic',
            )}
          >
            {emptyLabel}
          </li>

          {filtered.length === 0 && query ? (
            <li className="px-2.5 py-2 text-gray-400">Nenhuma opção encontrada</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                onMouseDown={() => handleSelect(opt)}
                className={cn(
                  'px-2.5 py-1.5 cursor-pointer hover:bg-green-light truncate',
                  opt.value === value && 'bg-green-light font-semibold text-green-primary',
                )}
                title={opt.label}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
