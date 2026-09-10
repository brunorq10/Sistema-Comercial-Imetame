'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { mesKey, resumoPorClassificacaoOrigem, CLASSIFICACAO_LABEL, type CenarioLinha, type MesRef, type TotalMes, type ClassificacaoCenario } from '@/lib/cenario'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const W = { classificacao: 110, origem: 110 }
const L = { classificacao: 0, origem: W.classificacao }
const FROZEN_WIDTH = W.classificacao + W.origem
const MES_W = 74

const ORIGEM_LABEL: Record<string, string> = { CONTRATO: 'Contrato', PROPOSTA: 'Proposta' }
const ORIGEM_COR: Record<string, string> = { CONTRATO: '#1565C0', PROPOSTA: '#B45309' }
const ORIGEM_BG: Record<string, string> = { CONTRATO: '#E3F0FB', PROPOSTA: '#FEF3E2' }

const CLASSIFICACOES_ORDEM: ClassificacaoCenario[] = ['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS']

interface Props {
  linhas: CenarioLinha[]
  periodo: MesRef[]
  totais: TotalMes[]
}

export function CenarioResumoTable({ linhas, periodo, totais }: Props) {
  const anos = useMemo(() => {
    const grupos: { ano: number; qtdMeses: number }[] = []
    for (const m of periodo) {
      const last = grupos[grupos.length - 1]
      if (last && last.ano === m.ano) last.qtdMeses++
      else grupos.push({ ano: m.ano, qtdMeses: 1 })
    }
    return grupos
  }, [periodo])

  const resumo = useMemo(() => resumoPorClassificacaoOrigem(linhas, periodo), [linhas, periodo])
  const maxTotal = useMemo(() => Math.max(...totais.map((t) => t.total), 1), [totais])

  if (periodo.length === 0) {
    return (
      <div className="border border-gray-200 rounded-md p-10 text-center text-gray-400 text-[12px]">
        Nenhum lançamento no cenário ainda.
      </div>
    )
  }

  const th = 'sticky top-0 z-[20] bg-green-primary text-white px-2 py-[6px] text-left font-semibold text-[10px] whitespace-nowrap border-b border-green-dark'
  const td = 'px-2 py-[5px] text-[11px] whitespace-nowrap border-b border-gray-100'
  const tdF = 'sticky z-[5] shadow-[2px_0_4px_rgba(0,0,0,0.05)]'

  const totalPorOrigemMes = (origem: 'CONTRATO' | 'PROPOSTA', key: string) =>
    resumo.filter((r) => r.origem === origem).reduce((s, r) => s + (r.totais.get(key) ?? 0), 0)

  return (
    <div className="border border-gray-200 rounded-md" style={{ overflow: 'auto', maxHeight: 620 }}>
      <table className="border-separate text-[11px]" style={{ borderSpacing: 0, tableLayout: 'fixed', minWidth: FROZEN_WIDTH + periodo.length * MES_W }}>
        <colgroup>
          <col style={{ width: W.classificacao }} /><col style={{ width: W.origem }} />
          {periodo.map((m) => <col key={mesKey(m)} style={{ width: MES_W }} />)}
        </colgroup>

        <thead>
          <tr>
            <th className={cn(th, 'z-[30]')} style={{ top: 0, left: L.classificacao }} rowSpan={2}>Classificação</th>
            <th className={cn(th, 'z-[30] shadow-[2px_0_4px_rgba(0,0,0,0.08)]')} style={{ top: 0, left: L.origem }} rowSpan={2}>Origem</th>
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
          {CLASSIFICACOES_ORDEM.map((classificacao, ci) => {
            const linhasClassif = resumo.filter((r) => r.classificacao === classificacao)
            return linhasClassif.map((r, oi) => (
              <tr key={`${classificacao}-${r.origem}`} className={cn('hover:bg-green-light transition-colors', oi === 0 && ci > 0 && 'border-t-2 border-t-gray-300')}>
                {oi === 0 && (
                  <td className={cn(td, tdF, 'font-semibold text-gray-700 bg-white text-center align-middle')} style={{ left: L.classificacao }} rowSpan={linhasClassif.length}>
                    {CLASSIFICACAO_LABEL[classificacao]}
                  </td>
                )}
                <td className={cn(td, tdF, 'bg-white')} style={{ left: L.origem }}>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: ORIGEM_BG[r.origem], color: ORIGEM_COR[r.origem] }}>
                    {ORIGEM_LABEL[r.origem]}
                  </span>
                </td>
                {periodo.map((m) => {
                  const v = r.totais.get(mesKey(m)) ?? 0
                  return (
                    <td key={mesKey(m)} className={cn('px-1 py-[5px] text-center text-[10px] border-b border-gray-100', v > 0 ? 'font-semibold text-gray-700' : 'text-gray-300')}>
                      {v > 0 ? v.toLocaleString('pt-BR') : '—'}
                    </td>
                  )
                })}
              </tr>
            ))
          })}
        </tbody>

        <tfoot>
          <tr>
            <td className={cn(td, tdF, 'bg-gray-100 font-bold text-gray-700 border-t-2 border-t-gray-300')} style={{ left: L.classificacao }} colSpan={2}>Total contratos</td>
            {periodo.map((m) => {
              const v = totalPorOrigemMes('CONTRATO', mesKey(m))
              return <td key={mesKey(m)} className="px-1 py-[5px] text-center text-[10px] font-bold bg-gray-100 text-[#1565C0] border-t-2 border-t-gray-300">{v > 0 ? v.toLocaleString('pt-BR') : '—'}</td>
            })}
          </tr>
          <tr>
            <td className={cn(td, tdF, 'bg-gray-100 font-bold text-gray-700')} style={{ left: L.classificacao }} colSpan={2}>Total propostas</td>
            {periodo.map((m) => {
              const v = totalPorOrigemMes('PROPOSTA', mesKey(m))
              return <td key={mesKey(m)} className="px-1 py-[5px] text-center text-[10px] font-bold bg-gray-100 text-[#B45309]">{v > 0 ? v.toLocaleString('pt-BR') : '—'}</td>
            })}
          </tr>
          <tr>
            <td className={cn(td, tdF, 'bg-green-primary text-white font-bold border-t-2 border-t-gray-300')} style={{ left: L.classificacao }} colSpan={2}>Total geral</td>
            {totais.map((t) => (
              <td key={mesKey(t)} className="px-1 py-[5px] text-center text-[10px] font-bold bg-green-primary text-white border-t-2 border-t-gray-300">
                {t.total > 0 ? t.total.toLocaleString('pt-BR') : '—'}
              </td>
            ))}
          </tr>

          {/* ── Gráfico de barras (mesma grade, mesmo scroll) ── */}
          <tr>
            <td className={cn(td, tdF, 'bg-white align-bottom')} style={{ left: L.classificacao }} colSpan={2}>
              <div className="flex flex-col gap-1 py-1">
                <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#1565C0' }} />Contratos</span>
                <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#B45309' }} />Propostas</span>
              </div>
            </td>
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
            <td className={cn(td, tdF, 'bg-white')} style={{ left: L.classificacao }} colSpan={2} />
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
