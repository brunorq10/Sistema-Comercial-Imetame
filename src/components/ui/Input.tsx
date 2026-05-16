import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

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

const inputBase =
  'w-full px-2.5 py-[7px] border border-gray-300 rounded text-xs text-gray-900 bg-white outline-none focus:border-green-primary transition-colors'

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
