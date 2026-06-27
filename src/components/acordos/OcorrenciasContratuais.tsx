'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import {
  TIPOS_OCORRENCIA, TIPO_OCORRENCIA_LABEL,
  RESPONSABILIDADES, RESPONSABILIDADE_MAP,
  IMPACTO_OCORRENCIA_LABEL, PERIODOS,
} from '@/lib/ocorrencias'
import { NovaOcorrenciaModal } from '@/components/forms/NovaOcorrenciaModal'

interface Anexo { id: number; nome: string; tipo: string; url: string; tamanho: number | null }
interface Ocorrencia {
  id: number; codigo: string; tipo: string; data: string
  responsabilidade: string; impacto: string[]; descricao: string
  data_notificacao_cliente: string | null
  created_by: number; autor: string; created_at: string; anexos: Anexo[]
}
interface Responsavel { id: number; nome: string }

interface Props {
  contratoId: number
  numero: string
  subtitulo: string
  canCreate: boolean
  userId: number | null
  canSupervise: boolean
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
const IconPdf = svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" /></>)
const IconImage = svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>)

function anexoIcon(tipo: string) {
  if (/pdf/i.test(tipo)) return IconPdf
  if (/image|png|jpe?g|gif|webp/i.test(tipo)) return IconImage
  return IconPdf
}

