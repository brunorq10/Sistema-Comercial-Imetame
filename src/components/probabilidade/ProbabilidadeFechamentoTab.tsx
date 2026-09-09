'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { IncluirPropostaProbabilidadeModal } from '@/components/forms/IncluirPropostaProbabilidadeModal'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { SEGMENTO_LABELS, INTERESSE_LABELS } from '@/types'
import type { NivelProbabilidade } from '@/types'
import { ProbabilidadeStats } from './ProbabilidadeStats'
import { ProbabilidadeQuadro } from './ProbabilidadeQuadro'
import { ProbabilidadeCard } from './ProbabilidadeCard'
import type { ProbabilidadeItem } from './types'

const QUADROS: { nivel: NivelProbabilidade; icone: string; titulo: string; descricao: string; rodape: string; cor: string }[] = [
  { nivel: 'ALTA', icone: '🟢', titulo: 'Alta', descricao: 'próxima de fechamento', rodape: 'Acompanhamento prioritário.', cor: '#2E7D32' },
  { nivel: 'MEDIA', icone: '🟠', titulo: 'Média', descricao: 'em negociação', rodape: 'Requer ação para evoluir.', cor: '#E65100' },
  { nivel: 'BAIXA', icone: '🔴', titulo: 'Baixa', descricao: 'sem evolução recente', rodape: 'Avaliar retomada ou encerramento.', cor: '#C62828' },
  { nivel: 'BUDGET', icone: '🟣', titulo: 'Budget', descricao: 'referência de orçamento', rodape: 'Sem intenção imediata de compra.', cor: '#6A1B9A' },
]

const opSegmento = (Object.entries(SEGMENTO_LABELS) as [string, string][]).map(([value, label]) => ({ value, label }))
const opInteresse = (Object.entries(INTERESSE_LABELS) as [string, string][]).map(([value, label]) => ({ value, label }))

function uniqPessoas(itens: ProbabilidadeItem[], get: (i: ProbabilidadeItem) => { id: number; nome: string } | null) {
  const map = new Map<number, string>()
  for (const i of itens) { const p = get(i); if (p) map.set(p.id, p.nome) }
  return Array.from(map.entries()).map(([id, nome]) => ({ value: String(id), label: nome })).sort((a, b) => a.label.localeCompare(b.label))
}

