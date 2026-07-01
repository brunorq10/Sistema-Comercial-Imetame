'use client'

import { formatValor, type PivotResult } from '@/lib/relatorios/shared'

const TH = 'px-2.5 py-1.5 text-left text-[10px] font-semibold text-white bg-green-primary border border-green-dark/30 whitespace-nowrap'
const TD = 'px-2.5 py-1.5 text-[11px] border border-gray-100 whitespace-nowrap'

export function ResultTable({ pivot }: { pivot: PivotResult }) {
  const nRD = Math.max(1, pivot.rowDimLabels.length)
  const twoRow = !!pivot.topHeader

  return (
    <div className="border border-gray-200 rounded-md overflow-auto">
      <table className="border-collapse w-full">
        <thead>
          {twoRow ? (
            <>
              <tr>
                {pivot.rowDimLabels.map((l, i) => <th key={i} rowSpan={2} className={TH}>{l}</th>)}
                {pivot.topHeader!.map((g, i) => (
                  <th key={i} colSpan={g.span} className={`${TH} text-center`} style={g.isTotal ? { background: '#0A1F44' } : undefined}>{g.label}</th>
                ))}
              </tr>
              <tr>
                {pivot.leaves.map((l, i) => (
                  <th key={i} className={`${TH} text-right`} style={l.isTotal ? { background: '#0A1F44' } : undefined}>{l.valorLabel}</th>
                ))}
              </tr>
            </>
          ) : (
            <tr>
              {pivot.rowDimLabels.map((l, i) => <th key={i} className={TH}>{l}</th>)}
              {pivot.leaves.map((l, i) => <th key={i} className={`${TH} text-right`}>{l.valorLabel}</th>)}
            </tr>
          )}
        </thead>
        <tbody>
          {pivot.rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-gray-50">
              {r.dims.map((d, di) => <td key={di} className={`${TD} font-medium text-gray-700`}>{d}</td>)}
              {r.values.map((v, vi) => (
                <td key={vi} className={`${TD} text-right ${pivot.leaves[vi]?.isTotal ? 'text-white font-semibold' : 'text-gray-700'}`}
                  style={pivot.leaves[vi]?.isTotal ? { background: '#0A1F44' } : undefined}>
                  {formatValor(v, pivot.leaves[vi]?.formato ?? 'numero')}
                </td>
              ))}
            </tr>
          ))}
          {/* Linha Total */}
          <tr style={{ background: '#F0FDF4' }}>
            <td className={`${TD} font-bold text-green-800`} colSpan={nRD}>Total</td>
            {pivot.totalRow.map((v, vi) => (
              <td key={vi} className={`${TD} text-right font-bold ${pivot.leaves[vi]?.isTotal ? 'text-white' : 'text-green-700'}`}
                style={pivot.leaves[vi]?.isTotal ? { background: '#0A1F44' } : undefined}>
                {formatValor(v, pivot.leaves[vi]?.formato ?? 'numero')}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
