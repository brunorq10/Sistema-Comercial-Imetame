import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao, sendEmailAsync } from '@/lib/notifications'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaSemPermissao } from '@/lib/permissaoApi'
import { revisaoPayloadSchema } from '@/lib/revisoes'

// A abertura de revisão NÃO aplica mais nada de imediato: cria uma pendência
// que o orçamentista da solicitação avalia no Meu Painel. Só após a aprovação
// dele a revisão é registrada (aplicarRevisao) e o fluxo normal continua.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  if (!pode(usuarioDaSessao(session), 'orc.solicitacao.revisao')) return respostaSemPermissao()

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const parsed = revisaoPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    select: {
      id: true, numero: true, cancelled_at: true, as_sold: true, orcamentista_id: true,
      cliente: { select: { nome: true } },
      orcamentista: { select: { email: true, nome: true } },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (!sol.orcamentista_id) {
    return NextResponse.json({ data: null, error: 'Solicitação sem orçamentista atribuído' }, { status: 400 })
  }
  if (sol.as_sold) {
    return NextResponse.json(
      { data: null, error: 'Esta solicitação já possui uma revisão As Sold. Não é possível criar novas revisões.' },
      { status: 409 },
    )
  }

  const jaPendente = await prisma.revisaoPendente.findFirst({
    where: { solicitacao_id: id, status: 'PENDENTE' },
    select: { id: true },
  })
  if (jaPendente) {
    return NextResponse.json(
      { data: null, error: 'Já existe uma revisão aguardando avaliação do orçamentista para esta solicitação.' },
      { status: 409 },
    )
  }

  const pendente = await prisma.revisaoPendente.create({
    data: {
      solicitacao_id: id,
      payload: parsed.data as unknown as Prisma.InputJsonValue,
      created_by: Number(session.user.id),
    },
  })

  // Notifica o orçamentista (in-app + e-mail): há uma revisão para ele avaliar
  const label = parsed.data.as_sold ? 'As Sold.' : 'nova revisão'
  createNotificacao(
    sol.orcamentista_id,
    `Revisão aguardando sua avaliação — ${sol.numero}`,
    `Foi aberta uma ${label} para a solicitação ${sol.numero} (${sol.cliente.nome}). Avalie no Meu Painel se é de fato uma revisão.`,
    '/orcamentos/painel',
  )
  if (sol.orcamentista?.email) {
    sendEmailAsync({
      to: sol.orcamentista.email,
      subject: `[Sistema Comercial] Revisão aguardando avaliação — ${sol.numero}`,
      html: `<p>Olá, ${sol.orcamentista.nome}.</p>
        <p>Foi aberta uma ${label} para a solicitação <strong>${sol.numero}</strong> (${sol.cliente.nome}).</p>
        <p>Acesse o Meu Painel para avaliar se é de fato uma revisão ou devolvê-la com justificativa.</p>`,
    })
  }

  return NextResponse.json({
    data: { id: pendente.id, pendente: true },
    message: 'Revisão enviada para avaliação do orçamentista. Ela só será registrada após a aprovação.',
    error: null,
  }, { status: 201 })
}
