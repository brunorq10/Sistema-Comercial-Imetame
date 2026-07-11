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
import { AcoesMenu } from '@/components/ui/AcoesMenu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TIPO_MULTA_MAP } from '@/lib/multas'

export interface MultaListItem {
  id: number
  contrato_id: number
  contrato_indice: string
  cliente_nome: string
  tipo: string
  descricao: string
  data_ocorrencia: string
  data_notificacao_cliente: string | null
  data_desconto: string | null
  valor_total: number
  ativa: boolean
  motivo_inativacao: string | null
  autor: string
}

interface Props {
  multas: MultaListItem[]
  onEditar: (m: MultaListItem) => void
  onInativar: (m: MultaListItem) => void
  onExcluir: (m: MultaListItem) => void
  canEditar: boolean
  canExcluir: boolean
}

const col = createColumnHelper<MultaListItem>()

// Mesmo padrão visual da tabela de Registro de NF (NfRegistroTable)
export function MultasRegistroTable({ multas, onEditar, onInativar, onExcluir, canEditar, canExcluir }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(() => [
    col.accessor('tipo', {
      header: 'Tipo',
      cell: (info) => {
        const cfg = TIPO_MULTA_MAP[info.getValue()]
        return (
          <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5" style={{ color: cfg?.cor ?? '#6B7280', backgroundColor: cfg?.corBg ?? '#F3F4F6' }}>
            {cfg?.label ?? info.getValue()}
          </span>
        )
      },
      size: 110,
    }),
    col.accessor('contrato_indice', {
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
        <span className="text-blue-700 font-medium truncate block max-w-[154px]">
          {info.getValue()}
        </span>
      ),
      size: 170,
    }),
    col.accessor('descricao', {
      header: 'Descrição',
      cell: (info) => (
        <span className="truncate block max-w-[260px] text-gray-600" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
      size: 260,
    }),
    col.accessor('data_ocorrencia', {
      header: 'Dt. Ocorrência',
      cell: (info) => formatDate(info.getValue()),
      size: 95,
    }),
    col.accessor('data_notificacao_cliente', {
      header: 'Dt. Notificação',
      cell: (info) => info.getValue() ? formatDate(info.getValue()!) : <span className="text-gray-300">—</span>,
      size: 95,
    }),
    col.accessor('data_desconto', {
      header: 'Dt. Desconto',
      cell: (info) => info.getValue() ? formatDate(info.getValue()!) : <span className="text-gray-300">—</span>,
      size: 95,
    }),
    col.accessor('valor_total', {
      header: 'Valor',
      cell: (info) => {
        const ativa = info.row.original.ativa
        return (
          <span className={ativa ? 'font-semibold text-auto-value' : 'text-gray-400 line-through'}>
            {formatCurrency(info.getValue())}
          </span>
        )
      },
      size: 120,
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
    col.display({
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <AcoesMenu items={[
              { label: 'Editar multa', icon: '✎', destaque: true, visivel: canEditar, onClick: () => onEditar(m) },
              { label: m.ativa ? 'Inativar' : 'Reativar', icon: m.ativa ? '⊘' : '↺', visivel: canEditar, onClick: () => onInativar(m) },
              { label: 'Excluir', icon: '🗑', destrutiva: true, visivel: canExcluir, onClick: () => onExcluir(m) },
            ]} />
          </div>
        )
      },
      size: 64,
    }),
  ], [canEditar, canExcluir, onEditar, onInativar, onExcluir])

  const table = useReactTable({
    data: multas,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const totalValor = multas.reduce((a, m) => a + m.valor_total, 0)
  const qtAtivas   = multas.filter((m) => m.ativa).length

  if (multas.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhuma multa/penalidade encontrada com os filtros aplicados.</p>
  }

  const colSpan = columns.length

  return (
    <div className="h-full overflow-auto border border-gray-200 rounded-md">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
          {/* ── Linha totalizadora ── */}
          <tr className="bg-[#C8E6C9] border-b-2 border-green-primary">
            <td
              colSpan={7}
              className="px-2 py-[4px] font-bold text-[10px] whitespace-nowrap"
            >
              TOTAIS · {multas.length} lançamento{multas.length !== 1 ? 's' : ''} · {qtAtivas} ativo{qtAtivas !== 1 ? 's' : ''}
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalValor)}</span>
            </td>
            <td colSpan={colSpan - 8} className="px-2 py-[4px]"></td>
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
