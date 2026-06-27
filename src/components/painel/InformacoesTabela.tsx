'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { TIPOS_INTERACAO, TIPO_INTERACAO_MAP } from '@/lib/interacoes'
import { RegistrarInfoModal } from '@/components/forms/RegistrarInfoModal'

interface Anexo { id: number; nome: string; tipo: string; url: string; tamanho: number | null }
interface Info {
  id: number; codigo: string | null; tipo: string | null; data: string
  comentario: string; autor: string; created_by: number; anexosCount: number
}
interface InfoDetalhe extends Info { anexos: Anexo[] }
interface Autor { id: number; nome: string }

interface Props {
  solicitacaoId: number
  numero: string
  canCreate: boolean
  userId: number | null
  canSupervise: boolean
}

const PERIODOS = [
  { value: 'all', label: 'Todo o período' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'mes_atual', label: 'Mês atual' },
]
const FALLBACK = { cor: '#6B7280', corBg: '#F3F4F6', label: 'Registro' }

function highlight(texto: string, termo: string) {
  if (!termo.trim()) return texto
  const esc = termo.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return texto.split(new RegExp(`(${esc})`, 'gi')).map((p, i) =>
    p.toLowerCase() === termo.trim().toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>,
  )
}

const svg = (d: React.ReactNode) => (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
)
const IconSearch = svg(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)
const IconClip = svg(<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />)
const IconEye = svg(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>)
const IconTrash = svg(<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>)
const IconInbox = svg(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>)
const IconBack = svg(<path d="m15 18-6-6 6-6" />)
const IconDownload = svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>)
const IconFile = svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" /></>)
const IconImage = svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>)
const anexoIcon = (tipo: string) => (/image|png|jpe?g|gif|webp/i.test(tipo) ? IconImage : IconFile)
const trunc = (s: string, n = 55) => (s.length > n ? s.slice(0, n) + '…' : s)

