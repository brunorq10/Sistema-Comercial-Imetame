import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarExcecoes } from '@/lib/excecoes'

// GET /api/excecoes — Painel de Exceções. Acessível a qualquer usuário
// autenticado; o escopo (quais exceções aparecem) é resolvido por perfil
// dentro de listarExcecoes, igual à regra combinada com o usuário.
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const usuario = {
    id: Number(session.user.id),
    perfil: session.user.perfil as string,
    is_analista_critico: !!session.user.is_analista_critico,
  }

  const data = await listarExcecoes(usuario)
  return NextResponse.json({ data, error: null })
}
