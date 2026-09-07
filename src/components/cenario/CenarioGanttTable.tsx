'use client'

import { useMemo } from 'react'
import { cn, formatDate } from '@/lib/utils'
import { mesKey, totaisPorMes, type CenarioLinha, type MesRef, type TotalMes } from '@/lib/cenario'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Larguras das colunas de identificação ──────────────────────────────────
// Apenas Cliente/Cidade/Escopo ficam congeladas (sticky); as demais colunas de
// identificação rolam junto com a linha do tempo.
const W = {
  cliente: 150, cidade: 110, escopo: 220, classificacao: 90,
  origem: 90, inicio: 85, fim: 85, efetivo: 70,
}
const L = {
  cliente: 0,
  cidade: W.cliente,
  escopo: W.cliente + W.cidade,
}
const ID_TOTAL_WIDTH = W.cliente + W.cidade + W.escopo + W.classificacao + W.origem + W.inicio + W.fim + W.efetivo
const MES_W = 74

// ── Limite de altura: cabeçalho + 10 linhas de lançamento + rodapé de totais/gráfico.
// Acima de 10 lançamentos, o wrapper passa a rolar verticalmente (barra de rolagem).
const HEADER_H = 44
const ROW_H = 26
const VISIBLE_ROWS = 10
const RODAPE_TOTAL_H = 26
const RODAPE_CHART_H = 138
const RODAPE_MESES_H = 22
const MAX_HEIGHT = HEADER_H + VISIBLE_ROWS * ROW_H + RODAPE_TOTAL_H + RODAPE_CHART_H + RODAPE_MESES_H

const ORIGEM_LABEL: Record<string, string> = { CONTRATO: 'Contrato', PROPOSTA: 'Proposta' }
const CLASSIF_LABEL: Record<string, string> = { OBRAS: 'Obras', PARADAS: 'Paradas', FABRICACOES: 'Fabricação', OLEO_GAS: 'Óleo e Gás' }

interface Props {
  linhas: CenarioLinha[]
  periodo: MesRef[]
  totais: TotalMes[]
  editavel?: boolean
  onEditar?: (linha: CenarioLinha) => void
  onExcluir?: (linha: CenarioLinha) => void
}

