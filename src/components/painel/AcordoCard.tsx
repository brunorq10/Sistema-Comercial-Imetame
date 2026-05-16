'use client'

import { formatDate, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface AcordoPainelItem {
  id: number
  numero: string
  created_at: string
  cliente: { id: number; nome: string }
  descricao: string | null
  valor_total: number
  valor_anos_seguintes: number | null
  ano: number
  status: 'ATIVO' | 'ENCERRADO' | 'CANCELADO'
  data_inicio: string | null
  data_fim: string | null
  total_faturado: number
  perc_executado: number
  saldo: number
  qt_nfs: number
  qt_nfs_ativas: number
  qt_vencidas: number
  qt_proximas_30d: number
  proximo_vencimento: string | null
  total_nfs: number
}

interface Props {
  item: AcordoPainelItem
  onVerNFs: (item: AcordoPainelItem) => void
  onLancarNF: (item: AcordoPainelItem) => void
  canLancarNF: boolean
}

export function AcordoCard({ item, onVerNFs, onLancarNF, canLancarNF }: Props) {
  const temVencidas = item.qt_vencidas > 0
  const temProximas = item.qt_proximas_30d > 0
  const encerrado = item.status === 'ENCERRADO'

  const borderColor = temVencidas
    ? 'border-l-[#C62828]'
    : temProximas
    ? 'border-l-[#FB8C00]'
    : 'border-l-green-primary'

  return (
    <div className={cn('bg-white border rounded-md p-3.5 mb-2.5 border-l-[3px]', borderColor)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold">{item.numero} — {item.cliente.nome}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8EAF6] text-[#283593]">
            {item.ano}
          </span>
          {encerrado && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Encerrado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {temVencidas && (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFEBEE] text-[#C62828]">
              {item.qt_vencidas} NF{item.qt_vencidas > 1 ? 's' : ''} vencida{item.qt_vencidas > 1 ? 's' : ''} ⚠
            </span>
          )}
          {temProximas && (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100]">
              {item.qt_proximas_30d} vencem em 30 dias
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-5 gap-2 text-[11px] mb-2.5">
        <CardField label="Valor Contrato">
          <span className="font-semibold">{formatCurrency(item.valor_total)}</span>
        </CardField>

        <CardField label="Faturado (NFs ativas)">
          <span className="text-auto-value font-semibold">{formatCurrency(item.total_faturado)}</span>
        </CardField>

        <CardField label="% Executado">
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-14 bg-gray-200 rounded-full h-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full',
                  item.perc_executado > 100
                    ? 'bg-red-500'
                    : item.perc_executado >= 80
                    ? 'bg-amber-400'
                    : 'bg-green-primary',
                )}
                style={{ width: `${Math.min(item.perc_executado, 100)}%` }}
              />
            </div>
            <span className={cn(
              'text-[10px] font-bold',
              item.perc_executado > 100 ? 'text-red-600' : 'text-gray-600',
            )}>
              {item.perc_executado}%
            </span>
          </div>
        </CardField>

        <CardField label="Saldo">
          <span className={cn('font-semibold', item.saldo < 0 ? 'text-red-700' : 'text-green-primary')}>
            {formatCurrency(item.saldo)}
          </span>
        </CardField>

        <CardField label="NFs">
          <span>{item.qt_nfs_ativas} ativa{item.qt_nfs_ativas !== 1 ? 's' : ''}</span>
          {item.qt_nfs > item.qt_nfs_ativas && (
            <span className="text-gray-400 ml-1">({item.qt_nfs} total)</span>
          )}
        </CardField>

        {item.descricao && (
          <CardField label="Descrição" className="col-span-3">
            {item.descricao}
          </CardField>
        )}

        <CardField label="Próximo vencimento" className={item.descricao ? 'col-span-2' : 'col-span-3'}>
          {item.proximo_vencimento ? (
            <span className={temVencidas ? 'text-red-700 font-semibold' : temProximas ? 'text-[#E65100] font-semibold' : ''}>
              {formatDate(item.proximo_vencimento)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </CardField>

        {item.valor_anos_seguintes != null && (
          <CardField label="Prev. anos seguintes" className="col-span-2">
            <span className="text-[#6A1B9A] font-semibold">{formatCurrency(item.valor_anos_seguintes)}</span>
          </CardField>
        )}

        <CardField label="Vigência" className={item.valor_anos_seguintes != null ? 'col-span-3' : 'col-span-5'}>
          {item.data_inicio || item.data_fim
            ? `${formatDate(item.data_inicio)} → ${formatDate(item.data_fim)}`
            : '—'}
        </CardField>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => onVerNFs(item)}>
          Ver NFs ({item.qt_nfs})
        </Button>
        {canLancarNF && !encerrado && (
          <Button size="sm" onClick={() => onLancarNF(item)}>
            + Lançar NF
          </Button>
        )}
      </div>
    </div>
  )
}

function CardField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-[9px] text-gray-400 uppercase tracking-[0.04em]">{label}</p>
      <p className="text-[11px] font-medium mt-0.5">{children}</p>
    </div>
  )
}
