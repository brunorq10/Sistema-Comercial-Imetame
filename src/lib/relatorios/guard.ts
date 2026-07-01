import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'

// Perfis com acesso ao Construtor de Relatório (ferramenta gerencial).
const PERFIS_OK = ['ADM_GERAL', 'ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'GESTAO_ACORDOS']

export function podeRelatorios(perfil?: string | null, isAnalista?: boolean): boolean {
  return (!!perfil && PERFIS_OK.includes(perfil)) || !!isAnalista
}

type Guarded =
  | { ok: true; session: Session }
  | { ok: false; res: NextResponse }

export async function guardRelatorios(): Promise<Guarded> {
  const session = await auth()
  if (!session) return { ok: false, res: NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 }) }
  if (!podeRelatorios(session.user.perfil, session.user.is_analista_critico)) {
    return { ok: false, res: NextResponse.json({ data: null, error: 'Sem permissão para o Construtor de Relatório' }, { status: 403 }) }
  }
  return { ok: true, session }
}
