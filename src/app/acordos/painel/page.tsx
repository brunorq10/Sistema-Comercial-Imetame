'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AcordoCard, type AcordoPainelItem } from '@/components/painel/AcordoCard'
import { LancarNFModal } from '@/components/forms/LancarNFModal'
import { NFsListModal } from '@/components/forms/NFsListModal'
import { Field, Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import type { AcordoListItem } from '@/types'

type FiltroIndicador = 'todos' | 'vencidas' | 'proximas' | 'ok'

export default function PainelAcordosPage() {
  const { canLancarNF } = usePermissions()

  const [items, setItems] = useState<AcordoPainelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroIndicador>('todos')

  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [busca, setBusca] = useState('')

  const [modalNFs, setModalNFs] = useState<AcordoPainelItem | null>(null)
  const [modalLancarNF, setModalLancarNF] = useState<AcordoPainelItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (ano) params.set('ano', ano)
      if (busca) params.set('busca', busca)
      const res = await fetch(`/api/painel/acordos?${params.toString()}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [ano, busca])

  useEffect(() => { fetchData() }, [fetchData])

  const contagens = useMemo(() => ({
    todos: items.length,
    vencidas: items.filter((i) => i.qt_vencidas > 0).length,
    proximas: items.filter((i) => i.qt_proximas_30d > 0 && i.qt_vencidas === 0).length,
    ok: items.filter((i) => i.qt_vencidas === 0 && i.qt_proximas_30d === 0).length,
    totalContratos: items.reduce((acc, i) => acc + i.valor_total, 0),
    totalFaturado: items.reduce((acc, i) => acc + i.total_faturado, 0),
    totalSaldo: items.reduce((acc, i) => acc + i.saldo, 0),
    totalNfsVencidas: items.reduce((acc, i) => acc + i.qt_vencidas, 0),
  }), [items])

  const itemsFiltrados = useMemo(() => {
    if (filtroAtivo === 'vencidas') return items.filter((i) => i.qt_vencidas > 0)
    if (filtroAtivo === 'proximas') return items.filter((i) => i.qt_proximas_30d > 0 && i.qt_vencidas === 0)
    if (filtroAtivo === 'ok') return items.filter((i) => i.qt_vencidas === 0 && i.qt_proximas_30d === 0)
    return items
  }, [items, filtroAtivo])

  const toAcordoListItem = (item: AcordoPainelItem) => item as unknown as AcordoListItem

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Meu Painel — Acordos</h2>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Visão dos acordos ativos por ano. Clique nos indicadores para filtrar.
      </p>

      {/* Totalizadores */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Contratos</p>
            <p className="text-[15px] font-bold text-green-dark">{formatCurrency(contagens.totalContratos)}</p>
            <p className="text-[10px] text-gray-400">{contagens.todos} acordo{contagens.todos !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Faturado (NFs ativas)</p>
            <p className="text-[15px] font-bold text-auto-value">{formatCurrency(contagens.totalFaturado)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Saldo total</p>
            <p className={`text-[15px] font-bold ${contagens.totalSaldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {formatCurrency(contagens.totalSaldo)}
            </p>
          </div>
          <div className={cn(
            'border rounded-md p-2.5',
            contagens.totalNfsVencidas > 0 ? 'bg-[#FFEBEE] border-red-300' : 'bg-white border-gray-200',
          )}>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">NFs vencidas</p>
            <p className={`text-[15px] font-bold ${contagens.totalNfsVencidas > 0 ? 'text-[#C62828]' : 'text-gray-700'}`}>
              {contagens.totalNfsVencidas}
              {contagens.totalNfsVencidas > 0 ? ' ⚠' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Indicadores filtráveis */}
      <div className="grid grid-cols-4 gap-2.5 mb-3">
        <IndicadorCard
          label="Todos os acordos"
          valor={contagens.todos}
          sub="do ano filtrado"
          variant="green"
          active={filtroAtivo === 'todos'}
          onClick={() => setFiltroAtivo('todos')}
        />
        <IndicadorCard
          label="NFs vencidas"
          valor={contagens.vencidas}
          sub="acordos com NF vencida"
          variant="red"
          active={filtroAtivo === 'vencidas'}
          onClick={() => setFiltroAtivo('vencidas')}
        />
        <IndicadorCard
          label="Vencem em 30 dias"
          valor={contagens.proximas}
          sub="atenção requerida"
          variant="amber"
          active={filtroAtivo === 'proximas'}
          onClick={() => setFiltroAtivo('proximas')}
        />
        <IndicadorCard
          label="Em dia"
          valor={contagens.ok}
          sub="sem pendências"
          variant="blue"
          active={filtroAtivo === 'ok'}
          onClick={() => setFiltroAtivo('ok')}
        />
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Ano" className="min-w-[90px]">
          <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2026" />
        </Field>
        <Field label="Busca (nº, cliente ou descrição)" className="min-w-[200px] flex-1">
          <Input placeholder="ACD-0001 ou Petrobras..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </Field>
        <div className="flex-shrink-0">
          <button
            onClick={() => { setAno(String(new Date().getFullYear())); setBusca('') }}
            className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : itemsFiltrados.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">Nenhum acordo encontrado.</p>
      ) : (
        itemsFiltrados.map((item) => (
          <AcordoCard
            key={item.id}
            item={item}
            onVerNFs={setModalNFs}
            onLancarNF={setModalLancarNF}
            canLancarNF={canLancarNF}
          />
        ))
      )}

      {/* Modais */}
      {modalNFs && (
        <NFsListModal
          open={true}
          onClose={() => setModalNFs(null)}
          acordo={toAcordoListItem(modalNFs)}
          canInativar={canLancarNF}
        />
      )}
      {modalLancarNF && (
        <LancarNFModal
          open={true}
          onClose={() => setModalLancarNF(null)}
          onSuccess={fetchData}
          acordo={toAcordoListItem(modalLancarNF)}
        />
      )}
    </div>
  )
}

// ─── Indicador Card ───────────────────────────────────────────────────────────

interface IndicadorCardProps {
  label: string
  valor: number
  sub: string
  variant: 'green' | 'blue' | 'red' | 'amber'
  active: boolean
  onClick: () => void
}

function IndicadorCard({ label, valor, sub, variant, active, onClick }: IndicadorCardProps) {
  const borderColor = {
    green: 'border-l-green-primary',
    blue: 'border-l-[#1565C0]',
    red: 'border-l-[#C62828]',
    amber: 'border-l-[#FB8C00]',
  }[variant]

  const activeStyle = {
    green: 'bg-green-light border-green-primary shadow-[0_0_0_2px_rgba(46,125,50,0.2)]',
    blue: 'bg-[#E3F2FD] border-[#1565C0] shadow-[0_0_0_2px_rgba(21,101,192,0.2)]',
    red: 'bg-[#FFEBEE] border-[#C62828] shadow-[0_0_0_2px_rgba(198,40,40,0.2)]',
    amber: 'bg-[#FFF3E0] border-[#FB8C00] shadow-[0_0_0_2px_rgba(251,140,0,0.2)]',
  }[variant]

  const valorColor = {
    green: 'text-green-dark',
    blue: 'text-[#1565C0]',
    red: 'text-[#C62828]',
    amber: 'text-[#E65100]',
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
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
