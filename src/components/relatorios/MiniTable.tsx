'use client'

export interface MiniTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  render: (row: T) => React.ReactNode
  width?: string
}

interface MiniTableProps<T> {
  columns: MiniTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  emptyLabel?: string
  maxH?: string
}

// Tabela compacta genérica — cabeçalho verde fixo, linhas zebradas. Usada nos
// relatórios que precisam de lista detalhada em vez de ranking/gráfico
// (atrasadas, pendências de aprovação, aderência por contrato...).
export function MiniTable<T>({ columns, rows, rowKey, emptyLabel = 'Nenhum registro.', maxH }: MiniTableProps<T>) {
  if (rows.length === 0) return <p className="text-[11px] text-gray-400 text-center py-6">{emptyLabel}</p>
  return (
    <div className="overflow-auto border border-gray-100 rounded-md" style={maxH ? { maxHeight: maxH } : undefined}>
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="bg-green-primary text-white px-2.5 py-[6px] font-semibold text-[10px] whitespace-nowrap"
                style={{ textAlign: c.align ?? 'left', width: c.width }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={rowKey(row)} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
              {columns.map((c) => (
                <td key={c.key} className="px-2.5 py-[6px] whitespace-nowrap text-gray-700" style={{ textAlign: c.align ?? 'left' }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
