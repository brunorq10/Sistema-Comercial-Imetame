'use client'

import { useState } from 'react'
import { Badge, ClassificacaoBadge, StatusBadge } from '@/components/ui/Badge'
import { formatDate, formatCurrency, formatRev } from '@/lib/utils'
import { RESULTADO_LABELS, MOTIVO_PERDA_LABELS } from '@/types'
import type { PropostasItem } from '@/types'

interface Props {
  item: PropostasItem
  onEditar: (item: PropostasItem) => void
  canEditar: boolean
}


function ResultadoBadge({ resultado }: { resultado: string | null }) {
  if (!resultado) return null
  const variant =
    resultado === 'GANHOU' ? 'green' : resultado === 'PERDEU' ? 'red' : 'amber'
  return <Badge variant={variant}>{RESULTADO_LABELS[resultado] ?? resultado}</Badge>
}

export function PropostaCard({ item, onEditar, canEditar }: Props) {
  const [expanded, setExpanded] = useState(false)

  const latestTecnica = item.propostas_tecnicas[0] ?? null
  const latestComercial = item.propostas_comerciais[0] ?? null
  const qtdRevisoes = item.propostas_tecnicas.length
  const currentRevLabel = latestTecnica ? formatRev(latestTecnica.versao) : null

  const hhTotal =
    latestTecnica?.hh_direto != null && latestTecnica?.hh_indireto != null
      ? latestTecnica.hh_direto + latestTecnica.hh_indireto
      : null
  const percIndireto =
    hhTotal && latestTecnica?.hh_indireto
      ? ((latestTecnica.hh_indireto / hhTotal) * 100).toFixed(1) + '%'
      : null

  const atrasado = item.tecnica_atrasada || item.comercial_atrasada

  return (
    <div
      className={`bg-white border rounded-lg mb-2 overflow-hidden transition-shadow ${
        atrasado ? 'border-l-4 border-l-red-400 border-gray-200' : 'border-gray-200'
      }`}
    >
      {/* ── Linha de resumo ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-400 text-[10px] shrink-0">{expanded ? '▼' : '▶'}</span>

        {/* Nº + Rev */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-[120px]">
          <span className="font-bold text-green-dark text-sm">{item.numero}</span>
          {currentRevLabel && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {currentRevLabel}
            </span>
          )}
        </div>

        {/* Cliente + Cidade/UF */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-800 font-medium truncate">{item.cliente.nome}</span>
          {(item.cidade || item.estado) && (
            <span className="text-[11px] text-gray-400 ml-1.5">
              · {[item.cidade, item.estado].filter(Boolean).join(' / ')}
            </span>
          )}
        </div>

        {/* Qtd revisões */}
        <span className="text-[11px] text-gray-400 shrink-0">
          {qtdRevisoes} rev{qtdRevisoes !== 1 ? 's' : ''}
        </span>

        {/* Classificação */}
        {item.classificacao && (
          <span className="shrink-0">
            <ClassificacaoBadge value={item.classificacao} />
          </span>
        )}

        {/* Orçamentista */}
        {item.orcamentista && (
          <span className="text-[11px] text-gray-500 shrink-0 max-w-[100px] truncate">
            {item.orcamentista.nome}
          </span>
        )}

        {/* Valor total */}
        {latestComercial?.valor_total && (
          <span className="text-sm font-semibold text-gray-800 shrink-0">
            {formatCurrency(Number(latestComercial.valor_total))}
          </span>
        )}

        {/* Status */}
        <span className="shrink-0">
          <StatusBadge status={item.status} />
        </span>

        {/* Resultado */}
        <span className="shrink-0">
          <ResultadoBadge resultado={item.resultado} />
        </span>

        {/* Ação */}
        {canEditar && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(item) }}
            className="shrink-0 text-[11px] text-blue-600 hover:underline ml-1"
          >
            Editar
          </button>
        )}
      </div>

      {/* ── Painel expandido ──────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
          {/* Grid técnica + comercial mais recentes */}
          {(latestTecnica || latestComercial) && (
            <div className="grid grid-cols-2 gap-6 mb-4">
              {/* Proposta técnica */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Proposta Técnica {currentRevLabel ? `· ${currentRevLabel}` : ''}
                </p>
                {latestTecnica ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">HH Direto</p>
                      <p className="text-xs font-semibold">{latestTecnica.hh_direto ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">HH Indireto</p>
                      <p className="text-xs font-semibold">{latestTecnica.hh_indireto ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">HH Total</p>
                      <p className="text-xs font-semibold text-auto-value">{hhTotal ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">% Indireto</p>
                      <p className="text-xs font-semibold text-auto-value">{percIndireto ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">Peso Mont. (t)</p>
                      <p className="text-xs font-semibold">{latestTecnica.peso_montagem ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">Env. Técnica</p>
                      <p className="text-xs font-semibold">{formatDate(latestTecnica.data_envio)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Nenhuma proposta técnica registrada.</p>
                )}
              </div>

              {/* Proposta comercial */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Proposta Comercial
                </p>
                {latestComercial ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">Valor Total</p>
                      <p className="text-xs font-semibold">
                        {latestComercial.valor_total
                          ? formatCurrency(Number(latestComercial.valor_total))
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">Env. Comercial</p>
                      <p className="text-xs font-semibold">{formatDate(latestComercial.data_envio)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase">Resultado</p>
                      <p className="text-xs font-semibold">
                        {latestComercial.resultado
                          ? RESULTADO_LABELS[latestComercial.resultado] ?? latestComercial.resultado
                          : '—'}
                      </p>
                    </div>
                    {latestComercial.motivo_perda && (
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase">Motivo</p>
                        <p className="text-xs font-semibold">
                          {MOTIVO_PERDA_LABELS[latestComercial.motivo_perda]}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Nenhuma proposta comercial registrada.</p>
                )}
              </div>
            </div>
          )}

          {/* Histórico de revisões */}
          {item.propostas_tecnicas.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                Histórico de revisões
              </p>
              <div className="space-y-1">
                {item.propostas_tecnicas.map((tec, idx) => {
                  const isLatest = idx === 0
                  // Encontra o comercial mais recente que referencia esta técnica
                  const com = item.propostas_comerciais.find(
                    (c) => c.proposta_tecnica_id === tec.id,
                  ) ?? null

                  const hhtotal =
                    tec.hh_direto != null && tec.hh_indireto != null
                      ? tec.hh_direto + tec.hh_indireto
                      : null

                  return (
                    <div
                      key={tec.id}
                      className={`flex items-center gap-4 rounded px-3 py-2 text-[11px] ${
                        isLatest
                          ? 'bg-green-light border border-green-primary/20'
                          : 'bg-white border border-gray-100 text-gray-500'
                      }`}
                    >
                      <span
                        className={`font-bold w-12 shrink-0 ${isLatest ? 'text-green-dark' : 'text-gray-400'}`}
                      >
                        {formatRev(tec.versao)}
                      </span>
                      {isLatest && (
                        <span className="text-[9px] font-semibold text-green-primary bg-green-light border border-green-primary/30 px-1.5 py-0.5 rounded-full shrink-0">
                          atual
                        </span>
                      )}
                      <span className="shrink-0">
                        HH {hhtotal ?? '—'} · Env: {formatDate(tec.data_envio)}
                        {tec.peso_montagem ? ` · ${tec.peso_montagem}t` : ''}
                      </span>
                      {com ? (
                        <span className="shrink-0">
                          | Com:{' '}
                          {com.valor_total
                            ? formatCurrency(Number(com.valor_total))
                            : '—'}{' '}
                          · {formatDate(com.data_envio)}
                        </span>
                      ) : (
                        <span className="text-gray-400 shrink-0">| Sem comercial</span>
                      )}
                      {com?.resultado && (
                        <span className="shrink-0">
                          <ResultadoBadge resultado={com.resultado} />
                        </span>
                      )}
                      {com?.motivo_perda && (
                        <span className="text-[10px] text-gray-400">
                          ({MOTIVO_PERDA_LABELS[com.motivo_perda]})
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
