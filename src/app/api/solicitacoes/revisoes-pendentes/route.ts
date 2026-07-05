import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — revisões aguardando avaliação (Meu Painel).
// Orçamentista vê as das suas solicitações; Analista Crítico e ADM Geral veem todas.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)
  const veTodas = !!session.user.is_analista_critico || session.user.perfil === 'ADM_GERAL'

  const pendentes = await prisma.revisaoPendente.findMany({
    where: {
      status: 'PENDENTE',
      solicitacao: { cancelled_at: null, ...(veTodas ? {} : { orcamentista_id: userId }) },
    },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      payload: true,
      created_at: true,
      criador: { select: { nome: true } },
      solicitacao: {
        select: {
          id: true, numero: true, escopo: true, revisao_esperada: true,
          cliente: { select: { nome: true } },
          propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1, select: { versao: true } },
        },
      },
    },
  })

  return NextResponse.json({
    data: pendentes.map((p) => {
      const payload = p.payload as { as_sold?: boolean; escopo?: string } | null
      // Mesma regra do aplicarRevisao: próxima = max(esperada, última técnica) + 1
      const ultimaVersao = p.solicitacao.propostas_tecnicas[0]?.versao ?? 0
      const novaRevisao = Math.max(p.solicitacao.revisao_esperada, ultimaVersao) + 1
      return {
        id: p.id,
        solicitacao_id: p.solicitacao.id,
        numero: p.solicitacao.numero,
        cliente: p.solicitacao.cliente.nome,
        escopo_atual: p.solicitacao.escopo,
        escopo_novo: payload?.escopo ?? null,
        as_sold: payload?.as_sold ?? false,
        proxima_rev: payload?.as_sold ? 'As Sold.' : `Rev${String(novaRevisao - 1).padStart(2, '0')}`,
        criador: p.criador.nome,
        created_at: p.created_at.toISOString(),
      }
    }),
    error: null,
  })
}
