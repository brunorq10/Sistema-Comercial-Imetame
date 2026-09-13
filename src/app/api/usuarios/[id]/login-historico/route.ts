import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaSemPermissao } from '@/lib/permissaoApi'

// GET /api/usuarios/:id/login-historico — últimos acessos (login/logout,
// sucesso e falha) do usuário. Restrito a quem gerencia usuários.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!pode(usuarioDaSessao(session), 'cadastro.usuario.gerenciar')) return respostaSemPermissao()

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const registros = await prisma.loginHistorico.findMany({
    where: { user_id: id },
    orderBy: { created_at: 'desc' },
    take: 20,
    select: { id: true, sucesso: true, motivo: true, created_at: true },
  })

  const data = registros.map((r) => ({
    id: r.id,
    sucesso: r.sucesso,
    motivo: r.motivo,
    quando: r.created_at.toISOString(),
  }))

  return NextResponse.json({ data, error: null })
}
