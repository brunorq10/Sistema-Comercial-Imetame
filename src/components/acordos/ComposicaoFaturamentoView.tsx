'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { KpiCard } from '@/components/dashboard/KpiCard'

const TIPOS = ['Normal', 'Bônus', 'Serviço Extra', 'Outros'] as const
type Tipo = typeof TIPOS[number]

const CORES: Record<Tipo, string> = {
  Normal: '#16A34A',
  'Bônus': '#7C3AED',
  'Serviço Extra': '#D97706',
  Outros: '#475569',
}

interface Linha {
  id: number; indice: string; cliente: string; cliente_final: string | null
  cidade: string | null; estado: string | null; num_os: string | null; responsavel: string | null
  escopo: string | null
  valores: Record<Tipo, number>; total: number
}

interface Props {
  ano: string
  clienteId: string[]
  clienteFinalId: string[]
  ramo: string[]
  responsavelId: string[]
  cidade: string[]
  escopo: string
}

export function ComposicaoFaturamentoView({ ano, clienteId, clienteFinalId, ramo, responsavelId, cidade, escopo }: Props) {
  const [totaisPorTipo, setTotaisPorTipo] = useState<Record<Tipo, number>>({ Normal: 0, 'Bônus': 0, 'Serviço Extra': 0, Outros: 0 })
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<Tipo | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setFiltroTipo(null)
    const params = new URLSearchParams()
    if (ano) params.set('ano', ano)
    if (clienteId.length) params.set('clienteId', clienteId.join(','))
    if (clienteFinalId.length) params.set('clienteFinalId', clienteFinalId.join(','))
    if (ramo.length) params.set('ramo', ramo.join(','))
    if (responsavelId.length) params.set('responsavelId', responsavelId.join(','))
    if (cidade.length) params.set('cidade', cidade.join(','))
    if (escopo.trim()) params.set('escopo', escopo.trim())
    fetch(`/api/acordos/dashboard/composicao?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (!ativo || j.error) return
        setTotaisPorTipo(j.data.totaisPorTipo)
        setLinhas(j.data.linhas ?? [])
      })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [ano, clienteId, clienteFinalId, ramo, responsavelId, cidade, escopo])

  const totalGeral = TIPOS.reduce((s, t) => s + totaisPorTipo[t], 0)
  const linhasFiltradas = filtroTipo ? linhas.filter((l) => l.valores[filtroTipo] > 0) : linhas

  if (loading) return <p className="text-center text-gray-400 py-8 text-[12px]">Carregando...</p>

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {TIPOS.map((t) => (
          <KpiCard key={t} label={t} value={formatCurrency(totaisPorTipo[t])}
            sub={totalGeral > 0 ? `${((totaisPorTipo[t] / totalGeral) * 100).toFixed(1).replace('.', ',')}% do total` : undefined}
            accent={CORES[t]}
            selected={filtroTipo === t}
            onClick={() => setFiltroTipo((cur) => (cur === t ? null : t))} />
        ))}
      </div>

      {linhas.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-[12px]">Nenhum faturamento encontrado com os filtros aplicados.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filtroTipo && (
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-gray-200 text-[11px] text-gray-500">
              <span>Filtrado por: <strong className="text-gray-700">{filtroTipo}</strong> — {linhasFiltradas.length} acordo{linhasFiltradas.length !== 1 ? 's' : ''}</span>
              <button onClick={() => setFiltroTipo(null)} className="text-green-primary font-semibold hover:underline">Limpar filtro</button>
            </div>
          )}
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200 sticky top-0 z-10">
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">Acordo</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">Cliente</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">Cliente Final</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">Escopo</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">Cidade</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">OS</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">Responsável</th>
                  {TIPOS.map((t) => (
                    <th key={t} className="text-right px-4 py-2 font-semibold whitespace-nowrap bg-slate-50">{t}</th>
                  ))}
                  <th className="text-right px-4 py-2 font-semibold whitespace-nowrap bg-slate-100">Valor Total Faturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhasFiltradas.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-green-dark whitespace-nowrap">{l.indice}</td>
                    <td className="px-4 py-2.5">{l.cliente}</td>
                    <td className="px-4 py-2.5">{l.cliente_final ?? '—'}</td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate" title={l.escopo ?? ''}>{l.escopo ?? '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{[l.cidade, l.estado].filter(Boolean).join('/') || '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{l.num_os ?? '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{l.responsavel ?? '—'}</td>
                    {TIPOS.map((t) => (
                      <td key={t} className="px-4 py-2.5 text-right tabular-nums">
                        {l.valores[t] > 0 ? formatCurrency(l.valores[t]) : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums bg-slate-50">{formatCurrency(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-green-primary text-white font-bold text-[12px] sticky bottom-0">
                  <td className="px-4 py-2.5" colSpan={7}>Total ({linhasFiltradas.length} acordo{linhasFiltradas.length !== 1 ? 's' : ''})</td>
                  {TIPOS.map((t) => (
                    <td key={t} className="px-4 py-2.5 text-right tabular-nums">
                      {formatCurrency(filtroTipo ? linhasFiltradas.reduce((s, l) => s + l.valores[t], 0) : totaisPorTipo[t])}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCurrency(filtroTipo ? linhasFiltradas.reduce((s, l) => s + l.total, 0) : totalGeral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
