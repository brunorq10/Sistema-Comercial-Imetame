'use client'

import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface PrevisaoRealizadoItem {
  id: number
  subindice_id: number
  indice: string
  cliente_nome: string
  descricao: string
  valor_consolidado: number
  valor_previsto: number
  valor_faturado: number
  percentual: number
}

interface Props {
  itens: PrevisaoRealizadoItem[]
}

const col = createColumnHelper<PrevisaoRealizadoItem>()

function PercBadge({ perc }: { perc: number }) {
  const cls =
    perc >= 100 ? 'text-green-700 font-bold' :
    perc >= 50  ? 'text-blue-600 font-semibold' :
    perc > 0    ? 'text-orange-500 font-semibold' :
                  'text-gray-400'
  return <span className={cls}>{perc.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
}

export function PrevisaoRealizadoTable({ itens }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(() => [
    col.accessor('indice', {
      header: 'Índice',
      cell: (info) => (
        <span className="bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-[10px] font-semibold">
          {info.getValue()}
        </span>
      ),
      size: 90,
    }),
    col.accessor('cliente_nome', {
      header: 'Cliente',
      cell: (info) => (
        <span className="text-blue-700 font-medium truncate block max-w-[160px]">{info.getValue()}</span>
      ),
      size: 170,
    }),
    col.accessor('descricao', {
      header: 'Descrição / Evento',
      cell: (info) => (
        <span className="truncate block text-gray-600 max-w-[300px]" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
      size: 320,
    }),
    col.accessor('valor_consolidado', {
      header: 'Valor Consolidado',
      cell: (info) => (
        <span className="text-purple-700 font-semibold">{formatCurrency(info.getValue())}</span>
      ),
      size: 150,
    }),
    col.accessor('valor_previsto', {
      header: 'Valor Previsto',
      cell: (info) => (
        <span className="text-[#1565C0] font-semibold">{formatCurrency(info.getValue())}</span>
      ),
      size: 140,
    }),
    col.accessor('valor_faturado', {
      header: 'Valor Faturado',
      cell: (info) => {
        const fat = info.getValue()
        return fat > 0
          ? <span className="text-green-700 font-semibold">{formatCurrency(fat)}</span>
          : <span className="text-gray-300">—</span>
      },
      size: 140,
    }),
    col.accessor('percentual', {
      header: '% Realizado',
      cell: (info) => <PercBadge perc={info.getValue()} />,
      size: 100,
    }),
  ], [])

  const table = useReactTable({
    data: itens,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const totalConsolidado = itens.reduce((a, i) => a + i.valor_consolidado, 0)
  const totalPrevisto    = itens.reduce((a, i) => a + i.valor_previsto, 0)
  const totalFaturado    = itens.reduce((a, i) => a + i.valor_faturado, 0)
  const percTotal        = totalConsolidado > 0 ? (totalFaturado / totalConsolidado) * 100 : 0

  if (itens.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum item neste consolidado.</p>
  }

  const colSpan = columns.length

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-md">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          {/* Totalizador */}
          <tr className="bg-[#C8E6C9] border-b-2 border-green-primary">
            <td colSpan={3} className="px-2 py-[4px] font-bold text-[10px] whitespace-nowrap">
              TOTAIS · {itens.length} item{itens.length !== 1 ? 's' : ''}
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalConsolidado)}</span>
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalPrevisto)}</span>
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalFaturado)}</span>
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <PercBadge perc={Number(percTotal.toFixed(1))} />
            </td>
          </tr>

          {/* Cabeçalho */}
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap cursor-pointer select-none"
                  style={{ width: header.getSize() }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc'  && ' ↑'}
                  {header.column.getIsSorted() === 'desc' && ' ↓'}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-gray-100 hover:bg-green-light transition-colors',
                i % 2 === 1 ? 'bg-gray-50' : 'bg-white',
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-[6px] whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
