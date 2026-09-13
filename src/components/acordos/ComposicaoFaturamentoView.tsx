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

  useEffect(() => {
    let ativo = true
    setLoading(true)
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

  if (loading) return <p className="text-center text-gray-400 py-8 text-[12px]">Carregando...</p>

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {TIPOS.map((t) => (
          <KpiCard key={t} label={t} value={formatCurrency(totaisPorTipo[t])}
            sub={totalGeral > 0 ? `${((totaisPorTipo[t] / totalGeral) * 100).toFixed(1).replace('.', ',')}% do total` : undefined}
            accent={CORES[t]} />
        ))}
      </div>

      {linhas.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-[12px]">Nenhum faturamento encontrado com os filtros aplicados.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-gray-600 text-[11px] border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Contrato</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Cliente</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Cliente Final</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Cidade</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">OS</th>
                  <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">Responsável</th>
                  {TIPOS.map((t) => (
                    <th key={t} className="text-right px-4 py-2 font-semibold whitespace-nowrap">{t}</th>
                  ))}
                  <th className="text-right px-4 py-2 font-semibold whitespace-nowrap bg-slate-100">Valor Total Faturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhas.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-green-dark whitespace-nowrap">{l.indice}</td>
                    <td className="px-4 py-2.5">{l.cliente}</td>
                    <td className="px-4 py-2.5">{l.cliente_final ?? '—'}</td>
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
                <tr className="bg-green-primary text-white font-bold text-[12px]">
                  <td className="px-4 py-2.5" colSpan={6}>Total ({linhas.length} contrato{linhas.length !== 1 ? 's' : ''})</td>
                  {TIPOS.map((t) => (
                    <td key={t} className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totaisPorTipo[t])}</td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
