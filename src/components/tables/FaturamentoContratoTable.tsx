'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ContratoItem, SubIndiceItem, NFContratoItem } from '@/types'
import { CLASSIFICACAO_LABELS, RAMO_ATUACAO_LABELS } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getSubAno(dataInicio: string | null, fallback: number): number {
  if (!dataInicio) return fallback
  return parseInt(dataInicio.substring(0, 4), 10) || fallback
}

function nfFaturadoMes(notas: NFContratoItem[], mesIdx: number, ano: number): number {
  return notas
    .filter((nf) => nf.ativa)
    .filter((nf) => { const d = new Date(nf.data_emissao); return d.getFullYear() === ano && d.getMonth() === mesIdx })
    .reduce((acc, nf) => acc + nf.valor_atribuido, 0)
}

function nfFaturadoAnual(notas: NFContratoItem[], ano: number | undefined): number {
  return notas
    .filter((nf) => nf.ativa)
    .filter((nf) => !ano || new Date(nf.data_emissao).getFullYear() === ano)
    .reduce((acc, nf) => acc + nf.valor_atribuido, 0)
}

function fatColorClass(fat: number, prev: number): string {
  if (fat < prev) return 'text-red-400'
  return 'text-green-500'
}

// ── Larguras ──────────────────────────────────────────────────────────────────
const W = {
  indice: 120, cliente: 125, descricao: 240,
  classificacao: 110, ramo: 140, os: 110, anoRef: 70, acordo: 120, proposta: 110,
  dtInicio: 90, dtFim: 90, statusFat: 90,
  vlrTotal: 155, vlrFat: 150, saldo: 145,
  responsavel: 130, comentarios: 140,
  mes: 130, prevAnos: 130, acoes: 130,
}
const L = { indice: 0, cliente: W.indice, descricao: W.indice + W.cliente }
const FROZEN_TOTAL = L.descricao + W.descricao

const MIN_W = FROZEN_TOTAL + W.classificacao + W.ramo + W.os + W.anoRef + W.acordo + W.proposta +
              W.dtInicio + W.dtFim + W.statusFat + W.vlrTotal + W.vlrFat + W.saldo +
              W.responsavel + W.comentarios + 12 * W.mes + W.prevAnos + W.acoes

function StatusBadge({ status }: { status: 'A_FATURAR' | 'FATURADO' | 'PARCIAL' | 'CANCELADO' }) {
  const map = {
    A_FATURAR: { label: 'A faturar', cls: 'text-orange-600 font-semibold' },
    FATURADO:  { label: 'Faturado',  cls: 'text-green-700 font-semibold' },
    PARCIAL:   { label: 'Parcial',   cls: 'text-blue-600 font-semibold' },
    CANCELADO: { label: 'Cancelado', cls: 'text-gray-400' },
  }
  const { label, cls } = map[status] ?? map['A_FATURAR']
  return <span className={cn('text-[11px]', cls)}>{label}</span>
}

function SaldoCell({ saldo, className }: { saldo: number; className?: string }) {
  if (saldo > 0.01) return <span className={cn('text-orange-600 font-bold', className)}>{formatCurrency(saldo)}</span>
  if (saldo < -0.01) return <span className={cn('text-blue-600 font-bold', className)}>{formatCurrency(Math.abs(saldo))} acima</span>
  return <span className={cn('text-green-600 font-bold', className)}>{formatCurrency(0)}</span>
}

interface Props {
  contratos: ContratoItem[]
  anoFiltro?: number
  onLancarNF: (contrato: ContratoItem, subindice: SubIndiceItem) => void
  onEditarSubindice: (contrato: ContratoItem, subindice: SubIndiceItem) => void
  onEditarContrato: (contrato: ContratoItem) => void
  onCancelarContrato: (contrato: ContratoItem) => void
  onExcluirSubindice: (sub: SubIndiceItem) => void
  onHistoricoSubindice: (sub: SubIndiceItem) => void
  onHistoricoContrato: (contrato: ContratoItem) => void
  onComentario: (sub: SubIndiceItem) => void
  canEditar: boolean
  canLancarNF: boolean
}

