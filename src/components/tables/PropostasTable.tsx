'use client'

import { formatRev, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ClassificacaoBadge } from '@/components/ui/Badge'
import { RESULTADO_LABELS } from '@/types'
import type { PropostasItem } from '@/types'

interface Props {
  data: PropostasItem[]
  onEditar: (item: PropostasItem) => void
  onHistorico: (item: PropostasItem) => void
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

export function PropostasTable({ data, onEditar, onHistorico, canEditar }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhuma proposta encontrada.</p>
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Nº Proposta</Th>
              <Th>Versão</Th>
              <Th>Cliente</Th>
              <Th>Cidade / UF</Th>
              <Th>Classificação</Th>
              <Th>Escopo Resumido</Th>
              <Th>Orçamentista</Th>
              <Th>Resultado</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb'
              const isFabricacao = item.classificacao === 'FABRICACOES' || item.classificacao === 'OLEO_GAS'
              const latestVersao = isFabricacao
                ? (item.propostas_fabricacao[0]?.versao ?? null)
                : (item.propostas_tecnicas[0]?.versao ?? null)
              const resultado = isFabricacao
                ? (item.propostas_fabricacao[0]?.resultado ?? null)
                : item.resultado
              return (
                <tr key={item.id} className="border-b border-gray-100" style={{ background: bg }}>
                  <td className="px-3 py-[6px] whitespace-nowrap">
                    <span className="font-bold text-green-dark">{item.numero}</span>
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
                  <td className="px-3 py-[6px]"><ResultadoCell resultado={resultado} /></td>
                  <td className="px-3 py-[6px]">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => onHistorico(item)} title="Histórico de revisões">
                        ↺
                      </Button>
                      {canEditar && (
                        <Button variant="outline" size="sm" onClick={() => onEditar(item)} title="Editar">
                          ✎
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
    </div>
  )
}
