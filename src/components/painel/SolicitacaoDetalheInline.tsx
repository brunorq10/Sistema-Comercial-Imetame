'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { ClassificacaoBadge, InteresseBadge, StatusAnaliseBadge, VersaoBadge } from '@/components/ui/Badge'
import { CLASSIFICACAO_LABELS, INTERESSE_LABELS, ORIGEM_LABELS, MOTIVO_REPROVACAO_LABELS } from '@/types'
import type { Classificacao, Interesse, Origem, MotivoReprovacao } from '@/types'

export interface DetalheInline {
  id: number
  numero: string
  created_at: string
  contato: string | null
  cidade: string | null
  estado: string | null
  origem: Origem | null
  segmento: string | null
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  status_analise: 'AGUARDANDO' | 'APROVADA' | 'REPROVADA'
  prazo_tecnica: string | null
  prazo_tecnica_indeterminado: boolean
  prazo_comercial: string | null
  prazo_comercial_indeterminado: boolean
  visita_tecnica: boolean
  data_visita: string | null
  motivo_recusa: string | null
  motivo_reprovacao: MotivoReprovacao | null
  obs_reprovacao: string | null
  cancel_reason: string | null
  cliente: { id: number; nome: string }
  cliente_final: { id: number; nome: string } | null
  orcamentista: { id: number; nome: string } | null
  criador: { id: number; nome: string }
  propostas_tecnicas: { versao: number; data_envio: string | null; nao_aplicavel: boolean }[]
  propostas_comerciais: { versao: number; data_envio: string | null; nao_aplicavel: boolean }[]
  propostas_fabricacao: { versao: number; data_envio: string | null }[]
}

interface CicloRevisao {
  versao: number
  tecnica_data: string | null
  tecnica_na: boolean
  comercial_data: string | null
  comercial_na: boolean
  fabricacao_data: string | null
  fabricacao_na: boolean
}

type Detalhe = DetalheInline

function buildCiclos(detalhe: Detalhe): CicloRevisao[] {
  const versoes = new Set<number>()
  detalhe.propostas_tecnicas.forEach((p) => versoes.add(p.versao))
  detalhe.propostas_comerciais.forEach((p) => versoes.add(p.versao))
  detalhe.propostas_fabricacao.forEach((p) => versoes.add(p.versao))
  return Array.from(versoes)
    .sort((a, b) => a - b)
    .map((versao) => {
      const tec = detalhe.propostas_tecnicas.find((p) => p.versao === versao)
      const com = detalhe.propostas_comerciais.find((p) => p.versao === versao)
      const fab = detalhe.propostas_fabricacao.find((p) => p.versao === versao)
      return {
        versao,
        tecnica_data: tec?.data_envio ?? null,
        tecnica_na: tec?.nao_aplicavel ?? false,
        comercial_data: com?.data_envio ?? null,
        comercial_na: com?.nao_aplicavel ?? false,
        fabricacao_data: fab?.data_envio ?? null,
        fabricacao_na: false,
      }
    })
}

interface InlineProps {
  id: number
  onEditarReprovacao?: () => void
  initialData?: DetalheInline
  onLoaded?: (id: number, data: DetalheInline) => void
}

