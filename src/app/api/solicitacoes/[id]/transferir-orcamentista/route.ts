import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

const schema = z.object({
  novo_orcamentista_id: z.number().int().positive(),
})

// POST /api/solicitacoes/:id/transferir-orcamentista
// RN-23: ADM_COMERCIAL transfere orçamentista; notifica saída e chegada
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  if (session.user.perfil !== 'ADM_COMERCIAL') {
    return NextResponse.json({ data: null, error: 'Apenas ADM_COMERCIAL pode transferir orçamentistas' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { novo_orcamentista_id } = parsed.data

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      orcamentista: { select: { id: true, nome: true } },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  if (sol.orcamentista_id === novo_orcamentista_id) {
    return NextResponse.json({ data: null, error: 'Orçamentista já é o responsável pela solicitação' }, { status: 409 })
  }

  const novoOrcamentista = await prisma.user.findUnique({
    where: { id: novo_orcamentista_id },
    select: { id: true, nome: true, perfil: true, ativo: true },
  })
  if (!novoOrcamentista || !novoOrcamentista.ativo || novoOrcamentista.perfil !== 'ORCAMENTISTA') {
    return NextResponse.json({ data: null, error: 'Orçamentista não encontrado ou inativo' }, { status: 404 })
  }

  const updated = await prisma.solicitacao.update({
    where: { id },
    data: { orcamentista_id: novo_orcamentista_id },
    include: { orcamentista: { select: { id: true, nome: true } } },
  })

  const linkSol = `/orcamentos/painel`

  // Notifica orçamentista anterior sobre a saída
  if (sol.orcamentista) {
    createNotificacao(
      sol.orcamentista.id,
      `Transferência de solicitação — ${sol.numero}`,
      `A solicitação ${sol.numero} foi transferida para ${novoOrcamentista.nome}. Você não é mais o responsável.`,
      linkSol,
    )
  }

  // Notifica novo orçamentista sobre a chegada
  createNotificacao(
    novo_orcamentista_id,
    `Nova solicitação atribuída — ${sol.numero}`,
    `Você é o novo orçamentista responsável pela solicitação ${sol.numero}.`,
    linkSol,
  )

  return NextResponse.json({ data: updated, error: null }, { status: 200 })
}
