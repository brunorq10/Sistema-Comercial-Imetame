import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const schema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('classificar'), nivel: z.enum(['ALTA', 'MEDIA', 'BAIXA', 'BUDGET']) }),
  z.object({ acao: z.literal('revisar') }),
  z.object({ acao: z.literal('remover') }),
  z.object({ acao: z.literal('restaurar') }),
])

// PATCH /api/probabilidade/:solicitacaoId — classificar, revisar (confirma sem
// mudar de nível), remover do painel (soft-cancel, não afeta a proposta) ou
// restaurar (traz de volta uma proposta removida — usado por "Incluir proposta").
export async function PATCH(req: NextRequest, { params }: { params: { solicitacaoId: string } }) {
  const { erro, usuario } = await exigirPermissao('probabilidade.editar')
  if (erro) return erro

  const solicitacaoId = Number(params.solicitacaoId)
  if (isNaN(solicitacaoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id: solicitacaoId }, select: { id: true } })
  if (!solicitacao) return NextResponse.json({ data: null, error: 'Proposta não encontrada' }, { status: 404 })

  const atual = await prisma.painelProbabilidade.findUnique({ where: { solicitacao_id: solicitacaoId } })
  const d = parsed.data

  if (d.acao === 'classificar') {
    const painel = await prisma.painelProbabilidade.upsert({
      where: { solicitacao_id: solicitacaoId },
      create: {
        solicitacao_id: solicitacaoId, nivel: d.nivel, created_by: usuario.id,
        revisado_em: new Date(), revisado_por: usuario.id,
      },
      update: {
        nivel: d.nivel, updated_by: usuario.id,
        revisado_em: new Date(), revisado_por: usuario.id,
        cancelled_at: null, cancel_reason: null,
      },
    })
    await prisma.painelProbabilidadeHistorico.create({
      data: { painel_id: painel.id, nivel_de: atual?.nivel ?? null, nivel_para: d.nivel, created_by: usuario.id },
    })
    return NextResponse.json({ data: painel, error: null })
  }

  if (d.acao === 'revisar') {
    if (!atual || atual.cancelled_at) {
      return NextResponse.json({ data: null, error: 'Esta proposta ainda não foi classificada.' }, { status: 400 })
    }
    const painel = await prisma.painelProbabilidade.update({
      where: { solicitacao_id: solicitacaoId },
      data: { revisado_em: new Date(), revisado_por: usuario.id, updated_by: usuario.id },
    })
    await prisma.painelProbabilidadeHistorico.create({
      data: { painel_id: painel.id, nivel_de: atual.nivel, nivel_para: atual.nivel, created_by: usuario.id },
    })
    return NextResponse.json({ data: painel, error: null })
  }

  if (d.acao === 'remover') {
    const painel = await prisma.painelProbabilidade.upsert({
      where: { solicitacao_id: solicitacaoId },
      create: { solicitacao_id: solicitacaoId, created_by: usuario.id, cancelled_at: new Date() },
      update: { cancelled_at: new Date(), updated_by: usuario.id },
    })
    return NextResponse.json({ data: painel, error: null })
  }

  // restaurar — só faz sentido para um registro previamente removido
  if (!atual || !atual.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Esta proposta já está no painel.' }, { status: 400 })
  }
  const painel = await prisma.painelProbabilidade.update({
    where: { solicitacao_id: solicitacaoId },
    data: { cancelled_at: null, cancel_reason: null, nivel: null, updated_by: usuario.id },
  })
  return NextResponse.json({ data: painel, error: null })
}
