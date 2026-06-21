'use client'

import { useMemo } from 'react'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'

// Forma mínima de contrato necessária para os filtros (compartilhada entre Obras, Paradas e Fabricações)
export interface FiltravelContrato {
  cliente: { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
  num_os: string | null
  responsavel: { id: number; nome: string } | null
  descricao: string | null
  ano_referencia?: number | null
}

export type FilterState = Record<string, string[]>

export function useFilterOptions(contratos: FiltravelContrato[]) {
  return useMemo(() => ({
    anos:           Array.from(new Set(contratos.map(c => c.ano_referencia).filter((v): v is number => v != null))).sort((a, b) => b - a).map(v => ({ value: String(v), label: String(v) })),
    clientes:       Array.from(new Map(contratos.map(c => [c.cliente.id, c.cliente.nome])).entries()).map(([v, l]) => ({ value: String(v), label: l })),
    clientesFinais: Array.from(new Map(contratos.filter(c => c.cliente_final).map(c => [c.cliente_final!.id, c.cliente_final!.nome])).entries()).map(([v, l]) => ({ value: String(v), label: l })),
    oss:            Array.from(new Set(contratos.map(c => c.num_os).filter((v): v is string => v != null))).map(v => ({ value: v, label: v })),
    responsaveis:   Array.from(new Map(contratos.filter(c => c.responsavel).map(c => [c.responsavel!.id, c.responsavel!.nome])).entries()).map(([v, l]) => ({ value: String(v), label: l })),
    mercados:       Array.from(new Set(contratos.map(c => c.cliente.ramo_atuacao).filter((v): v is string => v != null && v !== ''))).map(v => ({ value: v, label: v })),
    escopos:        contratos.filter(c => c.descricao).map(c => ({ value: c.descricao!, label: c.descricao! })),
  }), [contratos])
}

export function HhFilters({ opts, filters, onChange }: {
  opts: ReturnType<typeof useFilterOptions>
  filters: FilterState
  onChange: (k: string, v: string[]) => void
}) {
  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'
  const filterDefs = [
    { key: 'anos',           label: 'Ano',           opts: opts.anos },
    { key: 'clientes',       label: 'Cliente',       opts: opts.clientes },
    { key: 'clientesFinais', label: 'Cliente Final', opts: opts.clientesFinais },
    { key: 'oss',            label: 'OS',            opts: opts.oss },
    { key: 'responsaveis',   label: 'Responsável',   opts: opts.responsaveis },
    { key: 'mercados',       label: 'Mercado',       opts: opts.mercados },
    { key: 'escopos',        label: 'Escopo',        opts: opts.escopos },
  ]
  const hasAny = Object.values(filters).some(v => v.length > 0)
  return (
    <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 flex gap-1.5 items-end mb-3 flex-wrap">
      {filterDefs.map(({ key, label, opts: o }) => (
        <div key={key} className="flex-1 min-w-[110px]">
          <label className={fLbl}>{label}</label>
          <SearchableMultiSelect values={filters[key] ?? []} onChange={v => onChange(key, v)} options={o} />
        </div>
      ))}
      {hasAny && (
        <button onClick={() => filterDefs.forEach(f => onChange(f.key, []))}
          className="border border-gray-300 text-gray-500 rounded px-2 py-[5px] text-[11px] hover:bg-gray-100 flex-shrink-0">✕</button>
      )}
    </div>
  )
}

export function applyFilters<T extends FiltravelContrato>(contratos: T[], filters: FilterState): T[] {
  return contratos.filter(c => {
    if (filters.anos?.length           && !filters.anos.includes(String(c.ano_referencia)))               return false
    if (filters.clientes?.length       && !filters.clientes.includes(String(c.cliente.id)))               return false
    if (filters.clientesFinais?.length && !filters.clientesFinais.includes(String(c.cliente_final?.id)))  return false
    if (filters.oss?.length            && !filters.oss.includes(c.num_os ?? ''))                          return false
    if (filters.responsaveis?.length   && !filters.responsaveis.includes(String(c.responsavel?.id)))      return false
    if (filters.mercados?.length       && !filters.mercados.includes(c.cliente.ramo_atuacao ?? ''))       return false
    if (filters.escopos?.length        && !filters.escopos.includes(c.descricao ?? ''))                   return false
    return true
  })
}
