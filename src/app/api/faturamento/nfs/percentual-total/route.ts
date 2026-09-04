import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const numero_nf = req.nextUrl.searchParams.get('numero_nf')
  if (!numero_nf) return NextResponse.json({ data: null, error: 'numero_nf obrigatório' }, { status: 400 })

  const [result, existente] = await Promise.all([
    prisma.notaFiscalContrato.aggregate({
      where: { numero_nf, ativa: true, deleted_at: null },
      _sum: { percentual: true },
    }),
    prisma.notaFiscalContrato.findFirst({
      where: { numero_nf, ativa: true, deleted_at: null },
      orderBy: { created_at: 'asc' },
      select: { valor_total_nf: true },
    }),
  ])

  const total = Number(result._sum.percentual ?? 0)
  const valor_total_nf = existente ? Number(existente.valor_total_nf) : null
  return NextResponse.json({ data: { total, valor_total_nf }, error: null })
}