export function CenarioGanttTable({ linhas, periodo, totais, editavel, onEditar, onExcluir }: Props) {
  const anos = useMemo(() => {
    const grupos: { ano: number; qtdMeses: number }[] = []
    for (const m of periodo) {
      const last = grupos[grupos.length - 1]
      if (last && last.ano === m.ano) last.qtdMeses++
      else grupos.push({ ano: m.ano, qtdMeses: 1 })
    }
    return grupos
  }, [periodo])

  const maxTotal = useMemo(() => Math.max(...totais.map((t) => t.total), 1), [totais])

  if (linhas.length === 0) {
    return (
      <div className="border border-gray-200 rounded-md p-10 text-center text-gray-400 text-[12px]">
        Nenhum lançamento no cenário ainda.
      </div>
    )
  }

  const th = 'sticky top-0 z-[20] bg-green-primary text-white px-2 py-[6px] text-left font-semibold text-[10px] whitespace-nowrap border-b border-green-dark'
  const td = 'px-2 py-[5px] text-[11px] whitespace-nowrap border-b border-gray-100'
  const tdF = 'sticky z-[5] shadow-[2px_0_4px_rgba(0,0,0,0.05)]'

  return (
    <div className="border border-gray-200 rounded-md" style={{ overflow: 'auto', maxHeight: MAX_HEIGHT }}>
      <table className="border-separate text-[11px]" style={{ borderSpacing: 0, tableLayout: 'fixed', minWidth: ID_TOTAL_WIDTH + periodo.length * MES_W }}>
        <colgroup>
          <col style={{ width: W.cliente }} /><col style={{ width: W.cidade }} /><col style={{ width: W.escopo }} />
          <col style={{ width: W.classificacao }} /><col style={{ width: W.origem }} /><col style={{ width: W.inicio }} />
          <col style={{ width: W.fim }} /><col style={{ width: W.efetivo }} />
          {periodo.map((m) => <col key={mesKey(m)} style={{ width: MES_W }} />)}
        </colgroup>

        <thead>
          {/* ── Faixa de ano ── */}
          <tr>
            <th className={cn(th, 'z-[30]')} style={{ top: 0, left: L.cliente }} rowSpan={2}>Cliente</th>
            <th className={cn(th, 'z-[30]')} style={{ top: 0, left: L.cidade }} rowSpan={2}>Cidade/UF</th>
            <th className={cn(th, 'z-[30] shadow-[2px_0_4px_rgba(0,0,0,0.08)]')} style={{ top: 0, left: L.escopo }} rowSpan={2}>Escopo</th>
            <th className={th} rowSpan={2}>Classif.</th>
            <th className={th} rowSpan={2}>Origem</th>
            <th className={th} rowSpan={2}>Início prev.</th>
            <th className={th} rowSpan={2}>Fim prev.</th>
            <th className={th} rowSpan={2}>Efetivo</th>
            {anos.map((g) => (
              <th key={g.ano} colSpan={g.qtdMeses} className="sticky top-0 z-[15] bg-green-dark text-white px-2 py-[3px] text-center font-bold text-[10px] border-b border-green-primary border-l-2 border-l-white/30">
                {g.ano}
              </th>
            ))}
          </tr>
          <tr>
            {periodo.map((m) => (
              <th key={mesKey(m)} className="sticky z-[15] bg-green-primary text-white px-1 py-[3px] text-center font-medium text-[9px] border-b border-green-dark" style={{ top: 22 }}>
                {MESES_ABREV[m.mes - 1]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {linhas.map((l, i) => {
            const origemCor = l.origem === 'CONTRATO' ? '#1565C0' : '#B45309'
            const origemBg = l.origem === 'CONTRATO' ? '#E3F0FB' : '#FEF3E2'
            const rowBg = i % 2 === 1 ? '#F9FAFB' : '#FFFFFF'
            const mesesAtivos = new Set(
              (() => { const out: string[] = []; let a = l.data_inicio.getUTCFullYear(), m = l.data_inicio.getUTCMonth() + 1
                const af = l.data_fim.getUTCFullYear(), mf = l.data_fim.getUTCMonth() + 1
                while (a < af || (a === af && m <= mf)) { out.push(`${a}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; a++ } }
                return out })(),
            )
            return (
              <tr key={l.id} className={cn('group border-b border-gray-100 hover:bg-green-light transition-colors', i % 2 === 1 ? 'bg-gray-50' : 'bg-white')}>
                <td className={cn(td, tdF, 'font-semibold text-gray-700')} style={{ left: L.cliente, background: rowBg }}>
                  <span className="truncate block" style={{ maxWidth: W.cliente - 16 }} title={l.cliente_nome}>{l.cliente_nome}</span>
                </td>
                <td className={cn(td, tdF, 'text-gray-500')} style={{ left: L.cidade, background: rowBg }}>
                  {[l.cidade, l.estado].filter(Boolean).join('/') || '—'}
                </td>
                <td className={cn(td, tdF, 'text-gray-600')} style={{ left: L.escopo, background: rowBg }}>
                  <span className="truncate block" style={{ maxWidth: W.escopo - 16 }} title={l.escopo ?? ''}>{l.escopo ?? '—'}</span>
                </td>
                <td className={cn(td, 'text-gray-600')}>
                  {CLASSIF_LABEL[l.classificacao]}
                </td>
                <td className={td}>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: origemBg, color: origemCor }}>
                    {ORIGEM_LABEL[l.origem]}
                  </span>
                </td>
                <td className={cn(td, 'text-gray-500')}>{formatDate(l.data_inicio.toISOString())}</td>
                <td className={cn(td, 'text-gray-500')}>{formatDate(l.data_fim.toISOString())}</td>
                <td className={cn(td, 'font-bold text-right pr-3')}>
                  <div className="flex items-center justify-end gap-1">
                    {l.efetivo.toLocaleString('pt-BR')}
                    {editavel && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ml-1">
                        <button onClick={() => onEditar?.(l)} className="text-gray-400 hover:text-green-primary text-[10px]" title="Editar">✎</button>
                        <button onClick={() => onExcluir?.(l)} className="text-gray-400 hover:text-red-600 text-[10px]" title="Excluir">✕</button>
                      </span>
                    )}
                  </div>
                </td>
                {periodo.map((m) => {
                  const ativo = mesesAtivos.has(mesKey(m))
                  return (
                    <td key={mesKey(m)} className="px-1 py-[5px] text-center text-[10px] border-b border-gray-100">
                      {ativo ? (
                        <span className="inline-block px-1.5 py-0.5 rounded font-semibold" style={{ background: origemBg, color: origemCor }}>
                          {l.efetivo}
                        </span>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>

        <tfoot>
          {/* ── TOTAL COMPROMETIDO ── */}
          <tr>
            <td className={cn(td, tdF, 'bg-gray-100 font-bold text-gray-700 border-t-2 border-t-gray-300')} style={{ left: L.cliente }} colSpan={3}>TOTAL COMPROMETIDO</td>
            <td className={cn(td, 'bg-gray-100 border-t-2 border-t-gray-300')} colSpan={5} />
            {totais.map((t) => (
              <td key={mesKey(t)} className="px-1 py-[5px] text-center text-[10px] font-bold bg-gray-100 text-gray-700 border-t-2 border-t-gray-300">
                {t.total.toLocaleString('pt-BR')}
              </td>
            ))}
          </tr>

          {/* ── Gráfico de barras (mesma grade, mesmo scroll) ── */}
          <tr>
            <td className={cn(td, tdF, 'bg-white align-bottom')} style={{ left: L.cliente }} colSpan={3}>
              <div className="flex items-center gap-3 py-1">
                <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#1565C0' }} />Contratos</span>
                <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#B45309' }} />Propostas</span>
              </div>
            </td>
            <td className="bg-white align-bottom" colSpan={5} />
            {totais.map((t) => {
              const hMax = 110
              const hContratos = Math.round((t.contratos / maxTotal) * hMax)
              const hPropostas = Math.round((t.propostas / maxTotal) * hMax)
              return (
                <td key={mesKey(t)} className="px-1 py-1 align-bottom relative" style={{ height: hMax + 28 }}>
                  <div className="relative mx-auto" style={{ width: MES_W - 16, height: hMax }}>
                    <div className="absolute left-0 right-0 flex flex-col justify-end" style={{ bottom: 0, height: hMax }}>
                      {t.propostas > 0 && <div style={{ height: hPropostas, background: '#E8A838' }} title={`Propostas: ${t.propostas}`} />}
                      {t.contratos > 0 && <div style={{ height: hContratos, background: '#2D7DD2' }} title={`Contratos: ${t.contratos}`} />}
                    </div>
                  </div>
                  {t.total > 0 && (
                    <p className="text-center text-[9px] font-bold mt-0.5 text-gray-600">
                      {t.total.toLocaleString('pt-BR')}
                    </p>
                  )}
                </td>
              )
            })}
          </tr>

          {/* ── Rótulos dos meses ── */}
          <tr>
            <td className={cn(td, tdF, 'bg-white')} style={{ left: L.cliente }} colSpan={3} />
            <td className="bg-white" colSpan={5} />
            {periodo.map((m) => (
              <td key={mesKey(m)} className="px-1 py-[4px] text-center text-[9px] text-gray-500 font-semibold border-t border-gray-100">
                {MESES_ABREV[m.mes - 1]}/{String(m.ano).slice(2)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