export function InformacoesTabela({ solicitacaoId, numero, canCreate, userId, canSupervise }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [periodo, setPeriodo] = useState('all')
  const [autor, setAutor] = useState('')
  const [tipo, setTipo] = useState('')
  const [items, setItems] = useState<Info[]>([])
  const [total, setTotal] = useState(0)
  const [autores, setAutores] = useState<Autor[]>([])
  const [proximoCodigo, setProximoCodigo] = useState('INF-0001')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InfoDetalhe | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let ativo = true
    setLoading(true)
    const p = new URLSearchParams()
    if (debouncedQ) p.set('q', debouncedQ)
    if (periodo !== 'all') p.set('periodo', periodo)
    if (autor) p.set('autor', autor)
    if (tipo) p.set('tipo', tipo)
    p.set('limit', '50')
    fetch(`/api/solicitacoes/${solicitacaoId}/informacoes?${p.toString()}`)
      .then(r => r.json())
      .then(j => {
        if (!ativo || j.error) return
        setItems(j.data.items); setTotal(j.data.total); setAutores(j.data.autores ?? [])
        if (j.data.proximoCodigo) setProximoCodigo(j.data.proximoCodigo)
      })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [solicitacaoId, debouncedQ, periodo, autor, tipo, reloadKey])

  const limparFiltros = () => { setQ(''); setPeriodo('all'); setAutor(''); setTipo('') }

  const verDetalhe = async (id: number) => {
    setCarregandoDetalhe(true)
    try {
      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/informacoes/${id}`)
      const json = await res.json()
      if (!res.ok || json.error) { alert(json.error ?? 'Erro ao carregar'); return }
      setSelected(json.data)
    } finally { setCarregandoDetalhe(false) }
  }

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta informação? Esta ação não pode ser desfeita.')) return
    const res = await fetch(`/api/solicitacoes/${solicitacaoId}/informacoes/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) { alert(json.error ?? 'Erro ao excluir'); return }
    setSelected(null)
    setReloadKey(k => k + 1)
  }

  // ── Detalhe (substitui a tabela) ──────────────────────────────────────────
  if (selected) {
    const cfg = (selected.tipo && TIPO_INTERACAO_MAP[selected.tipo]) || FALLBACK
    const podeExcluir = canSupervise || (userId != null && selected.created_by === userId)
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900">
            <IconBack className="w-4 h-4" /> Voltar
          </button>
          {podeExcluir && (
            <button onClick={() => excluir(selected.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700">
              <IconTrash className="w-3.5 h-3.5" /> Excluir
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          {selected.codigo && <span className="text-[15px] font-bold text-green-primary">{selected.codigo}</span>}
          <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5" style={{ color: cfg.cor, backgroundColor: cfg.corBg }}>{cfg.label}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <Campo label="Data do evento" valor={formatDate(selected.data)} />
          <Campo label="Registrado por" valor={selected.autor} />
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
          <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.comentario}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Anexos</p>
          {selected.anexos.length === 0 ? (
            <p className="text-[11px] text-gray-400">Nenhum anexo registrado para esta informação.</p>
          ) : (
            <div className="space-y-1.5">
              {selected.anexos.map(a => {
                const Icon = anexoIcon(a.tipo)
                return (
                  <div key={a.id} className="flex items-center gap-2 border border-gray-200 rounded-md px-2.5 py-1.5">
                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-[11px] text-gray-700 truncate flex-1">{a.nome}</span>
                    <a href={a.url} download={a.nome} className="text-gray-400 hover:text-green-primary shrink-0" title="Baixar">
                      <IconDownload className="w-4 h-4" />
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Cabeçalho da aba: botão + Nova Informação */}
      {canCreate && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setModalOpen(true)} className="bg-green-primary hover:bg-green-dark text-white text-[12px] font-semibold rounded px-3 py-1.5 transition-colors">
            + Nova Informação
          </button>
        </div>
      )}

      {/* Busca */}
      <div className="relative mb-1.5">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por código, palavra-chave..."
          className="w-full pl-9 pr-3 py-2 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-green-primary"
        />
      </div>
      {(debouncedQ || periodo !== 'all' || autor || tipo) && (
        <p className="text-[10px] text-gray-500 mb-2">
          {total} {total === 1 ? 'resultado encontrado' : 'resultados encontrados'}{debouncedQ ? ` para “${debouncedQ}”` : ''}
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-3">
        <Select label="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} />
        <Select label="Autor" value={autor} onChange={setAutor}
          options={[{ value: '', label: 'Todos' }, ...autores.map(a => ({ value: String(a.id), label: a.nome }))]} />
        <Select label="Tipo de informação" value={tipo} onChange={setTipo}
          options={[{ value: '', label: 'Todos os tipos' }, ...TIPOS_INTERACAO.map(t => ({ value: t.value, label: t.label }))]} />
        <button onClick={limparFiltros} className="text-[12px] font-semibold text-green-primary hover:underline md:mb-1.5 self-start md:self-auto">
          Limpar filtros
        </button>
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-center text-[11px] text-gray-400 py-8">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
          <IconInbox className="w-8 h-8" />
          <p className="text-[11px]">Nenhuma informação encontrada com os filtros aplicados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: 720 }}>
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-gray-50 z-10">CÓDIGO</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">DATA</th>
                <th className="text-left font-semibold px-3 py-2">TIPO</th>
                <th className="text-left font-semibold px-3 py-2">DESCRIÇÃO</th>
                <th className="text-left font-semibold px-3 py-2">AUTOR</th>
                <th className="text-left font-semibold px-3 py-2">ANEXOS</th>
                <th className="text-left font-semibold px-3 py-2">DETALHES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((info) => {
                const cfg = (info.tipo && TIPO_INTERACAO_MAP[info.tipo]) || FALLBACK
                return (
                  <tr key={info.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 font-bold text-green-primary whitespace-nowrap">{info.codigo ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(info.data)}</td>
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5 whitespace-nowrap" style={{ color: cfg.cor, backgroundColor: cfg.corBg }}>{cfg.label}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[280px]" title={info.comentario}>
                      {highlight(trunc(info.comentario), debouncedQ)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{info.autor}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {info.anexosCount > 0 ? <span className="inline-flex items-center gap-1"><IconClip className="w-3.5 h-3.5" />{info.anexosCount}</span> : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => verDetalhe(info.id)} disabled={carregandoDetalhe} className="inline-flex items-center gap-1 text-green-primary font-semibold hover:underline disabled:opacity-50">
                        <IconEye className="w-3.5 h-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <RegistrarInfoModal
          open
          onClose={() => setModalOpen(false)}
          onSuccess={() => { limparFiltros(); setReloadKey(k => k + 1) }}
          solicitacaoId={solicitacaoId}
          numero={numero}
          proximoCodigo={proximoCodigo}
        />
      )}
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[12px] text-gray-700">{valor}</p>
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1 md:min-w-[150px]">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-[12px] text-gray-700 bg-white focus:outline-none focus:border-green-primary">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
