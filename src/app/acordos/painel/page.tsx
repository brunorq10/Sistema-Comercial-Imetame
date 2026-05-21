'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { ProporAlteracaoModal } from '@/components/forms/ProporAlteracaoModal'
import { cn } from '@/lib/utils'
import type { ContratoItem, SubIndiceItem, PrevisaoAlteracaoItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
type MesKey = typeof MESES[number]
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtCompact(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
  return `R$ ${fmt(v)}`
}

interface SubIndiceComAlteracao extends SubIndiceItem {
  alteracao_pendente: PrevisaoAlteracaoItem | null
}

interface ContratoComAlteracoes extends Omit<ContratoItem, 'subindices'> {
  subindices: SubIndiceComAlteracao[]
}

interface Responsavel { id: number; nome: string }

const STATUS_BADGE = {
  PENDENTE: { label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  APROVADO: { label: 'Aprovado', cls: 'bg-green-100 text-green-800 border-green-300' },
  REPROVADO: { label: 'Reprovado', cls: 'bg-red-100 text-red-800 border-red-300' },
}

export default function MeuPainelAcordosPage() {
  const { data: session } = useSession()
  const perfil = session?.user?.perfil
  const isGestao = perfil === 'GESTAO_ACORDOS'
  const userId = session?.user?.id ? Number(session.user.id) : null

  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [responsavelId, setResponsavelId] = useState<string>('')
  const [contratos, setContratos] = useState<ContratoComAlteracoes[]>([])
  const [minhasAlteracoes, setMinhasAlteracoes] = useState<PrevisaoAlteracaoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroNumOs, setFiltroNumOs] = useState('')

  const [modalPropor, setModalPropor] = useState<{ subindice: SubIndiceItem; indiceLabel: string } | null>(null)

  useEffect(() => {
    if (!isGestao) return
    fetch('/api/faturamento/filtros')
      .then((r) => r.json())
      .then((j) => { if (j.data?.responsaveis) setResponsaveis(j.data.responsaveis) })
  }, [isGestao])

  useEffect(() => {
    if (userId && !isGestao) setResponsavelId(String(userId))
  }, [userId, isGestao])

  const fetchContratos = useCallback(async () => {
    if (!responsavelId && !isGestao) return
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (responsavelId) params.set('responsavel_id', responsavelId)
      else if (isGestao) params.set('todos', '1')
      const res = await fetch(`/api/faturamento/painel-acordos?${params.toString()}`)
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      setContratos(json.data ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [responsavelId, isGestao])

  const fetchMinhasAlteracoes = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/faturamento/alteracoes?status=')
      const json = await res.json()
      if (!json.error) setMinhasAlteracoes(json.data ?? [])
    } catch { /* silencioso */ }
  }, [userId])

  useEffect(() => { fetchContratos() }, [fetchContratos])
  useEffect(() => { if (!isGestao) fetchMinhasAlteracoes() }, [fetchMinhasAlteracoes, isGestao])

  const filteredContratos = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroCliente && !c.cliente.nome.toLowerCase().includes(filtroCliente.toLowerCase())) return false
      if (filtroNumOs) {
        const match = c.subindices.some((s) => s.num_os?.toLowerCase().includes(filtroNumOs.toLowerCase()))
        if (!match) return false
      }
      return true
    })
  }, [contratos, filtroCliente, filtroNumOs])

  const { indicators, mesPassadoLabel, mesAtualLabel, mesProximoLabel } = useMemo(() => {
    const allSubs = filteredContratos.flatMap((c) => c.subindices)
    const m = new Date().getMonth()
    const mp = m === 0 ? 11 : m - 1
    const mn = m === 11 ? 0 : m + 1
    const sum = (idx: number) => {
      const key = MESES[idx] as MesKey
      return allSubs.reduce((acc, s) => acc + (Number(s[key]) || 0), 0)
    }
    return {
      indicators: {
        totalContratos: filteredContratos.length,
        prevPassado: sum(mp),
        prevAtual: sum(m),
        prevProximo: sum(mn),
      },
      mesPassadoLabel: MESES_LABELS[mp],
      mesAtualLabel: MESES_LABELS[m],
      mesProximoLabel: MESES_LABELS[mn],
    }
  }, [filteredContratos])

  const pendentes = minhasAlteracoes.filter((a) => a.status === 'PENDENTE')
  const reprovadas = minhasAlteracoes.filter((a) => a.status === 'REPROVADO')

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Meu Painel — Acordos</h2>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        {isGestao
          ? 'Visão de contratos por responsável e gestão de alterações de previsão.'
          : 'Seus contratos vinculados e proposta de alterações de previsão mensal.'}
      </p>

      {/* Indicadores */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <IndicatorCard label="Total de contratos" value={String(indicators.totalContratos)} />
        <IndicatorCard label={`Prev. ${mesPassadoLabel}.`} value={fmtCompact(indicators.prevPassado)} color="gray" />
        <IndicatorCard label={`Prev. ${mesAtualLabel}. (atual)`} value={fmtCompact(indicators.prevAtual)} color="green" />
        <IndicatorCard label={`Prev. ${mesProximoLabel}. (próximo)`} value={fmtCompact(indicators.prevProximo)} color="blue" />
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 mb-4 flex flex-wrap items-center gap-3">
        {isGestao && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap">Responsável</span>
            <Select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="text-[11px] py-[3px] max-w-[200px]"
            >
              <option value="">Todos</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={String(r.id)}>{r.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap">Cliente</span>
          <Input
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            placeholder="Filtrar..."
            className="text-[11px] py-[3px] max-w-[180px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em] whitespace-nowrap">Nº OS</span>
          <Input
            value={filtroNumOs}
            onChange={(e) => setFiltroNumOs(e.target.value)}
            placeholder="Filtrar..."
            className="text-[11px] py-[3px] max-w-[120px]"
          />
        </div>
        {(filtroCliente || filtroNumOs) && (
          <button
            onClick={() => { setFiltroCliente(''); setFiltroNumOs('') }}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            Limpar
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
      )}

      {/* Pendentes / reprovadas */}
      {!isGestao && (pendentes.length > 0 || reprovadas.length > 0) && (
        <div className="mb-5">
          {pendentes.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                {pendentes.length} alteração{pendentes.length > 1 ? 'ões' : ''} aguardando aprovação
              </p>
              <div className="space-y-1.5">
                {pendentes.map((a) => <AlteracaoCard key={a.id} alteracao={a} />)}
              </div>
            </div>
          )}
          {reprovadas.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {reprovadas.length} alteração{reprovadas.length > 1 ? 'ões' : ''} reprovada{reprovadas.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5">
                {reprovadas.map((a) => <AlteracaoCard key={a.id} alteracao={a} />)}
              </div>
            </div>
          )}
          <div className="border-t border-gray-200 mt-4 mb-4" />
        </div>
      )}

      {/* Lista de contratos */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : filteredContratos.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          {isGestao && !responsavelId
            ? 'Selecione um responsável ou aguarde o carregamento de todos os contratos.'
            : 'Nenhum contrato vinculado a este responsável.'}
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {filteredContratos.map((contrato) => (
            <ContratoCard
              key={contrato.id}
              contrato={contrato}
              isGestao={isGestao}
              onPropor={(sub) =>
                setModalPropor({ subindice: sub, indiceLabel: `${contrato.indice}.${sub.ordem}` })
              }
            />
          ))}
        </div>
      )}

      {modalPropor && (
        <ProporAlteracaoModal
          open={true}
          onClose={() => setModalPropor(null)}
          onSuccess={() => { fetchContratos(); fetchMinhasAlteracoes() }}
          subindice={modalPropor.subindice}
          indiceLabel={modalPropor.indiceLabel}
        />
      )}
    </div>
  )
}

