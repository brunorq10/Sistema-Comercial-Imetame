import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { aplicarRevisao, revisaoPayloadSchema } from '@/lib/revisoes'

const schema = z.object({
  acao: z.enum(['APROVAR', 'RECUSAR']),
  justificativa: z.string().trim().optional(),
})

// PUT — o orçamentista avalia a revisão pendente.
// APROVAR: registra como revisão (aplicarRevisao) e o fluxo normal continua.
// RECUSAR: devolve com justificativa obrigatória; nada é alterado na solicitação.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Dados inválidos' }, { status: 400 })
  const { acao, justificativa } = parsed.data

  const pendente = await prisma.revisaoPendente.findUnique({
    where: { id },
    include: {
      solicitacao: { select: { id: true, numero: true, orcamentista_id: true, cliente: { select: { nome: true } } } },
    },
  })
  if (!pendente || pendente.status !== 'PENDENTE') {
    return NextResponse.json({ data: null, error: 'Revisão pendente não encontrada ou já avaliada' }, { status: 404 })
  }

  // Podem avaliar: o orçamentista designado, o Analista Crítico e o ADM Geral
  const podeAvaliar = pendente.solicitacao.orcamentista_id === userId ||
    !!session.user.is_analista_critico || session.user.perfil === 'ADM_GERAL'
  if (!podeAvaliar) {
    return NextResponse.json({ data: null, error: 'Apenas o orçamentista designado ou o Analista Crítico podem avaliar esta revisão' }, { status: 403 })
  }

  if (acao === 'RECUSAR') {
    if (!justificativa || justificativa.length < 3) {
      return NextResponse.json({ data: null, error: 'Informe a justificativa da devolução (mínimo 3 caracteres)' }, { status: 400 })
    }
    await prisma.revisaoPendente.update({
      where: { id },
      data: { status: 'RECUSADA', justificativa, avaliado_por: userId, avaliado_em: new Date() },
    })
    createNotificacao(
      pendente.created_by,
      `Revisão devolvida — ${pendente.solicitacao.numero}`,
      `O orçamentista avaliou que não se trata de uma revisão. Justificativa: ${justificativa}`,
      '/orcamentos/solicitacoes',
    )
    return NextResponse.json({ data: { id, status: 'RECUSADA' }, error: null })
  }

  // APROVAR — valida o payload guardado e aplica a revisão (fluxo normal)
  const payload = revisaoPayloadSchema.safeParse(pendente.payload)
  if (!payload.success) {
    return NextResponse.json({ data: null, error: 'Dados da revisão inválidos — devolva e abra novamente.' }, { status: 422 })
  }

  const resultado = await aplicarRevisao(pendente.solicitacao.id, payload.data, pendente.created_by)
  if (!resultado.ok) {
    return NextResponse.json({ data: null, error: resultado.error }, { status: resultado.status })
  }

  await prisma.revisaoPendente.update({
    where: { id },
    data: { status: 'APROVADA', avaliado_por: userId, avaliado_em: new Date() },
  })
  createNotificacao(
    pendente.created_by,
    `Revisão aprovada — ${pendente.solicitacao.numero}`,
    `O orçamentista confirmou a revisão da solicitação ${pendente.solicitacao.numero} (${pendente.solicitacao.cliente.nome}). Ela foi registrada e segue o fluxo normal.`,
    '/orcamentos/solicitacoes',
  )

  return NextResponse.json({ data: { id, status: 'APROVADA', novaRevisao: resultado.novaRevisao }, error: null })
}
