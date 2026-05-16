import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger' | 'warning' | 'info' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded font-semibold transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
          size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
          variant === 'primary' && 'bg-green-primary text-white hover:bg-green-dark',
          variant === 'outline' &&
            'bg-white text-green-primary border border-green-primary hover:bg-green-light',
          variant === 'danger' &&
            'bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2] hover:bg-[#FFCDD2]',
          variant === 'warning' &&
            'bg-[#FFF3E0] text-[#E65100] border border-[#FFCC80] hover:bg-[#FFE0B2]',
          variant === 'info' &&
            'bg-[#E3F2FD] text-[#1565C0] border border-[#90CAF9] hover:bg-[#BBDEFB]',
          variant === 'ghost' && 'bg-transparent text-gray-600 hover:bg-gray-100',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
