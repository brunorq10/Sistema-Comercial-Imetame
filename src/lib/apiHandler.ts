import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Envelopa um route handler com try/catch padrão.
// Qualquer exceção não tratada vira uma resposta { data: null, error } com status 500,
// mantendo o contrato de resposta do sistema em vez de um 500 "cru" do Next.
type RouteHandler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse> | NextResponse

export function withApi<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      logger.error(`[API ${req.method} ${req.nextUrl?.pathname ?? ''}]`, err)
      return NextResponse.json(
        { data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' },
        { status: 500 },
      )
    }
  }
}
