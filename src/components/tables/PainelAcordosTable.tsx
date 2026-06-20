'use client'

import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { CLASSIFICACAO_LABELS } from '@/types'
import type { Classificacao } from '@/types'

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface PainelContratoRow {
  id: number
  indice: string
  cliente_nome: string
  descricao: string | null
  classificacao: string | null
  status: string
  meses: { prev: number; fat: number }[]
  total_prev_ano: number
  total_fat_ano: number
  a_faturar_ano: number
}

interface Props {
  contratos: PainelContratoRow[]
  mesAtual: number  // 0-11
}

const W = {
  indice:    90,
  cliente:   155,
  descricao: 230,
  mes:       110,
  totalPrev: 130,
  totalFat:  130,
  aFaturar:  120,
}

// Offsets de congelamento (desktop). No mobile usamos EMPTY_L (undefined) para
// que as colunas não fixem e a tabela role inteira, sem sobreposição.
const LD = {
  indice:    0 as number | undefined,
  cliente:   W.indice as number | undefined,
  descricao: (W.indice + W.cliente) as number | undefined,
}
const EMPTY_L = { indice: undefined, cliente: undefined, descricao: undefined }
const FROZEN_TOTAL = (LD.descricao ?? 0) + W.descricao
const MIN_W = FROZEN_TOTAL + 12 * W.mes + W.totalPrev + W.totalFat + W.aFaturar

function fatColorClass(fat: number, prev: number): string {
  return fat < prev ? 'text-red-400' : 'text-green-500'
}

