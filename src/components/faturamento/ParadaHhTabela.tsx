'use client'

import { formatDate } from '@/lib/utils'
import { barColors } from '@/lib/hh'
import { ETAPA_LABEL, ETAPA_COR, type ParadaHhRow } from '@/lib/paradaHh'

const fmtHH = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Substitui a tabela "Faturamento por Mês" quando o contrato é uma Parada. */
export function ParadaHhTabela({ rows }: { rows: ParadaHhRow[] }) {
  const totPrevisto = rows.reduce((s, r) => s + r.previsto, 0)
  const temReal = rows.some((r) => r.realizado != null)
  const totRealizado = temReal ? rows.reduce((s, r) => s + (r.realizado ?? 0), 0) : null

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">▦ HH Previsto x Realizado — por dia</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum lançamento de HH diário registrado para esta Parada.</p>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-auto" style={{ maxHeight: '446px' }}>
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">Etapa</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">Data</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">HH Previsto</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">HH Real</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">Previsto Acum.</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">Real Acum.</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.realizadoAcum != null && r.previstoAcum > 0 ? (r.realizadoAcum / r.previstoAcum) * 100 : null
                return (
                  <tr key={`${r.etapa}-${r.data}`} className="hover:bg-gray-50" style={{ borderLeft: `3px solid ${ETAPA_COR[r.etapa]}` }}>
                    <td className="px-3 py-1.5 font-medium border-b border-gray-100 whitespace-nowrap" style={{ color: ETAPA_COR[r.etapa] }}>{ETAPA_LABEL[r.etapa]}</td>
                    <td className="px-3 py-1.5 text-gray-600 border-b border-gray-100 whitespace-nowrap">{formatDate(r.data)}</td>
                    <td className="px-3 py-1.5 text-right text-blue-600 font-semibold border-b border-gray-100 whitespace-nowrap">{fmtHH(r.previsto)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold border-b border-gray-100 whitespace-nowrap">
                      {r.realizado != null ? <span className="text-green-700">{fmtHH(r.realizado)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-blue-600 font-semibold border-b border-gray-100 whitespace-nowrap">{fmtHH(r.previstoAcum)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold border-b border-gray-100 whitespace-nowrap">
                      {r.realizadoAcum != null ? <span className="text-green-700">{fmtHH(r.realizadoAcum)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold border-b border-gray-100 whitespace-nowrap" style={{ color: pct != null ? barColors(pct).text : undefined }}>
                      {pct != null ? `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td colSpan={2} className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-700 whitespace-nowrap">Total</td>
                <td className="px-3 py-2 text-right text-blue-600 whitespace-nowrap">{fmtHH(totPrevisto)}</td>
                <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{totRealizado != null ? fmtHH(totRealizado) : '—'}</td>
                <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">—</td>
                <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">—</td>
                <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
