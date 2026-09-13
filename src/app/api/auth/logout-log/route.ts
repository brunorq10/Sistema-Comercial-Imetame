import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/auth/logout-log — registro de acesso (rastreabilidade): chamado
// pelo cliente logo antes de signOut(). Best-effort, nunca bloqueia o logout.
export async function POST() {
  const session = await auth()
  if (session?.user) {
    await prisma.loginHistorico.create({
      data: { user_id: Number(session.user.id), email: session.user.email, sucesso: true, motivo: 'LOGOUT' },
    }).catch(() => null)
  }
  return NextResponse.json({ data: { ok: true }, error: null })
}
