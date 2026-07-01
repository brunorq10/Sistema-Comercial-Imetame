// ─────────────────────────────────────────────────────────────────────────────
// Serviço do Construtor de Relatório: validação do request + orquestração das
// queries (principal + totais por linha/coluna/geral) → PivotResult.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { getCampo, type Granularidade } from './catalog'
import { buildQuery, dataFiltroExpr, runQuery, type ReportRequest, type RawRow } from './query'
import { buildPivot, type PivotResult } from './pivot'

// Série cronológica de inícios de período (UTC) entre De e Até, na granularidade.
function serieDatas(deStr: string, ateStr: string, gran: Granularidade): Date[] {
  const start = new Date(`${deStr}T00:00:00Z`)
  const end = new Date(`${ateStr}T00:00:00Z`)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return []
  const trunc = (d: Date): Date => {
    const y = d.getUTCFullYear(), m = d.getUTCMonth()
    if (gran === 'ano') return new Date(Date.UTC(y, 0, 1))
    if (gran === 'trimestre') return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))
    if (gran === 'mes') return new Date(Date.UTC(y, m, 1))
    return new Date(Date.UTC(y, m, d.getUTCDate()))
  }
  const next = (d: Date): Date => {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate()
    if (gran === 'ano') return new Date(Date.UTC(y + 1, 0, 1))
    if (gran === 'trimestre') return new Date(Date.UTC(y, m + 3, 1))
    if (gran === 'mes') return new Date(Date.UTC(y, m + 1, 1))
    return new Date(Date.UTC(y, m, day + 1))
  }
  const res: Date[] = []
  let d = trunc(start)
  const limite = 1000 // trava de segurança
  while (d <= end && res.length < limite) { res.push(d); d = next(d) }
  return res
}

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

  // Série completa de datas quando há exatamente 1 dimensão de data na zona
  // e período De/Até definido (períodos sem dados aparecem no resultado).
  const semear = (refs: ReportRequest['linhas']): Date[] | undefined => {
    if (refs.length !== 1 || !req.filtros.de || !req.filtros.ate) return undefined
    const c = getCampo(refs[0].campo)
    if (!c || c.tipo !== 'data') return undefined
    return serieDatas(req.filtros.de, req.filtros.ate, refs[0].granularidade ?? 'mes')
  }

  const pivot = buildPivot({
    linhasMeta: built.linhasMeta,
    colunasMeta: built.colunasMeta,
    valoresMeta: built.valoresMeta,
    main, rowTotais, colTotais, grand,
    rowSeedDates: semear(req.linhas),
    colSeedDates: semear(req.colunas),
  })

  return { pivot, dataFiltroLabel: built.dataFiltroLabel, semFiltroData: built.semFiltroData, totalLinhas: pivot.rows.length }
}
