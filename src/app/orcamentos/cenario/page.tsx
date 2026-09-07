'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import { CenarioCards } from '@/components/cenario/CenarioCards'
import { CenarioGanttTable } from '@/components/cenario/CenarioGanttTable'
import { NovoLancamentoCenarioModal } from '@/components/forms/NovoLancamentoCenarioModal'
import { GerenciarLancamentosCenarioModal } from '@/components/forms/GerenciarLancamentosCenarioModal'
import { RetratosCenarioModal } from '@/components/forms/RetratosCenarioModal'
import type { CenarioLinha, IndicadoresCenario, MesRef, TotalMes } from '@/lib/cenario'

interface CenarioData {
  capacidade: number
  lancamentos: Array<{
    id: number; proposta_comercial_id: number; cliente_nome: string; cliente_final_nome: string | null
    cidade: string | null; estado: string | null; escopo: string | null
    classificacao: 'OBRAS' | 'PARADAS'; origem: 'CONTRATO' | 'PROPOSTA'
    data_inicio: string; data_fim: string; efetivo: number; observacao: string | null
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

  const [capacidadeEdit, setCapacidadeEdit] = useState('')
  const [editandoCapacidade, setEditandoCapacidade] = useState(false)
  const [salvandoCapacidade, setSalvandoCapacidade] = useState(false)

  const [modalNovo, setModalNovo] = useState(false)
  const [modalGerenciar, setModalGerenciar] = useState(false)
  const [gerenciarFocoId, setGerenciarFocoId] = useState<number | null>(null)
  const [modalRetratos, setModalRetratos] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/cenario').then((r) => r.json()).then((j) => setData(j.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const salvarCapacidade = async () => {
    const v = Number(capacidadeEdit)
    if (!capacidadeEdit || isNaN(v) || v < 0) return
    setSalvandoCapacidade(true)
    try {
      await fetch('/api/cenario/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capacidade_efetivo: v }),
      })
      setEditandoCapacidade(false)
      fetchData()
    } finally {
      setSalvandoCapacidade(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <PageHeader
        title="Cenário"
        subtitle="Projeção de atividades futuras — carga de efetivo comprometida mês a mês (contratos + propostas em orçamentação), comparada com a capacidade disponível."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {editandoCapacidade ? (
              <div className="flex items-center gap-1.5">
                <Field label="" className="mb-0">
                  <Input type="number" min={0} className="w-24" value={capacidadeEdit} onChange={(e) => setCapacidadeEdit(e.target.value)} autoFocus />
                </Field>
                <Button size="sm" onClick={salvarCapacidade} disabled={salvandoCapacidade}>{salvandoCapacidade ? '...' : 'Salvar'}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditandoCapacidade(false)} disabled={salvandoCapacidade}>Cancelar</Button>
              </div>
            ) : (
              canEditarCenario && data && (
                <button
                  onClick={() => { setCapacidadeEdit(String(data.capacidade)); setEditandoCapacidade(true) }}
                  className="text-[11px] text-gray-500 border border-gray-300 rounded px-2.5 py-[5px] hover:bg-gray-50 transition-colors"
                  title="Editar capacidade de efetivo"
                >
                  Capacidade: <strong className="text-gray-700">{data.capacidade.toLocaleString('pt-BR')}</strong> ✎
                </button>
              )
            )}
            <Button size="sm" variant="outline" onClick={() => setModalRetratos(true)}>Retratos</Button>
            {canEditarCenario && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setGerenciarFocoId(null); setModalGerenciar(true) }}>Editar cenário</Button>
                <Button size="sm" onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>
              </>
            )}
          </div>
        }
      />

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
              {canEditarCenario ? 'Comece lançando uma proposta já enviada de Obras ou Paradas.' : 'Assim que houver lançamentos, eles aparecem aqui.'}
            </p>
            {canEditarCenario && <Button onClick={() => setModalNovo(true)}>+ Novo lançamento</Button>}
          </div>
        </>
      ) : (
        <>
          <CenarioCards ind={data.indicadores} />
          <CenarioGanttTable
            linhas={toLinhas(data.lancamentos)}
            periodo={data.periodo}
            totais={data.totais}
            capacidade={data.capacidade}
            editavel={canEditarCenario}
            onEditar={(l) => { setGerenciarFocoId(l.id); setModalGerenciar(true) }}
            onExcluir={(l) => { setGerenciarFocoId(l.id); setModalGerenciar(true) }}
          />
        </>
      )}

      <NovoLancamentoCenarioModal open={modalNovo} onClose={() => setModalNovo(false)} onSuccess={fetchData} />
      <GerenciarLancamentosCenarioModal open={modalGerenciar} onClose={() => setModalGerenciar(false)} onSuccess={fetchData} abrirEditandoId={gerenciarFocoId} />
      <RetratosCenarioModal open={modalRetratos} onClose={() => setModalRetratos(false)} editavel={canEditarCenario} />
    </div>
  )
}
