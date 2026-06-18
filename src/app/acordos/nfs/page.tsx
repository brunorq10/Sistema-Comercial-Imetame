'use client'

import { useCallback, useEffect, useState } from 'react'
import { NFsTable } from '@/components/tables/NFsTable'
import { Field, Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { formatCurrency } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import type { NFListItem } from '@/types'

type FiltroVenc = 'todas' | 'vencidas' | 'proximas' | 'ok' | 'inativas'

interface Contagens {
  total: number
  vencidas: number
  proximas: number
  ok: number
  inativas: number
  totalValor: number
  totalVencidas: number
}

export default function RegistroNFsPage() {
  const { canLancarNF } = usePermissions()

  const [items, setItems] = useState<NFListItem[]>([])
  const [contagens, setContagens] = useState<Contagens>({ total: 0, vencidas: 0, proximas: 0, ok: 0, inativas: 0, totalValor: 0, totalVencidas: 0 })
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc>('todas')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [vencDe, setVencDe] = useState('')
  const [vencAte, setVencAte] = useState('')

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    if (status) params.set('status', status)
    if (ano) params.set('ano', ano)
    if (vencDe) params.set('vencimento_de', vencDe)
    if (vencAte) params.set('vencimento_ate', vencAte)
    return params
  }, [busca, status, ano, vencDe, vencAte])

  const fetchContagens = useCallback(async () => {
    const params = buildParams()
    params.set('modo', 'contagens')
    const res = await fetch(`/api/nfs?${params}`)
    const json = await res.json()
    if (json.data) setContagens(json.data)
  }, [buildParams])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams()
      if (filtroVenc !== 'todas') params.set('venc_status', filtroVenc)
      params.set('page', String(page))
      const res = await fetch(`/api/nfs?${params}`)
      const json = await res.json()
      setItems(json.data ?? [])
      setTotal(json.total ?? 0)
      setPages(json.pages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [buildParams, filtroVenc, page])

  useEffect(() => { fetchContagens() }, [fetchContagens])
  useEffect(() => { fetchData() }, [fetchData])

  const handleFiltroVenc = (f: FiltroVenc) => {
    setFiltroVenc(f)
    setPage(1)
  }

  const handleToggleAtiva = useCallback(async (nf: NFListItem, motivo?: string) => {
    const body = nf.ativa
      ? { ativa: false, motivo_inativacao: motivo }
      : { ativa: true }
    const res = await fetch(`/api/nfs/${nf.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (json.error) { setPageError(json.error); return }
    fetchData()
    fetchContagens()
  }, [fetchData, fetchContagens])

  const limpar = () => {
    setBusca(''); setStatus(''); setAno(String(new Date().getFullYear()))
    setVencDe(''); setVencAte('')
    setFiltroVenc('todas'); setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3 flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError(null)} className="ml-2 text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        )}

        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-bold">Registro de Notas Fiscais</h2>
          <span className="text-[11px] text-gray-400">{contagens.total} NF{contagens.total !== 1 ? 's' : ''}</span>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">
          Visão consolidada de todas as NFs. Colunas NF Nº, Acordo e Cliente são fixas.
        </p>

        {/* Indicadores filtráveis */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          <IndicadorCard label="Total de NFs" valor={contagens.total} sub={formatCurrency(contagens.totalValor)}
            variant="green" active={filtroVenc === 'todas'} onClick={() => handleFiltroVenc('todas')} />
          <IndicadorCard label="Vencidas" valor={contagens.vencidas} sub={formatCurrency(contagens.totalVencidas)}
            variant="red" active={filtroVenc === 'vencidas'} onClick={() => handleFiltroVenc('vencidas')} />
          <IndicadorCard label="Vencem em 30 dias" valor={contagens.proximas} sub="atenção"
            variant="amber" active={filtroVenc === 'proximas'} onClick={() => handleFiltroVenc('proximas')} />
          <IndicadorCard label="Em dia" valor={contagens.ok} sub="venc. > 30 dias"
            variant="blue" active={filtroVenc === 'ok'} onClick={() => handleFiltroVenc('ok')} />
          <IndicadorCard label="Inativas" valor={contagens.inativas} sub="fora do faturamento"
            variant="gray" active={filtroVenc === 'inativas'} onClick={() => handleFiltroVenc('inativas')} />
        </div>

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
          <Field label="Busca (NF, acordo ou cliente)" className="min-w-[180px] flex-1">
            <Input placeholder="000123 ou ACD-0001 ou Petrobras..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </Field>
          <Field label="Status" className="min-w-[110px]">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              <option value="ativa">Ativas</option>
              <option value="inativa">Inativas</option>
            </Select>
          </Field>
          <Field label="Ano do acordo" className="min-w-[80px]">
            <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2026" />
          </Field>
          <Field label="Vencimento — de" className="min-w-[120px]">
            <Input type="date" value={vencDe} onChange={(e) => setVencDe(e.target.value)} />
          </Field>
          <Field label="até" className="min-w-[120px]">
            <Input type="date" value={vencAte} onChange={(e) => setVencAte(e.target.value)} />
          </Field>
          <div className="flex-shrink-0">
            <button
              onClick={limpar}
              className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
            >
              ✕ Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela com scroll */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <NFsTable
                data={items}
                onToggleAtiva={handleToggleAtiva}
                canInativar={canLancarNF}
              />
            </div>
            <Pagination page={page} pages={pages} total={total} limit={10} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Indicador Card ───────────────────────────────────────────────────────────

interface IndicadorCardProps {
  label: string
  valor: number
  sub: string
  variant: 'green' | 'blue' | 'red' | 'amber' | 'gray'
  active: boolean
  onClick: () => void
}

function IndicadorCard({ label, valor, sub, variant, active, onClick }: IndicadorCardProps) {
  const borderColor = {
    green: 'border-l-green-primary',
    blue: 'border-l-[#1565C0]',
    red: 'border-l-[#C62828]',
    amber: 'border-l-[#FB8C00]',
    gray: 'border-l-gray-400',
  }[variant]

  const activeStyle = {
    green: 'bg-green-light border-green-primary shadow-[0_0_0_2px_rgba(46,125,50,0.2)]',
    blue: 'bg-[#E3F2FD] border-[#1565C0] shadow-[0_0_0_2px_rgba(21,101,192,0.2)]',
    red: 'bg-[#FFEBEE] border-[#C62828] shadow-[0_0_0_2px_rgba(198,40,40,0.2)]',
    amber: 'bg-[#FFF3E0] border-[#FB8C00] shadow-[0_0_0_2px_rgba(251,140,0,0.2)]',
    gray: 'bg-gray-100 border-gray-400 shadow-[0_0_0_2px_rgba(100,100,100,0.15)]',
  }[variant]

  const valorColor = {
    green: 'text-green-dark',
    blue: 'text-[#1565C0]',
    red: 'text-[#C62828]',
    amber: 'text-[#E65100]',
    gray: 'text-gray-500',
  }[variant]

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-200 rounded-md p-3 cursor-pointer border-l-[3px] transition-all select-none',
        borderColor,
        active && activeStyle,
      )}
    >
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.04em] mb-1">{label}</p>
      <p className={cn('text-[20px] font-bold', valorColor)}>{valor}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
    </div>
  )
}
