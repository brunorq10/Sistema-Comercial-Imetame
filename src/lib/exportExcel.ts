import * as XLSX from 'xlsx'
import type { ColumnType } from '@/components/relatorios/DataTable'

interface ExportColumn<T> {
  header: string
  type: ColumnType
  value: (row: T) => string | number | Date | null
  width?: number
}

// Exporta exatamente as linhas/colunas exibidas na tela — respeitando os
// filtros já aplicados — com tipos reais: número como número, data como
// data, percentual como percentual. Nunca tudo como texto.
export function exportToExcel<T>(columns: ExportColumn<T>[], rows: T[], filename: string, sheetName = 'Relatório') {
  const header = columns.map((c) => c.header)
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row)
      if (v == null) return ''
      if (c.type === 'percent' && typeof v === 'number') return v / 100
      return v
    }),
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...body])

  columns.forEach((c, colIdx) => {
    if (c.type === 'text' || c.type === undefined) return
    for (let r = 1; r <= rows.length; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx })
      const cell = ws[addr]
      if (!cell) continue
      if (c.type === 'currency') cell.z = '"R$" #,##0.00'
      else if (c.type === 'percent') cell.z = '0.0%'
      else if (c.type === 'number') cell.z = '#,##0'
      else if (c.type === 'date' && cell.v instanceof Date) cell.z = 'dd/mm/yyyy'
    }
  })

  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}
