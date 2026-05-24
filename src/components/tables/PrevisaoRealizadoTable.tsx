'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export interface PrevisaoRealizadoItem {
  id: number
  subindice_id: number
  indice: string
  cliente_nome: string
  cliente_final_nome: string | null
  descricao_contrato: string | null
  ordem: number
  num_os: string | null
  descricao: string
  valor_consolidado: number
  valor_previsto: number
  valor_faturado: number
  percentual: number
}

interface Props {
  itens: PrevisaoRealizadoItem[]
}

function PercBadge({ perc }: { perc: number }) {
  const cls =
    perc >= 100 ? 'text-green-700 font-bold' :
    perc >= 50  ? 'text-blue-600 font-semibold' :
    perc > 0    ? 'text-orange-500 font-semibold' :
                  'text-gray-400'
  return (
    <span className={cls}>
      {perc.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  )
}

function calcPerc(faturado: number, consolidado: number) {
  return consolidado > 0 ? Number(((faturado / consolidado) * 100).toFixed(1)) : 0
}

interface Grupo {
  indice: string
  cliente_nome: string
  cliente_final_nome: string | null
  descricao_contrato: string | null
  itens: PrevisaoRealizadoItem[]
  total_consolidado: number
  total_previsto: number
  total_faturado: number
  perc: number
}

export function PrevisaoRealizadoTable({ itens }: Props) {
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>()
    const order: string[] = []
    for (const item of itens) {
      const key = item.indice
      if (!map.has(key)) {
        order.push(key)
        map.set(key, {
          indice: item.indice,
          cliente_nome: item.cliente_nome,
          cliente_final_nome: item.cliente_final_nome,
          descricao_contrato: item.descricao_contrato,
          itens: [],
          total_consolidado: 0,
          total_previsto: 0,
          total_faturado: 0,
          perc: 0,
        })
      }
      const g = map.get(key)!
      g.itens.push(item)
      g.total_consolidado += item.valor_consolidado
      g.total_previsto    += item.valor_previsto
      g.total_faturado    += item.valor_faturado
    }
    return order.map((key) => {
      const g = map.get(key)!
      g.perc = calcPerc(g.total_faturado, g.total_consolidado)
      return g
    })
  }, [itens])

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const toggle = (indice: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(indice) ? next.delete(indice) : next.add(indice)
      return next
    })

  const totalConsolidado = grupos.reduce((a, g) => a + g.total_consolidado, 0)
  const totalPrevisto    = grupos.reduce((a, g) => a + g.total_previsto, 0)
  const totalFaturado    = grupos.reduce((a, g) => a + g.total_faturado, 0)
  const percTotal        = calcPerc(totalFaturado, totalConsolidado)

  if (itens.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum item neste consolidado.</p>
  }

  const thCls = 'bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap'
  const tdBase = 'px-2 py-[5px] whitespace-nowrap text-[11px]'

  // 9 colunas: toggle | Índice | Cliente | Cliente Final | Descrição/Evento | Consolidado | Previsto | Faturado | %
  const COL_SPAN_TOTAL = 9

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-md">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          {/* Totalizador geral */}
          <tr className="bg-[#C8E6C9] border-b-2 border-green-primary">
            <td colSpan={5} className="px-2 py-[4px] font-bold text-[10px] whitespace-nowrap">
              TOTAIS · {grupos.length} contrato{grupos.length !== 1 ? 's' : ''} · {itens.length} sub-índice{itens.length !== 1 ? 's' : ''}
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalConsolidado)}</span>
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalPrevisto)}</span>
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <span className="font-bold text-[#1B5E20]">{formatCurrency(totalFaturado)}</span>
            </td>
            <td className="px-2 py-[4px] whitespace-nowrap">
              <PercBadge perc={percTotal} />
            </td>
          </tr>

          {/* Cabeçalho */}
          <tr>
            <th className={thCls} style={{ width: 28 }} />
            <th className={thCls} style={{ width: 90 }}>Índice</th>
            <th className={thCls} style={{ width: 150 }}>Cliente</th>
            <th className={thCls} style={{ width: 140 }}>Cliente Final</th>
            <th className={thCls}>Descrição / Evento</th>
            <th className={thCls} style={{ width: 150 }}>Valor Consolidado</th>
            <th className={thCls} style={{ width: 140 }}>Valor Previsto</th>
            <th className={thCls} style={{ width: 140 }}>Valor Faturado</th>
            <th className={thCls} style={{ width: 100 }}>% Realizado</th>
          </tr>
        </thead>

        <tbody>
          {grupos.map((g) => {
            const expanded = expandidos.has(g.indice)
            return (
              <>
                {/* ── Linha macro (contrato) ── */}
                <tr
                  key={g.indice}
                  className="bg-gray-100 border-b border-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
                  onClick={() => toggle(g.indice)}
                >
                  <td className={`${tdBase} text-center text-gray-500 select-none`}>
                    {expanded ? '▼' : '▶'}
                  </td>
                  <td className={tdBase}>
                    <span className="bg-green-primary text-white rounded px-1.5 py-0.5 text-[10px] font-bold">
                      {g.indice}
                    </span>
                  </td>
                  <td className={`${tdBase} max-w-[150px]`}>
                    <span className="font-semibold text-blue-700 truncate block" style={{ maxWidth: 134 }}>
                      {g.cliente_nome}
                    </span>
                  </td>
                  <td className={`${tdBase} max-w-[140px]`}>
                    {g.cliente_final_nome
                      ? <span className="text-indigo-600 truncate block" style={{ maxWidth: 124 }}>{g.cliente_final_nome}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className={tdBase}>
                    <span className="text-gray-700 truncate block" style={{ maxWidth: 320 }} title={g.descricao_contrato ?? ''}>
                      {g.descricao_contrato ?? <span className="text-gray-400 italic">Sem descrição</span>}
                    </span>
                    <span className="text-gray-400 text-[10px]">
                      {g.itens.length} sub-índice{g.itens.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className={tdBase}>
                    <span className="font-bold text-purple-700">{formatCurrency(g.total_consolidado)}</span>
                  </td>
                  <td className={tdBase}>
                    <span className="font-bold text-[#1565C0]">{formatCurrency(g.total_previsto)}</span>
                  </td>
                  <td className={tdBase}>
                    {g.total_faturado > 0
                      ? <span className="font-bold text-green-700">{formatCurrency(g.total_faturado)}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className={tdBase}>
                    <PercBadge perc={g.perc} />
                  </td>
                </tr>

                {/* ── Sub-índices (expansíveis) ── */}
                {expanded && g.itens.map((item, i) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}`}
                  >
                    {/* toggle vazio */}
                    <td className={tdBase} />
                    {/* Nº sub-índice */}
                    <td className={tdBase}>
                      <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                        {g.indice}.{item.ordem}
                      </span>
                    </td>
                    {/* Nº OS — ocupa coluna Cliente */}
                    <td className={`${tdBase} text-gray-500`}>
                      {item.num_os ?? <span className="text-gray-300">—</span>}
                    </td>
                    {/* Cliente Final — vazio nos sub-índices */}
                    <td className={tdBase} />
                    {/* Descrição do sub-índice */}
                    <td className={`${tdBase} pl-4 text-gray-600`}>
                      <span className="truncate block" style={{ maxWidth: 320 }} title={item.descricao}>
                        {item.descricao}
                      </span>
                    </td>
                    <td className={tdBase}>
                      <span className="text-purple-700 font-semibold">{formatCurrency(item.valor_consolidado)}</span>
                    </td>
                    <td className={tdBase}>
                      <span className="text-[#1565C0] font-semibold">{formatCurrency(item.valor_previsto)}</span>
                    </td>
                    <td className={tdBase}>
                      {item.valor_faturado > 0
                        ? <span className="text-green-700 font-semibold">{formatCurrency(item.valor_faturado)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className={tdBase}>
                      <PercBadge perc={item.percentual} />
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Suprime warning de key em fragment dentro de map
PrevisaoRealizadoTable.displayName = 'PrevisaoRealizadoTable'