export function SolicitacaoDetalheInline({ id, onEditarReprovacao, initialData, onLoaded }: InlineProps) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    fetch(`/api/solicitacoes/${id}`)
      .then((r) => r.json())
      .then((j) => {
        setDetalhe(j.data)
        if (j.data) onLoaded?.(id, j.data)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return <p className="text-center py-4 text-[11px] text-gray-400">Carregando...</p>
  }
  if (!detalhe) {
    return <p className="text-center py-4 text-[11px] text-red-500">Erro ao carregar detalhes.</p>
  }

  const isFabricacao = detalhe.classificacao === 'FABRICACOES' || detalhe.classificacao === 'OLEO_GAS'
  const ciclos = buildCiclos(detalhe)

  return (
    <div className="bg-[#F9FAFB] border-t border-gray-200 px-4 py-4 text-[11px]">
      {/* Info geral */}
      <div className="grid grid-cols-4 gap-x-6 gap-y-2.5 mb-4">
        <Field label="Cliente">{detalhe.cliente.nome}</Field>
        <Field label="Cliente Final">{detalhe.cliente_final?.nome ?? '—'}</Field>
        <Field label="Contato">{detalhe.contato ?? '—'}</Field>
        <Field label="Cidade / UF">
          {[detalhe.cidade, detalhe.estado].filter(Boolean).join(' / ') || '—'}
        </Field>

        <Field label="Origem">
          {detalhe.origem ? ORIGEM_LABELS[detalhe.origem] : '—'}
        </Field>
        <Field label="Escopo" className="col-span-3">{detalhe.escopo ?? '—'}</Field>

        <Field label="Classificação">
          {detalhe.classificacao ? CLASSIFICACAO_LABELS[detalhe.classificacao] : '—'}
        </Field>
        <Field label="Interesse">
          {detalhe.interesse ? INTERESSE_LABELS[detalhe.interesse] : '—'}
        </Field>
        <Field label="Status análise">
          <StatusAnaliseBadge status={detalhe.status_analise} />
        </Field>
        <Field label="Orçamentista">{detalhe.orcamentista?.nome ?? '—'}</Field>

        <Field label="Prazo técnica">
          {detalhe.prazo_tecnica_indeterminado ? 'Não Determinado' : formatDate(detalhe.prazo_tecnica)}
        </Field>
        <Field label="Prazo comercial">
          {detalhe.prazo_comercial_indeterminado ? 'Não Determinado' : formatDate(detalhe.prazo_comercial)}
        </Field>
        <Field label="Visita técnica">
          {detalhe.visita_tecnica
            ? `Sim${detalhe.data_visita ? ' — ' + formatDate(detalhe.data_visita) : ''}`
            : 'Não'}
        </Field>
        <Field label="Criado por">{detalhe.criador.nome} em {formatDate(detalhe.created_at)}</Field>

        {detalhe.motivo_recusa && (
          <div className="col-span-4">
            <p className="text-[9px] text-gray-400 uppercase tracking-[0.04em] mb-0.5">Motivo reprovação</p>
            <p className="text-[11px] font-medium text-red-700">
              {detalhe.motivo_recusa}
              {detalhe.obs_reprovacao && (
                <span className="block text-[10px] text-red-500 mt-0.5">Obs: {detalhe.obs_reprovacao}</span>
              )}
            </p>
            {onEditarReprovacao && (
              <button
                onClick={onEditarReprovacao}
                className="mt-1 text-[10px] text-blue-600 hover:underline font-medium"
              >
                Editar motivo
              </button>
            )}
          </div>
        )}
        {detalhe.cancel_reason && (
          <Field label="Motivo cancelamento" className="col-span-4 text-red-700">
            {detalhe.cancel_reason}
          </Field>
        )}
      </div>

      {/* Histórico de revisões (ciclos) */}
      {ciclos.length > 0 && (
        <>
          <p className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-semibold mb-2">
            Histórico de revisões
          </p>
          <table className="w-full border border-gray-200 rounded text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <Th>Revisão</Th>
                {!isFabricacao && <Th>Proposta técnica</Th>}
                <Th>{isFabricacao ? 'Proposta fabricação' : 'Proposta comercial'}</Th>
              </tr>
            </thead>
            <tbody>
              {ciclos.map((c) => (
                <tr key={c.versao} className="border-t border-gray-100">
                  <Td><VersaoBadge versao={c.versao} /></Td>
                  {!isFabricacao && (
                    <Td>
                      {c.tecnica_na
                        ? <span className="text-gray-400 italic">N/A</span>
                        : c.tecnica_data
                          ? <span className="text-green-700 font-medium">Enviada em {formatDate(c.tecnica_data)}</span>
                          : <span className="text-amber-600">Aguardando</span>}
                    </Td>
                  )}
                  <Td>
                    {isFabricacao
                      ? (c.fabricacao_data
                          ? <span className="text-green-700 font-medium">Enviada em {formatDate(c.fabricacao_data)}</span>
                          : <span className="text-amber-600">Aguardando</span>)
                      : (c.comercial_na
                          ? <span className="text-gray-400 italic">N/A</span>
                          : c.comercial_data
                            ? <span className="text-green-700 font-medium">Enviada em {formatDate(c.comercial_data)}</span>
                            : <span className="text-amber-600">Aguardando</span>)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {ciclos.length === 0 && detalhe.status_analise === 'APROVADA' && (
        <p className="text-gray-400 italic text-[10px]">Nenhuma proposta registrada ainda.</p>
      )}
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[9px] text-gray-400 uppercase tracking-[0.04em] mb-0.5">{label}</p>
      <p className="text-[11px] font-medium">{children}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 text-left font-semibold text-gray-500">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5">{children}</td>
}
