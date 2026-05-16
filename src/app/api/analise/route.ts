import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/analise → lista solicitações aguardando análise
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  if (!session.user.is_analista_critico) {
    return NextResponse.json({ data: null, error: 'Acesso negado' }, { status: 403 })
  }

  const solicitacoes = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null,
      status_analise: 'AGUARDANDO',
    },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      numero: true,
      created_at: true,
      escopo: true,
      classificacao: true,
      interesse: true,
      origem: true,
      cidade: true,
      estado: true,
      visita_tecnica: true,
      status_analise: true,
      cliente: { select: { id: true, nome: true } },
      criador: { select: { id: true, nome: true } },
    },
  })

  const now = new Date()
  const data = solicitacoes.map((s) => {
    const diffMs = now.getTime() - s.created_at.getTime()
    const dias_aguardando = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return {
      ...s,
      created_at: s.created_at.toISOString(),
      dias_aguardando,
    }
  })

  return NextResponse.json({ data, error: null })
}
