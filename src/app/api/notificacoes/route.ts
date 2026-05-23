import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const userId = Number(session.user.id)

  // RN-51: Purga notificações com mais de 90 dias (não-bloqueante)
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  prisma.notificacao.deleteMany({ where: { created_at: { lt: cutoff } } }).catch(() => null)

  const [notificacoes, total_nao_lidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 30,
    }),
    prisma.notificacao.count({
      where: { user_id: userId, lida: false },
    }),
  ])

  const data = notificacoes.map((n) => ({
    ...n,
    created_at: n.created_at.toISOString(),
  }))

  return NextResponse.json({ data, total_nao_lidas, error: null })
}

// PATCH /api/notificacoes → marca todas como lidas
// PATCH /api/notificacoes?id=X → marca uma como lida
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const userId = Number(session.user.id)
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    await prisma.notificacao.updateMany({
      where: { id: Number(id), user_id: userId },
      data: { lida: true },
    })
  } else {
    await prisma.notificacao.updateMany({
      where: { user_id: userId, lida: false },
      data: { lida: true },
    })
  }

  return NextResponse.json({ data: null, error: null })
}
