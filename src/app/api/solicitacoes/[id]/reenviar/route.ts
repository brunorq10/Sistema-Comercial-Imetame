import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

// POST /api/solicitacoes/:id/reenviar
// RN-22: Adm Comercial reenvia solicitação reprovada → volta para Em Análise
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
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (sol.status_analise !== 'REPROVADA') {
    return NextResponse.json(
      { data: null, error: 'Apenas solicitações reprovadas podem ser reenviadas' },
      { status: 409 },
    )
  }

  // Mover motivo de reprovação para histórico (limpar campos de reprovação)
  await prisma.solicitacao.update({
    where: { id },
    data: {
      status_analise: 'AGUARDANDO',
      status: 'AGUARDANDO_ANALISE',
      motivo_reprovacao: null,
      obs_reprovacao: null,
      motivo_recusa: null,
    },
  })

  // Notificar analista crítico
  const analistaCritico = await prisma.user.findFirst({
    where: { is_analista_critico: true, ativo: true },
    select: { id: true },
  })
  if (analistaCritico) {
    await createNotificacao(
      analistaCritico.id,
      `Solicitação reenviada — ${sol.numero}`,
      `A solicitação ${sol.numero} — ${sol.cliente.nome} foi reenviada após reprovação e aguarda nova análise.`,
      '/orcamentos/analise',
    )
  }

  return NextResponse.json({ data: null, error: null })
}
