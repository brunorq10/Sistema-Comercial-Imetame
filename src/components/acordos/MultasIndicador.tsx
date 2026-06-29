'use client'

import { Fragment, useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TIPOS_MULTA, TIPO_MULTA_MAP, TIPO_MULTA_LABEL } from '@/lib/multas'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'

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
  motivo_inativacao: string | null
  autor: string
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
  const [clienteId, setClienteId] = useState<string[]>([])
  const [cidade, setCidade] = useState<string[]>([])
  const [responsavel, setResponsavel] = useState<string[]>([])
  const [tipo, setTipo] = useState<string[]>([])
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [expandida, setExpandida] = useState<number | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    const p = new URLSearchParams()
    if (clienteId.length) p.set('cliente_id', clienteId.join(','))
    if (cidade.length) p.set('cidade', cidade.join(','))
    if (responsavel.length) p.set('responsavel', responsavel.join(','))
    if (tipo.length) p.set('tipo', tipo.join(','))
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
  }, [clienteId, cidade, responsavel, tipo, de, ate])

  const total = items.reduce((s, m) => s + m.valor_total, 0)
  const limpar = () => { setClienteId([]); setCidade([]); setResponsavel([]); setTipo([]); setDe(''); setAte('') }

  // Resumo por tipo
  const porTipo = TIPOS_MULTA.map((t) => {
    const ds = items.filter((m) => m.tipo === t.value)
    return { ...t, count: ds.length, valor: ds.reduce((s, m) => s + m.valor_total, 0) }
  })

  const exportarExcel = () => {
    const rows = items.map((m) => ({
      Tipo: TIPO_MULTA_LABEL[m.tipo] ?? m.tipo,
      Índice: m.contrato_indice,
      Cliente: m.cliente_nome,
      'Cidade/UF': [m.cidade, m.estado].filter(Boolean).join(' / '),
      Responsável: m.responsavel_nome,
      Descrição: m.descricao,
      'Data ocorrência': formatDate(m.data_ocorrencia),
      'Data notificação': m.data_notificacao_cliente ? formatDate(m.data_notificacao_cliente) : '',
      'Data desconto': m.data_desconto ? formatDate(m.data_desconto) : '',
      Valor: m.valor_total,
      Status: m.ativa ? 'Ativa' : 'Inativa',
      'Lançado por': m.autor,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Multas')
    XLSX.writeFile(wb, `multas-penalidades-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2.5 items-end mb-3">
        <div className="min-w-[150px] flex-1">
          <label className={lblCls}>Cliente</label>
          <SearchableMultiSelect values={clienteId} onChange={setClienteId} options={opcoes.clientes.map((c) => ({ value: String(c.id), label: c.nome }))} />
        </div>
        <div className="min-w-[120px]">
          <label className={lblCls}>Cidade</label>
          <SearchableMultiSelect values={cidade} onChange={setCidade} options={opcoes.cidades.map((c) => ({ value: c, label: c }))} emptyLabel="Todas" />
        </div>
        <div className="min-w-[140px]">
          <label className={lblCls}>Responsável</label>
          <SearchableMultiSelect values={responsavel} onChange={setResponsavel} options={opcoes.responsaveis.map((r) => ({ value: String(r.id), label: r.nome }))} />
        </div>
        <div className="min-w-[120px]">
          <label className={lblCls}>Tipo</label>
          <SearchableMultiSelect values={tipo} onChange={setTipo} options={TIPOS_MULTA.map((t) => ({ value: t.value, label: t.label }))} emptyLabel="Todos" />
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
        <button onClick={exportarExcel} disabled={items.length === 0} className="bg-green-primary hover:bg-green-dark text-white rounded px-3 py-[6px] text-[11px] font-semibold transition-colors disabled:opacity-50">⭳ Exportar Excel</button>
      </div>

      {/* Cards de resumo por tipo + total */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-3">
        {porTipo.map((t) => (
          <div key={t.value} className="rounded-lg border p-2.5" style={{ borderColor: t.corBg, backgroundColor: t.corBg }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.cor }}>{t.label}</p>
            <p className="text-[16px] font-bold text-gray-800 leading-tight">{t.count}</p>
            <p className="text-[10px] text-gray-500">{formatCurrency(t.valor)}</p>
          </div>
        ))}
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Valor total</p>
          <p className="text-[16px] font-bold text-slate-800 leading-tight">{formatCurrency(total)}</p>
          <p className="text-[10px] text-gray-500">{items.length} lançamento(s)</p>
        </div>
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
                const aberta = expandida === m.id
                return (
                  <Fragment key={m.id}>
                    <tr onClick={() => setExpandida(aberta ? null : m.id)} className={`cursor-pointer ${m.ativa ? 'hover:bg-gray-50' : 'bg-gray-50/50 text-gray-400'}`}>
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
                    {aberta && (
                      <tr className="bg-slate-50">
                        <td colSpan={11} className="px-4 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                            <Det label="Tipo" valor={cfg?.label ?? m.tipo} />
                            <Det label="Contrato" valor={m.contrato_indice} />
                            <Det label="Cliente" valor={m.cliente_nome} />
                            <Det label="Cidade/UF" valor={[m.cidade, m.estado].filter(Boolean).join(' / ') || '—'} />
                            <Det label="Responsável" valor={m.responsavel_nome} />
                            <Det label="Data da ocorrência" valor={formatDate(m.data_ocorrencia)} />
                            <Det label="Notificação ao cliente" valor={m.data_notificacao_cliente ? formatDate(m.data_notificacao_cliente) : '—'} />
                            <Det label="Data do desconto" valor={m.data_desconto ? formatDate(m.data_desconto) : '—'} />
                            <Det label="Valor total" valor={formatCurrency(m.valor_total)} />
                            <Det label="Lançado por" valor={m.autor} />
                            {!m.ativa && <Det label="Motivo da inativação" valor={m.motivo_inativacao ?? '—'} />}
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Descrição</p>
                            <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{m.descricao}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

function Det({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[11px] text-gray-700">{valor}</p>
    </div>
  )
}
