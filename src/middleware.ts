import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login']

const PERFIS_COMERCIAL = ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ORCAMENTISTA', 'ADM_GERAL']
const PERFIS_ACORDOS = ['ADM_COMERCIAL', 'GESTAO_ACORDOS', 'ACORDOS', 'ADM_GERAL']
const PERFIS_CADASTROS = ['ADM_COMERCIAL', 'ADM_GERAL']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!req.auth && !isPublic) {
    // Chamadas de API recebem 401 JSON (o cliente trata sessão expirada);
    // navegação de telas é redirecionada para o login.
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ data: null, error: 'Sessão expirada ou não autenticada' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL('/orcamentos/solicitacoes', req.url))
  }

  const perfil = req.auth?.user?.perfil as string | undefined

  if (pathname.startsWith('/orcamentos') && perfil && !PERFIS_COMERCIAL.includes(perfil)) {
    return NextResponse.redirect(new URL('/acordos/painel', req.url))
  }

  if (pathname.startsWith('/acordos') && perfil && !PERFIS_ACORDOS.includes(perfil)) {
    return NextResponse.redirect(new URL('/orcamentos/solicitacoes', req.url))
  }

  if (pathname.startsWith('/cadastros') && perfil && !PERFIS_CADASTROS.includes(perfil)) {
    return NextResponse.redirect(new URL('/orcamentos/solicitacoes', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
