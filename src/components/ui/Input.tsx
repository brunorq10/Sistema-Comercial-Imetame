import { cn } from '@/lib/utils'
import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

// ── Preservação de cursor em inputs que reformatam o valor a cada tecla ────────
// (CurrencyInput/IntegerInput inserem/removem separador de milhar a cada
// onChange). Sem isso, apagar um dígito no meio do número reformata a string
// inteira e o navegador não tem como saber onde o cursor "deveria" ficar —
// ele acaba pulando pro final. A técnica: em vez de guardar a posição bruta
// do caractere, contamos quantos DÍGITOS existem antes do cursor (os
// separadores não contam) e, depois de reformatar, reposicionamos o cursor
// logo após esse mesmo número de dígitos na nova string.
function contarDigitosAntes(s: string, pos: number): number {
  let n = 0
  for (let i = 0; i < pos && i < s.length; i++) if (s[i] >= '0' && s[i] <= '9') n++
  return n
}
function posicaoAposNDigitos(s: string, n: number): number {
  if (n <= 0) return 0
  let count = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] >= '0' && s[i] <= '9') {
      count++
      if (count === n) return i + 1
    }
  }
  return s.length
}
/** Aplica, após o próximo commit do DOM, a posição de cursor calculada em `caretRef`. */
function useAplicarCaretPendente(ref: React.RefObject<HTMLInputElement>, caretRef: React.MutableRefObject<number | null>) {
  useEffect(() => {
    if (caretRef.current != null && ref.current) {
      ref.current.setSelectionRange(caretRef.current, caretRef.current)
      caretRef.current = null
    }
  })
}

const inputBase =
  'w-full px-2.5 py-[7px] border border-gray-300 rounded text-xs text-gray-900 bg-white outline-none focus:border-green-primary transition-colors'

// ── Field ─────────────────────────────────────────────────────────────────────

interface LabeledFieldProps {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function Field({ label, error, children, className }: LabeledFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* flex-1 + items-end: em grids, células da mesma linha alinham o controle
          pela base mesmo quando um label quebra em duas linhas */}
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] flex-1 flex items-end">
        <span>{label}</span>
      </label>
      {children}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  )
}

// ── Input / Select / Textarea / AutoInput ─────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(inputBase, className)} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputBase, 'resize-none h-[52px]', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export function AutoInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      readOnly
      className={cn(inputBase, 'bg-auto-bg text-green-dark font-bold text-center', className)}
      {...props}
    />
  )
}

// ── IntegerInput ──────────────────────────────────────────────────────────────
// Para campos inteiros (HH, Efetivo Pico, Dias de Parada).
// Exibe com separador de milhar pt-BR (ex.: 15.000).
// Recebe/emite string numérica inteira ("15000").

interface IntegerInputProps {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function intToDisplay(raw: string): string {
  if (!raw) return ''
  const num = parseInt(raw, 10)
  if (isNaN(num) || num === 0) return ''
  return num.toLocaleString('pt-BR')
}

/** Parse pt-BR or plain integer from a pasted/typed string. Returns raw integer string. */
function parsePtBrInt(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (s.includes(',')) {
    // pt-BR decimal "150.456,99" → round to integer 150457
    const n = Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')))
    return isNaN(n) ? '' : String(n)
  }
  // Strip non-digits (removes thousands dots and any stray chars)
  const digits = s.replace(/\D/g, '')
  return digits ? String(parseInt(digits, 10)) : ''
}

export function IntegerInput({ value, onChange, placeholder = '0', className, disabled }: IntegerInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  useAplicarCaretPendente(ref, caretRef)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const digitosAntes = contarDigitosAntes(el.value, el.selectionStart ?? el.value.length)
    const novoRaw = parsePtBrInt(el.value)
    onChange(novoRaw)
    caretRef.current = posicaoAposNDigitos(intToDisplay(novoRaw), digitosAntes)
  }
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    onChange(parsePtBrInt(e.clipboardData.getData('text')))
  }
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={intToDisplay(value)}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(inputBase, className)}
    />
  )
}

// ── CurrencyInput ─────────────────────────────────────────────────────────────
// Exibe valores monetários formatados em pt-BR (ex.: 1.234,56) enquanto o
// usuário digita. Recebe/emite string numérica no padrão JS ("1234.56").
// Cada dígito digitado é tratado como centavo — comportamento padrão de
// sistemas financeiros brasileiros.

interface CurrencyInputProps {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function rawToDisplay(raw: string): string {
  if (!raw) return ''
  const num = parseFloat(raw)
  if (isNaN(num) || num === 0) return ''
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// B6: limite de 9 dígitos inteiros + 2 decimais → 11 dígitos brutos máximo (999.999.999,99)
const MAX_CURRENCY_DIGITS = 11

export function CurrencyInput({ value, onChange, placeholder = '0,00', className, disabled }: CurrencyInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  useAplicarCaretPendente(ref, caretRef)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const digitosAntes = contarDigitosAntes(el.value, el.selectionStart ?? el.value.length)
    const digits = el.value.replace(/\D/g, '').slice(0, MAX_CURRENCY_DIGITS)
    if (!digits) { onChange(''); return }
    const numeric = parseInt(digits, 10) / 100
    const novoRaw = String(numeric)
    onChange(novoRaw)
    caretRef.current = posicaoAposNDigitos(rawToDisplay(novoRaw), digitosAntes)
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={rawToDisplay(value)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(inputBase, className)}
    />
  )
}