export function OcorrenciasContratuais({ contratoId, numero, subtitulo, canCreate, userId, canSupervise }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [periodo, setPeriodo] = useState('all')
  const [responsavel, setResponsavel] = useState('')
  const [tipo, setTipo] = useState('')
  const [responsabilidade, setResponsabilidade] = useState('') // chip (vazio = Todos)
  const [items, setItems] = useState<Ocorrencia[]>([])
  const [total, setTotal] = useState(0)
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [proximoCodigo, setProximoCodigo] = useState('OC-0001')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ocorrencia | null>(null)
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
    if (responsavel) p.set('responsavel', responsavel)
    if (responsabilidade) p.set('responsabilidade', responsabilidade)
    if (tipo) p.set('tipo', tipo)
    fetch(`/api/acordos/contratos/${contratoId}/ocorrencias?${p.toString()}`)
      .then(r => r.json())
      .then(j => {
        if (!ativo || j.error) return
        setItems(j.data.items); setTotal(j.data.total); setResponsaveis(j.data.responsaveis)
        if (j.data.proximoCodigo) setProximoCodigo(j.data.proximoCodigo)
      })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [contratoId, debouncedQ, periodo, responsavel, responsabilidade, tipo, reloadKey])

  const limparFiltros = () => {
    setQ(''); setPeriodo('all'); setResponsavel(''); setTipo(''); setResponsabilidade('')
  }

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta ocorrência? Esta ação não pode ser desfeita.')) return
    const res = await fetch(`/api/acordos/contratos/${contratoId}/ocorrencias/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) { alert(json.error ?? 'Erro ao excluir'); return }
    setSelected(null)
    setReloadKey(k => k + 1)
  }


  // ── Detalhe (substitui a tabela) ──────────────────────────────────────────
  if (selected) {
    const resp = RESPONSABILIDADE_MAP[selected.responsabilidade]
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
          <span className="text-[15px] font-bold text-green-primary">{selected.codigo}</span>
          <span className="text-[13px] text-gray-700">{TIPO_OCORRENCIA_LABEL[selected.tipo] ?? selected.tipo}</span>
          {resp && (
            <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5" style={{ color: resp.cor, backgroundColor: resp.corBg }}>
              {resp.label}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <Campo label="Data do evento" valor={formatDate(selected.data)} />
          <Campo label="Registrado por" valor={selected.autor} />
          {selected.data_notificacao_cliente && (
            <Campo label="Notificação ao cliente" valor={formatDate(selected.data_notificacao_cliente)} />
          )}
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
          <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.descricao}</p>
        </div>

        {selected.impacto.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Impactos</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.impacto.map(imp => (
                <span key={imp} className="text-[10px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                  {IMPACTO_OCORRENCIA_LABEL[imp] ?? imp}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Anexos</p>
          {selected.anexos.length === 0 ? (
            <p className="text-[11px] text-gray-400">Nenhum anexo registrado para esta ocorrência.</p>
          ) : (
            <div className="space-y-1.5">
              {selected.anexos.map(a => {
                const Icon = anexoIcon(a.tipo)
                return (
                  <div key={a.id} className="flex items-center gap-2 border border-gray-200 rounded-md px-2.5 py-1.5">
                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-[11px] text-gray-700 truncate flex-1">{a.nome}</span>
                    <a href={a.url} download className="text-gray-400 hover:text-green-primary shrink-0" title="Baixar">
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
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-gray-800">Ocorrências contratuais</h3>
          <p className="text-[11px] text-gray-500 truncate">{subtitulo}</p>
        </div>
        {canCreate && (
          <button onClick={() => setModalOpen(true)} className="shrink-0 bg-green-primary hover:bg-green-dark text-white text-[12px] font-semibold rounded px-3 py-1.5 transition-colors">
            + Nova Ocorrência
          </button>
        )}
      </div>

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
      {(debouncedQ || periodo !== 'all' || responsavel || tipo || responsabilidade) && (
        <p className="text-[10px] text-gray-500 mb-2">
          {total} {total === 1 ? 'resultado encontrado' : 'resultados encontrados'}{debouncedQ ? ` para “${debouncedQ}”` : ''}
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-3">
        <Select label="Período" value={periodo} onChange={setPeriodo}
          options={PERIODOS.map(p => ({ value: p.value, label: p.label }))} />
        <Select label="Responsável" value={responsavel} onChange={setResponsavel}
          options={[{ value: '', label: 'Todos' }, ...responsaveis.map(r => ({ value: String(r.id), label: r.nome }))]} />
        <Select label="Tipo de ocorrência" value={tipo} onChange={setTipo}
          options={[{ value: '', label: 'Todos os tipos' }, ...TIPOS_OCORRENCIA.map(t => ({ value: t.value, label: t.label }))]} />
        <button onClick={limparFiltros} className="text-[12px] font-semibold text-green-primary hover:underline md:mb-1.5 self-start md:self-auto">
          Limpar filtros
        </button>
      </div>

      {/* Chips de responsabilidade */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-[10px] text-gray-400 mr-1">Responsabilidade:</span>
        {[{ value: '', label: 'Todos' }, ...RESPONSABILIDADES.map(r => ({ value: r.value, label: r.label }))].map((r) => (
          <button
            key={r.value || 'all'}
            onClick={() => setResponsabilidade(r.value)}
            className={
              'text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition-colors ' +
              (responsabilidade === r.value
                ? 'bg-gray-800 border-gray-800 text-white'
                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50')
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-center text-[11px] text-gray-400 py-8">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
          <IconInbox className="w-8 h-8" />
          <p className="text-[11px]">Nenhuma ocorrência encontrada com os filtros aplicados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: 760 }}>
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-gray-50 z-10">CÓDIGO</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">DATA</th>
                <th className="text-left font-semibold px-3 py-2">TIPO</th>
                <th className="text-left font-semibold px-3 py-2">RESPONSABILIDADE</th>
                <th className="text-left font-semibold px-3 py-2">IMPACTOS</th>
                <th className="text-left font-semibold px-3 py-2">ANEXOS</th>
                <th className="text-left font-semibold px-3 py-2">DETALHES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((o) => {
                const resp = RESPONSABILIDADE_MAP[o.responsabilidade]
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 font-bold text-green-primary whitespace-nowrap">{o.codigo}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(o.data)}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{TIPO_OCORRENCIA_LABEL[o.tipo] ?? o.tipo}</td>
                    <td className="px-3 py-2">
                      {resp && (
                        <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5 whitespace-nowrap" style={{ color: resp.cor, backgroundColor: resp.corBg }}>
                          {resp.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {o.impacto.map(imp => (
                          <span key={imp} className="text-[9px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                            {IMPACTO_OCORRENCIA_LABEL[imp] ?? imp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {o.anexos.length > 0 ? (
                        <span className="inline-flex items-center gap-1"><IconClip className="w-3.5 h-3.5" />{o.anexos.length}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setSelected(o)} className="inline-flex items-center gap-1 text-green-primary font-semibold hover:underline">
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
        <NovaOcorrenciaModal
          open
          onClose={() => setModalOpen(false)}
          onSuccess={() => setReloadKey(k => k + 1)}
          contratoId={contratoId}
          numero={numero}
          subtitulo={subtitulo}
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-[12px] text-gray-700 bg-white focus:outline-none focus:border-green-primary"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