// ─── Indicator Card ───────────────────────────────────────────────────────────

interface IndicatorCardProps {
  label: string
  value: string
  color?: 'green' | 'blue' | 'gray'
}

function IndicatorCard({ label, value, color = 'gray' }: IndicatorCardProps) {
  const valueCls =
    color === 'green' ? 'text-green-dark' :
    color === 'blue' ? 'text-[#1565C0]' :
    'text-gray-700'
  return (
    <div className="bg-white border border-gray-200 rounded-md px-4 py-3 shadow-sm">
      <p className="text-[10px] text-gray-400 mb-1 leading-tight">{label}</p>
      <p className={cn('text-[16px] font-bold leading-snug', valueCls)}>{value}</p>
    </div>
  )
}

// ─── Card de contrato ─────────────────────────────────────────────────────────

interface ContratoCardProps {
  contrato: ContratoComAlteracoes
  isGestao: boolean
  onPropor: (sub: SubIndiceItem) => void
}

function ContratoCard({ contrato, isGestao, onPropor }: ContratoCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Group subitems by ordem, sort each group by year
  const subGroups: Array<{ ordem: number; subs: SubIndiceComAlteracao[] }> = []
  const seen = new Map<number, SubIndiceComAlteracao[]>()
  for (const s of contrato.subindices) {
    if (!seen.has(s.ordem)) { seen.set(s.ordem, []); subGroups.push({ ordem: s.ordem, subs: seen.get(s.ordem)! }) }
    seen.get(s.ordem)!.push(s)
  }
  for (const g of subGroups) {
    g.subs.sort((a, b) => {
      const ya = a.data_inicio ? new Date(a.data_inicio).getFullYear() : 0
      const yb = b.data_inicio ? new Date(b.data_inicio).getFullYear() : 0
      return ya - yb
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[12px] font-bold text-green-dark shrink-0">{contrato.indice}</span>
          {contrato.descricao && (
            <span className="text-[11px] font-medium text-gray-700 truncate max-w-[200px]">{contrato.descricao}</span>
          )}
          <span className="text-[11px] text-gray-500 shrink-0">{contrato.cliente.nome}</span>
          {contrato.num_acordo && (
            <span className="text-[10px] text-gray-400 shrink-0">Acordo: {contrato.num_acordo}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {contrato.responsavel && (
            <span className="text-[10px] text-gray-400">Resp.: {contrato.responsavel.nome}</span>
          )}
          <span className="text-[10px] text-gray-400">{contrato.ano_referencia}</span>
          <span className="text-[10px] text-gray-400">
            {subGroups.length} subitem{subGroups.length !== 1 ? 's' : ''}
          </span>
          <Chevron open={expanded} />
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {subGroups.map(({ ordem, subs }) => (
            <SubIndiceRow
              key={ordem}
              subs={subs}
              isGestao={isGestao}
              indiceLabel={`${contrato.indice}.${ordem}`}
              onPropor={onPropor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Chevron ──────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      className={cn('transition-transform duration-200 text-gray-400', open && 'rotate-180')}
    >
      <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Linha de sub-índice ──────────────────────────────────────────────────────

interface SubIndiceRowProps {
  subs: SubIndiceComAlteracao[]
  isGestao: boolean
  indiceLabel: string
  onPropor: (sub: SubIndiceItem) => void
}

function SubIndiceRow({ subs, isGestao, indiceLabel, onPropor }: SubIndiceRowProps) {
  const [expanded, setExpanded] = useState(false)
  const firstSub = subs[0]
  const isMultiYear = subs.length > 1

  const valorTotal = firstSub.valor_total
  const totalFaturado = subs.reduce((acc, s) => acc + s.total_faturado, 0)
  const disponivel = valorTotal - totalFaturado
  const percFaturado = valorTotal > 0 ? (totalFaturado / valorTotal) * 100 : 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-700">{indiceLabel}</span>
            {isMultiYear && (
              <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                {subs.map((s) => s.data_inicio ? new Date(s.data_inicio).getFullYear() : '?').join('/')}
              </span>
            )}
            <span className="text-[11px] text-gray-600 truncate">{firstSub.descricao}</span>
            {firstSub.num_os && (
              <span className="text-[9px] text-gray-400">OS: {firstSub.num_os}</span>
            )}
            {firstSub.alteracao_pendente && (
              <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', STATUS_BADGE.PENDENTE.cls)}>
                {STATUS_BADGE.PENDENTE.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[10px] text-gray-400">
              Total: <strong className="text-gray-700">R$ {fmt(valorTotal)}</strong>
            </span>
            <span className="text-[10px] text-gray-400">
              Faturado: <strong className="text-[#1565C0]">R$ {fmt(totalFaturado)}</strong>
            </span>
            <span className="text-[10px] text-gray-400">
              Disponível: <strong className="text-green-dark">R$ {fmt(Math.max(0, disponivel))}</strong>
            </span>
            <span className="text-[10px] text-gray-400">{percFaturado.toFixed(0)}% faturado</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            {expanded ? 'Ocultar meses' : 'Ver meses'}
          </button>
          {!isGestao && !isMultiYear && (
            <Button size="sm" variant="outline" onClick={() => onPropor(firstSub)}>
              Editar previsão
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
          {subs.map((sub) => {
            const year = sub.data_inicio ? new Date(sub.data_inicio).getFullYear() : null
            return (
              <div key={sub.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                    {isMultiYear && year ? `Previsão ${year}` : 'Previsão atual'}
                  </p>
                  {!isGestao && isMultiYear && (
                    <Button size="sm" variant="outline" onClick={() => onPropor(sub)}>
                      Editar {year}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {MESES.map((m, mi) => {
                    const valor = sub[m as MesKey]
                    return (
                      <div key={m} className="text-center">
                        <p className="text-[8px] uppercase text-gray-300 mb-0.5">{MESES_LABELS[mi]}</p>
                        <p className="text-[10px] font-medium text-gray-600 bg-gray-50 rounded px-1 py-0.5">
                          {valor != null ? fmt(valor) : '—'}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {sub.alteracao_pendente && (
                  <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50 rounded p-2">
                    <p className="text-[9px] font-semibold text-amber-700 uppercase tracking-widest mb-1.5">
                      Proposta pendente — enviada em {new Date(sub.alteracao_pendente.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="grid grid-cols-12 gap-1">
                      {MESES.map((m, mi) => {
                        const alt = sub.alteracao_pendente!
                        const deProp = alt[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
                        const paraProp = alt[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
                        const mudou = deProp !== paraProp
                        return (
                          <div key={m} className="text-center">
                            <p className="text-[8px] uppercase text-gray-300 mb-0.5">{MESES_LABELS[mi]}</p>
                            {mudou ? (
                              <div>
                                <p className="text-[9px] text-gray-400 line-through">{deProp != null ? fmt(deProp) : '—'}</p>
                                <p className="text-[10px] font-bold text-amber-700">{paraProp != null ? fmt(paraProp) : '—'}</p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-400 bg-white rounded px-1 py-0.5">
                                {paraProp != null ? fmt(paraProp) : '—'}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Card de alteração ────────────────────────────────────────────────────────

function AlteracaoCard({ alteracao }: { alteracao: PrevisaoAlteracaoItem }) {
  const badge = STATUS_BADGE[alteracao.status]
  return (
    <div className={cn(
      'bg-white border rounded-md px-3 py-2.5 flex items-center justify-between gap-3',
      alteracao.status === 'REPROVADO' ? 'border-red-200' : 'border-amber-200',
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-700">
            {alteracao.contrato?.indice}.{alteracao.subindice.ordem} — {alteracao.subindice.descricao}
          </span>
          <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', badge.cls)}>
            {badge.label}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {alteracao.contrato?.cliente.nome} · Enviado em {new Date(alteracao.created_at).toLocaleDateString('pt-BR')}
        </p>
        {alteracao.status === 'REPROVADO' && alteracao.motivo_recusa && (
          <p className="text-[10px] text-red-600 mt-0.5 font-medium">Motivo: {alteracao.motivo_recusa}</p>
        )}
      </div>
    </div>
  )
}
