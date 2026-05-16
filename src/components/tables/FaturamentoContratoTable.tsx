'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ContratoItem, SubIndiceItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Larguras fixas das colunas
const W = {
  indice: 130, cliente: 150, os: 110,
  anoRef: 70, acordo: 120, proposta: 110, dtInicio: 90, dtFim: 90,
  descricao: 200, statusFat: 90, vlrTotal: 120, vlrFat: 120,
  responsavel: 130, comentarios: 140,
  mes: 100,
  prevAnos: 130, vlrAFat: 120, acoes: 130,
}

// Posições left das colunas congeladas
const FROZEN_LEFT = {
  indice: 0,
  cliente: W.indice,
  os: W.indice + W.cliente,
}
const FROZEN_SHADOW_WIDTH = W.indice + W.cliente + W.os

function StatusBadge({ status }: { status: 'A_FATURAR' | 'FATURADO' | 'PARCIAL' | 'CANCELADO' }) {
  const map = {
    A_FATURAR: { label: 'A faturar', cls: 'text-orange-600 font-semibold' },
    FATURADO: { label: 'Faturado', cls: 'text-green-700 font-semibold' },
    PARCIAL: { label: 'Parcial', cls: 'text-blue-600 font-semibold' },
    CANCELADO: { label: 'Cancelado', cls: 'text-gray-400' },
  }
  const { label, cls } = map[status] ?? map['A_FATURAR']
  return <span className={cn('text-[11px]', cls)}>{label}</span>
}

interface Props {
  contratos: ContratoItem[]
  onLancarNF: (contrato: ContratoItem, subindice: SubIndiceItem) => void
  onEditarSubindice: (contrato: ContratoItem, subindice: SubIndiceItem) => void
  onEditarContrato: (contrato: ContratoItem) => void
  onCancelarContrato: (contrato: ContratoItem) => void
  canEditar: boolean
  canLancarNF: boolean
}

