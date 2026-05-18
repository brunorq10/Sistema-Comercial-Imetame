'use client'

import { useCallback, useEffect, useState } from 'react'
import { PrevisaoRealizadoTable, type PrevisaoRealizadoItem } from '@/components/tables/PrevisaoRealizadoTable'
import { Field, Select } from '@/components/ui/Input'

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type ConsolidadoListItem = { id: number; mes: number; ano: number; created_at: string; qt_itens: number }

export default function ConsolidadoRealizadoPage() {
  const [consolidadosDisponiveis, setConsolidadosDisponiveis] = useState<ConsolidadoListItem[]>([])
  const [consolidadoSelecionado, setConsolidadoSelecionado] = useState('')
  const [consolidadoData, setConsolidadoData] = useState<PrevisaoRealizadoItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchConsolidados = useCallback(async () => {
    try {
      const res = await fetch('/api/faturamento/consolidados')
      const json = await res.json()
      const lista: ConsolidadoListItem[] = json.data ?? []
      setConsolidadosDisponiveis(lista)
      if (lista.length > 0 && !consolidadoSelecionado) {
        setConsolidadoSelecionado(`${lista[0].mes}-${lista[0].ano}`)
      }
    } catch {
      setConsolidadosDisponiveis([])
    }
  }, [consolidadoSelecionado])

  const fetchDetalhe = useCallback(async (mesAno: string) => {
    if (!mesAno) { setConsolidadoData(null); return }
    const [mes, ano] = mesAno.split('-')
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/faturamento/consolidados?mes=${mes}&ano=${ano}`)
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      setConsolidadoData(json.data?.itens ?? null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConsolidados() }, [fetchConsolidados])
  useEffect(() => { fetchDetalhe(consolidadoSelecionado) }, [consolidadoSelecionado, fetchDetalhe])

  const consolidadoAtual = consolidadosDisponiveis.find(
    (c) => `${c.mes}-${c.ano}` === consolidadoSelecionado
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold">Consolidado x Realizado</h2>
      </div>

      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Consolidado (mês/ano)" className="min-w-[240px]">
          <Select value={consolidadoSelecionado} onChange={(e) => setConsolidadoSelecionado(e.target.value)}>
            <option value="">Selecione um consolidado...</option>
            {consolidadosDisponiveis.map((c) => (
              <option key={c.id} value={`${c.mes}-${c.ano}`}>
                {MESES_NOMES[c.mes - 1]}/{c.ano} · {c.qt_itens} ite{c.qt_itens !== 1 ? 'ns' : 'm'}
              </option>
            ))}
          </Select>
        </Field>
        {consolidadoAtual && (
          <p className="text-[11px] text-gray-400 self-end pb-[5px]">
            Gerado em {new Date(consolidadoAtual.created_at).toLocaleDateString('pt-BR')}
          </p>
        )}
        {consolidadosDisponiveis.length === 0 && (
          <p className="text-[11px] text-gray-400 self-end pb-[5px]">
            Nenhum consolidado gerado ainda. Use o botão <strong>Consolidado mês</strong> em Controle de Faturamento.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
          Erro ao carregar: {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : consolidadoData ? (
        <PrevisaoRealizadoTable itens={consolidadoData} />
      ) : (
        <p className="text-center text-gray-400 py-12 text-sm">Selecione um mês consolidado para visualizar os dados.</p>
      )}
    </div>
  )
}