export function ProbabilidadeFechamentoTab() {
  const { canEditarProbabilidade } = usePermissions()

  const [itens, setItens] = useState<ProbabilidadeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalIncluir, setModalIncluir] = useState(false)
  const [confirmRemover, setConfirmRemover] = useState<ProbabilidadeItem | null>(null)
  const [removerLoading, setRemoverLoading] = useState(false)
  const [removerError, setRemoverError] = useState<string | null>(null)

  const [orcamentistaIds, setOrcamentistaIds] = useState<string[]>([])
  const [clienteIds, setClienteIds] = useState<string[]>([])
  const [cidades, setCidades] = useState<string[]>([])
  const [segmentos, setSegmentos] = useState<string[]>([])
  const [interesses, setInteresses] = useState<string[]>([])

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/probabilidade').then((r) => r.json()).then((j) => setItens(j.data ?? [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const opOrcamentista = useMemo(() => uniqPessoas(itens, (i) => i.orcamentista), [itens])
  const opCliente = useMemo(() => uniqPessoas(itens, (i) => i.cliente), [itens])
  const opCidade = useMemo(() => {
    const set = new Set<string>()
    for (const i of itens) if (i.cidade) set.add(i.estado ? `${i.cidade}/${i.estado}` : i.cidade)
    return Array.from(set).sort().map((c) => ({ value: c, label: c }))
  }, [itens])

  const filtrados = useMemo(() => itens.filter((i) => (
    (orcamentistaIds.length === 0 || (i.orcamentista && orcamentistaIds.includes(String(i.orcamentista.id)))) &&
    (clienteIds.length === 0 || clienteIds.includes(String(i.cliente.id))) &&
    (cidades.length === 0 || (i.cidade && cidades.includes(i.estado ? `${i.cidade}/${i.estado}` : i.cidade))) &&
    (segmentos.length === 0 || (i.segmento && segmentos.includes(i.segmento))) &&
    (interesses.length === 0 || (i.interesse && interesses.includes(i.interesse)))
  )), [itens, orcamentistaIds, clienteIds, cidades, segmentos, interesses])

  const naoClassificadas = useMemo(() => filtrados.filter((i) => i.nivel === null), [filtrados])
  const porNivel = useCallback((nivel: NivelProbabilidade) => filtrados.filter((i) => i.nivel === nivel), [filtrados])

  const limpar = () => { setOrcamentistaIds([]); setClienteIds([]); setCidades([]); setSegmentos([]); setInteresses([]) }
  const filtrosAtivos = orcamentistaIds.length + clienteIds.length + cidades.length + segmentos.length + interesses.length > 0

  const classificar = async (solicitacaoId: number, nivel: NivelProbabilidade) => {
    setItens((prev) => prev.map((i) => i.solicitacao_id === solicitacaoId ? { ...i, nivel } : i))
    await fetch(`/api/probabilidade/${solicitacaoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'classificar', nivel }),
    })
    fetchData()
  }

  const revisar = async (solicitacaoId: number) => {
    await fetch(`/api/probabilidade/${solicitacaoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'revisar' }),
    })
    fetchData()
  }

  const executarRemocao = async () => {
    if (!confirmRemover) return
    setRemoverLoading(true); setRemoverError(null)
    try {
      const res = await fetch(`/api/probabilidade/${confirmRemover.solicitacao_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'remover' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setRemoverError(json.error ?? 'Erro ao remover'); return }
      setConfirmRemover(null)
      fetchData()
    } finally {
      setRemoverLoading(false)
    }
  }

  const exportar = () => {
    const rows = filtrados.map((i) => ({
      'Número': i.numero,
      'Classificação': i.classificacao ?? '',
      'Cliente': i.cliente.nome,
      'Cidade/UF': [i.cidade, i.estado].filter(Boolean).join(' / '),
      'Valor Total (R$)': i.valor_total ?? '',
      'Orçamentista': i.orcamentista?.nome ?? '',
      'Nível de Probabilidade': i.nivel ?? 'Não classificada',
      'Última Revisão': i.revisado_em ? formatDate(i.revisado_em) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Probabilidade')
    XLSX.writeFile(wb, `probabilidade_fechamento_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const fLbl = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
      <PageHeader
        title="Probabilidade de fechamento"
        subtitle="Propostas comerciais enviadas e em aberto, classificadas pela chance de conversão."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportar}>Exportar</Button>
            {canEditarProbabilidade && <Button size="sm" onClick={() => setModalIncluir(true)}>Incluir proposta</Button>}
          </>
        }
      />

      <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 flex flex-wrap gap-1.5 items-end mb-3">
        <div className="flex-1 min-w-[130px]">
          <label className={fLbl}>Orçamentista</label>
          <SearchableMultiSelect values={orcamentistaIds} onChange={setOrcamentistaIds} options={opOrcamentista} />
        </div>
        <div className="flex-[2] min-w-[160px]">
          <label className={fLbl}>Cliente</label>
          <SearchableMultiSelect values={clienteIds} onChange={setClienteIds} options={opCliente} />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className={fLbl}>Cidade</label>
          <SearchableMultiSelect values={cidades} onChange={setCidades} options={opCidade} emptyLabel="Todas" />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className={fLbl}>Mercado</label>
          <SearchableMultiSelect values={segmentos} onChange={setSegmentos} options={opSegmento} />
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className={fLbl}>Nível de interesse</label>
          <SearchableMultiSelect values={interesses} onChange={setInteresses} options={opInteresse} />
        </div>
        <div className="flex-shrink-0">
          <button onClick={limpar} disabled={!filtrosAtivos}
            className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Limpar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-md p-10 text-center">
          <p className="text-[13px] font-semibold text-gray-600 mb-1">Nenhuma proposta no painel ainda</p>
          <p className="text-[11px] text-gray-400">Propostas aparecem aqui automaticamente depois que a proposta comercial é enviada.</p>
        </div>
      ) : (
        <>
          <ProbabilidadeStats itens={filtrados} />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-3">
            {QUADROS.map((q) => (
              <ProbabilidadeQuadro
                key={q.nivel}
                icone={q.icone} titulo={q.titulo} descricao={q.descricao} rodape={q.rodape} cor={q.cor}
                itens={porNivel(q.nivel)}
                editavel={canEditarProbabilidade}
                onClassificar={classificar}
                onRevisar={revisar}
                onRemover={setConfirmRemover}
                onDropNivel={(id) => classificar(id, q.nivel)}
              />
            ))}
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-md bg-gray-50/60 p-3">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div>
                <p className="text-[12px] font-bold text-gray-600">Não classificadas</p>
                <p className="text-[9px] text-gray-400">Propostas comerciais enviadas que ainda aguardam classificação.</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-bold text-gray-700">{naoClassificadas.length}</p>
                <p className="text-[9px] text-gray-400">{formatCurrency(naoClassificadas.reduce((s, i) => s + (i.valor_total ?? 0), 0))}</p>
              </div>
            </div>
            {naoClassificadas.length === 0 ? (
              <p className="text-center text-gray-400 text-[10px] py-6">Nenhuma proposta aguardando classificação.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {naoClassificadas.map((item) => (
                  <ProbabilidadeCard
                    key={item.solicitacao_id}
                    item={item}
                    editavel={canEditarProbabilidade}
                    onClassificar={(nivel) => classificar(item.solicitacao_id, nivel)}
                    onRevisar={() => revisar(item.solicitacao_id)}
                    onRemover={() => setConfirmRemover(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <IncluirPropostaProbabilidadeModal open={modalIncluir} onClose={() => setModalIncluir(false)} onIncluida={fetchData} />

      <ConfirmDialog
        open={!!confirmRemover}
        title={`Remover do painel · ${confirmRemover?.numero ?? ''}`}
        message='Isso retira a proposta deste painel de probabilidade — a proposta em si não é afetada em nada. Ela pode ser trazida de volta a qualquer momento pelo botão "Incluir proposta".'
        variant="warning"
        confirmLabel="Remover"
        loading={removerLoading}
        error={removerError}
        onConfirm={executarRemocao}
        onClose={() => setConfirmRemover(null)}
      />
    </div>
  )
}
