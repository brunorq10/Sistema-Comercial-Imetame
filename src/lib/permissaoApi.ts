import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode, ehDono, type Permissao, type Usuario } from '@/lib/permissoes'

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

// Guard por titularidade da SOLICITAÇÃO (dono = orcamentista). Busca o registro,
// calcula ehDono e verifica. Retorna NextResponse (negado) ou null (autorizado).
export async function exigirTitularSolicitacao(
  session: Session | null,
  solicitacaoId: number,
  permissao: Permissao,
): Promise<NextResponse | null> {
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  const sol = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId }, select: { orcamentista_id: true } })
  if (!pode(usuario, permissao, { ehDono: ehDono(usuario, sol, 'solicitacao') })) return respostaSemPermissao()
  return null
}

// Guard por titularidade do CONTRATO (dono = responsável).
export async function exigirTitularContrato(
  session: Session | null,
  contratoId: number,
  permissao: Permissao,
): Promise<NextResponse | null> {
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  const ct = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { responsavel_id: true } })
  if (!pode(usuario, permissao, { ehDono: ehDono(usuario, ct, 'contrato') })) return respostaSemPermissao()
  return null
}
