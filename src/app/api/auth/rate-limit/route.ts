import { NextRequest, NextResponse } from 'next/server'
import { loginRateLimit } from '@/lib/rate-limit'

// Endpoint público (usuário ainda não autenticado) — retorna estado do rate limit para exibição na tela de login
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') ?? ''
  if (!email) {
    return NextResponse.json({ locked: false, attemptsLeft: 5, waitMinutes: 0 })
  }
  const state = loginRateLimit.check(email)
  return NextResponse.json(state)
}
