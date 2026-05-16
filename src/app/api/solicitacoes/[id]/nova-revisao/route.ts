import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailNovaRevisao } from '@/lib/notifications'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  if (session.user.perfil !== 'ADM_COMERCIAL') {
    return NextResponse.json({ data: null, error: 'Apenas ADM_COMERCIAL pode criar revisões' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1 },
      orcamentista: { select: { email: true, nome: true } },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (!sol.orcamentista_id) {
    return NextResponse.json({ data: null, error: 'Solicitação sem orçamentista atribuído' }, { status: 400 })
  }

  const ultimaVersao = sol.propostas_tecnicas[0]?.versao ?? 0
  const novaRevisao = Math.max(sol.revisao_esperada, ultimaVersao) + 1

  const updated = await prisma.solicitacao.update({
    where: { id },
    data: {
      revisao_esperada: novaRevisao,
      status: 'EM_ELABORACAO',
    },
  })

  if (sol.orcamentista?.email) {
    emailNovaRevisao(sol.orcamentista.email, sol.numero, novaRevisao)
  }

  return NextResponse.json({ data: updated, error: null }, { status: 200 })
}
