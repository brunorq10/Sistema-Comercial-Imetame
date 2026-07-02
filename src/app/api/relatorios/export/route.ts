import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { logger } from '@/lib/logger'
import { guardRelatorios } from '@/lib/relatorios/guard'
import { reportRequestSchema, validarRequest, gerarPivot, erroAmigavel } from '@/lib/relatorios/service'
import type { ReportRequest } from '@/lib/relatorios/query'

const MODULO_LABEL: Record<string, string> = { comercial: 'Comercial', acordos: 'Acordos (Faturamento)' }

function numFmt(formato: string): string | undefined {
  if (formato === 'moeda') return 'R$ #,##0.00'
  if (formato === 'percent') return '0.0"%"'
  if (formato === 'decimal') return '#,##0.00'
  if (formato === 'numero') return '#,##0'
  return undefined
}

// Geração síncrona (MVP). Para volumes muito grandes, a geração assíncrona por
// job fica para uma fase posterior (requer infraestrutura de fila).
export async function POST(req: NextRequest) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res

  const body = await req.json().catch(() => null)
  const parsed = reportRequestSchema.safeParse(body?.relatorio ?? body)
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Configuração inválida' }, { status: 400 })
  const nome: string = typeof body?.nome === 'string' ? body.nome : 'Relatório'

  const reqData = parsed.data as ReportRequest
  const erro = validarRequest(reqData)
  if (erro) return NextResponse.json({ data: null, error: erro }, { status: 400 })

  try {
    const { pivot, dataFiltroLabel, semFiltroData } = await gerarPivot(reqData)

    const nRD = pivot.rowDimLabels.length
    const aoa: (string | number | null)[][] = []
    const merges: XLSX.Range[] = []

    // Cabeçalho
    if (pivot.topHeader) {
      const h1: (string | null)[] = pivot.rowDimLabels.map(() => null)
      let col = nRD
      for (const g of pivot.topHeader) {
        h1.push(g.label)
        for (let k = 1; k < g.span; k++) h1.push(null)
        if (g.span > 1) merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + g.span - 1 } })
        col += g.span
      }
      aoa.push(h1)
      aoa.push([...pivot.rowDimLabels, ...pivot.leaves.map((l) => l.valorLabel)])
    } else {
      aoa.push([...pivot.rowDimLabels, ...pivot.leaves.map((l) => l.valorLabel)])
    }
    const headerRows = pivot.topHeader ? 2 : 1

    // Dados
    for (const r of pivot.rows) {
      aoa.push([...r.dims, ...r.values.map((v) => (v === null ? null : v))])
    }
    // Total
    const totalLabel: (string | null)[] = ['Total', ...pivot.rowDimLabels.slice(1).map(() => null)]
    aoa.push([...totalLabel, ...pivot.totalRow.map((v) => (v === null ? null : v))])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    if (merges.length) ws['!merges'] = merges

    // Formatos numéricos por coluna-folha
    const totalDataRows = pivot.rows.length + 1 // + linha Total
    pivot.leaves.forEach((leaf, li) => {
      const fmt = numFmt(leaf.formato)
      if (!fmt) return
      const c = nRD + li
      for (let i = 0; i < totalDataRows; i++) {
        const r = headerRows + i
        const addr = XLSX.utils.encode_cell({ r, c })
        const cellRef = ws[addr]
        if (cellRef && typeof cellRef.v === 'number') cellRef.z = fmt
      }
    })

    // Largura das colunas
    ws['!cols'] = [
      ...pivot.rowDimLabels.map(() => ({ wch: 22 })),
      ...pivot.leaves.map((l) => ({ wch: Math.max(12, l.valorLabel.length + 2) })),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado')

    // Aba Configuração
    const cfg: (string | null)[][] = [
      ['Construtor de Relatório'],
      ['Relatório', nome],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ['Módulo', MODULO_LABEL[reqData.modulo] ?? reqData.modulo],
      [],
      ['Linhas', pivot.rowDimLabels.join(' · ') || '—'],
      ['Colunas', pivot.colDimLabels.join(' · ') || '—'],
      ['Valores', pivot.valoresMeta.map((v) => v.label).join(' · ') || '—'],
      ['Aplicado sobre', dataFiltroLabel],
      ['Período', semFiltroData
        ? 'SEM FILTRO DE DATA (todos os registros históricos incluídos)'
        : `${reqData.filtros.de ?? '—'} a ${reqData.filtros.ate ?? '—'}`],
    ]
    const wsCfg = XLSX.utils.aoa_to_sheet(cfg)
    wsCfg['!cols'] = [{ wch: 16 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, wsCfg, 'Configuração')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const fileName = `relatorio_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    logger.error('[POST /api/relatorios/export]', err)
    const { status, msg } = erroAmigavel(err)
    return NextResponse.json({ data: null, error: msg }, { status })
  }
}