export function FaturamentoContratoTable({
  contratos, onLancarNF, onEditarSubindice, onEditarContrato, onCancelarContrato,
  canEditar, canLancarNF,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<number>>(() => new Set(contratos.map((c) => c.id)))

  const toggleExpand = (id: number) =>
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (contratos.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum contrato encontrado.</p>
  }

  const thBase = 'bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap select-none'
  const thFrozen = (left: number, shadow?: boolean) =>
    cn(thBase, 'sticky z-[4]', shadow && 'shadow-[2px_0_6px_rgba(0,0,0,0.12)]')
  const thScroll = cn(thBase, 'relative z-[1]')
  const thPurple = cn(thBase, 'bg-[#6A1B9A] relative z-[1]')

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-md">
      <table className="border-collapse text-[11px]" style={{ minWidth: `${FROZEN_SHADOW_WIDTH + 2200}px` }}>
        <thead>
          <tr>
            <th className={thFrozen(FROZEN_LEFT.indice)} style={{ width: W.indice, left: FROZEN_LEFT.indice }}>Índice / Sub-índice</th>
            <th className={thFrozen(FROZEN_LEFT.cliente)} style={{ width: W.cliente, left: FROZEN_LEFT.cliente }}>Cliente</th>
            <th className={thFrozen(FROZEN_LEFT.os, true)} style={{ width: W.os, left: FROZEN_LEFT.os }}>Nº OS</th>
            <th className={thScroll} style={{ width: W.anoRef }}>Ano Ref.</th>
            <th className={thScroll} style={{ width: W.acordo }}>Nº Acordo</th>
            <th className={thScroll} style={{ width: W.proposta }}>Nº Proposta</th>
            <th className={thScroll} style={{ width: W.dtInicio }}>Dt. Início</th>
            <th className={thScroll} style={{ width: W.dtFim }}>Dt. Fim</th>
            <th className={thScroll} style={{ width: W.descricao }}>Descrição / Evento</th>
            <th className={thScroll} style={{ width: W.statusFat }}>Status Fat.</th>
            <th className={thScroll} style={{ width: W.vlrTotal }}>Vlr. Total</th>
            <th className={thScroll} style={{ width: W.vlrFat }}>Vlr. Fat.</th>
            <th className={thScroll} style={{ width: W.responsavel }}>Responsável</th>
            <th className={thScroll} style={{ width: W.comentarios }}>Comentários</th>
            {MESES_LABELS.map((m) => (
              <th key={m} className={thScroll} style={{ width: W.mes }}>{m}</th>
            ))}
            <th className={thPurple} style={{ width: W.prevAnos }}>Prev. anos seg.</th>
            <th className={thScroll} style={{ width: W.vlrAFat }}>Vlr. a Fat./ano</th>
            <th className={thScroll} style={{ width: W.acoes }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((contrato) => {
            const expanded = expandidos.has(contrato.id)
            const totalFaturadoContrato = contrato.subindices.reduce((a, s) => a + s.total_faturado, 0)
            const totalValorContrato = contrato.subindices.reduce((a, s) => a + s.valor_total, 0)
            const vlrAFatContrato = totalValorContrato - totalFaturadoContrato
            const statusContrato = contrato.status as 'A_FATURAR' | 'FATURADO' | 'PARCIAL' | 'CANCELADO'

            // Prev. anos seguintes: soma dos meses que pertencem a anos seguintes não está nos dados,
            // mas podemos checar se data_fim ultrapassa ano_referencia
            const temPrevAnosSeg = contrato.subindices.some(
              (s) => s.data_fim && new Date(s.data_fim).getFullYear() > contrato.ano_referencia
            )

            const tdFrozen = (left: number, shadow?: boolean, extra?: string) =>
              cn('px-2 py-[5px] whitespace-nowrap sticky z-[2] bg-[#EAF4EA]', shadow && 'shadow-[2px_0_6px_rgba(0,0,0,0.08)]', extra)
            const tdMacro = 'px-2 py-[5px] whitespace-nowrap bg-[#EAF4EA] font-semibold'

            return [
              // Linha macro (contrato)
              <tr key={`ct-${contrato.id}`} className="border-b border-gray-200">
                <td className={tdFrozen(FROZEN_LEFT.indice)} style={{ left: FROZEN_LEFT.indice, width: W.indice }}>
                  <button
                    onClick={() => toggleExpand(contrato.id)}
                    className="flex items-center gap-1.5 font-bold text-green-dark hover:text-green-primary"
                  >
                    <span className="text-[10px]">{expanded ? '▼' : '▶'}</span>
                    {contrato.indice}
                  </button>
                </td>
                <td className={tdFrozen(FROZEN_LEFT.cliente)} style={{ left: FROZEN_LEFT.cliente, width: W.cliente }}>
                  <span className="font-semibold text-blue-700">{contrato.cliente.nome}</span>
                </td>
                <td className={tdFrozen(FROZEN_LEFT.os, true)} style={{ left: FROZEN_LEFT.os, width: W.os }}>
                  {contrato.num_os ?? '—'}
                </td>
                <td className={tdMacro} style={{ width: W.anoRef }}>
                  <span className="bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 text-[10px]">{contrato.ano_referencia}</span>
                </td>
                <td className={tdMacro} style={{ width: W.acordo }}>{contrato.num_acordo ?? '—'}</td>
                <td className={tdMacro} style={{ width: W.proposta }}>{contrato.num_proposta ?? '—'}</td>
                <td className={tdMacro} style={{ width: W.dtInicio }}>{formatDate(contrato.data_inicio)}</td>
                <td className={tdMacro} style={{ width: W.dtFim }}>{formatDate(contrato.data_fim)}</td>
                <td className={cn(tdMacro, 'max-w-[200px] truncate')} style={{ width: W.descricao }} title={contrato.descricao ?? ''}>
                  {contrato.descricao ?? '—'}
                </td>
                <td className={tdMacro} style={{ width: W.statusFat }}>
                  <StatusBadge status={statusContrato} />
                </td>
                <td className={tdMacro} style={{ width: W.vlrTotal }}>
                  <span className="font-bold">{formatCurrency(totalValorContrato)}</span>
                </td>
                <td className={tdMacro} style={{ width: W.vlrFat }}>
                  {totalFaturadoContrato > 0 ? formatCurrency(totalFaturadoContrato) : <span className="text-gray-300">—</span>}
                </td>
                <td className={tdMacro} style={{ width: W.responsavel }}>{contrato.responsavel?.nome ?? '—'}</td>
                <td className={tdMacro} style={{ width: W.comentarios }}>—</td>
                {MESES.map((m) => {
                  const soma = contrato.subindices.reduce((a, s) => a + (s[m] ?? 0), 0)
                  return (
                    <td key={m} className={tdMacro} style={{ width: W.mes }}>
                      {soma > 0 ? <span className="text-auto-value font-semibold">{formatCurrency(soma)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  )
                })}
                <td className={cn(tdMacro, 'bg-[#F3E5F5]')} style={{ width: W.prevAnos }}>
                  {temPrevAnosSeg ? <span className="text-[#6A1B9A] font-semibold">Ver sub-índices</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={tdMacro} style={{ width: W.vlrAFat }}>
                  {vlrAFatContrato > 0 ? <span className="text-orange-600 font-bold">{formatCurrency(vlrAFatContrato)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className={tdMacro} style={{ width: W.acoes }}>
                  <div className="flex gap-1">
                    {canEditar && contrato.status !== 'CANCELADO' && (
                      <button
                        onClick={() => onEditarContrato(contrato)}
                        className="border border-green-primary text-green-primary rounded px-1.5 py-0.5 text-[10px] hover:bg-green-light transition-colors"
                        title="Editar contrato"
                      >✎</button>
                    )}
                    {canEditar && contrato.status !== 'CANCELADO' && (
                      <button
                        onClick={() => onCancelarContrato(contrato)}
                        className="border border-red-400 text-red-400 rounded px-1.5 py-0.5 text-[10px] hover:bg-red-50 transition-colors"
                        title="Cancelar contrato"
                      >🗑</button>
                    )}
                  </div>
                </td>
              </tr>,

              // Linhas de sub-índices (quando expandido)
              ...(expanded ? contrato.subindices.map((sub) => {
                const indiceLabel = `${contrato.indice}.${sub.ordem}`
                const vlrAFatSub = sub.valor_total - sub.total_faturado
                const temPrevSub = sub.data_fim && new Date(sub.data_fim).getFullYear() > contrato.ano_referencia

                const tdSub = (extra?: string) =>
                  cn('px-2 py-[4px] whitespace-nowrap', extra)
                const tdSubFrozen = (left: number, shadow?: boolean) =>
                  cn('px-2 py-[4px] whitespace-nowrap sticky z-[2] bg-white', shadow && 'shadow-[2px_0_6px_rgba(0,0,0,0.06)]')

                return (
                  <tr key={`sub-${sub.id}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className={tdSubFrozen(FROZEN_LEFT.indice)} style={{ left: FROZEN_LEFT.indice, width: W.indice }}>
                      <span className="pl-4 text-[10px] text-gray-500">{indiceLabel}</span>
                    </td>
                    <td className={tdSubFrozen(FROZEN_LEFT.cliente)} style={{ left: FROZEN_LEFT.cliente, width: W.cliente }}>
                      <span className="text-gray-600">{contrato.cliente.nome}</span>
                    </td>
                    <td className={tdSubFrozen(FROZEN_LEFT.os, true)} style={{ left: FROZEN_LEFT.os, width: W.os }}>
                      <span className="text-gray-600">{contrato.num_os ?? '—'}</span>
                    </td>
                    <td className={tdSub()} style={{ width: W.anoRef }}>
                      <span className="bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 text-[10px]">{contrato.ano_referencia}</span>
                    </td>
                    <td className={tdSub('text-gray-400')} style={{ width: W.acordo }}>—</td>
                    <td className={tdSub('text-gray-400')} style={{ width: W.proposta }}>—</td>
                    <td className={tdSub('text-gray-400')} style={{ width: W.dtInicio }}>—</td>
                    <td className={tdSub('text-gray-400')} style={{ width: W.dtFim }}>—</td>
                    <td className={tdSub('max-w-[200px] truncate')} style={{ width: W.descricao }} title={sub.descricao}>
                      {sub.descricao}
                    </td>
                    <td className={tdSub()} style={{ width: W.statusFat }}>
                      <StatusBadge status={sub.status_faturamento} />
                    </td>
                    <td className={tdSub()} style={{ width: W.vlrTotal }}>
                      {formatCurrency(sub.valor_total)}
                    </td>
                    <td className={tdSub()} style={{ width: W.vlrFat }}>
                      {sub.total_faturado > 0
                        ? <span className="text-auto-value font-semibold">{formatCurrency(sub.total_faturado)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={tdSub('text-gray-400')} style={{ width: W.responsavel }}>—</td>
                    <td className={tdSub('max-w-[140px] truncate text-gray-500')} style={{ width: W.comentarios }} title={sub.comentarios ?? ''}>
                      {sub.comentarios ?? '—'}
                    </td>
                    {MESES.map((m) => (
                      <td key={m} className={tdSub()} style={{ width: W.mes }}>
                        {sub[m] != null && sub[m]! > 0
                          ? <span className="text-auto-value font-semibold">{formatCurrency(sub[m]!)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-2 py-[4px] whitespace-nowrap bg-[#F3E5F5]" style={{ width: W.prevAnos }}>
                      {temPrevSub
                        ? <span className="text-[#6A1B9A] font-semibold text-[10px]">Ano seg.</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={tdSub()} style={{ width: W.vlrAFat }}>
                      {vlrAFatSub > 0
                        ? <span className="text-orange-600 font-semibold">{formatCurrency(vlrAFatSub)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={tdSub()} style={{ width: W.acoes }}>
                      <div className="flex gap-1">
                        {canLancarNF && contrato.status !== 'CANCELADO' && (
                          <button
                            onClick={() => onLancarNF(contrato, sub)}
                            className="bg-[#1565C0] text-white rounded px-1.5 py-0.5 text-[10px] hover:bg-[#0D47A1] transition-colors"
                            title="Lançar NF"
                          >NF</button>
                        )}
                        {canEditar && contrato.status !== 'CANCELADO' && (
                          <button
                            onClick={() => onEditarSubindice(contrato, sub)}
                            className="border border-green-primary text-green-primary rounded px-1.5 py-0.5 text-[10px] hover:bg-green-light transition-colors"
                            title="Editar sub-índice"
                          >✎</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              }) : []),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
