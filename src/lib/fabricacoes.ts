// ─────────────────────────────────────────────────────────────────────────────
// Tipos e helpers compartilhados do Controle de HH — Fabricações: usados pela
// listagem/resumo (src/components/acordos/FabricacoesView.tsx), pelos modais de
// edição (src/components/acordos/FabricacaoItensModals.tsx), pela página dedicada
// por contrato (src/app/acordos/hh/fabricacoes/[id]/page.tsx) e pelas rotas de API
// (src/app/api/acordos/hh/fabricacoes/**).
//
// Nota: mês é 0-indexado aqui (getUTCMonth(), 0-11) — convenção diferente da usada
// em Controle de HH — Obras (HhLancamentoMes.mes é 1-indexado). Já era assim antes
// desta extração; mantido por compatibilidade com os dados existentes.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'

export const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export const fmtHh   = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
export const fmtPeso = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtPct  = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

// ── Tipos vindos da API ─────────────────────────────────────────────────────
export interface MesPlano { mes: number; ano: number; hh_orcado: number | null; hh_previsto: number | null; peso_previsto: number | null }
export interface MesReal  { mes: number; ano: number; hh_realizado: number | null; peso_realizado: number | null }
export interface ItemFab {
  id: number
  descricao: string
  peso_total: number | null
  data_inicio: string
  data_fim: string
  ordem: number
  meses: MesPlano[]
  realizados: MesReal[]
}
export interface ContratoFab {
  id: number
  indice: string
  num_os: string | null
  num_acordo: string | null
  num_proposta: string | null
  ano_referencia?: number | null
  cliente: { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
  responsavel: { id: number; nome: string } | null
  cidade: string | null
  estado: string | null
  classificacao: string | null
  descricao: string | null
  data_inicio: string | null
  data_fim: string | null
  tem_itens: boolean
  hh_orcado: number | null
  hh_previsto: number | null
  hh_realizado: number | null
  peso_total: number | null
  peso_previsto: number | null
  peso_realizado: number | null
  itens: ItemFab[]
}

// Lista de meses (mes,ano) entre duas datas YYYY-MM-DD (inclusive)
export function mesesEntre(inicio: string, fim: string): { mes: number; ano: number }[] {
  if (!inicio || !fim) return []
  const a = new Date(inicio), b = new Date(fim)
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return []
  const out: { mes: number; ano: number }[] = []
  let y = a.getUTCFullYear(), m = a.getUTCMonth()
  const yE = b.getUTCFullYear(), mE = b.getUTCMonth()
  let guard = 0
  while ((y < yE || (y === yE && m <= mE)) && guard < 240) {
    out.push({ mes: m, ano: y }); m++; if (m > 11) { m = 0; y++ }; guard++
  }
  return out
}
export const key = (ano: number, mes: number) => `${ano}-${mes}`

// Somas de peso por item e % de avanço (= peso realizado / peso previsto)
export const pesoPrevItem = (it: ItemFab) => it.meses.reduce((a, m) => a + (m.peso_previsto ?? 0), 0)
export const pesoRealItem = (it: ItemFab) => it.realizados.reduce((a, r) => a + (r.peso_realizado ?? 0), 0)
export const pctAvanco = (prev: number, real: number) => (prev > 0 ? (real / prev) * 100 : 0)

// ── Server-side: mapeia um Contrato (com fabricacao_itens incluídos) para ContratoFab ──
export const FAB_CONTRATO_INCLUDE = {
  cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
  cliente_final: { select: { id: true, nome: true } },
  responsavel:   { select: { id: true, nome: true } },
  fabricacao_itens: {
    orderBy: { ordem: 'asc' },
    include: {
      meses:      true,
      realizados: true,
    },
  },
} satisfies Prisma.ContratoInclude

type ContratoComItens = Prisma.ContratoGetPayload<{ include: typeof FAB_CONTRATO_INCLUDE }>

export function mapContratoFab(c: ContratoComItens): ContratoFab {
  const itens: ItemFab[] = c.fabricacao_itens.map((it) => ({
    id: it.id,
    descricao: it.descricao,
    peso_total: it.peso_total != null ? Number(it.peso_total) : null,
    data_inicio: it.data_inicio.toISOString(),
    data_fim: it.data_fim.toISOString(),
    ordem: it.ordem,
    meses: it.meses.map((m) => ({
      mes: m.mes, ano: m.ano,
      hh_orcado: m.hh_orcado, hh_previsto: m.hh_previsto,
      peso_previsto: m.peso_previsto != null ? Number(m.peso_previsto) : null,
    })),
    realizados: it.realizados.map((r) => ({
      mes: r.mes, ano: r.ano,
      hh_realizado: r.hh_realizado,
      peso_realizado: r.peso_realizado != null ? Number(r.peso_realizado) : null,
    })),
  }))

  const temItens = itens.length > 0
  const hhOrcado      = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.hh_orcado ?? 0), 0), 0)
  const hhPrevisto     = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.hh_previsto ?? 0), 0), 0)
  const hhRealizado    = itens.reduce((a, i) => a + i.realizados.reduce((b, r) => b + (r.hh_realizado ?? 0), 0), 0)
  const pesoPrevisto  = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.peso_previsto ?? 0), 0), 0)
  const pesoRealizado = itens.reduce((a, i) => a + i.realizados.reduce((b, r) => b + (r.peso_realizado ?? 0), 0), 0)
  const pesoTotal     = itens.reduce((a, i) => a + (i.peso_total ?? 0), 0)

  return {
    id: c.id, indice: c.indice, num_os: c.num_os,
    num_acordo: c.num_acordo ?? null, num_proposta: c.num_proposta ?? null,
    ano_referencia: c.ano_referencia,
    cidade: c.cidade, estado: c.estado, classificacao: c.classificacao,
    cliente: c.cliente, cliente_final: c.cliente_final ?? null,
    descricao: c.descricao, responsavel: c.responsavel,
    data_inicio: c.data_inicio?.toISOString() ?? null,
    data_fim:    c.data_fim?.toISOString()    ?? null,
    tem_itens: temItens,
    hh_orcado:    hhOrcado    > 0 ? hhOrcado    : null,
    hh_previsto:  hhPrevisto  > 0 ? hhPrevisto  : null,
    hh_realizado: hhRealizado > 0 ? hhRealizado : null,
    peso_total:     pesoTotal     > 0 ? pesoTotal     : null,
    peso_previsto:  pesoPrevisto  > 0 ? pesoPrevisto  : null,
    peso_realizado: pesoRealizado > 0 ? pesoRealizado : null,
    itens,
  }
}
