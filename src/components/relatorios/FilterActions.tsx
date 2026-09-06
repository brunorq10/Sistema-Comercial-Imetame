'use client'

import { Button } from '@/components/ui/Button'

export function FilterActions({ onAplicar, onLimpar }: { onAplicar: () => void; onLimpar: () => void }) {
  return (
    <div className="flex items-end gap-2">
      <Button onClick={onAplicar}>Aplicar</Button>
      <Button variant="outline" onClick={onLimpar}>Limpar</Button>
    </div>
  )
}
