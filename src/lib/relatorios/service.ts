// ─────────────────────────────────────────────────────────────────────────────
// Serviço do Construtor de Relatório: validação do request + orquestração das
// queries (principal + totais por linha/coluna/geral) → PivotResult.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { getCampo } from './catalog'
import { buildQuery, dataFiltroExpr, runQuery, type ReportRequest, type RawRow } from './query'
import { buildPivot, type PivotResult } from './pivot'

const granEnum = z.enum(['dia', 'mes', 'trimestre', 'ano'])
const aggEnum = z.enum(['soma', 'media', 'contagem'])

export const reportRequestSchema = z.object({
  modulo: z.enum(['comercial', 'acordos', 'ocorrencias']),
  linhas: z.array(z.object({ campo: z.string(), granularidade: granEnum.optional() })).default([]),
  colunas: z.array(z.object({ campo: z.string(), granularidade: granEnum.optional() })).default([]),
  valores: z.array(z.object({ campo: z.string(), agregacao: aggEnum.optional() })).default([]),
  filtros: z.object({
    de: z.string().nullish(),
    ate: z.string().nullish(),
    campoDataRef: z.string().nullish(),
    cliente_id: z.array(z.number()).optional(),
    responsavel_id: z.array(z.number()).optional(),
  }).default({}),
})

// Regras semânticas: campo existe, pertence ao módulo e está na zona correta.
export function validarRequest(req: ReportRequest): string | null {
  if (!req.valores.length) return 'Adicione ao menos um campo na zona Valores.'
  if (!req.linhas.length && !req.colunas.length) return 'Adicione ao menos um campo em Linhas ou Colunas.'

  for (const r of [...req.linhas, ...req.colunas, ...req.valores]) {
    const c = getCampo(r.campo)
    if (!c) return `Campo desconhecido: ${r.campo}`
    if (c.modulo !== req.modulo) return `O campo "${c.label}" não pertence ao módulo selecionado.`
  }
  for (const r of [...req.linhas, ...req.colunas]) {
    const c = getCampo(r.campo)!
    if (c.tipo !== 'dim' && c.tipo !== 'data') return `"${c.label}" é um valor — não pode ir em Linhas/Colunas.`
  }
  for (const r of req.valores) {
    const c = getCampo(r.campo)!
    if (c.tipo !== 'met' && c.tipo !== 'calc') return `"${c.label}" é uma dimensão — não pode ir em Valores.`
  }
  return null
}

export interface GerarResultado {
  pivot: PivotResult
  dataFiltroLabel: string
  semFiltroData: boolean
  totalLinhas: number
}

export async function gerarPivot(req: ReportRequest, limitGrupos?: number): Promise<GerarResultado> {
  const forcedDate = dataFiltroExpr(req)  // mesmo campo de data em todas as subqueries
  const built = buildQuery(req, { limit: limitGrupos, forcedDate })
  const nL = req.linhas.length, nC = req.colunas.length

  const vazio: Promise<RawRow[]> = Promise.resolve([])
  const [main, rowTotais, colTotais, grand] = await Promise.all([
    runQuery(built),
    nC > 0 && nL > 0 ? runQuery(buildQuery({ ...req, colunas: [] }, { forcedDate })) : vazio,
    nC > 0 ? runQuery(buildQuery({ ...req, linhas: req.colunas, colunas: [] }, { forcedDate })) : vazio,
    runQuery(buildQuery({ ...req, linhas: [], colunas: [] }, { forcedDate })),
  ])

  const pivot = buildPivot({
    linhasMeta: built.linhasMeta,
    colunasMeta: built.colunasMeta,
    valoresMeta: built.valoresMeta,
    main, rowTotais, colTotais, grand,
  })

  return { pivot, dataFiltroLabel: built.dataFiltroLabel, semFiltroData: built.semFiltroData, totalLinhas: pivot.rows.length }
}
