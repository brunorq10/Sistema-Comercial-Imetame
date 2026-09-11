import { barColors } from '@/lib/hh'

// ── Card de indicador (mesmo padrão visual dos cards de Obras) — compartilhado
// entre a página de UM contrato de Fabricação e a aba Resumo (ResumoFab), que
// deve mostrar exatamente os mesmos cards.
export function IndicadorCard({ label, value, color, bg, iconPath, sub, extra, bar }: {
  label: string; value: string; color: string; bg: string; iconPath: string; sub?: string
  extra?: React.ReactNode
  bar?: { titulo: string; pct: number }
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-normal text-gray-500 mb-1">{label}</p>
        <p className="text-[30px] font-bold leading-none tracking-tight" style={{ color }}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
        {extra}
        {bar && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{bar.titulo}</span>
              <span className="text-[11px] font-bold" style={{ color: barColors(bar.pct).text }}>{bar.pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(bar.pct, 100)}%`, backgroundColor: barColors(bar.pct).bg }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const ICONS = {
  doc:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  trend:  'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  target: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  list:   'M4 6h16M4 12h16M4 18h16',
  bolt:   'M13 10V3L4 14h7v7l9-11h-7z',
}
