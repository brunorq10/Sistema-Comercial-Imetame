'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Input } from '@/components/ui/Input'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { CenarioCards } from '@/components/cenario/CenarioCards'
import { CenarioGanttTable } from '@/components/cenario/CenarioGanttTable'
import { CenarioResumoTable } from '@/components/cenario/CenarioResumoTable'
import type { CenarioLinha, IndicadoresCenario, MesRef, TotalMes } from '@/lib/cenario'

interface RetratoResumo {
  id: number; nome: string; observacao: string | null; created_at: string; autor: string
  qtd_lancamentos: number; pico: number; mes_pico: MesRef | null; mais_recente: boolean
}

interface RetratoDetalhe {
  id: number; nome: string; observacao: string | null; created_at: string; autor: string
  capacidade: number
  lancamentos: Array<{ id: number; proposta_comercial_id: number; cliente_nome: string; cliente_final_nome: string | null; cidade: string | null; estado: string | null; escopo: string | null; classificacao: 'OBRAS' | 'PARADAS' | 'FABRICACOES' | 'OLEO_GAS'; origem: 'CONTRATO' | 'PROPOSTA'; data_inicio: string; data_fim: string; efetivo: number; observacao: string | null }>
  periodo: MesRef[]
  totais: TotalMes[]
  indicadores: IndicadoresCenario
}

