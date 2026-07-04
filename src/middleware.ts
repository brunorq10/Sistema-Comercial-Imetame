import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login']

// RN: todos os perfis podem VISUALIZAR Orçamentos e Acordos (as ações são
// restritas por permissão em cada rota). Cadastros é módulo de gestão:
// acessível ao ADM Comercial, ADM Geral e a quem tem o flag Analista Crítico.
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
  const isAnalista = !!req.auth?.user?.is_analista_critico

  // Apenas o módulo Cadastros permanece com acesso restrito a nível de tela.
  if (pathname.startsWith('/cadastros')) {
    const podeCadastros = perfil === 'ADM_GERAL' || perfil === 'ADM_COMERCIAL' || isAnalista
    if (perfil && !podeCadastros) {
      return NextResponse.redirect(new URL('/orcamentos/solicitacoes', req.url))
    }
  }

  // Construtor de Relatório: liberado para todos os usuários autenticados.

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
