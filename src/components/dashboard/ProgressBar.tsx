'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  pct: number
  color: string
  size?: 'sm' | 'md'
  className?: string
}

// Mini-barra de participação/distribuição usada nas tabelas das telas de
// indicadores — mesmo trilho/altura/raio nas duas telas, só a cor de
// preenchimento varia por chamada.
// size="sm": trilho mais alto e cantos levemente arredondados (célula de tabela).
// size="md": trilho fino em pílula (barra "solo", ex. aderência por responsável).
export function ProgressBar({ pct, color, size = 'sm', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, pct))
  const track = size === 'sm' ? 'h-3 rounded' : 'h-2 rounded-full'
  const fill = size === 'sm' ? 'rounded' : 'rounded-full'
  return (
    <div className={cn('flex-1 bg-slate-100 overflow-hidden', track, className)}>
      <div className={cn('h-full', fill)} style={{ width: `${clamped}%`, background: color }} />
    </div>
  )
}
