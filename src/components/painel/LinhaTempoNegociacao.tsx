'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { TIPO_INTERACAO_MAP } from '@/lib/interacoes'
import { RegistrarInfoModal } from '@/components/forms/RegistrarInfoModal'

interface Info {
  id: number
  codigo: string | null
  tipo: string | null
  data: string
  comentario: string
  created_at: string
  created_by: number
  autor: string
  anexosCount: number
}

interface Props {
  solicitacaoId: number
  numero: string
  cliente: string
  escopo?: string | null
  canCreate: boolean
  userId: number | null
  canSupervise: boolean
}

const LIMIT = 10

const FALLBACK = { cor: '#6B7280', corBg: '#F3F4F6', label: 'Registro' }

// Destaque case-insensitive do termo pesquisado dentro do texto
function highlight(texto: string, termo: string) {
  if (!termo.trim()) return texto
  const esc = termo.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const partes = texto.split(new RegExp(`(${esc})`, 'gi'))
  return partes.map((p, i) =>
    p.toLowerCase() === termo.trim().toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>,
  )
}

const IconSearch = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
)
const IconTrash = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)
const IconInbox = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
)
const IconClip = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

export function LinhaTempoNegociacao({ solicitacaoId, numero, cliente, escopo, canCreate, userId, canSupervise }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [tipo, setTipo] = useState<'all' | 'DEFINICAO_INTERNA'>('all')
  const [items, setItems] = useState<Info[]>([])
  const [total, setTotal] = useState(0)
  const [proximoCodigo, setProximoCodigo] = useState('INF-0001')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [modal, setModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // debounce da busca (tempo real, sem Enter)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const buildUrl = (offset: number) => {
    const p = new URLSearchParams()
    if (debouncedQ) p.set('q', debouncedQ)
    if (tipo !== 'all') p.set('tipo', tipo)
    p.set('limit', String(LIMIT))
    p.set('offset', String(offset))
    return `/api/solicitacoes/${solicitacaoId}/informacoes?${p.toString()}`
  }

  // busca/filtro server-side: recarrega a 1ª página quando muda termo, filtro ou após salvar
  useEffect(() => {
    let ativo = true
    setLoading(true)
    fetch(buildUrl(0))
      .then(r => r.json())
      .then(j => {
        if (ativo && !j.error) {
          setItems(j.data.items); setTotal(j.data.total)
          if (j.data.proximoCodigo) setProximoCodigo(j.data.proximoCodigo)
        }
      })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, tipo, reloadKey, solicitacaoId])

  const loadMore = () => {
    setLoadingMore(true)
    fetch(buildUrl(items.length))
      .then(r => r.json())
      .then(j => { if (!j.error) { setItems(prev => [...prev, ...j.data.items]); setTotal(j.data.total) } })
      .finally(() => setLoadingMore(false))
  }

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta informação? Esta ação não pode ser desfeita.')) return
    const res = await fetch(`/api/solicitacoes/${solicitacaoId}/informacoes/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) { alert(json.error ?? 'Erro ao excluir'); return }
    setItems(prev => prev.filter(x => x.id !== id))
    setTotal(t => Math.max(0, t - 1))
  }

  const hasMore = items.length < total
  const subtitulo = `${numero} · ${cliente}${escopo ? ` — ${escopo}` : ''}`

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4">
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-gray-800">Linha do tempo da negociação</h3>
          <p className="text-[11px] text-gray-500 truncate">{subtitulo}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setModal(true)}
            className="shrink-0 bg-green-primary hover:bg-green-dark text-white text-[12px] font-semibold rounded px-3 py-1.5 transition-colors"
          >
            + Nova informação
          </button>
        )}
      </div>

      {/* Busca + filtros */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por palavra-chave (ex: concorrência, prazo, desconto...)"
            className="w-full pl-9 pr-3 py-2 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-green-primary"
          />
        </div>
        {debouncedQ && (
          <p className="text-[10px] text-gray-500 mt-1.5">
            {total} {total === 1 ? 'resultado encontrado' : 'resultados encontrados'} para “{debouncedQ}”
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="text-[10px] text-gray-400 mr-1">Filtrar:</span>
          {([['all', 'Todos'], ['DEFINICAO_INTERNA', 'Decisões']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTipo(val)}
              className={
                'text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition-colors ' +
                (tipo === val
                  ? 'bg-green-primary border-green-primary text-white'
                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / timeline */}
      <div className="px-4 pb-4">
        {loading ? (
          <p className="text-center text-[11px] text-gray-400 py-8">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
            <IconInbox className="w-8 h-8" />
            <p className="text-[11px]">
              {debouncedQ || tipo !== 'all'
                ? 'Nenhuma informação encontrada para essa busca'
                : 'Nenhuma informação registrada ainda.'}
            </p>
          </div>
        ) : (
          <div className="relative pt-1">
            {items.map((info, idx) => {
              const cfg = info.tipo ? TIPO_INTERACAO_MAP[info.tipo] : undefined
              const Icon = cfg?.icon
              const cor = cfg?.cor ?? FALLBACK.cor
              const corBg = cfg?.corBg ?? FALLBACK.corBg
              const label = cfg?.label ?? FALLBACK.label
              const podeExcluir = canSupervise || (userId != null && info.created_by === userId)
              const ultimo = idx === items.length - 1
              return (
                <div key={info.id} className="group relative flex gap-3 pb-5">
                  {!ultimo && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-gray-200" />}
                  <div
                    className="relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: corBg, color: cor }}
                  >
                    {Icon ? <Icon width={16} height={16} /> : <span className="w-2 h-2 rounded-full bg-current" />}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {info.codigo && <span className="text-[10px] font-bold text-green-primary">{info.codigo}</span>}
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: cor, backgroundColor: corBg }}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(info.data)} · {info.autor}</span>
                      <span className="text-[10px] text-gray-400 inline-flex items-center gap-0.5">
                        {info.anexosCount > 0 ? <><IconClip className="w-3 h-3" />{info.anexosCount}</> : '—'}
                      </span>
                      {podeExcluir && (
                        <button
                          onClick={() => excluir(info.id)}
                          title="Excluir"
                          className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap mt-0.5">
                      {highlight(info.comentario, debouncedQ)}
                    </p>
                  </div>
                </div>
              )
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full border border-dashed border-gray-300 text-gray-500 text-[11px] font-semibold py-2 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : `Carregar mais (${total - items.length} restante${total - items.length === 1 ? '' : 's'})`}
              </button>
            )}
          </div>
        )}
      </div>

      {modal && (
        <RegistrarInfoModal
          open
          onClose={() => setModal(false)}
          onSuccess={() => { setQ(''); setTipo('all'); setReloadKey(k => k + 1) }}
          solicitacaoId={solicitacaoId}
          numero={numero}
          proximoCodigo={proximoCodigo}
        />
      )}
    </div>
  )
}
