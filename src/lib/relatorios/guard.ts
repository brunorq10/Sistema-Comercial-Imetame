import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'

// O Construtor de Relatório é liberado para TODOS os usuários autenticados.
// Os relatórios salvos (Favoritos) são por usuário (escopo created_by nas rotas).
type Guarded =
  | { ok: true; session: Session }
  | { ok: false; res: NextResponse }

export async function guardRelatorios(): Promise<Guarded> {
  const session = await auth()
  if (!session) return { ok: false, res: NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 }) }
  return { ok: true, session }
}
