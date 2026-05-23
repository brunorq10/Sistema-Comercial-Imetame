import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailNovaRevisao, createNotificacao } from '@/lib/notifications'

const schema = z.object({
  prazo_tecnica: z.string().nullable().optional(),
  prazo_tecnica_indeterminado: z.boolean().optional(),
  prazo_comercial: z.string().nullable().optional(),
  prazo_comercial_indeterminado: z.boolean().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  if (session.user.perfil !== 'ADM_COMERCIAL') {
    return NextResponse.json({ data: null, error: 'Apenas ADM_COMERCIAL pode criar revisões' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

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

  const d = parsed.data

  // Conta pendentes antes de fechar — necessário para a notificação (ALTO-6)
  const pendenteCount = await prisma.propostaComercial.count({
    where: { solicitacao_id: id, resultado: 'AGUARDANDO' },
  })

  // RN-46: Encerra propostas comerciais pendentes do ciclo atual
  await prisma.propostaComercial.updateMany({
    where: { solicitacao_id: id, resultado: 'AGUARDANDO' },
    data: { resultado: 'PERDEU', motivo_perda: 'OUTRO' },
  })

  // CRÍTICO-2: atualização atômica — WHERE em revisao_esperada age como compare-and-swap.
  // Se outro processo já incrementou, count=0 e retornamos 409.
  const updateResult = await prisma.solicitacao.updateMany({
    where: { id, revisao_esperada: sol.revisao_esperada },
    data: {
      revisao_esperada: novaRevisao,
      status: 'EM_ELABORACAO',
      ...(d.prazo_tecnica !== undefined && {
        prazo_tecnica: d.prazo_tecnica ? new Date(d.prazo_tecnica) : null,
      }),
      ...(d.prazo_tecnica_indeterminado !== undefined && {
        prazo_tecnica_indeterminado: d.prazo_tecnica_indeterminado,
      }),
      ...(d.prazo_comercial !== undefined && {
        prazo_comercial: d.prazo_comercial ? new Date(d.prazo_comercial) : null,
      }),
      ...(d.prazo_comercial_indeterminado !== undefined && {
        prazo_comercial_indeterminado: d.prazo_comercial_indeterminado,
      }),
    },
  })

  if (updateResult.count === 0) {
    return NextResponse.json(
      { data: null, error: 'Revisão já foi criada. Recarregue a página e tente novamente.' },
      { status: 409 },
    )
  }

  // ALTO-6: notifica orçamentista se havia propostas pendentes que foram encerradas
  if (pendenteCount > 0 && sol.orcamentista_id) {
    createNotificacao(
      sol.orcamentista_id,
      `Nova revisão criada — ${sol.numero}`,
      `A revisão Rev${String(novaRevisao - 1).padStart(2, '0')} foi aberta. ${pendenteCount} proposta(s) pendente(s) foram encerradas automaticamente.`,
      '/orcamentos/painel',
    )
  }

  if (sol.orcamentista?.email) {
    emailNovaRevisao(sol.orcamentista.email, sol.numero, novaRevisao)
  }

  const updated = await prisma.solicitacao.findUnique({ where: { id } })
  return NextResponse.json({ data: updated, error: null }, { status: 200 })
}
