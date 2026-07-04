'use client'

import { useState } from 'react'
import type { CampoPublico } from '@/lib/relatorios/catalog'

export type Gran = 'dia' | 'mes' | 'trimestre' | 'ano'
export type Agg = 'soma' | 'media' | 'contagem'
export interface ChipDim { campo: string; granularidade?: Gran }
export interface ChipVal { campo: string; agregacao?: Agg }
export type Zona = 'linhas' | 'colunas' | 'valores'

const GRAN_LABEL: Record<Gran, string> = { dia: 'Dia', mes: 'Mês', trimestre: 'Trimestre', ano: 'Ano' }
const AGG_LABEL: Record<Agg, string> = { soma: 'Soma', media: 'Média', contagem: 'Contagem' }

const ZONA_COR: Record<Zona, string> = { linhas: '#0A1F44', colunas: '#185FA5', valores: '#854F0B' }
const ZONA_TITULO: Record<Zona, string> = { linhas: 'Linhas (agrupar por)', colunas: 'Colunas (separar por)', valores: 'Valores (calcular)' }

const CHIP_MIME = 'application/x-chip'
const FIM = Number.MAX_SAFE_INTEGER // reordenar para o fim da zona

interface Props {
  camposMap: Map<string, CampoPublico>
  linhas: ChipDim[]
  colunas: ChipDim[]
  valores: ChipVal[]
  onDrop: (zona: Zona, key: string) => void
  onRemove: (zona: Zona, idx: number) => void
  onGran: (zona: 'linhas' | 'colunas', idx: number, gran: Gran) => void
  onAgg: (idx: number, agg: Agg) => void
  onReorder: (zona: Zona, from: number, targetIndex: number) => void
}

export function Zones({ camposMap, linhas, colunas, valores, onDrop, onRemove, onGran, onAgg, onReorder }: Props) {
  const granOpts = (['dia', 'mes', 'trimestre', 'ano'] as Gran[]).map((g) => ({ value: g, label: GRAN_LABEL[g] }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
      <DropZone zona="linhas" onDrop={onDrop} onReorder={onReorder}>
        {linhas.map((c, i) => (
          <Chip key={`${c.campo}-${i}`} zona="linhas" index={i} label={camposMap.get(c.campo)?.label ?? c.campo} cor={ZONA_COR.linhas} onRemove={() => onRemove('linhas', i)} onReorder={onReorder}>
            {camposMap.get(c.campo)?.tipo === 'data' && (
              <SelectInline value={c.granularidade ?? 'mes'} onChange={(v) => onGran('linhas', i, v as Gran)} options={granOpts} />
            )}
          </Chip>
        ))}
      </DropZone>

      <DropZone zona="colunas" onDrop={onDrop} onReorder={onReorder}>
        {colunas.map((c, i) => (
          <Chip key={`${c.campo}-${i}`} zona="colunas" index={i} label={camposMap.get(c.campo)?.label ?? c.campo} cor={ZONA_COR.colunas} onRemove={() => onRemove('colunas', i)} onReorder={onReorder}>
            {camposMap.get(c.campo)?.tipo === 'data' && (
              <SelectInline value={c.granularidade ?? 'mes'} onChange={(v) => onGran('colunas', i, v as Gran)} options={granOpts} />
            )}
          </Chip>
        ))}
      </DropZone>

      <DropZone zona="valores" onDrop={onDrop} onReorder={onReorder}>
        {valores.map((c, i) => {
          const campo = camposMap.get(c.campo)
          const podeAgg = campo?.tipo === 'met' && !campo.count && (campo.aggs?.length ?? 0) > 1
          return (
            <Chip key={`${c.campo}-${i}`} zona="valores" index={i} label={campo?.label ?? c.campo} cor={ZONA_COR.valores} onRemove={() => onRemove('valores', i)} onReorder={onReorder}>
              {podeAgg && (
                <SelectInline value={c.agregacao ?? campo!.aggPadrao ?? 'soma'} onChange={(v) => onAgg(i, v as Agg)}
                  options={(campo!.aggs ?? []).map((a) => ({ value: a, label: AGG_LABEL[a] }))} />
              )}
              {campo?.tipo === 'calc' && <span className="text-[8px] text-purple-200 font-semibold">fórmula</span>}
            </Chip>
          )
        })}
      </DropZone>
    </div>
  )
}

function DropZone({ zona, onDrop, onReorder, children }: { zona: Zona; onDrop: (z: Zona, k: string) => void; onReorder: (z: Zona, from: number, to: number) => void; children: React.ReactNode }) {
  const [over, setOver] = useState(false)
  const vazio = !children || (Array.isArray(children) && children.length === 0)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes(CHIP_MIME) ? 'move' : 'copy'; setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false)
        const chip = e.dataTransfer.getData(CHIP_MIME)
        if (chip) { const s = JSON.parse(chip); if (s.zona === zona) onReorder(zona, s.index, FIM); return }
        const k = e.dataTransfer.getData('text/plain'); if (k) onDrop(zona, k)
      }}
      className={`rounded-md border-2 border-dashed p-2 min-h-[72px] transition-colors ${over ? 'border-green-primary bg-green-light/40' : 'border-gray-300 bg-gray-50'}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: ZONA_COR[zona] }}>{ZONA_TITULO[zona]}</div>
      <div className="flex flex-wrap gap-1.5">
        {children}
        {vazio && <span className="text-[10px] text-gray-400 italic py-1">Arraste campos aqui</span>}
      </div>
    </div>
  )
}

function Chip({ zona, index, label, cor, onRemove, onReorder, children }: {
  zona: Zona; index: number; label: string; cor: string; onRemove: () => void
  onReorder: (z: Zona, from: number, to: number) => void; children?: React.ReactNode
}) {
  const [dropOver, setDropOver] = useState(false)
  return (
    <span
      onDragOver={(e) => { if (e.dataTransfer.types.includes(CHIP_MIME)) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) } }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(CHIP_MIME)
        if (!raw) return
        e.preventDefault(); e.stopPropagation(); setDropOver(false)
        const s = JSON.parse(raw)
        if (s.zona === zona && s.index !== index) onReorder(zona, s.index, index)
      }}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-white text-[10px] font-medium ${dropOver ? 'ring-2 ring-white/80' : ''}`}
      style={{ background: cor }}
    >
      <span
        draggable
        onDragStart={(e) => { e.dataTransfer.setData(CHIP_MIME, JSON.stringify({ zona, index })); e.dataTransfer.effectAllowed = 'move' }}
        className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white select-none leading-none"
        title="Arraste para reordenar"
      >⠿</span>
      <span className="truncate max-w-[130px]">{label}</span>
      {children}
      <button onClick={onRemove} className="text-white/70 hover:text-white text-[11px] leading-none">✕</button>
    </span>
  )
}

function SelectInline({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()}
      className="bg-white/20 text-white text-[9px] rounded px-1 py-0.5 border-none focus:outline-none cursor-pointer [&>option]:text-gray-800">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
