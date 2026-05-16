import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

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
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em]">
        {label}
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

export function IntegerInput({ value, onChange, placeholder = '0', className, disabled }: IntegerInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(digits ? String(parseInt(digits, 10)) : '')
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={intToDisplay(value)}
      onChange={handleChange}
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

export function CurrencyInput({ value, onChange, placeholder = '0,00', className, disabled }: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    const numeric = parseInt(digits, 10) / 100
    onChange(String(numeric))
  }

  return (
    <input
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
