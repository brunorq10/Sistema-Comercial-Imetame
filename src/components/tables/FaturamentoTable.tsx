'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnPinningState,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AcordoListItem } from '@/types'

interface Props {
  data: AcordoListItem[]
  onVerNFs: (item: AcordoListItem) => void
  onLancarNF: (item: AcordoListItem) => void
  onEditar: (item: AcordoListItem) => void
  onCancelar: (item: AcordoListItem) => void
  canLancarNF: boolean
  canEditar: boolean
  canCancelar: boolean
}

const col = createColumnHelper<AcordoListItem>()

function StatusAcordoBadge({ status }: { status: AcordoListItem['status'] }) {
  const map = {
    ATIVO: { label: 'Ativo', variant: 'green' as const },
    ENCERRADO: { label: 'Encerrado', variant: 'gray' as const },
    CANCELADO: { label: 'Cancelado', variant: 'red' as const },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

function PercBar({ perc }: { perc: number }) {
  const clamped = Math.min(perc, 100)
  const color = perc > 100 ? 'bg-red-500' : perc >= 80 ? 'bg-amber-400' : 'bg-green-primary'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 bg-gray-200 rounded-full h-1.5 flex-shrink-0">
        <div className={cn('h-1.5 rounded-full', color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={cn('text-[10px] font-semibold', perc > 100 ? 'text-red-600' : 'text-gray-600')}>
        {perc.toFixed(1)}%
      </span>
    </div>
  )
}

export function FaturamentoTable({
  data,
  onVerNFs,
  onLancarNF,
  onEditar,
  onCancelar,
  canLancarNF,
  canEditar,
  canCancelar,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnPinning] = useState<ColumnPinningState>({ left: ['numero', 'cliente', 'status'] })

  const columns = useMemo(
    () => [
      col.accessor('numero', {
        id: 'numero',
        header: 'Nº',
        cell: (info) => <span className="font-bold text-green-dark">{info.getValue()}</span>,
        size: 90,
      }),
      col.accessor((row) => row.cliente.nome, {
        id: 'cliente',
        header: 'Cliente',
        size: 160,
      }),
      col.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => <StatusAcordoBadge status={info.getValue()} />,
        size: 100,
      }),
      col.accessor('descricao', {
        header: 'Descrição',
        cell: (info) => (
          <span className="max-w-[180px] truncate block" title={info.getValue() ?? ''}>
            {info.getValue() ?? '—'}
          </span>
        ),
        size: 200,
      }),
      col.accessor('ano', {
        header: 'Ano',
        size: 60,
      }),
      col.accessor('valor_total', {
        header: 'Valor Contrato',
        cell: (info) => <span className="font-semibold">{formatCurrency(info.getValue())}</span>,
        size: 130,
      }),
      col.accessor('total_nfs', {
        header: 'NFs Emitidas',
        cell: (info) => {
          const row = info.row.original
          return (
            <span>
              {formatCurrency(info.getValue())}
              <span className="text-gray-400 ml-1">({row.qt_nfs_ativas}/{row.qt_nfs})</span>
            </span>
          )
        },
        size: 160,
      }),
      col.accessor('perc_executado', {
        header: '% Exec.',
        cell: (info) => <PercBar perc={info.getValue()} />,
        size: 130,
      }),
      col.accessor('saldo', {
        header: 'Saldo',
        cell: (info) => {
          const v = info.getValue()
          return (
            <span className={v < 0 ? 'text-red-700 font-semibold' : 'text-green-primary font-semibold'}>
              {formatCurrency(v)}
            </span>
          )
        },
        size: 120,
      }),
      col.accessor('valor_anos_seguintes', {
        header: 'Prev. Anos Seguintes',
        cell: (info) => {
          const v = info.getValue()
          return v != null ? (
            <span className="text-[#6A1B9A] font-semibold">{formatCurrency(v)}</span>
          ) : (
            <span className="text-gray-300">—</span>
          )
        },
        size: 150,
      }),
      col.accessor('data_inicio', {
        header: 'Início',
        cell: (info) => formatDate(info.getValue()),
        size: 90,
      }),
      col.accessor('data_fim', {
        header: 'Fim',
        cell: (info) => formatDate(info.getValue()),
        size: 90,
      }),
      col.display({
        id: 'acoes',
        header: 'Ações',
        cell: ({ row }) => {
          const item = row.original
          const ativo = item.status === 'ATIVO'
          return (
            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onVerNFs(item) }}
                title="Ver NFs"
              >
                NFs
              </Button>
              {canLancarNF && ativo && (
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onLancarNF(item) }}
                  title="Lançar NF"
                >
                  + NF
                </Button>
              )}
              {canEditar && ativo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); onEditar(item) }}
                  title="Editar"
                >
                  ✎
                </Button>
              )}
              {canCancelar && ativo && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => { e.stopPropagation(); onCancelar(item) }}
                  title="Cancelar"
                >
                  ✕
                </Button>
              )}
            </div>
          )
        },
        size: 140,
      }),
    ],
    [canLancarNF, canEditar, canCancelar, onVerNFs, onLancarNF, onEditar, onCancelar],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnPinning },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <p className="text-center text-gray-400 py-10 text-sm">Nenhum acordo encontrado.</p>
    )
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-md">
      <table className="border-collapse text-[11px]" style={{ minWidth: 'max-content', width: '100%' }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const isPinned = header.column.getIsPinned()
                return (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      'bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap cursor-pointer select-none',
                      isPinned && 'shadow-[2px_0_4px_rgba(0,0,0,0.08)]',
                      // Coluna "Prev. Anos Seguintes" com cabeçalho roxo (RN-23)
                      header.column.id === 'valor_anos_seguintes' && 'bg-[#6A1B9A]',
                    )}
                    style={{
                      width: header.getSize(),
                      position: isPinned ? 'sticky' : 'relative',
                      left: isPinned === 'left' ? `${header.column.getStart('left')}px` : undefined,
                      zIndex: isPinned ? 3 : 1,
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => {
            const rowBg = i % 2 === 1 ? '#F9FAFB' : '#FFFFFF'
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-gray-100 hover:bg-green-light transition-colors',
                  i % 2 === 1 ? 'bg-gray-50' : 'bg-white',
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const isPinned = cell.column.getIsPinned()
                  const isFuture = cell.column.id === 'valor_anos_seguintes'
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-2 py-[6px] whitespace-nowrap',
                        isPinned && 'shadow-[2px_0_4px_rgba(0,0,0,0.05)]',
                        isFuture && 'bg-[#F3E5F5]',
                      )}
                      style={{
                        position: isPinned ? 'sticky' : 'relative',
                        left: isPinned === 'left' ? `${cell.column.getStart('left')}px` : undefined,
                        zIndex: isPinned ? 1 : 0,
                        background: isPinned ? rowBg : isFuture ? '#F3E5F5' : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
