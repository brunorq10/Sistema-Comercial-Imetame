import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createNotificacao,
  emailSolicitacaoAprovada,
  emailSolicitacaoReprovada,
} from '@/lib/notifications'
import type { Classificacao, Interesse, MotivoReprovacao } from '@prisma/client'

// GET /api/analise/:id → detalhes completos da solicitação
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!session.user.is_analista_critico) {
    return NextResponse.json({ data: null, error: 'Acesso negado' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      cliente_final: { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
      criador: { select: { id: true, nome: true } },
    },
  })

  if (!sol) return NextResponse.json({ data: null, error: 'Não encontrada' }, { status: 404 })

  return NextResponse.json({
    data: {
      ...sol,
      created_at: sol.created_at.toISOString(),
      updated_at: sol.updated_at.toISOString(),
      prazo_tecnica: sol.prazo_tecnica?.toISOString() ?? null,
      prazo_comercial: sol.prazo_comercial?.toISOString() ?? null,
      data_visita: sol.data_visita?.toISOString() ?? null,
      data_recebimento: sol.data_recebimento?.toISOString() ?? null,
      cancelled_at: sol.cancelled_at?.toISOString() ?? null,
    },
    error: null,
  })
}

const MOTIVO_REPROVACAO_VALUES = [
  'VOLUME_ADJUDICADO',
  'FORA_LINHA_FORNECIMENTO',
  'INDISPONIBILIDADE_MO',
  'SEM_SERVICO_LOCAL',
  'LIMITACAO_EQUIPAMENTOS',
  'DIFICULDADE_PARCERIA',
  'OUTROS',
] as const

const aprovarSchema = z.object({
  orcamentista_id: z.number().int().positive(),
  escopo: z.string().optional(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']).optional(),
  interesse: z.enum(['ALTO', 'MEDIO', 'BAIXO']).optional(),
  prazo_tecnica: z.string().optional(),
  prazo_comercial: z.string().optional(),
  visita_tecnica: z.boolean().optional(),
  data_visita: z.string().optional(),
  obs_analise: z.string().optional(),
})

const reprovarSchema = z.object({
  motivo_reprovacao: z.enum(MOTIVO_REPROVACAO_VALUES, {
    required_error: 'Selecione o motivo da reprovação',
  }),
  obs_reprovacao: z.string().optional(),
})

const MOTIVO_LABELS: Record<string, string> = {
  VOLUME_ADJUDICADO: 'Volume de Serviços Adjudicados Para o Período',
  FORA_LINHA_FORNECIMENTO: 'Não Faz Parte da Linha de Fornecimento',
  INDISPONIBILIDADE_MO: 'Indisponibilidade de MO',
  SEM_SERVICO_LOCAL: 'Não Temos Serviço no Local',
  LIMITACAO_EQUIPAMENTOS: 'Limitação de Equipamentos',
  DIFICULDADE_PARCERIA: 'Dificuldade de Parceria',
  OUTROS: 'Outros',
}

// POST /api/analise/:id → body: { acao: 'aprovar' | 'reprovar', ...dados }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!session.user.is_analista_critico) {
    return NextResponse.json({ data: null, error: 'Acesso negado' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true } },
      criador: { select: { id: true, email: true, nome: true } },
      orcamentista: { select: { id: true, email: true, nome: true } },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (sol.status_analise !== 'AGUARDANDO') {
    return NextResponse.json({ data: null, error: 'Solicitação já foi analisada' }, { status: 409 })
  }

  const body = await req.json()
  const acao = body.acao as 'aprovar' | 'reprovar'

  if (acao === 'aprovar') {
    const parsed = aprovarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    const updated = await prisma.solicitacao.update({
      where: { id },
      data: {
        status_analise: 'APROVADA',
        status: 'EM_ELABORACAO',
        orcamentista_id: d.orcamentista_id,
        ...(d.escopo !== undefined && { escopo: d.escopo }),
        ...(d.classificacao !== undefined && { classificacao: d.classificacao as Classificacao }),
        ...(d.interesse !== undefined && { interesse: d.interesse as Interesse }),
        ...(d.prazo_tecnica && { prazo_tecnica: new Date(d.prazo_tecnica) }),
        ...(d.prazo_comercial && { prazo_comercial: new Date(d.prazo_comercial) }),
        ...(d.visita_tecnica !== undefined && { visita_tecnica: d.visita_tecnica }),
        ...(d.data_visita && { data_visita: new Date(d.data_visita) }),
      },
      include: { orcamentista: { select: { id: true, email: true, nome: true } } },
    })

    const orc = updated.orcamentista
    if (orc) {
      await createNotificacao(
        orc.id,
        `Nova solicitação atribuída — ${sol.numero}`,
        `A solicitação ${sol.numero} — ${sol.cliente.nome} foi aprovada e atribuída a você.`,
        '/orcamentos/painel',
      )
      emailSolicitacaoAprovada(orc.email, sol.numero, sol.cliente.nome)
    }

    return NextResponse.json({ data: updated, error: null })
  }

  if (acao === 'reprovar') {
    const parsed = reprovarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.issues[0]?.message ?? 'Motivo obrigatório' },
        { status: 400 },
      )
    }

    const motivoLabel = MOTIVO_LABELS[parsed.data.motivo_reprovacao]
    const mensagemCompleta = parsed.data.obs_reprovacao
      ? `${motivoLabel}. Observações: ${parsed.data.obs_reprovacao}`
      : motivoLabel

    await prisma.solicitacao.update({
      where: { id },
      data: {
        status_analise: 'REPROVADA',
        motivo_reprovacao: parsed.data.motivo_reprovacao as MotivoReprovacao,
        obs_reprovacao: parsed.data.obs_reprovacao ?? null,
        motivo_recusa: motivoLabel,
      },
    })

    await createNotificacao(
      sol.criador.id,
      `Solicitação reprovada — ${sol.numero}`,
      `A solicitação ${sol.numero} — ${sol.cliente.nome} foi reprovada. Motivo: ${mensagemCompleta}`,
      '/orcamentos/solicitacoes',
    )
    emailSolicitacaoReprovada(
      sol.criador.email,
      sol.numero,
      sol.cliente.nome,
      mensagemCompleta,
    )

    return NextResponse.json({ data: null, error: null })
  }

  return NextResponse.json({ data: null, error: 'Ação inválida' }, { status: 400 })
}
