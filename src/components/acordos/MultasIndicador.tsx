'use client'

import { useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TIPO_MULTA_MAP } from '@/lib/multas'

interface MultaItem {
  id: number
  contrato_indice: string
  cliente_nome: string
  cidade: string | null
  estado: string | null
  responsavel_nome: string
  tipo: string
  descricao: string
  data_ocorrencia: string
  data_notificacao_cliente: string | null
  data_desconto: string | null
  valor_total: number
  ativa: boolean
}
interface Opcoes {
  clientes: { id: number; nome: string }[]
  cidades: string[]
  responsaveis: { id: number; nome: string }[]
}

const selCls = 'border border-gray-300 rounded-md px-2 py-1.5 text-[12px] text-gray-700 bg-white focus:outline-none focus:border-green-primary'
const lblCls = 'block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-[0.04em]'

export function MultasIndicador() {
  const [items, setItems] = useState<MultaItem[]>([])
  const [opcoes, setOpcoes] = useState<Opcoes>({ clientes: [], cidades: [], responsaveis: [] })
  const [loading, setLoading] = useState(true)
  const [clienteId, setClienteId] = useState('')
  const [cidade, setCidade] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  useEffect(() => {
    let ativo = true
    setLoading(true)
    const p = new URLSearchParams()
    if (clienteId) p.set('cliente_id', clienteId)
    if (cidade) p.set('cidade', cidade)
    if (responsavel) p.set('responsavel', responsavel)
    if (de) p.set('de', de)
    if (ate) p.set('ate', ate)
    fetch(`/api/faturamento/multas?${p.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (!ativo || j.error) return
        setItems(j.data.items ?? [])
        if (j.data.opcoes) setOpcoes(j.data.opcoes)
      })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [clienteId, cidade, responsavel, de, ate])

  const total = items.reduce((s, m) => s + m.valor_total, 0)
  const limpar = () => { setClienteId(''); setCidade(''); setResponsavel(''); setDe(''); setAte('') }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2.5 items-end mb-3">
        <div className="min-w-[160px] flex-1">
          <label className={lblCls}>Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`${selCls} w-full`}>
            <option value="">Todos</option>
            {opcoes.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="min-w-[130px]">
          <label className={lblCls}>Cidade</label>
          <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={`${selCls} w-full`}>
            <option value="">Todas</option>
            {opcoes.cidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className={lblCls}>Responsável</label>
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={`${selCls} w-full`}>
            <option value="">Todos</option>
            {opcoes.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className={lblCls}>Período (de)</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${selCls} w-full`} />
        </div>
        <div className="min-w-[120px]">
          <label className={lblCls}>Período (até)</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${selCls} w-full`} />
        </div>
        <button onClick={limpar} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[6px] text-[11px] hover:bg-gray-100 transition-colors">✕ Limpar</button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8 text-[12px]">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-[12px]">Nenhuma multa/penalidade encontrada com os filtros aplicados.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: 1080 }}>
            <thead>
              <tr className="bg-slate-50 text-gray-500">
                <th className="text-left font-semibold px-3 py-2">Tipo</th>
                <th className="text-left font-semibold px-3 py-2">Índice</th>
                <th className="text-left font-semibold px-3 py-2">Cliente</th>
                <th className="text-left font-semibold px-3 py-2">Cidade/UF</th>
                <th className="text-left font-semibold px-3 py-2">Responsável</th>
                <th className="text-left font-semibold px-3 py-2">Descrição</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Dt. Ocorrência</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Dt. Notificação</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Dt. Desconto</th>
                <th className="text-right font-semibold px-3 py-2">Valor</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((m) => {
                const cfg = TIPO_MULTA_MAP[m.tipo]
                return (
                  <tr key={m.id} className={m.ativa ? 'hover:bg-gray-50' : 'bg-gray-50/50 text-gray-400'}>
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5 whitespace-nowrap" style={{ color: cfg?.cor ?? '#6B7280', backgroundColor: cfg?.corBg ?? '#F3F4F6' }}>{cfg?.label ?? m.tipo}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-green-dark whitespace-nowrap">{m.contrato_indice}</td>
                    <td className="px-3 py-2">{m.cliente_nome}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{[m.cidade, m.estado].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.responsavel_nome}</td>
                    <td className="px-3 py-2 max-w-[240px] truncate" title={m.descricao}>{m.descricao}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.data_ocorrencia)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.data_notificacao_cliente ? formatDate(m.data_notificacao_cliente) : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.data_desconto ? formatDate(m.data_desconto) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${m.ativa ? 'text-auto-value' : ''}`}>{formatCurrency(m.valor_total)}</td>
                    <td className="px-3 py-2">
                      {m.ativa
                        ? <span className="text-[9px] font-semibold text-green-700 bg-green-50 rounded-full px-1.5 py-0.5">Ativa</span>
                        : <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">Inativa</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-green-primary text-white font-bold text-[11px]">
                <td className="px-3 py-2" colSpan={9}>Total ({items.length})</td>
                <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
