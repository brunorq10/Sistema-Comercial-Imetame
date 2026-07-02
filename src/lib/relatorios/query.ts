// ─────────────────────────────────────────────────────────────────────────────
// Montagem da query do Construtor de Relatório.
// Toda a lógica de SQL vive aqui — o frontend só envia estrutura semântica.
// As expressões SQL vêm exclusivamente do catálogo (nomes de campo do front são
// apenas chaves validadas). Valores de filtro string são parametrizados; ids
// numéricos são coeridos com Number() antes de entrar na query.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  BASES, getCampo, type Agregacao, type Granularidade, type Modulo, type Campo,
} from './catalog'
import type { DimMeta, ValMeta } from './shared'

export type { DimMeta, ValMeta } from './shared'

export interface CampoRef { campo: string; granularidade?: Granularidade }
export interface ValorRef { campo: string; agregacao?: Agregacao }
export interface Filtros {
  de?: string | null
  ate?: string | null
  campoDataRef?: string | null
  cliente_id?: number[]
  responsavel_id?: number[]
}
export interface ReportRequest {
  modulo: Modulo
  linhas: CampoRef[]
  colunas: CampoRef[]
  valores: ValorRef[]
  filtros: Filtros
}

const TRUNC: Record<Granularidade, string> = {
  dia: 'day', mes: 'month', trimestre: 'quarter', ano: 'year',
}

function dimExpr(ref: CampoRef): string {
  const c = getCampo(ref.campo)
  if (!c) throw new Error(`Campo desconhecido: ${ref.campo}`)
  if (c.tipo === 'data') return `DATE_TRUNC('${TRUNC[ref.granularidade ?? 'mes']}', ${c.dateCol})`
  if (c.tipo === 'dim') return c.sql
  throw new Error(`Campo ${ref.campo} não pode ser usado como dimensão`)
}

function aggExpr(ref: ValorRef): string {
  const c = getCampo(ref.campo)
  if (!c) throw new Error(`Campo desconhecido: ${ref.campo}`)
  if (c.tipo === 'calc') {
    const base = `SUM(${c.num})${c.percent ? ' * 100.0' : ''} / NULLIF(SUM(${c.den}), 0)`
    return `(${base})::float8`
  }
  if (c.tipo === 'met') {
    if (c.count) return 'COUNT(*)::float8'
    const agg = ref.agregacao ?? c.aggPadrao
    const fn = agg === 'soma' ? 'SUM' : agg === 'media' ? 'AVG' : 'COUNT'
    return `${fn}(${c.sql})::float8`
  }
  throw new Error(`Campo ${ref.campo} não pode ser usado como valor`)
}

function campoFormato(c: Campo): string {
  return c.tipo === 'met' || c.tipo === 'calc' ? c.formato : 'texto'
}

// Coluna de data (bruta) sobre a qual o filtro De/Até é aplicado.
export function dataFiltroExpr(req: ReportRequest): { expr: string; label: string } {
  const base = BASES[req.modulo]
  const dims = [...req.linhas, ...req.colunas]
  // Campo de data explicitamente escolhido como referência
  if (req.filtros.campoDataRef) {
    const c = getCampo(req.filtros.campoDataRef)
    if (c && c.tipo === 'data' && dims.some((d) => d.campo === c.key)) {
      return { expr: c.dateCol, label: c.label }
    }
  }
  // Primeiro campo de data presente nas zonas
  for (const d of dims) {
    const c = getCampo(d.campo)
    if (c && c.tipo === 'data') return { expr: c.dateCol, label: c.label }
  }
  // Fallback: data principal do módulo
  return { expr: base.dataPadrao, label: base.dataPadraoLabel }
}

export interface BuiltQuery {
  sql: string
  params: unknown[]
  linhasMeta: DimMeta[]
  colunasMeta: DimMeta[]
  valoresMeta: ValMeta[]
  dataFiltroLabel: string
  semFiltroData: boolean
}

export function buildQuery(req: ReportRequest, opts?: { limit?: number; forcedDate?: { expr: string; label: string } }): BuiltQuery {
  const base = BASES[req.modulo]
  const params: unknown[] = []
  const p = (v: unknown) => { params.push(v); return `$${params.length}` }

  const dims = [...req.linhas, ...req.colunas]
  const selDims = dims.map((d, i) => `${dimExpr(d)} AS d${i}`)
  const selVals = req.valores.map((v, i) => `${aggExpr(v)} AS m${i}`)
  const selects = [...selDims, ...selVals]
  if (selects.length === 0) throw new Error('Nenhum campo selecionado')

  const { expr: dataExpr, label: dataLabel } = opts?.forcedDate ?? dataFiltroExpr(req)
  const where = [base.where]
  if (req.filtros.de)  where.push(`${dataExpr} >= ${p(req.filtros.de)}::date`)
  if (req.filtros.ate) where.push(`${dataExpr} <= ${p(req.filtros.ate)}::date`)

  const cids = (req.filtros.cliente_id ?? []).map(Number).filter((n) => Number.isInteger(n))
  if (cids.length) where.push(`${base.clienteCol} IN (${cids.join(',')})`)
  const rids = (req.filtros.responsavel_id ?? []).map(Number).filter((n) => Number.isInteger(n))
  if (rids.length) where.push(`${base.responsavelCol} IN (${rids.join(',')})`)

  const nDims = dims.length
  const groupOrder = Array.from({ length: nDims }, (_, i) => String(i + 1)).join(', ')

  let sql = `SELECT ${selects.join(', ')} FROM ${base.from} WHERE ${where.join(' AND ')}`
  if (nDims > 0) sql += ` GROUP BY ${groupOrder} ORDER BY ${groupOrder}`
  if (opts?.limit && opts.limit > 0) sql += ` LIMIT ${Math.floor(opts.limit)}`

  const toMeta = (ref: CampoRef): DimMeta => {
    const c = getCampo(ref.campo)!
    return { key: c.key, label: c.label, eData: c.tipo === 'data', granularidade: ref.granularidade }
  }
  const toValMeta = (ref: ValorRef): ValMeta => {
    const c = getCampo(ref.campo)!
    return { key: c.key, label: c.label, formato: campoFormato(c), agregacao: c.tipo === 'met' && !c.count ? (ref.agregacao ?? c.aggPadrao) : undefined }
  }

  return {
    sql,
    params,
    linhasMeta: req.linhas.map(toMeta),
    colunasMeta: req.colunas.map(toMeta),
    valoresMeta: req.valores.map(toValMeta),
    dataFiltroLabel: dataLabel,
    semFiltroData: !req.filtros.de && !req.filtros.ate,
  }
}

// Linha "longa" retornada pela agregação: d0..dN (dimensões) + m0..mK (métricas).
export type RawRow = Record<string, string | number | Date | null>

// Cada query roda numa transação com statement_timeout local — um relatório
// muito pesado falha sozinho (código 57014) em vez de segurar conexão do banco.
const RELATORIO_TIMEOUT_MS = 15000

export async function runQuery(built: BuiltQuery): Promise<RawRow[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${RELATORIO_TIMEOUT_MS}`)
    return tx.$queryRawUnsafe<RawRow[]>(built.sql, ...built.params)
  })
}
