'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils'

export type ColumnType = 'text' | 'number' | 'currency' | 'percent' | 'date'

export interface DataColumn<T> {
  key: string
  header: string
  type: ColumnType
  /** Valor bruto (usado para ordenar, exportar e — se `render` não for informado — formatar). */
  value: (row: T) => string | number | Date | null
  /** Célula customizada (ex.: badge colorido). Se omitido, formata `value()` pelo `type`. */
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  /** Agregação exibida no rodapé. */
  totalizer?: 'sum' | 'avg' | 'count'
  width?: number
}

interface DataTableProps<T> {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  emptyLabel?: string
  maxH?: string
}

function formatByType(type: ColumnType, v: string | number | Date | null): string {
  if (v === null || v === undefined) return '—'
  switch (type) {
    case 'currency': return formatCurrency(typeof v === 'number' ? v : Number(v))
    case 'percent':  return formatPercent(typeof v === 'number' ? v : Number(v))
    case 'number':   return formatNumber(typeof v === 'number' ? v : Number(v), 0)
    case 'date':     return formatDate(v instanceof Date ? v : String(v))
    default:         return String(v)
  }
}

// Tabela de relatório: cabeçalho fixo, ordenação por coluna, totalizadores no
// rodapé, contagem de registros. É o elemento central de todo relatório —
// nunca um gráfico ou card.
export function DataTable<T>({ columns, rows, rowKey, emptyLabel = 'Nenhum registro encontrado.', maxH = '520px' }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const withVal = rows.map((r) => ({ r, v: col.value(r) }))
    withVal.sort((a, b) => {
      if (a.v == null && b.v == null) return 0
      if (a.v == null) return 1
      if (b.v == null) return -1
      let cmp: number
      if (a.v instanceof Date && b.v instanceof Date) cmp = a.v.getTime() - b.v.getTime()
      else if (typeof a.v === 'number' && typeof b.v === 'number') cmp = a.v - b.v
      else cmp = String(a.v).localeCompare(String(b.v), 'pt-BR')
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return withVal.map((x) => x.r)
  }, [rows, sort, columns])

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const totals = useMemo(() => {
    const out: Record<string, number> = {}
    for (const col of columns) {
      if (!col.totalizer) continue
      const vals = rows.map((r) => col.value(r)).filter((v): v is number => typeof v === 'number')
      if (col.totalizer === 'sum') out[col.key] = vals.reduce((a, b) => a + b, 0)
      else if (col.totalizer === 'avg') out[col.key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      else if (col.totalizer === 'count') out[col.key] = rows.length
    }
    return out
  }, [rows, columns])

  const hasTotals = Object.keys(totals).length > 0

  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-1.5">
        {rows.length} registro{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
      </p>
      {rows.length === 0 ? (
        <p className="text-[12px] text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-md">{emptyLabel}</p>
      ) : (
        <div className="overflow-auto border border-gray-200 rounded-md" style={{ maxHeight: maxH }}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key
                  return (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      className="bg-green-primary text-white px-3 py-[7px] font-semibold text-[10.5px] whitespace-nowrap cursor-pointer select-none hover:bg-green-dark transition-colors"
                      style={{ textAlign: c.align ?? (c.type === 'text' ? 'left' : 'right') }}
                      title="Clique para ordenar"
                    >
                      {c.header}
                      <span className="inline-block w-3 text-[9px] opacity-80">{active ? (sort!.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr key={rowKey(row)} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className="px-3 py-[6px] whitespace-nowrap text-gray-700 border-b border-gray-100"
                      style={{ textAlign: c.align ?? (c.type === 'text' ? 'left' : 'right') }}
                    >
                      {c.render ? c.render(row) : formatByType(c.type, c.value(row))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-gray-100 font-bold">
                  {columns.map((c, i) => (
                    <td key={c.key} className="px-3 py-[7px] text-gray-700 border-t-2 border-gray-300" style={{ textAlign: c.align ?? (c.type === 'text' ? 'left' : 'right') }}>
                      {c.key in totals ? formatByType(c.type, totals[c.key]) : (i === 0 ? 'Total' : '')}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