export function FaturamentoContratoTable({
  contratos, anoFiltro, onLancarNF, onEditarSubindice, onEditarContrato, onCancelarContrato,
  onExcluirSubindice, onHistoricoSubindice, onHistoricoContrato, onComentario,
  canEditar, canLancarNF,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<number>>(() => new Set(contratos.map((c) => c.id)))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hoveredKey,  setHoveredKey]  = useState<string | null>(null)

  const toggleExpand = (id: number) =>
    setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleRowClick = (key: string) =>
    setSelectedKey((prev) => (prev === key ? null : key))

  if (contratos.length === 0)
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum contrato encontrado.</p>

  const rowBgContract = (key: string) =>
    selectedKey === key ? '#E0E0E0' : hoveredKey === key ? '#C8E6C9' : '#EAF4EA'
  const rowBgSub = (key: string) =>
    selectedKey === key ? '#EEEEEE' : hoveredKey === key ? '#F0F4F0' : '#ffffff'

  const TH  = 'sticky top-[42px] bg-green-primary text-white px-2 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap select-none border-b border-green-dark'
  const thF = (shadow?: boolean) => cn(TH, 'z-[20]', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
  const thS = cn(TH, 'z-[10]')
  const thP = cn(TH, 'bg-[#6A1B9A] z-[10]')

  // ── Totalizadores da linha de cabeçalho ──────────────────────────────────────
  const totVlrTotal = anoFiltro
    ? contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => getSubAno(s.data_inicio, c.ano_referencia) === anoFiltro ? b + s.valor_total : b, 0), 0)
    : contratos.reduce((a, c) => a + (c.valor_contrato ?? 0), 0)

  const totVlrFat = contratos.reduce((a, c) =>
    a + c.subindices.reduce((b, s) => b + nfFaturadoAnual(s.notas_fiscais, anoFiltro), 0), 0)

  const totMeses = MESES.map((m, mi) => ({
    prev: contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => b + (s[m] ?? 0), 0), 0),
    fat:  contratos.reduce((a, c) => a + c.subindices.reduce((b, s) => b + nfFaturadoMes(s.notas_fiscais, mi, getSubAno(s.data_inicio, c.ano_referencia)), 0), 0),
  }))

  return (
    <div className="border border-gray-200 rounded-md h-full" style={{ overflow: 'auto' }}>
      <table className="border-collapse text-[11px]" style={{ minWidth: `${MIN_W}px`, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: W.indice }} /><col style={{ width: W.cliente }} /><col style={{ width: W.descricao }} />
          <col style={{ width: W.classificacao }} /><col style={{ width: W.ramo }} /><col style={{ width: W.os }} />
          <col style={{ width: W.anoRef }} /><col style={{ width: W.acordo }} /><col style={{ width: W.proposta }} />
          <col style={{ width: W.dtInicio }} /><col style={{ width: W.dtFim }} /><col style={{ width: W.statusFat }} />
          <col style={{ width: W.vlrTotal }} /><col style={{ width: W.vlrFat }} /><col style={{ width: W.saldo }} />
          <col style={{ width: W.responsavel }} /><col style={{ width: W.comentarios }} />
          {MESES.map((m) => <col key={m} style={{ width: W.mes }} />)}
          <col style={{ width: W.prevAnos }} /><col style={{ width: W.acoes }} />
        </colgroup>

        <thead>
          {/* ── Linha totalizadora ── */}
          {(() => {
            const TC  = 'sticky top-0 z-[30] px-2 py-[4px] bg-[#C8E6C9] text-[11px] whitespace-nowrap border-b-2 border-green-primary'
            const tcF = (shadow?: boolean) => cn(TC, 'z-[40] font-bold', shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.18)]')
            return (
              <tr>
                <td className={tcF()} style={{ left: L.indice }}>TOTAIS</td>
                <td className={tcF()} style={{ left: L.cliente }}></td>
                <td className={tcF(true)} style={{ left: L.descricao }}></td>
                {/* 9 cells: classificacao, ramo, os, anoRef, acordo, proposta, dtInicio, dtFim, statusFat */}
                {Array.from({ length: 9 }, (_, i) => <td key={i} className={TC}></td>)}
                {/* vlrTotal */}
                <td className={TC}>
                  <span className="font-bold text-[#1565C0]">{formatCurrency(totVlrTotal)}</span>
                </td>
                {/* vlrFat */}
                <td className={TC}>
                  <span className="font-bold text-green-700">{formatCurrency(totVlrFat)}</span>
                </td>
                {/* saldo */}
                <td className={TC}>
                  <SaldoCell saldo={totVlrTotal - totVlrFat} />
                </td>
                {/* responsavel, comentarios */}
                <td className={TC}></td><td className={TC}></td>
                {/* meses */}
                {totMeses.map(({ prev, fat }, mi) => (
                  <td key={mi} className={TC}>
                    {prev === 0 && fat === 0 ? <span className="text-gray-400">—</span> : (
                      <div className="flex flex-col gap-0.5">
                        {prev > 0 && <span className="text-[10px] text-[#1565C0] font-semibold">P {formatCurrency(prev)}</span>}
                        {fat  > 0 && <span className={cn('text-[10px] font-semibold', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                      </div>
                    )}
                  </td>
                ))}
                {/* prevAnos */}
                <td className={TC}>
                  {(() => {
                    const t = contratos.reduce((a, c) => a + c.prev_anos_seguintes, 0)
                    return t > 0 ? <span className="text-[#6A1B9A] font-semibold">{formatCurrency(t)}</span> : <span className="text-gray-400">—</span>
                  })()}
                </td>
                <td className={TC}></td>
              </tr>
            )
          })()}

          {/* ── Cabeçalhos das colunas ── */}
          <tr>
            <th className={thF()} style={{ left: L.indice }}>Índice</th>
            <th className={thF()} style={{ left: L.cliente }}>Cliente</th>
            <th className={thF(true)} style={{ left: L.descricao }}>Descrição / Evento</th>
            <th className={thS}>Classificação</th><th className={thS}>Ramo</th>
            <th className={thS}>Nº OS</th><th className={thS}>Ano</th>
            <th className={thS}>Nº Acordo</th><th className={thS}>Nº Proposta</th>
            <th className={thS}>Dt. Início</th><th className={thS}>Dt. Fim</th>
            <th className={thS}>Status Fat.</th>
            <th className={thS}>Valor Total Contrato</th>
            <th className={thS}>Valor Total Faturado</th>
            <th className={thS}>Saldo a Faturar</th>
            <th className={thS}>Responsável</th><th className={thS}>Comentários</th>
            {MESES_LABELS.map((m) => <th key={m} className={thS}>{m}</th>)}
            <th className={thP}>Previsão prox. anos</th>
            <th className={thS}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {contratos.map((contrato) => {
            const expanded = expandidos.has(contrato.id)
            const anoRef   = anoFiltro ?? contrato.ano_referencia
            const ctKey    = `ct-${contrato.id}`
            const ctBg     = rowBgContract(ctKey)

            // Valor Total Contrato (filtrado por ano ou total do contrato)
            const ctVlrTotal = anoFiltro
              ? contrato.subindices.reduce((a, s) =>
                  getSubAno(s.data_inicio, contrato.ano_referencia) === anoFiltro ? a + s.valor_total : a, 0)
              : (contrato.valor_contrato ?? 0)

            const ctVlrFat = contrato.subindices.reduce((a, s) =>
              a + nfFaturadoAnual(s.notas_fiscais, anoFiltro), 0)
            const ctSaldo = ctVlrTotal - ctVlrFat

            const mF = (shadow?: boolean) =>
              cn('px-2 py-[5px] font-semibold text-[11px] whitespace-nowrap sticky z-[5] cursor-pointer',
                shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.10)]')
            const mBase = 'px-2 py-[5px] font-semibold text-[11px] whitespace-nowrap cursor-pointer'

            const trProps = {
              onClick: () => handleRowClick(ctKey),
              onMouseEnter: () => setHoveredKey(ctKey),
              onMouseLeave: () => setHoveredKey(null),
            }

            return [
              /* ── Linha macro (contrato) ── */
              <tr key={ctKey} className="border-b border-gray-200" {...trProps}>
                <td className={mF()} style={{ left: L.indice, background: ctBg }}>
                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(contrato.id) }}
                    className="flex items-center gap-1 font-bold text-green-dark hover:text-green-primary">
                    <span className="text-[9px]">{expanded ? '▼' : '▶'}</span>
                    {contrato.indice}
                  </button>
                </td>
                <td className={mF()} style={{ left: L.cliente, background: ctBg }}>
                  <span className="font-semibold text-blue-700 truncate block" style={{ maxWidth: W.cliente - 16 }}>{contrato.cliente.nome}</span>
                </td>
                <td className={mF(true)} style={{ left: L.descricao, background: ctBg }}>
                  <span className="line-clamp-2 whitespace-normal" title={contrato.descricao ?? ''}>{contrato.descricao ?? '—'}</span>
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {contrato.classificacao
                    ? <span className="bg-blue-50 text-blue-700 rounded px-1.5 text-[10px] font-semibold">{CLASSIFICACAO_LABELS[contrato.classificacao as keyof typeof CLASSIFICACAO_LABELS]}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  {contrato.cliente.ramo_atuacao
                    ? <span className="text-gray-600 text-[10px]">{RAMO_ATUACAO_LABELS[contrato.cliente.ramo_atuacao as keyof typeof RAMO_ATUACAO_LABELS] ?? contrato.cliente.ramo_atuacao}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>—</td>
                <td className={mBase} style={{ background: ctBg }}>
                  <span className="bg-gray-200 text-gray-700 rounded px-1 text-[10px]">{anoRef}</span>
                </td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.num_acordo ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.num_proposta ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>{formatDate(contrato.data_inicio)}</td>
                <td className={mBase} style={{ background: ctBg }}>{formatDate(contrato.data_fim)}</td>
                <td className={mBase} style={{ background: ctBg }}><StatusBadge status={contrato.status as 'A_FATURAR' | 'FATURADO' | 'PARCIAL' | 'CANCELADO'} /></td>
                {/* Valor Total Contrato */}
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrTotal > 0
                    ? <span className="font-bold text-[#1565C0]">{formatCurrency(ctVlrTotal)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                {/* Valor Total Faturado */}
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrFat > 0
                    ? <span className="font-bold text-green-700">{formatCurrency(ctVlrFat)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                {/* Saldo a Faturar */}
                <td className={mBase} style={{ background: ctBg }}>
                  {ctVlrTotal > 0 ? <SaldoCell saldo={ctSaldo} /> : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>{contrato.responsavel?.nome ?? '—'}</td>
                <td className={mBase} style={{ background: ctBg }}>—</td>
                {MESES.map((m, mi) => {
                  const prev = contrato.subindices.reduce((a, s) => a + (s[m] ?? 0), 0)
                  const fat  = contrato.subindices.reduce((a, s) => a + nfFaturadoMes(s.notas_fiscais, mi, getSubAno(s.data_inicio, contrato.ano_referencia)), 0)
                  return (
                    <td key={m} className={mBase} style={{ background: ctBg }}>
                      {prev === 0 && fat === 0 ? <span className="text-gray-300">—</span> : (
                        <div className="flex flex-col gap-0.5">
                          {prev > 0 && <span className="text-[10px] text-[#1565C0]">P {formatCurrency(prev)}</span>}
                          {fat  > 0 && <span className={cn('text-[10px]', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-[5px] font-semibold text-[11px] whitespace-nowrap cursor-pointer" style={{ background: '#F3E5F5' }}>
                  {contrato.prev_anos_seguintes > 0
                    ? <span className="text-[#6A1B9A] font-bold">{formatCurrency(contrato.prev_anos_seguintes)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={mBase} style={{ background: ctBg }}>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/acordos/faturamento/${contrato.id}`}
                      className="border border-blue-400 text-blue-500 rounded px-1.5 py-0.5 text-[10px] hover:bg-blue-50"
                      title="Visão geral">👁</Link>
                    {canEditar && contrato.status !== 'CANCELADO' && (
                      <button onClick={() => onEditarContrato(contrato)}
                        className="border border-green-primary text-green-primary rounded px-1.5 py-0.5 text-[10px] hover:bg-green-light"
                        title="Editar">✎</button>
                    )}
                    <button onClick={() => onHistoricoContrato(contrato)}
                      className="border border-gray-300 text-gray-500 rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                      title="Histórico">📋</button>
                    {canEditar && contrato.status !== 'CANCELADO' && (
                      <button onClick={() => onCancelarContrato(contrato)}
                        className="border border-red-400 text-red-400 rounded px-1.5 py-0.5 text-[10px] hover:bg-red-50"
                        title="Cancelar">🗑</button>
                    )}
                  </div>
                </td>
              </tr>,

              /* ── Linhas de sub-índices ── */
              ...(expanded ? contrato.subindices.map((sub) => {
                const indiceLabel = `${contrato.indice}.${sub.ordem}`
                const subKey      = `sub-${sub.id}`
                const subBg       = rowBgSub(subKey)
                const subAno      = getSubAno(sub.data_inicio, contrato.ano_referencia)
                const sF = (shadow?: boolean) => cn('px-2 py-[4px] text-[11px] whitespace-nowrap sticky z-[5] cursor-pointer',
                  shadow && 'shadow-[3px_0_6px_rgba(0,0,0,0.07)]')
                const sBase = 'px-2 py-[4px] text-[11px] whitespace-nowrap cursor-pointer'

                const subVlrFat = nfFaturadoAnual(sub.notas_fiscais, anoFiltro)
                const subSaldo  = sub.valor_total - subVlrFat

                return (
                  <tr key={subKey} className="border-b border-gray-100"
                    onClick={() => handleRowClick(subKey)}
                    onMouseEnter={() => setHoveredKey(subKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    <td className={sF()} style={{ left: L.indice, background: subBg }}>
                      <span className="pl-4 text-[10px] text-gray-500">{indiceLabel}</span>
                    </td>
                    <td className={sF()} style={{ left: L.cliente, background: subBg }}>
                      <span className="text-gray-500 truncate block" style={{ maxWidth: W.cliente - 16 }}>{contrato.cliente.nome}</span>
                    </td>
                    <td className={sF(true)} style={{ left: L.descricao, background: subBg }}>
                      <span className="line-clamp-2 whitespace-normal" title={sub.descricao}>{sub.descricao}</span>
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      {contrato.classificacao
                        ? <span className="text-blue-400 text-[10px]">{CLASSIFICACAO_LABELS[contrato.classificacao as keyof typeof CLASSIFICACAO_LABELS]}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      {contrato.cliente.ramo_atuacao
                        ? <span className="text-gray-400 text-[10px]">{RAMO_ATUACAO_LABELS[contrato.cliente.ramo_atuacao as keyof typeof RAMO_ATUACAO_LABELS] ?? contrato.cliente.ramo_atuacao}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-gray-600">{sub.num_os ?? '—'}</span></td>
                    <td className={sBase} style={{ background: subBg }}>
                      <span className={`rounded px-1 text-[10px] ${subAno !== anoRef ? 'bg-[#F3E5F5] text-[#6A1B9A] font-semibold' : 'bg-gray-100 text-gray-400'}`}>
                        {subAno}
                      </span>
                    </td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-gray-400">{formatDate(sub.data_inicio)}</span></td>
                    <td className={sBase} style={{ background: subBg }}><span className="text-gray-400">{formatDate(sub.data_fim)}</span></td>
                    <td className={sBase} style={{ background: subBg }}><StatusBadge status={sub.status_faturamento} /></td>
                    {/* Valor Total Subitem */}
                    <td className={sBase} style={{ background: subBg }}>
                      <span className="text-[#1565C0]">{formatCurrency(sub.valor_total)}</span>
                    </td>
                    {/* Valor Total Faturado subitem */}
                    <td className={sBase} style={{ background: subBg }}>
                      {subVlrFat > 0
                        ? <span className="text-green-700">{formatCurrency(subVlrFat)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Saldo a Faturar subitem */}
                    <td className={sBase} style={{ background: subBg }}>
                      <SaldoCell saldo={subSaldo} className="!font-normal" />
                    </td>
                    <td className={cn(sBase, 'text-gray-400')} style={{ background: subBg }}>—</td>
                    <td className={sBase} style={{ background: subBg }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onComentario(sub)} className="text-left w-full group" title={sub.comentarios ?? 'Adicionar comentário'}>
                        <span className={`truncate block text-[11px] group-hover:text-green-primary transition-colors ${sub.comentarios ? 'text-gray-600' : 'text-gray-300'}`}
                          style={{ maxWidth: W.comentarios - 16 }}>
                          {sub.comentarios ?? '+ comentário'}
                        </span>
                      </button>
                    </td>
                    {MESES.map((m, mi) => {
                      const prev = sub[m] ?? 0
                      const fat  = nfFaturadoMes(sub.notas_fiscais, mi, subAno)
                      return (
                        <td key={m} className={sBase} style={{ background: subBg }}>
                          {prev === 0 && fat === 0 ? <span className="text-gray-300">—</span> : (
                            <div className="flex flex-col gap-0.5">
                              {prev > 0 && <span className="text-[10px] text-[#1565C0]">P {formatCurrency(prev)}</span>}
                              {fat  > 0 && <span className={cn('text-[10px]', fatColorClass(fat, prev))}>F {formatCurrency(fat)}</span>}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ background: '#F3E5F5' }} className="px-2 py-[4px] text-[11px] whitespace-nowrap cursor-pointer">
                      {sub.prev_anos_seguintes > 0
                        ? <span className="text-[#6A1B9A]">{formatCurrency(sub.prev_anos_seguintes)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={sBase} style={{ background: subBg }}>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {canLancarNF && contrato.status !== 'CANCELADO' && (
                          <button onClick={() => onLancarNF(contrato, sub)}
                            className="bg-[#1565C0] text-white rounded px-1.5 py-0.5 text-[10px] hover:bg-[#0D47A1]"
                            title="Lançar NF">NF</button>
                        )}
                        {canEditar && contrato.status !== 'CANCELADO' && (
                          <button onClick={() => onEditarSubindice(contrato, sub)}
                            className="border border-green-primary text-green-primary rounded px-1.5 py-0.5 text-[10px] hover:bg-green-light"
                            title="Editar">✎</button>
                        )}
                        <button onClick={() => onHistoricoSubindice(sub)}
                          className="border border-gray-300 text-gray-500 rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                          title="Histórico">📋</button>
                        {canEditar && contrato.status !== 'CANCELADO' && (
                          <button onClick={() => onExcluirSubindice(sub)}
                            className="border border-red-400 text-red-400 rounded px-1.5 py-0.5 text-[10px] hover:bg-red-50"
                            title="Excluir">🗑</button>
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
