// ─────────────────────────────────────────────────────────────────────────────
// Remodelagem "longa → cruzada" (pivot) + totais.
//
// Para manter SUM/AVG e campos calculados matematicamente corretos, os totais
// NÃO são somados a partir das células já agregadas. Cada nível de total é uma
// nova agregação (linhas-apenas, colunas-apenas, geral) executada pela API e
// passada aqui. Assim "% faturado total" ou "média" batem com a realidade.
// ─────────────────────────────────────────────────────────────────────────────

import type { RawRow } from './query'
import type { DimMeta, ValMeta, LeafColumn, PivotRow, PivotResult } from './shared'
export type { LeafColumn, PivotRow, PivotResult } from './shared'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') { const d = new Date(v); return isNaN(d.getTime()) ? null : d }
  return null
}

function displayDim(value: unknown, meta: DimMeta): string {
  if (meta.eData) {
    const d = toDate(value)
    if (!d) return ''
    const g = meta.granularidade ?? 'mes'
    if (g === 'dia') return d.toLocaleDateString('pt-BR')
    if (g === 'ano') return String(d.getUTCFullYear())
    if (g === 'trimestre') return `T${Math.floor(d.getUTCMonth() / 3) + 1}/${d.getUTCFullYear()}`
    return `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}`
  }
  // Sem informação → célula vazia (não escreve texto).
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

// chave estável p/ casar combinações entre a query principal e as de totais
function keyDim(value: unknown, meta: DimMeta): string {
  if (meta.eData) { const d = toDate(value); return d ? d.toISOString() : '∅' }
  return value === null || value === undefined ? '∅' : String(value)
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return isNaN(n) ? null : n
}

interface BuildArgs {
  linhasMeta: DimMeta[]
  colunasMeta: DimMeta[]
  valoresMeta: ValMeta[]
  main: RawRow[]
  rowTotais: RawRow[]   // agregado só por linhas
  colTotais: RawRow[]   // agregado só por colunas
  grand: RawRow[]       // agregado geral (0 ou 1 linha)
  // Série completa de datas p/ preencher períodos sem dados (só quando há
  // exatamente 1 dimensão de data na respectiva zona e período De/Até definido).
  rowSeedDates?: Date[]
  colSeedDates?: Date[]
  // Quando false (padrão), linhas em que TODOS os valores são nulos/zero são
  // omitidas do resultado.
  incluirVazios?: boolean
}

export function buildPivot(a: BuildArgs): PivotResult {
  const nL = a.linhasMeta.length
  const nC = a.colunasMeta.length
  const nV = a.valoresMeta.length

  // Combinações ordenadas de linhas e colunas, extraídas da query principal.
  const rowOrder: string[] = []
  const rowDisplay = new Map<string, string[]>()
  const colOrder: string[] = []
  const colDisplay = new Map<string, string[]>()
  const cell = new Map<string, (number | null)[]>() // `${rk}||${ck}` → valores

  // Semente cronológica de datas (períodos sem dados aparecem com valores nulos).
  if (a.rowSeedDates && nL === 1 && a.linhasMeta[0].eData) {
    for (const d of a.rowSeedDates) {
      const rk = keyDim(d, a.linhasMeta[0])
      if (!rowDisplay.has(rk)) { rowOrder.push(rk); rowDisplay.set(rk, [displayDim(d, a.linhasMeta[0])]) }
    }
  }
  if (a.colSeedDates && nC === 1 && a.colunasMeta[0].eData) {
    for (const d of a.colSeedDates) {
      const ck = keyDim(d, a.colunasMeta[0])
      if (!colDisplay.has(ck)) { colOrder.push(ck); colDisplay.set(ck, [displayDim(d, a.colunasMeta[0])]) }
    }
  }

  for (const r of a.main) {
    const rParts: string[] = [], rDisp: string[] = []
    for (let i = 0; i < nL; i++) { rParts.push(keyDim(r[`d${i}`], a.linhasMeta[i])); rDisp.push(displayDim(r[`d${i}`], a.linhasMeta[i])) }
    const cParts: string[] = [], cDisp: string[] = []
    for (let i = 0; i < nC; i++) { cParts.push(keyDim(r[`d${nL + i}`], a.colunasMeta[i])); cDisp.push(displayDim(r[`d${nL + i}`], a.colunasMeta[i])) }
    const rk = rParts.join('¦'), ck = cParts.join('¦')
    if (!rowDisplay.has(rk)) { rowOrder.push(rk); rowDisplay.set(rk, rDisp) }
    if (nC > 0 && !colDisplay.has(ck)) { colOrder.push(ck); colDisplay.set(ck, cDisp) }
    cell.set(`${rk}||${ck}`, a.valoresMeta.map((_, vi) => numOrNull(r[`m${vi}`])))
  }

  // Totais por linha (agregado só por linhas) → coluna "Total" à direita
  const rowTot = new Map<string, (number | null)[]>()
  for (const r of a.rowTotais) {
    const parts: string[] = []
    for (let i = 0; i < nL; i++) parts.push(keyDim(r[`d${i}`], a.linhasMeta[i]))
    rowTot.set(parts.join('¦'), a.valoresMeta.map((_, vi) => numOrNull(r[`m${vi}`])))
  }
  // Totais por coluna (agregado só por colunas) → linha "Total" no rodapé
  const colTot = new Map<string, (number | null)[]>()
  for (const r of a.colTotais) {
    const parts: string[] = []
    for (let i = 0; i < nC; i++) parts.push(keyDim(r[`d${i}`], a.colunasMeta[i]))
    colTot.set(parts.join('¦'), a.valoresMeta.map((_, vi) => numOrNull(r[`m${vi}`])))
  }
  const grandVals: (number | null)[] = a.grand[0]
    ? a.valoresMeta.map((_, vi) => numOrNull(a.grand[0][`m${vi}`]))
    : a.valoresMeta.map(() => null)

  // Colunas-folha
  const leaves: LeafColumn[] = []
  const topHeader: { label: string; span: number; isTotal: boolean }[] | null = nC > 0 ? [] : null
  if (nC > 0) {
    for (const ck of colOrder) {
      const disp = colDisplay.get(ck)!
      topHeader!.push({ label: disp.join(' · '), span: nV, isTotal: false })
      for (const v of a.valoresMeta) leaves.push({ colPath: disp, isTotal: false, valorLabel: v.label, formato: v.formato })
    }
    topHeader!.push({ label: 'Total', span: nV, isTotal: true })
    for (const v of a.valoresMeta) leaves.push({ colPath: ['Total'], isTotal: true, valorLabel: v.label, formato: v.formato })
  } else {
    for (const v of a.valoresMeta) leaves.push({ colPath: [], isTotal: false, valorLabel: v.label, formato: v.formato })
  }

  // Linhas
  const rows: PivotRow[] = rowOrder.map((rk) => {
    const values: (number | null)[] = []
    if (nC > 0) {
      for (const ck of colOrder) {
        const cv = cell.get(`${rk}||${ck}`)
        for (let vi = 0; vi < nV; vi++) values.push(cv ? cv[vi] : null)
      }
      const rt = rowTot.get(rk)
      for (let vi = 0; vi < nV; vi++) values.push(rt ? rt[vi] : null)
    } else {
      const cv = cell.get(`${rk}||`)
      for (let vi = 0; vi < nV; vi++) values.push(cv ? cv[vi] : null)
    }
    return { dims: rowDisplay.get(rk)!, values }
  })

  // Por padrão, omite linhas em que TODOS os valores são nulos/zero.
  const rowsFiltradas = a.incluirVazios
    ? rows
    : rows.filter((r) => !r.values.every((v) => v === null || v === 0))

  // Linha Total (rodapé)
  const totalRow: (number | null)[] = []
  if (nC > 0) {
    for (const ck of colOrder) {
      const ct = colTot.get(ck)
      for (let vi = 0; vi < nV; vi++) totalRow.push(ct ? ct[vi] : null)
    }
    for (let vi = 0; vi < nV; vi++) totalRow.push(grandVals[vi])
  } else {
    for (let vi = 0; vi < nV; vi++) totalRow.push(grandVals[vi])
  }

  return {
    rowDimLabels: a.linhasMeta.map((m) => m.label),
    colDimLabels: a.colunasMeta.map((m) => m.label),
    valoresMeta: a.valoresMeta,
    topHeader,
    leaves,
    rows: rowsFiltradas,
    totalRow,
  }
}
