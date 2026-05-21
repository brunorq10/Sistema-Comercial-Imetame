'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { ProporAlteracaoModal } from '@/components/forms/ProporAlteracaoModal'
import { cn } from '@/lib/utils'
import type { ContratoItem, SubIndiceItem, PrevisaoAlteracaoItem } from '@/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  // Modal
  const [modalPropor, setModalPropor] = useState<{ subindice: SubIndiceItem; indiceLabel: string } | null>(null)

  // Busca lista de responsáveis (apenas para GESTAO_ACORDOS)
  useEffect(() => {
    if (!isGestao) return
    fetch('/api/faturamento/filtros')
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.responsaveis) setResponsaveis(j.data.responsaveis)
      })
  }, [isGestao])

  // Define o responsável padrão ao montar
  useEffect(() => {
    if (userId && !isGestao) {
      setResponsavelId(String(userId))
    }
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

  useEffect(() => {
    fetchContratos()
  }, [fetchContratos])

  useEffect(() => {
    if (!isGestao) fetchMinhasAlteracoes()
  }, [fetchMinhasAlteracoes, isGestao])

  const pendentes = minhasAlteracoes.filter((a) => a.status === 'PENDENTE')
  const reprovadas = minhasAlteracoes.filter((a) => a.status === 'REPROVADO')

  return (
    <div className="p-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Meu Painel — Acordos</h2>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        {isGestao
          ? 'Visão de contratos por responsável e gestão de alterações de previsão.'
          : 'Seus contratos vinculados e proposta de alterações de previsão mensal.'}
      </p>

      {/* Filtro de responsável (apenas Gestão) */}
      {isGestao && (
        <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 mb-4 flex items-center gap-3">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Responsável</span>
          <Select
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            className="text-[11px] py-[3px] max-w-[260px]"
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.nome}</option>
            ))}
          </Select>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
      )}

      {/* Seção de pendentes/reprovadas (apenas para não-gestão) */}
      {!isGestao && (pendentes.length > 0 || reprovadas.length > 0) && (
        <div className="mb-5">
          {pendentes.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                {pendentes.length} alteração{pendentes.length > 1 ? 'ões' : ''} aguardando aprovação
              </p>
              <div className="space-y-1.5">
                {pendentes.map((a) => (
                  <AlteracaoCard key={a.id} alteracao={a} />
                ))}
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
                {reprovadas.map((a) => (
                  <AlteracaoCard key={a.id} alteracao={a} />
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-200 mt-4 mb-4" />
        </div>
      )}

      {/* Lista de contratos */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : contratos.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          {isGestao && !responsavelId
            ? 'Selecione um responsável ou aguarde o carregamento de todos os contratos.'
            : 'Nenhum contrato vinculado a este responsável.'}
        </div>
      ) : (
        <div className="space-y-4">
          {contratos.map((contrato) => (
            <ContratoCard
              key={contrato.id}
              contrato={contrato}
              isGestao={isGestao}
              onPropor={(sub) =>
                setModalPropor({
                  subindice: sub,
                  indiceLabel: `${contrato.indice}.${sub.ordem}`,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Modal propor alteração */}
      {modalPropor && (
        <ProporAlteracaoModal
          open={true}
          onClose={() => setModalPropor(null)}
          onSuccess={() => {
            fetchContratos()
            fetchMinhasAlteracoes()
          }}
          subindice={modalPropor.subindice}
          indiceLabel={modalPropor.indiceLabel}
        />
      )}
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
  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
      {/* Cabeçalho do contrato */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-bold text-green-dark">{contrato.indice}</span>
          <span className="text-[11px] text-gray-500">{contrato.cliente.nome}</span>
          {contrato.num_acordo && (
            <span className="text-[10px] text-gray-400">Acordo: {contrato.num_acordo}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {contrato.responsavel && (
            <span className="text-[10px] text-gray-400">Resp.: {contrato.responsavel.nome}</span>
          )}
          <span className="text-[10px] text-gray-400">{contrato.ano_referencia}</span>
        </div>
      </div>

      {/* Sub-índices */}
      <div className="divide-y divide-gray-100">
        {contrato.subindices.map((sub) => (
          <SubIndiceRow
            key={sub.id}
            sub={sub}
            isGestao={isGestao}
            indiceLabel={`${contrato.indice}.${sub.ordem}`}
            onPropor={() => onPropor(sub)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Linha de sub-índice ──────────────────────────────────────────────────────

interface SubIndiceRowProps {
  sub: SubIndiceComAlteracao
  isGestao: boolean
  indiceLabel: string
  onPropor: () => void
}

function SubIndiceRow({ sub, isGestao, indiceLabel, onPropor }: SubIndiceRowProps) {
  const [expanded, setExpanded] = useState(false)
  const alt = sub.alteracao_pendente

  const disponivel = sub.valor_total - sub.total_faturado
  const percFaturado = sub.valor_total > 0 ? (sub.total_faturado / sub.valor_total) * 100 : 0

  return (
    <div className="px-4 py-3">
      {/* Linha principal */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-700">{indiceLabel}</span>
            <span className="text-[11px] text-gray-600 truncate">{sub.descricao}</span>
            {alt && (
              <span className={cn(
                'text-[9px] font-semibold px-1.5 py-0.5 rounded border',
                STATUS_BADGE.PENDENTE.cls,
              )}>
                {STATUS_BADGE.PENDENTE.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[10px] text-gray-400">
              Total: <strong className="text-gray-700">R$ {fmt(sub.valor_total)}</strong>
            </span>
            <span className="text-[10px] text-gray-400">
              Faturado: <strong className="text-[#1565C0]">R$ {fmt(sub.total_faturado)}</strong>
            </span>
            <span className="text-[10px] text-gray-400">
              Disponível: <strong className="text-green-dark">R$ {fmt(Math.max(0, disponivel))}</strong>
            </span>
            <span className="text-[10px] text-gray-400">
              {percFaturado.toFixed(0)}% faturado
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            {expanded ? 'Ocultar meses' : 'Ver meses'}
          </button>
          {!isGestao && (
            <Button size="sm" variant="outline" onClick={onPropor}>
              Editar previsão
            </Button>
          )}
        </div>
      </div>

      {/* Grid de meses atual */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Previsão atual</p>
          <div className="grid grid-cols-12 gap-1">
            {MESES.map((m, mi) => {
              const valor = sub[m]
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

          {/* Alteração pendente expandida */}
          {alt && (
            <div className="mt-3 pt-3 border-t border-amber-200 bg-amber-50 rounded p-2.5">
              <p className="text-[9px] font-semibold text-amber-700 uppercase tracking-widest mb-2">
                Proposta pendente — enviada em {new Date(alt.created_at).toLocaleDateString('pt-BR')}
              </p>
              <div className="grid grid-cols-12 gap-1">
                {MESES.map((m, mi) => {
                  const deProp = alt[`${m}_de` as keyof PrevisaoAlteracaoItem] as number | null
                  const paraProp = alt[`${m}_para` as keyof PrevisaoAlteracaoItem] as number | null
                  const mudou = deProp !== paraProp
                  return (
                    <div key={m} className="text-center">
                      <p className="text-[8px] uppercase text-gray-300 mb-0.5">{MESES_LABELS[mi]}</p>
                      {mudou ? (
                        <div>
                          <p className="text-[9px] text-gray-400 line-through">
                            {deProp != null ? fmt(deProp) : '—'}
                          </p>
                          <p className="text-[10px] font-bold text-amber-700">
                            {paraProp != null ? fmt(paraProp) : '—'}
                          </p>
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
      )}
    </div>
  )
}

// ─── Card de alteração pendente/reprovada ─────────────────────────────────────

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
          <p className="text-[10px] text-red-600 mt-0.5 font-medium">
            Motivo: {alteracao.motivo_recusa}
          </p>
        )}
      </div>
    </div>
  )
}
