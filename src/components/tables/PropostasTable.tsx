'use client'

import { useState } from 'react'
import { formatRev, formatDate, formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ClassificacaoBadge } from '@/components/ui/Badge'
import { RESULTADO_LABELS } from '@/types'
import type { PropostasItem } from '@/types'

interface Props {
  onRelatorioOS?: (item: PropostasItem) => void
  data: PropostasItem[]
  onEditar: (item: PropostasItem) => void
  onHistorico: (item: PropostasItem) => void
  onHistoricoAlteracoes: (item: PropostasItem) => void
  canEditar: boolean
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      'bg-green-primary text-white px-3 py-[7px] text-left font-semibold text-[10px] whitespace-nowrap select-none',
      className,
    )}>
      {children}
    </th>
  )
}

function ResultadoCell({ resultado }: { resultado: string | null }) {
  if (!resultado) return <span className="text-gray-400">—</span>
  const cls =
    resultado === 'GANHOU' ? 'text-green-primary font-semibold'
    : resultado === 'PERDEU' ? 'text-red-600 font-semibold'
    : 'text-amber-600'
  return <span className={cn('text-[10px]', cls)}>{RESULTADO_LABELS[resultado] ?? resultado}</span>
}

export function PropostasTable({ data, onEditar, onHistorico, onHistoricoAlteracoes, onRelatorioOS, canEditar }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhuma proposta encontrada.</p>
  }

  return (
    <div className="h-full border border-gray-200 rounded-md overflow-auto">
      <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Nº Proposta</Th>
              <Th>Versão</Th>
              <Th>Cliente</Th>
              <Th>Cliente Final</Th>
              <Th>Cidade / UF</Th>
              <Th>Classificação</Th>
              <Th>Escopo Resumido</Th>
              <Th>Orçamentista</Th>
              <Th>Último Envio</Th>
              <Th>Valor Total</Th>
              <Th>Resultado</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const isHovered = hoveredId === item.id
              const baseBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb'
              const bg = isHovered ? '#EEEEEE' : baseBg
              const isFabricacao = item.classificacao === 'FABRICACOES' || item.classificacao === 'OLEO_GAS'
              const latestVersao = isFabricacao
                ? (item.propostas_fabricacao[0]?.versao ?? null)
                : (item.propostas_tecnicas[0]?.versao ?? null)
              const resultado = isFabricacao
                ? (item.propostas_fabricacao[0]?.resultado ?? null)
                : item.resultado
              const fabricacaoItem = isFabricacao ? (item.propostas_fabricacao[0] ?? null) : null
              const enviosDates = [
                item.data_envio_tecnica,
                item.data_envio_comercial,
                fabricacaoItem?.data_envio ?? null,
              ].filter((d): d is string => Boolean(d))
              const latestEnvio = enviosDates.sort().at(-1) ?? null
              const valorTotalRaw = isFabricacao
                ? (fabricacaoItem?.valor_total ?? null)
                : item.valor_total
              const valorTotalNum = valorTotalRaw != null ? Number(valorTotalRaw) : null
              const desativada = !!item.proposta_cancelada_at || item.suspensa
              return (
                <tr
                  key={item.id}
                  className={cn('border-b border-gray-100 cursor-default', desativada && 'opacity-50')}
                  style={{ background: bg }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <td className="px-3 py-[6px] whitespace-nowrap">
                    <span className="font-bold text-green-dark">{item.numero}</span>
                    {item.proposta_cancelada_at && (
                      <span className="ml-1.5 inline-block text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 bg-gray-200 text-gray-500" title={item.proposta_cancel_reason ?? undefined}>Cancelada</span>
                    )}
                    {!item.proposta_cancelada_at && item.suspensa && (
                      <span className="ml-1.5 inline-block text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-700">Suspensa</span>
                    )}
                  </td>
                  <td className="px-3 py-[6px] whitespace-nowrap">
                    {latestVersao !== null ? (
                      <span className="inline-block text-[10px] font-bold px-[7px] py-[2px] rounded-full bg-green-primary text-white">
                        {formatRev(latestVersao)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-[6px] whitespace-nowrap font-medium">{item.cliente.nome}</td>
                  <td className="px-3 py-[6px] whitespace-nowrap text-gray-600">{item.cliente_final?.nome ?? '—'}</td>
                  <td className="px-3 py-[6px] whitespace-nowrap text-amber-600 font-medium">
                    {[item.cidade, item.estado].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-3 py-[6px] whitespace-nowrap">
                    <ClassificacaoBadge value={item.classificacao} />
                  </td>
                  <td className="px-3 py-[6px] max-w-[240px]">
                    {item.escopo
                      ? <span title={item.escopo} className="block truncate text-gray-600">{item.escopo}</span>
                      : '—'}
                  </td>
                  <td className="px-3 py-[6px] whitespace-nowrap">{item.orcamentista?.nome ?? '—'}</td>
                  <td className="px-3 py-[6px] whitespace-nowrap text-gray-600">
                    {latestEnvio ? formatDate(latestEnvio) : '—'}
                  </td>
                  <td className="px-3 py-[6px] whitespace-nowrap">
                    {valorTotalNum != null
                      ? <span className="font-semibold text-auto-value">{formatCurrency(valorTotalNum)}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-[6px]"><ResultadoCell resultado={resultado} /></td>
                  <td className="px-3 py-[6px]">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => onHistorico(item)} title="Histórico de revisões">
                        ↺
                      </Button>
                      <button
                        onClick={() => onHistoricoAlteracoes(item)}
                        className="border border-gray-300 text-gray-500 rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-100"
                        title="Histórico de Alterações"
                      >
                        📋
                      </button>
                      {canEditar && (
                        <Button variant="outline" size="sm" onClick={() => onEditar(item)} title="Editar">
                          ✎
                        </Button>
                      )}
                      {resultado === 'GANHOU' && onRelatorioOS && (
                        <Button variant={item.tem_relatorio_os ? 'info' : 'warning'} size="sm"
                          onClick={() => onRelatorioOS(item)}
                          title={item.tem_relatorio_os ? 'Relatório de OS (preenchido) — ver/editar' : 'Relatório de OS — preencher'}>
                          OS
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
    </div>
  )
}
