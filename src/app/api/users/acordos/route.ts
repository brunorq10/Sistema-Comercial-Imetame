import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const users = await prisma.user.findMany({
    where: {
      ativo: true,
      perfil: { in: ['ACORDOS', 'GESTAO_ACORDOS', 'ADM_GERAL', 'ADM_COMERCIAL'] },
    },
    select: { id: true, nome: true, perfil: true },
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json({ data: users, error: null })
}
