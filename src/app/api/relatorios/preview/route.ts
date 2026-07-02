import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { guardRelatorios } from '@/lib/relatorios/guard'
import { reportRequestSchema, validarRequest, gerarPivot, erroAmigavel } from '@/lib/relatorios/service'
import type { ReportRequest } from '@/lib/relatorios/query'

// Preview: no máximo 50 grupos. Chamado com debounce pelo frontend.
export async function POST(req: NextRequest) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res

  const parsed = reportRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Configuração inválida' }, { status: 400 })

  const reqData = parsed.data as ReportRequest
  const erro = validarRequest(reqData)
  if (erro) return NextResponse.json({ data: null, error: erro }, { status: 400 })

  try {
    const r = await gerarPivot(reqData, 50)
    return NextResponse.json({ data: { ...r, preview: true }, error: null })
  } catch (err) {
    logger.error('[POST /api/relatorios/preview]', err)
    const { status, msg } = erroAmigavel(err)
    return NextResponse.json({ data: null, error: msg }, { status })
  }
}