interface LinhaComp { proposta_comercial_id: number; cliente_nome: string; escopo: string | null; classificacao: string; origem: string; data_inicio: string; data_fim: string; efetivo: number }
interface Comparacao {
  entraram: LinhaComp[]; sairam: LinhaComp[]
  mudaram: { antes: LinhaComp; depois: LinhaComp }[]
  diferencaPorMes: Array<{ ano: number; mes: number; total_retrato: number; total_atual: number; diferenca: number }>
  indicadoresRetrato: IndicadoresCenario; indicadoresAtual: IndicadoresCenario
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function toLinhas(lancs: RetratoDetalhe['lancamentos']): CenarioLinha[] {
  return lancs.map((l) => ({ ...l, data_inicio: new Date(l.data_inicio), data_fim: new Date(l.data_fim), efetivo_mensal: null }))
}

interface Props {
  open: boolean
  onClose: () => void
  editavel: boolean
}

type Modo = 'lista' | 'novo' | 'ver' | 'comparar'

export function RetratosCenarioModal({ open, onClose, editavel }: Props) {
  const [modo, setModo] = useState<Modo>('lista')
  const [abaRetrato, setAbaRetrato] = useState<'detalhamento' | 'resumo'>('detalhamento')
  const [lista, setLista] = useState<RetratoResumo[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [retratoAtivo, setRetratoAtivo] = useState<RetratoDetalhe | null>(null)
  const [comparacao, setComparacao] = useState<Comparacao | null>(null)
  const [excluindo, setExcluindo] = useState<RetratoResumo | null>(null)
  const [excluirError, setExcluirError] = useState<string | null>(null)
  const [excluirLoading, setExcluirLoading] = useState(false)

  // Formulário "novo retrato"
  const [nome, setNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroNovo, setErroNovo] = useState<string | null>(null)

  const fetchLista = () => {
    setLoadingLista(true)
    fetch('/api/cenario/retratos').then((r) => r.json()).then((j) => setLista(j.data ?? [])).finally(() => setLoadingLista(false))
  }

  useEffect(() => {
    if (!open) return
    setModo('lista'); setRetratoAtivo(null); setComparacao(null)
    fetchLista()
  }, [open])

  const abrirRetrato = (id: number) => {
    fetch(`/api/cenario/retratos/${id}`).then((r) => r.json()).then((j) => { setRetratoAtivo(j.data); setAbaRetrato('detalhamento'); setModo('ver') })
  }

  const abrirComparacao = () => {
    if (!retratoAtivo) return
    fetch(`/api/cenario/retratos/${retratoAtivo.id}/comparar`).then((r) => r.json()).then((j) => { setComparacao(j.data); setModo('comparar') })
  }

  const abrirNovo = () => {
    const hoje = new Date()
    setNome(`Reunião de Cenário — ${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`)
    setObservacao(''); setErroNovo(null)
    setModo('novo')
  }

  const salvarRetrato = async () => {
    if (!nome.trim()) { setErroNovo('Informe um nome'); return }
    setSalvando(true); setErroNovo(null)
    try {
      const res = await fetch('/api/cenario/retratos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), observacao: observacao.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErroNovo(json.error ?? 'Erro ao criar retrato'); return }
      setModo('lista'); fetchLista()
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (motivo: string) => {
    // ConfirmDialog exige input, mas exclusão de retrato não pede motivo — usamos
    // sem campo de texto (ver `input` omitido abaixo); motivo virá vazio.
    if (!excluindo) return
    setExcluirLoading(true); setExcluirError(null)
    try {
      const res = await fetch(`/api/cenario/retratos/${excluindo.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) { setExcluirError(json.error ?? 'Erro ao excluir'); return }
      setExcluindo(null); fetchLista()
    } finally {
      setExcluirLoading(false)
    }
  }

  const titulo = modo === 'lista' ? 'Retratos do Cenário'
    : modo === 'novo' ? 'Tirar Retrato do Cenário Atual'
    : modo === 'comparar' ? `Comparar Retrato · ${retratoAtivo?.nome}`
    : `Retrato · ${retratoAtivo?.nome}`

  return (
    <>
      <Modal open={open} confirmClose={modo === 'novo'} onClose={onClose} title={titulo} extraWide
        footer={modo === 'lista' ? <ModalCancelButton label="Fechar" /> : undefined}
      >
        {modo === 'lista' && (
          <>
            {editavel && (
              <div className="mb-4">
                <Button onClick={abrirNovo}>+ Tirar retrato do cenário atual</Button>
              </div>
            )}
            {loadingLista ? (
              <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
            ) : lista.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Nenhum retrato registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {lista.map((r) => (
                  <div
                    key={r.id}
                    className={`border rounded-md p-3 flex items-center justify-between gap-3 flex-wrap cursor-pointer transition-colors hover:bg-gray-50 ${r.mais_recente ? 'border-green-primary bg-green-light' : 'border-gray-200'}`}
                    onClick={() => abrirRetrato(r.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] font-bold text-gray-700">{r.nome}</span>
                        {r.mais_recente && <span className="text-[9px] bg-green-primary text-white rounded-full px-2 py-0.5 font-bold">MAIS RECENTE</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{formatDateTime(r.created_at)} · {r.autor}</p>
                      {r.observacao && <p className="text-[10px] text-gray-400 mt-0.5 italic truncate">{r.observacao}</p>}
                      <p className="text-[9px] text-gray-400 mt-1">
                        {r.qtd_lancamentos} lançamento{r.qtd_lancamentos === 1 ? '' : 's'} · Pico {r.pico.toLocaleString('pt-BR')}
                        {r.mes_pico ? ` (${MESES_ABREV[r.mes_pico.mes - 1]}/${r.mes_pico.ano})` : ''}
                      </p>
                    </div>
                    {editavel && (
                      <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setExcluindo(r); setExcluirError(null) }}>✕ Excluir</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {modo === 'novo' && (
          <div>
            {erroNovo && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{erroNovo}</div>}
            <Field label="Nome / identificação *" className="mb-3">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            <Field label="Observação (opcional)" className="mb-4">
              <textarea
                className="w-full border border-gray-300 rounded px-2.5 py-[5px] text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-green-primary/40"
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModo('lista')} disabled={salvando}>← Voltar</Button>
              <Button onClick={salvarRetrato} disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar retrato'}</Button>
            </div>
          </div>
        )}

        {modo === 'ver' && retratoAtivo && (
          <div>
            <div className="bg-[#F3E5F5] border border-[#CE93D8] rounded-md px-3.5 py-2.5 mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-bold text-[#6A1B9A]">📷 Visualizando retrato histórico — {retratoAtivo.nome}</p>
                <p className="text-[10px] text-[#6A1B9A]/80 mt-0.5">{formatDateTime(retratoAtivo.created_at)} · {retratoAtivo.autor}{retratoAtivo.observacao ? ` · ${retratoAtivo.observacao}` : ''}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={abrirComparacao}>Comparar com o cenário atual</Button>
                <Button size="sm" variant="outline" onClick={() => setModo('lista')}>← Voltar aos retratos</Button>
              </div>
            </div>
            <CenarioCards ind={retratoAtivo.indicadores} />

            <div className="flex gap-1 border-b border-gray-200 mb-3">
              <button
                onClick={() => setAbaRetrato('detalhamento')}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors',
                  abaRetrato === 'detalhamento' ? 'border-green-primary text-green-dark' : 'border-transparent text-gray-400 hover:text-gray-600',
                )}
              >
                Detalhamento
              </button>
              <button
                onClick={() => setAbaRetrato('resumo')}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors',
                  abaRetrato === 'resumo' ? 'border-green-primary text-green-dark' : 'border-transparent text-gray-400 hover:text-gray-600',
                )}
              >
                Resumo
              </button>
            </div>

            {abaRetrato === 'detalhamento' ? (
              <CenarioGanttTable
                linhas={toLinhas(retratoAtivo.lancamentos)}
                periodo={retratoAtivo.periodo}
                totais={retratoAtivo.totais}
                editavel={false}
              />
            ) : (
              <CenarioResumoTable
                linhas={toLinhas(retratoAtivo.lancamentos)}
                periodo={retratoAtivo.periodo}
                totais={retratoAtivo.totais}
              />
            )}
          </div>
        )}

        {modo === 'comparar' && comparacao && retratoAtivo && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-gray-500">Comparação somente leitura entre <strong>{retratoAtivo.nome}</strong> e o cenário atual.</p>
              <Button size="sm" variant="outline" onClick={() => setModo('ver')}>← Voltar ao retrato</Button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Pico — retrato → atual</p>
                <p className="text-[15px] font-bold">{comparacao.indicadoresRetrato.pico.toLocaleString('pt-BR')} → {comparacao.indicadoresAtual.pico.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Itens — retrato → atual</p>
                <p className="text-[15px] font-bold">{comparacao.indicadoresRetrato.totalItens} → {comparacao.indicadoresAtual.totalItens}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Meses acima capacidade</p>
                <p className="text-[15px] font-bold">{comparacao.indicadoresRetrato.mesesAcimaCapacidade} → {comparacao.indicadoresAtual.mesesAcimaCapacidade}</p>
              </div>
            </div>

            <GrupoComparacao titulo={`Entraram (${comparacao.entraram.length})`} cor="green" linhas={comparacao.entraram} />
            <GrupoComparacao titulo={`Saíram (${comparacao.sairam.length})`} cor="red" linhas={comparacao.sairam} />

            {comparacao.mudaram.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-amber-700 mb-1.5">Mudaram ({comparacao.mudaram.length})</p>
                <div className="space-y-1.5">
                  {comparacao.mudaram.map((m) => (
                    <div key={m.antes.proposta_comercial_id} className="border border-amber-200 bg-amber-50 rounded-md p-2.5 text-[10px]">
                      <p className="font-bold text-gray-700">{m.depois.cliente_nome}</p>
                      <p className="text-gray-500">
                        {formatDate(m.antes.data_inicio)}–{formatDate(m.antes.data_fim)} · Efetivo {m.antes.efetivo} · {m.antes.origem}
                        {' → '}
                        {formatDate(m.depois.data_inicio)}–{formatDate(m.depois.data_fim)} · Efetivo {m.depois.efetivo} · {m.depois.origem}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 mt-4">Diferença de total comprometido por mês</p>
            <div className="border border-gray-200 rounded-md overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-2 py-1.5 text-left font-semibold">Mês</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Retrato</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Atual</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.diferencaPorMes.map((d) => (
                    <tr key={`${d.ano}-${d.mes}`} className="border-t border-gray-100">
                      <td className="px-2 py-1">{MESES_ABREV[d.mes - 1]}/{d.ano}</td>
                      <td className="px-2 py-1 text-right">{d.total_retrato.toLocaleString('pt-BR')}</td>
                      <td className="px-2 py-1 text-right">{d.total_atual.toLocaleString('pt-BR')}</td>
                      <td className={`px-2 py-1 text-right font-bold ${d.diferenca > 0 ? 'text-red-600' : d.diferenca < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {d.diferenca > 0 ? '+' : ''}{d.diferenca.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!excluindo}
        title="Excluir retrato"
        message={`O retrato "${excluindo?.nome}" será excluído permanentemente. Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Confirmar exclusão"
        loading={excluirLoading}
        error={excluirError}
        onConfirm={() => handleExcluir('')}
        onClose={() => setExcluindo(null)}
      />
    </>
  )
}

function GrupoComparacao({ titulo, cor, linhas }: { titulo: string; cor: 'green' | 'red'; linhas: LinhaComp[] }) {
  if (linhas.length === 0) return null
  const cls = cor === 'green' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
  return (
    <div className="mb-4">
      <p className={`text-[11px] font-bold mb-1.5 ${cor === 'green' ? 'text-green-700' : 'text-red-700'}`}>{titulo}</p>
      <div className="space-y-1.5">
        {linhas.map((l) => (
          <div key={l.proposta_comercial_id} className={`border rounded-md p-2.5 text-[10px] ${cls}`}>
            <p className="font-bold">{l.cliente_nome}</p>
            <p>{l.escopo ?? '—'} · {formatDate(l.data_inicio)}–{formatDate(l.data_fim)} · Efetivo {l.efetivo}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
