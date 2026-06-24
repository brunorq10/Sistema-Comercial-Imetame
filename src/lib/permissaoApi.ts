import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { pode, type Permissao, type Usuario } from '@/lib/permissoes'

export function usuarioDaSessao(session: Session | null): Usuario | null {
  if (!session?.user) return null
  return {
    id: Number(session.user.id),
    perfil: session.user.perfil as Usuario['perfil'],
    is_analista_critico: session.user.is_analista_critico,
  }
}

export const respostaNaoAutorizado = () =>
  NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

export const respostaSemPermissao = () =>
  NextResponse.json({ data: null, error: 'Você não tem permissão para realizar esta ação.' }, { status: 403 })

// Guard para ações SEM titularidade: faz auth + verifica a permissão.
// Retorna { erro } (NextResponse a devolver) ou { usuario } quando autorizado.
export async function exigirPermissao(
  permissao: Permissao,
  opts?: { ehDono?: boolean },
): Promise<{ erro: NextResponse; usuario: null } | { erro: null; usuario: Usuario }> {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return { erro: respostaNaoAutorizado(), usuario: null }
  if (!pode(usuario, permissao, opts)) return { erro: respostaSemPermissao(), usuario: null }
  return { erro: null, usuario }
}
