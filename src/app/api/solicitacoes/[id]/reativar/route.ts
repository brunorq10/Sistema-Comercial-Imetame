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

  // ── SUSPENSA → reativa restaurando o status conforme o andamento das propostas ──
  if (sol.status === 'SUSPENSA') {
    const [ganhouComercial, ganhouFabricacao, enviada] = await Promise.all([
      prisma.propostaComercial.findFirst({ where: { solicitacao_id: id, resultado: 'GANHOU' }, select: { id: true } }),
      prisma.propostaFabricacao.findFirst({ where: { solicitacao_id: id, resultado: 'GANHOU' }, select: { id: true } }),
      prisma.propostaComercial.findFirst({ where: { solicitacao_id: id, data_envio: { not: null } }, select: { id: true } })
        .then(async (r) => r
          ?? await prisma.propostaTecnica.findFirst({ where: { solicitacao_id: id, data_envio: { not: null } }, select: { id: true } })
          ?? await prisma.propostaFabricacao.findFirst({ where: { solicitacao_id: id, data_envio: { not: null } }, select: { id: true } })),
    ])
    const novoStatus = (ganhouComercial || ganhouFabricacao)
      ? 'CONTRATO_GANHO'
      : enviada ? 'PROPOSTA_ENVIADA' : 'EM_ELABORACAO'

    await prisma.solicitacao.update({
      where: { id },
      data: { status: novoStatus, suspended_at: null, suspend_reason: null },
    })

    if (sol.orcamentista_id) {
      await createNotificacao(
        sol.orcamentista_id,
        `Solicitação reativada — ${sol.numero}`,
        `A solicitação ${sol.numero} — ${sol.cliente.nome} foi reativada e voltou ao seu painel.`,
        '/orcamentos/painel',
      )
    }
    return NextResponse.json({ data: null, error: null })
  }

  if (!sol.cancelled_at) {
    return NextResponse.json(
      { data: null, error: 'Apenas solicitações canceladas ou suspensas podem ser reativadas' },
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
