import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

// POST /api/solicitacoes/:id/reativar
// RN-15: Adm Comercial reativa solicitação cancelada
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true } },
    },
  })
  if (!sol) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (!sol.cancelled_at) {
    return NextResponse.json(
      { data: null, error: 'Apenas solicitações canceladas podem ser reativadas' },
      { status: 409 },
    )
  }

  // RN-15: Retorna com status Em Análise, motivo de reprovação vai ao histórico (limpa display)
  await prisma.solicitacao.update({
    where: { id },
    data: {
      cancelled_at: null,
      cancel_reason: null,
      status: 'AGUARDANDO_ANALISE',
      status_analise: 'AGUARDANDO',
      motivo_reprovacao: null,
      obs_reprovacao: null,
      motivo_recusa: null,
    },
  })

  // Notificar analista crítico sobre a reativação
  const analistaCritico = await prisma.user.findFirst({
    where: { is_analista_critico: true, ativo: true },
    select: { id: true },
  })
  if (analistaCritico) {
    await createNotificacao(
      analistaCritico.id,
      `Solicitação reativada — ${sol.numero}`,
      `A solicitação ${sol.numero} — ${sol.cliente.nome} foi reativada e aguarda análise.`,
      '/orcamentos/analise',
    )
  }

  return NextResponse.json({ data: null, error: null })
}
