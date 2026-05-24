'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { StatusAnaliseBadge, ClassificacaoBadge, InteresseBadge, VersaoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { SolicitacaoDetalheInline, type DetalheInline } from '@/components/painel/SolicitacaoDetalheInline'
import { MOTIVO_REPROVACAO_LABELS } from '@/types'
import type { SolicitacaoListItem } from '@/types'

interface Props {
  data: SolicitacaoListItem[]
  onEdit: (item: SolicitacaoListItem) => void
  onCancel: (item: SolicitacaoListItem) => void
  onNovaRevisao?: (item: SolicitacaoListItem) => void
  onReenviar?: (item: SolicitacaoListItem) => void
  onReativar?: (item: SolicitacaoListItem) => void
  onEditarReprovacao?: (id: number) => void
  canEdit: boolean
  canCancel: boolean
  canRevisao: boolean
}

const col = createColumnHelper<SolicitacaoListItem>()

export function SolicitacoesTable({
  data,
  onEdit,
  onCancel,
  onNovaRevisao,
  onReenviar,
  onReativar,
  onEditarReprovacao,
  canEdit,
  canCancel,
  canRevisao,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detalheCache, setDetalheCache] = useState<Map<number, DetalheInline>>(new Map())

  const handleDetalheLoaded = useCallback((id: number, data: DetalheInline) => {
    setDetalheCache((prev) => new Map(prev).set(id, data))
  }, [])

  const columns = useMemo(
    () => [
      col.accessor('numero', {
        header: 'Nº',
        cell: (info) => <span className="font-bold">{info.getValue()}</span>,
        size: 90,
      }),
      col.accessor('created_at', {
        header: 'Data criação',
        cell: (info) => formatDate(info.getValue()),
        size: 80,
      }),
      col.accessor('versao_atual', {
        header: 'Versão',
        cell: (info) => <VersaoBadge versao={info.getValue()} />,
        size: 70,
      }),
      col.accessor((row) => row.cliente.nome, {
        id: 'cliente',
        header: 'Cliente',
        size: 130,
      }),
      col.accessor((row) => row.cliente_final?.nome ?? '—', {
        id: 'cliente_final',
        header: 'Cliente Final',
        size: 130,
      }),
      col.accessor((row) => [row.cidade, row.estado].filter(Boolean).join(' / '), {
        id: 'local',
        header: 'Cidade / UF',
        size: 110,
      }),
      col.accessor('escopo', {
        header: 'Escopo',
        cell: (info) => (
          <span className="max-w-[240px] truncate block" title={info.getValue() ?? ''}>
            {info.getValue() ?? '—'}
          </span>
        ),
        size: 260,
      }),
      col.accessor('classificacao', {
        header: 'Classif.',
        cell: (info) => <ClassificacaoBadge value={info.getValue()} />,
        size: 80,
      }),
      col.accessor('interesse', {
        header: 'Interesse',
        cell: (info) => <InteresseBadge value={info.getValue()} />,
        size: 80,
      }),
      col.accessor('status_analise', {
        header: 'Status',
        cell: (info) => {
          const row = info.row.original
          return (
            <div>
              <StatusAnaliseBadge status={info.getValue()} />
              {row.status_analise === 'REPROVADA' && row.motivo_reprovacao && (
                <p className="text-[9px] text-red-500 mt-0.5 truncate max-w-[100px]" title={MOTIVO_REPROVACAO_LABELS[row.motivo_reprovacao]}>
                  {MOTIVO_REPROVACAO_LABELS[row.motivo_reprovacao]}
                </p>
              )}
            </div>
          )
        },
        size: 100,
      }),
      col.accessor((row) => row.orcamentista?.nome ?? '—', {
        id: 'orcamentista',
        header: 'Orçamentista',
        size: 110,
      }),
      col.display({
        id: 'acoes',
        header: 'Ações',
        cell: ({ row }) => {
          const item = row.original
          const isCancelada = !!item.cancelled_at
          const isReprovada = item.status_analise === 'REPROVADA'
          return (
            <div className="flex gap-1">
              {canRevisao && !isCancelada && (
                <Button
                  variant="warning"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onNovaRevisao?.(item) }}
                  title="Nova revisão"
                >
                  ↻
                </Button>
              )}
              {isReprovada && !isCancelada && onReenviar && (
                <Button
                  variant="warning"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onReenviar(item) }}
                  title="Reenviar para análise"
                >
                  ↩
                </Button>
              )}
              {isCancelada && onReativar && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onReativar(item) }}
                  title="Reativar solicitação"
                >
                  ↺
                </Button>
              )}
              {canEdit && !isCancelada && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onEdit(item) }}
                  title="Editar"
                >
                  ✎
                </Button>
              )}
              {canCancel && !isCancelada && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onCancel(item) }}
                  title="Cancelar"
                >
                  ✕
                </Button>
              )}
            </div>
          )
        },
        size: 120,
      }),
    ],
    [canEdit, canCancel, canRevisao, onEdit, onCancel, onNovaRevisao, onReenviar, onReativar, onEditarReprovacao],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <p className="text-center text-gray-400 py-10 text-sm">
        Nenhuma solicitação encontrada.
      </p>
    )
  }

  const colSpan = columns.length

  return (
    <div className="h-full overflow-auto border border-gray-200 rounded-md">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
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
                  {header.column.getIsSorted() === 'asc' && ' ↑'}
                  {header.column.getIsSorted() === 'desc' && ' ↓'}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => {
            const isExpanded = expandedId === row.original.id
            return (
              <>
                <tr
                  key={row.id}
                  onClick={() => setExpandedId(isExpanded ? null : row.original.id)}
                  className={`border-b border-gray-100 hover:bg-green-light cursor-pointer transition-colors ${
                    i % 2 === 1 && !isExpanded ? 'bg-gray-50' : isExpanded ? 'bg-green-light' : 'bg-white'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-[6px] whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <tr key={`${row.id}-detail`} className="bg-white border-b border-gray-200">
                    <td colSpan={colSpan} className="p-0">
                      <SolicitacaoDetalheInline
                    id={row.original.id}
                    initialData={detalheCache.get(row.original.id)}
                    onLoaded={handleDetalheLoaded}
                    onEditarReprovacao={onEditarReprovacao ? () => onEditarReprovacao(row.original.id) : undefined}
                  />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
