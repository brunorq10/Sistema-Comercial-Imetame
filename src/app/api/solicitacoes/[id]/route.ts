import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailStatusAlterado } from '@/lib/notifications'
import { createNotificacao } from '@/lib/notifications'
import type { Classificacao, Interesse, Origem, Segmento, StatusSolicitacao } from '@prisma/client'

// ─── GET /api/solicitacoes/:id ────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      cliente_final: { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
      criador: { select: { id: true, nome: true } },
      propostas_tecnicas: { orderBy: { versao: 'desc' } },
      propostas_comerciais: { orderBy: { versao: 'desc' } },
      propostas_fabricacao: { orderBy: { versao: 'desc' } },
    },
  })

  if (!sol) return NextResponse.json({ data: null, error: 'Não encontrada' }, { status: 404 })

  return NextResponse.json({ data: sol, error: null })
}

// ─── PUT /api/solicitacoes/:id ────────────────────────────────────────────────

const updateSchema = z.object({
  cliente_id: z.number().int().positive().optional(),
  cliente_final_id: z.number().int().positive().nullable().optional(),
  data_recebimento: z.string().nullable().optional(),
  segmento: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'OLEO_GAS', 'OUTROS']).nullable().optional(),
  contato: z.string().optional(),
  referencia_cliente: z.string().nullable().optional(),
  comprador: z.string().nullable().optional(),
  telefone_comprador: z.string().nullable().optional(),
  email_comprador: z.string().nullable().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  origem: z.enum(['EMAIL', 'TELEFONE', 'VISITA', 'INDICACAO', 'OUTRO']).optional(),
  escopo: z.string().optional(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']).optional(),
  interesse: z.enum(['ALTO', 'MEDIO', 'BAIXO']).optional(),
  status: z
    .enum(['AGUARDANDO_ANALISE', 'EM_ELABORACAO', 'PROPOSTA_ENVIADA', 'CONTRATO_GANHO', 'RECUSADA'])
    .optional(),
  prazo_tecnica: z.string().nullable().optional(),
  prazo_tecnica_indeterminado: z.boolean().optional(),
  prazo_comercial: z.string().nullable().optional(),
  prazo_comercial_indeterminado: z.boolean().optional(),
  orcamentista_id: z.number().int().positive().nullable().optional(),
  visita_tecnica: z.boolean().optional(),
  data_visita: z.string().nullable().optional(),
  motivo_recusa: z.string().nullable().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { data } = parsed

  const existing = await prisma.solicitacao.findUnique({
    where: { id },
    include: { orcamentista: { select: { email: true } } },
  })
  if (!existing || existing.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Não encontrada' }, { status: 404 })
  }

  // RN-10: Bloquear edição quando Em Análise (exceto pelo analista crítico via /api/analise)
  if (existing.status_analise === 'AGUARDANDO' && !session.user.is_analista_critico) {
    return NextResponse.json(
      { data: null, error: 'Não é possível editar uma solicitação Em Análise' },
      { status: 409 },
    )
  }

  const updated = await prisma.solicitacao.update({
    where: { id },
    data: {
      ...(data.cliente_id !== undefined && { cliente_id: data.cliente_id }),
      ...(data.cliente_final_id !== undefined && { cliente_final_id: data.cliente_final_id }),
      ...(data.data_recebimento !== undefined && {
        data_recebimento: data.data_recebimento ? new Date(data.data_recebimento) : null,
      }),
      ...(data.segmento !== undefined && { segmento: data.segmento as Segmento | null }),
      ...(data.contato !== undefined && { contato: data.contato }),
      ...(data.referencia_cliente !== undefined && { referencia_cliente: data.referencia_cliente }),
      ...(data.comprador !== undefined && { comprador: data.comprador }),
      ...(data.telefone_comprador !== undefined && { telefone_comprador: data.telefone_comprador }),
      ...(data.email_comprador !== undefined && { email_comprador: data.email_comprador }),
      ...(data.cidade !== undefined && { cidade: data.cidade }),
      ...(data.estado !== undefined && { estado: data.estado }),
      ...(data.origem !== undefined && { origem: data.origem as Origem }),
      ...(data.escopo !== undefined && { escopo: data.escopo }),
      ...(data.classificacao !== undefined && { classificacao: data.classificacao as Classificacao }),
      ...(data.interesse !== undefined && { interesse: data.interesse as Interesse }),
      ...(data.status !== undefined && { status: data.status as StatusSolicitacao }),
      ...(data.prazo_tecnica !== undefined && {
        prazo_tecnica: data.prazo_tecnica ? new Date(data.prazo_tecnica) : null,
      }),
      ...(data.prazo_tecnica_indeterminado !== undefined && {
        prazo_tecnica_indeterminado: data.prazo_tecnica_indeterminado,
      }),
      ...(data.prazo_comercial !== undefined && {
        prazo_comercial: data.prazo_comercial ? new Date(data.prazo_comercial) : null,
      }),
      ...(data.prazo_comercial_indeterminado !== undefined && {
        prazo_comercial_indeterminado: data.prazo_comercial_indeterminado,
      }),
      ...(data.orcamentista_id !== undefined && { orcamentista_id: data.orcamentista_id }),
      ...(data.visita_tecnica !== undefined && { visita_tecnica: data.visita_tecnica }),
      ...(data.data_visita !== undefined && {
        data_visita: data.data_visita ? new Date(data.data_visita) : null,
      }),
      ...(data.motivo_recusa !== undefined && { motivo_recusa: data.motivo_recusa }),
    },
    include: { orcamentista: { select: { email: true } } },
  })

  if (data.status && data.status !== existing.status && updated.orcamentista?.email) {
    emailStatusAlterado(updated.orcamentista.email, existing.numero, data.status)
  }

  return NextResponse.json({ data: updated, error: null })
}

// ─── DELETE /api/solicitacoes/:id (soft cancel) ───────────────────────────────

const cancelSchema = z.object({
  cancel_reason: z.string().min(5, 'Justificativa obrigatória (mín. 5 caracteres)'),
})

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Justificativa obrigatória' },
      { status: 400 },
    )
  }

  const existing = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      orcamentista: { select: { id: true, email: true, nome: true } },
    },
  })
  if (!existing) return NextResponse.json({ data: null, error: 'Não encontrada' }, { status: 404 })
  if (existing.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Já cancelada' }, { status: 409 })
  }

  // RN-12: Não cancelar quando proposta está com status Ganhou ou Perdeu
  const propostasAtivas = await prisma.propostaComercial.findFirst({
    where: {
      solicitacao_id: id,
      resultado: { in: ['GANHOU', 'PERDEU'] },
    },
  })
  if (propostasAtivas) {
    return NextResponse.json(
      { data: null, error: 'Não é possível cancelar — proposta com resultado Ganhou ou Perdeu' },
      { status: 409 },
    )
  }

  const updated = await prisma.solicitacao.update({
    where: { id },
    data: {
      cancelled_at: new Date(),
      cancel_reason: parsed.data.cancel_reason,
      status: 'CANCELADA',
      status_analise: 'REPROVADA',
    },
  })

  // RN-13: Notificar orçamentista se houver ciclo em aberto
  if (existing.orcamentista) {
    await createNotificacao(
      existing.orcamentista.id,
      `Solicitação cancelada — ${existing.numero}`,
      `A solicitação ${existing.numero} foi cancelada. Propostas pendentes foram encerradas automaticamente.`,
      '/orcamentos/painel',
    )
  }

  return NextResponse.json({ data: updated, error: null })
}
