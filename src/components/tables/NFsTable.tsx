'use client'

import { useState, useMemo, useCallback } from 'react'
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
import { useIsDesktop } from '@/hooks/useMediaQuery'
import type { NFListItem } from '@/types'

interface Props {
  data: NFListItem[]
  onToggleAtiva: (nf: NFListItem, motivo?: string) => Promise<void>
  canInativar: boolean
}

const col = createColumnHelper<NFListItem>()

function VencimentoBadge({ data_vencimento, ativa }: { data_vencimento: string; ativa: boolean }) {
  if (!ativa) return <span className="text-gray-400">{formatDate(data_vencimento)}</span>

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(data_vencimento)
  const em30 = new Date(hoje)
  em30.setDate(em30.getDate() + 30)

  if (venc < hoje) {
    return (
      <span className="text-red-700 font-semibold">
        {formatDate(data_vencimento)} <Badge variant="red">Vencida</Badge>
      </span>
    )
  }
  if (venc <= em30) {
    return (
      <span className="text-[#E65100] font-semibold">
        {formatDate(data_vencimento)} <Badge variant="amber">30 dias</Badge>
      </span>
    )
  }
  return <span>{formatDate(data_vencimento)}</span>
}

function InativarInline({
  nf,
  onConfirm,
  onCancel,
}: {
  nf: NFListItem
  onConfirm: (motivo: string) => void
  onCancel: () => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] w-40"
        placeholder="Motivo (min. 5 chars)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <Button
        size="sm"
        variant="danger"
        onClick={() => motivo.length >= 5 && onConfirm(motivo)}
        title="Confirmar inativação"
      >
        ✓
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel}>✕</Button>
    </div>
  )
}

export function NFsTable({ data, onToggleAtiva, canInativar }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'data_vencimento', desc: false }])
  // Congelar colunas só no desktop; no mobile a tabela rola sem colunas fixas.
  const isDesktop = useIsDesktop()
  const columnPinning: ColumnPinningState = isDesktop
    ? { left: ['numero_nf', 'acordo', 'cliente'] }
    : {}
  const [inativandoId, setInativandoId] = useState<number | null>(null)

  const handleInativar = useCallback(
    async (nf: NFListItem, motivo: string) => {
      await onToggleAtiva(nf, motivo)
      setInativandoId(null)
    },
    [onToggleAtiva],
  )

  const columns = useMemo(
    () => [
      col.accessor('numero_nf', {
        id: 'numero_nf',
        header: 'NF Nº',
        cell: (info) => <span className="font-bold">{info.getValue()}</span>,
        size: 110,
      }),
      col.accessor((row) => row.acordo.numero, {
        id: 'acordo',
        header: 'Acordo',
        cell: (info) => (
          <span className="font-semibold text-green-dark">{info.getValue()}</span>
        ),
        size: 100,
      }),
      col.accessor((row) => row.cliente.nome, {
        id: 'cliente',
        header: 'Cliente',
        size: 160,
      }),
      col.accessor('valor', {
        header: 'Valor',
        cell: (info) => <span className="font-semibold">{formatCurrency(info.getValue())}</span>,
        size: 120,
      }),
      col.accessor('data_emissao', {
        header: 'Emissão',
        cell: (info) => formatDate(info.getValue()),
        size: 90,
      }),
      col.accessor('data_vencimento', {
        header: 'Vencimento',
        cell: (info) => (
          <VencimentoBadge
            data_vencimento={info.getValue()}
            ativa={info.row.original.ativa}
          />
        ),
        size: 160,
      }),
      col.accessor('ativa', {
        header: 'Status',
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="green">Ativa</Badge>
          ) : (
            <Badge variant="gray">Inativa</Badge>
          ),
        size: 80,
      }),
      col.accessor('motivo_inativacao', {
        header: 'Motivo inativação',
        cell: (info) => (
          <span className="text-gray-400 italic max-w-[150px] truncate block" title={info.getValue() ?? ''}>
            {info.getValue() ?? '—'}
          </span>
        ),
        size: 160,
      }),
      col.accessor((row) => row.acordo.ano, {
        id: 'ano',
        header: 'Ano',
        size: 60,
      }),
      col.display({
        id: 'acoes',
        header: 'Ações',
        cell: ({ row }) => {
          const nf = row.original
          if (!canInativar) return null

          if (inativandoId === nf.id) {
            return (
              <InativarInline
                nf={nf}
                onConfirm={(motivo) => handleInativar(nf, motivo)}
                onCancel={() => setInativandoId(null)}
              />
            )
          }

          return nf.ativa ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); setInativandoId(nf.id) }}
            >
              Inativar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onToggleAtiva(nf) }}
            >
              Reativar
            </Button>
          )
        },
        size: 180,
      }),
    ],
    [canInativar, inativandoId, handleInativar, onToggleAtiva],
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
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhuma NF encontrada.</p>
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
            const nf = row.original
            const vencida = nf.ativa && new Date(nf.data_vencimento) < new Date()
            const rowBg = i % 2 === 1 ? '#F9FAFB' : '#FFFFFF'
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-gray-100 transition-colors',
                  !nf.ativa ? 'opacity-60' : 'hover:bg-green-light',
                  i % 2 === 1 ? 'bg-gray-50' : 'bg-white',
                  vencida && 'border-l-2 border-l-red-400',
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const isPinned = cell.column.getIsPinned()
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-2 py-[6px] whitespace-nowrap',
                        isPinned && 'shadow-[2px_0_4px_rgba(0,0,0,0.05)]',
                      )}
                      style={{
                        position: isPinned ? 'sticky' : 'relative',
                        left: isPinned === 'left' ? `${cell.column.getStart('left')}px` : undefined,
                        zIndex: isPinned ? 1 : 0,
                        background: isPinned ? rowBg : undefined,
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