export function PainelAcordosTable({ contratos, mesAtual }: Props) {
  // Congelar colunas só no desktop; no mobile a tabela rola inteira (sem sobreposição).
  const isDesktop = useIsDesktop()
  const L = isDesktop ? LD : EMPTY_L

  if (contratos.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum contrato atribuído a você neste ano.</p>
  }

  const TH  = 'sticky top-[33px] bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap select-none border-b border-green-dark'
  const thF = (shadow?: boolean) => cn(TH, 'z-[20]', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
  const thS = (mes?: number) => cn(TH, 'z-[10]', mes === mesAtual && 'bg-green-dark')

  const TC  = 'sticky top-0 z-[30] px-2 py-[4px] bg-[#C8E6C9] text-[11px] whitespace-nowrap border-b-2 border-green-primary'
  const tcF = (shadow?: boolean) => cn(TC, 'z-[40] font-bold', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')

  const mBase = 'px-2 py-[5px] text-[11px] whitespace-nowrap border-b border-gray-100'
  const mF    = (shadow?: boolean) => cn(mBase, 'sticky z-[5]', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.10)]')

  // Totalizadores
  const totMeses = Array.from({ length: 12 }, (_, mi) => ({
    prev: contratos.reduce((a, c) => a + c.meses[mi].prev, 0),
    fat:  contratos.reduce((a, c) => a + c.meses[mi].fat,  0),
  }))
  const totPrevAno  = contratos.reduce((a, c) => a + c.total_prev_ano, 0)
  const totFatAno   = contratos.reduce((a, c) => a + c.total_fat_ano,  0)
  const totAFaturar = totPrevAno - totFatAno

  return (
    <div className="border border-gray-200 rounded-md" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
      <table className="border-collapse text-[11px]" style={{ minWidth: `${MIN_W}px`, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: W.indice   }} />
          <col style={{ width: W.cliente  }} />
          <col style={{ width: W.descricao }} />
          {MESES_LABELS.map((_, i) => <col key={i} style={{ width: W.mes }} />)}
          <col style={{ width: W.totalPrev }} />
          <col style={{ width: W.totalFat  }} />
          <col style={{ width: W.aFaturar  }} />
        </colgroup>

        <thead>
          {/* ── Linha totalizadora ── */}
          <tr>
            <td className={tcF()}  style={{ left: L.indice   }}>TOTAIS</td>
            <td className={tcF()}  style={{ left: L.cliente  }}></td>
            <td className={tcF(true)} style={{ left: L.descricao }}></td>
            {totMeses.map(({ prev, fat }, mi) => (
              <td key={mi} className={cn(TC, mi === mesAtual && 'bg-[#A5D6A7]')}>
                {prev === 0 && fat === 0 ? <span className="text-gray-400">—</span> : (
                  <div className="flex flex-col gap-0.5">
                    {prev > 0 && <span className="text-[10px] text-[#1565C0] font-semibold">P {formatCurrency(prev)}</span>}
                    {fat  > 0 && <span className={cn('text-[10px] font-semibold', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                  </div>
                )}
              </td>
            ))}
            <td className={TC}>
              {totPrevAno > 0 ? <span className="text-[#1565C0] font-bold">{formatCurrency(totPrevAno)}</span> : <span className="text-gray-400">—</span>}
            </td>
            <td className={TC}>
              {totFatAno > 0
                ? <span className={cn('font-bold', fatColorClass(totFatAno, totPrevAno))}>{formatCurrency(totFatAno)}</span>
                : <span className="text-gray-400">—</span>}
            </td>
            <td className={TC}>
              {totAFaturar > 0
                ? <span className="text-orange-600 font-bold">{formatCurrency(totAFaturar)}</span>
                : totAFaturar === 0
                ? <span className="text-green-600 font-bold">{formatCurrency(0)}</span>
                : <span className="text-blue-600 font-bold">{formatCurrency(Math.abs(totAFaturar))}</span>}
            </td>
          </tr>

          {/* ── Cabeçalho ── */}
          <tr>
            <th className={thF()} style={{ left: L.indice }}>Índice</th>
            <th className={thF()} style={{ left: L.cliente }}>Cliente</th>
            <th className={thF(true)} style={{ left: L.descricao }}>Descrição / Evento</th>
            {MESES_LABELS.map((m, mi) => (
              <th key={m} className={thS(mi)}>
                {m}{mi === mesAtual ? ' ●' : ''}
              </th>
            ))}
            <th className={thS()}>Total Prev. ano</th>
            <th className={thS()}>Total Fat. ano</th>
            <th className={thS()}>A Faturar</th>
          </tr>
        </thead>

        <tbody>
          {contratos.map((c, i) => {
            const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            return (
              <tr key={c.id} className={cn('border-b border-gray-100 hover:bg-green-light transition-colors', rowBg)}>
                {/* Frozen */}
                <td className={mF()} style={{ left: L.indice, background: 'inherit' }}>
                  <span className="font-bold text-green-dark">{c.indice}</span>
                </td>
                <td className={mF()} style={{ left: L.cliente, background: 'inherit' }}>
                  <span className="text-blue-700 font-medium truncate block" style={{ maxWidth: W.cliente - 16 }}>
                    {c.cliente_nome}
                  </span>
                </td>
                <td className={mF(true)} style={{ left: L.descricao, background: 'inherit' }}>
                  <div>
                    <span className="line-clamp-1 whitespace-normal" title={c.descricao ?? ''}>{c.descricao ?? '—'}</span>
                    {c.classificacao && (
                      <span className="text-[9px] text-blue-500">
                        {CLASSIFICACAO_LABELS[c.classificacao as Classificacao]}
                      </span>
                    )}
                  </div>
                </td>

                {/* Meses */}
                {c.meses.map(({ prev, fat }, mi) => (
                  <td key={mi} className={cn(mBase, mi === mesAtual && 'bg-[#F1F8E9]')}>
                    {prev === 0 && fat === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {prev > 0 && <span className="text-[10px] text-[#1565C0]">P {formatCurrency(prev)}</span>}
                        {fat  > 0 && <span className={cn('text-[10px]', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                      </div>
                    )}
                  </td>
                ))}

                {/* Totais */}
                <td className={mBase}>
                  {c.total_prev_ano > 0
                    ? <span className="text-[#1565C0] font-semibold">{formatCurrency(c.total_prev_ano)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase}>
                  {c.total_fat_ano > 0
                    ? <span className={cn('font-semibold', fatColorClass(c.total_fat_ano, c.total_prev_ano))}>{formatCurrency(c.total_fat_ano)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase}>
                  {c.a_faturar_ano > 0
                    ? <span className="text-orange-500 font-semibold">{formatCurrency(c.a_faturar_ano)}</span>
                    : c.a_faturar_ano === 0
                    ? <span className="text-green-500 font-semibold">{formatCurrency(0)}</span>
                    : <span className="text-blue-500 font-semibold">{formatCurrency(Math.abs(c.a_faturar_ano))}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
