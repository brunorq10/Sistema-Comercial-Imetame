'use client'

import { Badge, ClassificacaoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { CLASSIFICACAO_LABELS, INTERESSE_LABELS } from '@/types'
import type { Classificacao, Interesse } from '@/types'
import { cn } from '@/lib/utils'

export interface PainelItem {
  id: number
  numero: string
  created_at: string
  cliente: string
  cidade: string | null
  estado: string | null
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  prazo_tecnica: string | null
  prazo_comercial: string | null
  visita_tecnica: boolean
  data_visita: string | null
  versao_atual: number
  tecnica_enviada: boolean
  tecnica_nao_aplicavel: boolean
  data_envio_tecnica: string | null
  comercial_enviada: boolean
  comercial_nao_aplicavel: boolean
  data_envio_comercial: string | null
  tecnica_atrasada: boolean
  comercial_atrasada: boolean
  fabricacao_enviada: boolean
  propostas_tecnicas: {
    id: number
    versao: number
    hh_direto: number | null
    hh_indireto: number | null
    hh_total: number | null
    peso_montagem: string | null
    efetivo_pico: number | null
    dias_parada: number | null
    turno: string | null
    finais_de_semana: boolean | null
    data_envio: string | null
  }[]
  propostas_comerciais: {
    id: number
    versao: number
    valor_total: string | null
    valor_terceiros: string | null
    data_envio: string | null
    resultado: string | null
    proposta_tecnica_id: number
  }[]
}

interface Props {
  item: PainelItem
  onRegistrarTecnica: (item: PainelItem) => void
  onRegistrarComercial: (item: PainelItem) => void
  onRegistrarFabricacao: (item: PainelItem) => void
  onRegistrarParada: (item: PainelItem, tab: 'tecnica' | 'comercial') => void
  onRegistrarObra: (item: PainelItem, tab: 'tecnica' | 'comercial') => void
}

export function SolicitacaoCard({ item, onRegistrarTecnica, onRegistrarComercial, onRegistrarFabricacao, onRegistrarParada, onRegistrarObra }: Props) {
  const isFabricacaoType = item.classificacao === 'FABRICACOES' || item.classificacao === 'OLEO_GAS'
  const isParadasType = item.classificacao === 'PARADAS'
  const isObrasType = item.classificacao === 'OBRAS'
  const atrasado = item.tecnica_atrasada || item.comercial_atrasada
  const tecnicaOk = item.tecnica_enviada && !item.comercial_enviada && !item.comercial_atrasada

  const local = [item.cliente, [item.cidade, item.estado].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' — ')

  return (
    <div
      className={cn(
        'bg-white border rounded-md p-3.5 mb-2.5 border-l-[3px]',
        atrasado ? 'border-l-[#C62828]' : tecnicaOk ? 'border-l-[#FB8C00]' : 'border-l-green-primary',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-bold">{item.numero} — {item.cliente}</span>
          <Badge variant="purple">{`Rev${String(item.versao_atual - 1).padStart(2, '0')}`}</Badge>
          {item.classificacao && <ClassificacaoBadge value={item.classificacao} />}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {/* Badge técnica */}
          {item.tecnica_nao_aplicavel ? (
            <Badge variant="gray">Técnica — N/A</Badge>
          ) : item.tecnica_enviada ? (
            <Badge variant="green">Técnica — Enviada ✓</Badge>
          ) : item.tecnica_atrasada ? (
            <Badge variant="red">Técnica — Atrasada ⚠</Badge>
          ) : (
            <Badge variant="blue">Em elaboração</Badge>
          )}
          {/* Badge comercial */}
          {item.comercial_nao_aplicavel ? (
            <Badge variant="gray">Comercial — N/A</Badge>
          ) : item.comercial_enviada ? (
            <Badge variant="green">Comercial — Enviada ✓</Badge>
          ) : item.comercial_atrasada ? (
            <Badge variant="red">Comercial — Atrasada ⚠</Badge>
          ) : item.tecnica_enviada ? (
            <Badge variant="amber">Comercial — Pendente</Badge>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-4 gap-2 text-[11px] mb-2.5">
        <CardField label="Classificação">
          {item.classificacao ? CLASSIFICACAO_LABELS[item.classificacao] : '—'}
        </CardField>
        <CardField label="Interesse">
          <span className={
            item.interesse === 'ALTO' ? 'text-green-primary font-bold' :
            item.interesse === 'MEDIO' ? 'text-[#E65100] font-bold' :
            item.interesse === 'BAIXO' ? 'text-red-700 font-bold' : ''
          }>
            {item.interesse ? INTERESSE_LABELS[item.interesse] : '—'}
          </span>
        </CardField>

        {item.tecnica_enviada ? (
          <CardField label="Env. técnica">
            <span className="text-green-primary">{formatDate(item.data_envio_tecnica)} ✓</span>
          </CardField>
        ) : (
          <CardField label="Prazo técnica">
            <span className={item.tecnica_atrasada ? 'text-red-700 font-semibold' : ''}>
              {formatDate(item.prazo_tecnica)}{item.tecnica_atrasada ? ' ⚠' : ''}
            </span>
          </CardField>
        )}

        <CardField label="Prazo comercial">
          <span className={item.comercial_atrasada ? 'text-red-700 font-semibold' : ''}>
            {formatDate(item.prazo_comercial)}{item.comercial_atrasada ? ' ⚠' : ''}
          </span>
        </CardField>

        <CardField label="Escopo" className="col-span-2">
          {item.escopo ?? '—'}
        </CardField>
        <CardField label="Cliente">
          {local}
        </CardField>

        <CardField label={item.visita_tecnica ? 'Visita técnica' : 'Visita técnica'}>
          {item.visita_tecnica
            ? `Sim${item.data_visita ? ' — ' + formatDate(item.data_visita) : ''}`
            : 'Não'}
        </CardField>
        <CardField label="Atribuído em">
          {formatDate(item.created_at)}
        </CardField>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isFabricacaoType ? (
          <Button size="sm" onClick={() => onRegistrarFabricacao(item)}>
            Enviar Proposta
          </Button>
        ) : isParadasType ? (
          <Button
            size="sm"
            onClick={() => onRegistrarParada(item, item.tecnica_enviada ? 'comercial' : 'tecnica')}
          >
            Enviar Proposta
          </Button>
        ) : isObrasType ? (
          <Button
            size="sm"
            onClick={() => onRegistrarObra(item, item.tecnica_enviada ? 'comercial' : 'tecnica')}
          >
            Enviar Proposta
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => item.tecnica_enviada ? onRegistrarComercial(item) : onRegistrarTecnica(item)}
          >
            Enviar Proposta
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
