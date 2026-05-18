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
import { formatCurrency, formatDate } from '@/lib/utils'
import type { NFContratoListItem } from '@/types'

interface Props {
  nfs: NFContratoListItem[]
  onEditar: (nf: NFContratoListItem) => void
  onInativar: (nf: NFContratoListItem) => void
  onExcluir: (nf: NFContratoListItem) => void
  canEditar: boolean
}

const col = createColumnHelper<NFContratoListItem>()

export function NfRegistroTable({ nfs, onEditar, onInativar, onExcluir, canEditar }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(() => [
    col.accessor('numero_nf', {
      header: 'Nº NF',
      cell: (info) => <span className="font-mono font-semibold">{info.getValue()}</span>,
      size: 140,
    }),
    col.accessor('data_emissao', {
      header: 'Emissão',
      cell: (info) => formatDate(info.getValue()),
      size: 95,
    }),
    col.accessor('data_vencimento', {
      header: 'Vencimento',
      cell: (info) => formatDate(info.getValue()),
      size: 95,
    }),
    col.accessor('valor_total_nf', {
      header: 'Valor Total NF',
      cell: (info) => <span className="font-semibold">{formatCurrency(info.getValue())}</span>,
      size: 130,
    }),
    col.accessor('percentual', {
      header: '%',
      cell: (info) => {
        const v = info.getValue()
        return v < 100
          ? <span className="text-blue-600 font-semibold">{v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%</span>
          : <span className="text-gray-400">100%</span>
      },
      size: 70,
    }),
    col.accessor('valor_atribuido', {
      header: 'Valor Faturado',
      cell: (info) => {
        const ativa = info.row.original.ativa
        return (
          <span className={ativa ? 'font-semibold text-auto-value' : 'text-gray-400 line-through'}>
            {formatCurrency(info.getValue())}
          </span>
        )
      },
      size: 130,
    }),
    col.accessor('ativa', {
      header: 'Status',
      cell: (info) => {
        const ativa = info.getValue()
        const motivo = info.row.original.motivo_inativacao
        return ativa
          ? <span className="text-green-700 font-semibold text-[10px]">Ativa</span>
          : <span className="text-gray-400 text-[10px]" title={motivo ?? undefined}>Inativa</span>
      },
      size: 75,
    }),
    col.accessor((row) => row.contrato.indice, {
      id: 'contrato',
      header: 'Contrato',
      cell: (info) => (
        <span className="bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-[10px] font-semibold">
          {info.getValue()}
        </span>
      ),
      size: 90,
    }),
    col.accessor((row) => row.cliente.nome, {
      id: 'cliente',
      header: 'Cliente',
      cell: (info) => (
        <span className="text-blue-700 font-medium truncate block max-w-[154px]">
          {info.getValue()}
        </span>
      ),
      size: 170,
    }),
    col.accessor((row) => `${row.contrato.indice}.${row.subindice.ordem}`, {
      id: 'subitem',
      header: 'Sub-item',
      cell: (info) => <span className="text-gray-500 text-[10px]">{info.getValue()}</span>,
      size: 80,
    }),
    col.accessor((row) => row.subindice.descricao, {
      id: 'descricao',
      header: 'Descrição / Evento',
      cell: (info) => (
        <span className="truncate block text-gray-600" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
      size: 260,
    }),
    col.display({
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => {
        const nf = row.original
        return (
          <div className="flex gap-1">
            {canEditar && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditar(nf) }}
                className="border border-green-primary text-green-primary rounded px-1.5 py-0.5 text-[10px] hover:bg-green-light"
                title="Editar NF"
              >✎</button>
            )}
            {canEditar && (
              <button
                onClick={(e) => { e.stopPropagation(); onInativar(nf) }}
                className={`border rounded px-1.5 py-0.5 text-[10px] ${
                  nf.ativa
                    ? 'border-orange-400 text-orange-500 hover:bg-orange-50'
                    : 'border-blue-400 text-blue-500 hover:bg-blue-50'
                }`}
                title={nf.ativa ? 'Inativar NF' : 'Reativar NF'}
              >{nf.ativa ? '⊘' : '↺'}</button>
            )}
            {canEditar && (
              <button
                onClick={(e) => { e.stopPropagation(); onExcluir(nf) }}
                className="border border-red-400 text-red-400 rounded px-1.5 py-0.5 text-[10px] hover:bg-red-50"
                title="Excluir NF"
              >🗑</button>
            )}
          </div>
        )
      },
      size: 90,
    }),
  ], [canEditar, onEditar, onInativar, onExcluir])

  const table = useReactTable({
    data: nfs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const totalValorNF   = nfs.reduce((a, n) => a + n.valor_total_nf, 0)
  const totalAtribuido = nfs.reduce((a, n) => a + n.valor_atribuido, 0)
  const qtAtivas       = nfs.filter((n) => n.ativa).length

  if (nfs.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhuma NF encontrada.</p>
  }

  const colSpan = columns.length

  return (
    <div className="h-full overflow-auto border border-gray-200 rounded-md">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
          {/* ── Linha totalizadora ── */}
          <tr className="bg-[#C8E6C9] border-b-2 border-green-primary">
            <td
              colSpan={3}
              className="px-2 py-[4px] font-bold text-[10px] whitespace-nowrap"
            >
              TOTAIS · {nfs.length} nota{nfs.length !== 1 ? 's' : ''} · {qtAtivas} ativa{qtAtivas !== 1 ? 's' : ''}
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalValorNF)}</span>
            </td>
            <td className="px-2 py-[4px]"></td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalAtribuido)}</span>
            </td>
            <td colSpan={colSpan - 6} className="px-2 py-[4px]"></td>
          </tr>

          {/* ── Cabeçalho ── */}
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
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              className={`border-b border-gray-100 hover:bg-green-light transition-colors ${
                i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
              } ${!row.original.ativa ? 'opacity-60' : ''}`}
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
