import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { guardRelatorios } from '@/lib/relatorios/guard'
import { reportRequestSchema, validarRequest, gerarPivot } from '@/lib/relatorios/service'
import type { ReportRequest } from '@/lib/relatorios/query'

// Execução completa: sem limite de linhas. Chamado só no clique "Atualizar".
export async function POST(req: NextRequest) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res

  const parsed = reportRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Configuração inválida' }, { status: 400 })

  const reqData = parsed.data as ReportRequest
  const erro = validarRequest(reqData)
  if (erro) return NextResponse.json({ data: null, error: erro }, { status: 400 })

  try {
    const r = await gerarPivot(reqData)
    return NextResponse.json({ data: { ...r, preview: false }, error: null })
  } catch (err) {
    logger.error('[POST /api/relatorios/executar]', err)
    return NextResponse.json({ data: null, error: 'Erro ao executar o relatório.' }, { status: 500 })
  }
}
