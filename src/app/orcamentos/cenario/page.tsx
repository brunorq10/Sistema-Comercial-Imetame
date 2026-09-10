'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { CenarioCards } from '@/components/cenario/CenarioCards'
import { CenarioGanttTable } from '@/components/cenario/CenarioGanttTable'
import { CenarioResumoTable } from '@/components/cenario/CenarioResumoTable'
import { NovoLancamentoCenarioModal } from '@/components/forms/NovoLancamentoCenarioModal'
import { GerenciarLancamentosCenarioModal } from '@/components/forms/GerenciarLancamentosCenarioModal'
import { RetratosCenarioModal } from '@/components/forms/RetratosCenarioModal'
import type { CenarioLinha, IndicadoresCenario, MesRef, TotalMes } from '@/lib/cenario'

interface CenarioData {
  capacidade: number
  lancamentos: Array<{
    id: number; proposta_comercial_id: number; cliente_nome: string; cliente_final_nome: string | null
    cidade: string | null; estado: string | null; escopo: string | null
    classificacao: 'OBRAS' | 'PARADAS' | 'FABRICACOES' | 'OLEO_GAS'; origem: 'CONTRATO' | 'PROPOSTA'
    data_inicio: string; data_fim: string; efetivo: number; efetivo_mensal: Record<string, number> | null; observacao: string | null
  }>
  periodo: MesRef[]
  totais: TotalMes[]
  indicadores: IndicadoresCenario
}

function toLinhas(lancs: CenarioData['lancamentos']): CenarioLinha[] {
  return lancs.map((l) => ({ ...l, data_inicio: new Date(l.data_inicio), data_fim: new Date(l.data_fim) }))
}

export default function CenarioPage() {
  const { canEditarCenario, isLoading } = usePermissions()
  const [data, setData] = useState<CenarioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'detalhamento' | 'resumo'>('detalhamento')

  const [modalNovo, setModalNovo] = useState(false)
  const [modalGerenciar, setModalGerenciar] = useState(false)
  const [gerenciarFocoId, setGerenciarFocoId] = useState<number | null>(null)
  const [modalRetratos, setModalRetratos] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/cenario').then((r) => r.json()).then((j) => setData(j.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="h-full overflow-y-auto p-4">
      <PageHeader
        title="Cenários"
        subtitle="Projeção de atividades futuras — carga de efetivo comprometida mês a mês (contratos + propostas em orçamentação)."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setModalRetratos(true)}>Retratos</Button>
            {canEditarCenario && aba === 'detalhamento' && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setGerenciarFocoId(null); setModalGerenciar(true) }}>Editar cenário</Button>
                <Button size="sm" onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex gap-1 border-b border-gray-200 mb-3">
        <button
          onClick={() => setAba('detalhamento')}
          className={cn(
            'px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors',
            aba === 'detalhamento' ? 'border-green-primary text-green-dark' : 'border-transparent text-gray-400 hover:text-gray-600',
          )}
        >
          Detalhamento
        </button>
        <button
          onClick={() => setAba('resumo')}
          className={cn(
            'px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors',
            aba === 'resumo' ? 'border-green-primary text-green-dark' : 'border-transparent text-gray-400 hover:text-gray-600',
          )}
        >
          Resumo
        </button>
      </div>

      {loading || isLoading ? (
        <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
      ) : !data ? (
        <p className="text-center text-gray-400 py-14 text-sm">Não foi possível carregar o cenário.</p>
      ) : data.lancamentos.length === 0 ? (
        <>
          <CenarioCards ind={data.indicadores} />
          <div className="bg-white border border-dashed border-gray-300 rounded-md p-10 text-center">
            <p className="text-[13px] font-semibold text-gray-600 mb-1">Nenhum lançamento no cenário ainda</p>
            <p className="text-[11px] text-gray-400 mb-4">
              {canEditarCenario ? 'Comece lançando uma proposta já enviada.' : 'Assim que houver lançamentos, eles aparecem aqui.'}
            </p>
            {canEditarCenario && <Button onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>}
          </div>
        </>
      ) : (
        <>
          <CenarioCards ind={data.indicadores} />
          {aba === 'detalhamento' ? (
            <CenarioGanttTable
              linhas={toLinhas(data.lancamentos)}
              periodo={data.periodo}
              totais={data.totais}
              editavel={canEditarCenario}
              onEditar={(l) => { setGerenciarFocoId(l.id); setModalGerenciar(true) }}
              onExcluir={(l) => { setGerenciarFocoId(l.id); setModalGerenciar(true) }}
            />
          ) : (
            <CenarioResumoTable linhas={toLinhas(data.lancamentos)} periodo={data.periodo} totais={data.totais} />
          )}
        </>
      )}

      <NovoLancamentoCenarioModal open={modalNovo} onClose={() => setModalNovo(false)} onSuccess={fetchData} />
      <GerenciarLancamentosCenarioModal open={modalGerenciar} onClose={() => setModalGerenciar(false)} onSuccess={fetchData} abrirEditandoId={gerenciarFocoId} />
      <RetratosCenarioModal open={modalRetratos} onClose={() => setModalRetratos(false)} editavel={canEditarCenario} />
    </div>
  )
}
