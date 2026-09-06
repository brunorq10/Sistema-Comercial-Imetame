'use client'

interface RankingRow {
  label: string
  value: number
  sub?: string
  highlight?: boolean
}

interface RankingBarProps {
  rows: RankingRow[]
  format: (v: number) => string
  color?: string
  emptyLabel?: string
  limit?: number
}

// Lista ranqueada com barra proporcional — usada em quase todo relatório
// (curva ABC de clientes, saldo a faturar, carga por pessoa, impacto de
// multas...). Uma única barra horizontal por linha, maior valor = 100%.
export function RankingBar({ rows, format, color = '#2E7D32', emptyLabel = 'Nenhum dado no período.', limit }: RankingBarProps) {
  const shown = limit ? rows.slice(0, limit) : rows
  if (shown.length === 0) return <p className="text-[11px] text-gray-400 text-center py-6">{emptyLabel}</p>
  const max = Math.max(...shown.map((r) => Math.abs(r.value)), 1)
  return (
    <div className="flex flex-col gap-2">
      {shown.map((r, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-2 text-[11px] mb-0.5">
            <span className="text-gray-700 truncate">{r.label}{r.sub && <span className="text-gray-400"> · {r.sub}</span>}</span>
            <span className={`font-semibold whitespace-nowrap ${r.highlight ? 'text-red-600' : 'text-gray-800'}`}>{format(r.value)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (Math.abs(r.value) / max) * 100)}%`, background: r.highlight ? '#DC2626' : color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
