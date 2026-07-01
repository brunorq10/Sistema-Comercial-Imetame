'use client'

import { useMemo } from 'react'
import type { CampoPublico } from '@/lib/relatorios/catalog'

const GRUPO_COR: Record<string, string> = { Comercial: '#0A1F44', Acordos: '#185FA5', 'Ocorrências': '#993C1D' }

function TipoBadge({ tipo }: { tipo: CampoPublico['tipo'] }) {
  if (tipo === 'met') return <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: '#EAF3DE', color: '#27500A' }}>MÉT</span>
  if (tipo === 'calc') return <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: '#F3E8FF', color: '#7C3AED' }}>CALC</span>
  return <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: '#E6F1FB', color: '#185FA5' }}>DIM</span>
}

interface Props {
  campos: CampoPublico[]
  busca: string
  onBusca: (v: string) => void
  onDragField: (key: string) => void
}

export function FieldPanel({ campos, busca, onBusca, onDragField }: Props) {
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const filtrados = q ? campos.filter((c) => c.label.toLowerCase().includes(q)) : campos
    const map = new Map<string, CampoPublico[]>()
    for (const c of filtrados) {
      if (!map.has(c.grupo)) map.set(c.grupo, [])
      map.get(c.grupo)!.push(c)
    }
    return Array.from(map.entries())
  }, [campos, busca])

  return (
    <div className="w-[220px] flex-1 min-h-0 border border-gray-200 rounded-md bg-white flex flex-col overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={busca} onChange={(e) => onBusca(e.target.value)} placeholder="Buscar campo..."
            className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-[11px] focus:outline-none focus:border-green-primary" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {grupos.length === 0 && <p className="text-[11px] text-gray-400 text-center py-4">Nenhum campo encontrado.</p>}
        {grupos.map(([grupo, lista]) => (
          <div key={grupo}>
            <div className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-1 rounded text-white mb-1.5" style={{ background: GRUPO_COR[grupo] ?? '#374151' }}>{grupo}</div>
            <div className="space-y-1">
              {lista.map((c) => (
                <div key={c.key} draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.key); e.dataTransfer.effectAllowed = 'copy'; onDragField(c.key) }}
                  className="flex items-center justify-between gap-1 px-2 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                  title={c.label}>
                  <span className="text-[11px] text-gray-700 truncate">{c.label}</span>
                  <TipoBadge tipo={c.tipo} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
