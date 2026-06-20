import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailStatusAlterado } from '@/lib/notifications'
import { createNotificacao } from '@/lib/notifications'
import { formatDate } from '@/lib/utils'
import type { Classificacao, Interesse, Origem, Segmento, StatusSolicitacao } from '@prisma/client'

const CAMPO_LABELS: Record<string, string> = {
  cliente_id: 'Cliente', cliente_final_id: 'Cliente Final', data_recebimento: 'Data Recebimento',
  segmento: 'Segmento', contato: 'Contato', referencia_cliente: 'Referência Cliente',
  comprador: 'Comprador', telefone_comprador: 'Telefone Comprador', email_comprador: 'E-mail Comprador',
  cidade: 'Cidade', estado: 'Estado', origem: 'Origem', escopo: 'Escopo',
  classificacao: 'Classificação', interesse: 'Interesse', status: 'Status',
  prazo_tecnica: 'Prazo Técnica', prazo_comercial: 'Prazo Comercial',
  orcamentista_id: 'Orçamentista', visita_tecnica: 'Visita Técnica', data_visita: 'Data Visita',
  motivo_recusa: 'Motivo Recusa',
}

const CAMPOS_DATA = new Set(['data_recebimento', 'prazo_tecnica', 'prazo_comercial', 'data_visita'])

function formatSolicitacaoVal(campo: string, val: unknown): string {
  if (val == null) return '—'
  if (CAMPOS_DATA.has(campo)) return formatDate(val instanceof Date ? val.toISOString() : String(val)) ?? '—'
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
  return String(val)
}

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

  const EDIT_PERFIS_AMPLOS = ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ADM_GERAL']
  const perfil = session.user.perfil as string
  const userId = Number(session.user.id)
  const temPerfilAmplo = EDIT_PERFIS_AMPLOS.includes(perfil) || session.user.is_analista_critico

  if (perfil !== 'ORCAMENTISTA' && !temPerfilAmplo) {
    return NextResponse.json({ data: null, error: 'Sem permissão para editar solicitações' }, { status: 403 })
  }

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
    include: { orcamentista: { select: { id: true, nome: true, email: true } } },
  })
  if (!existing || existing.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada ou já cancelada' }, { status: 404 })
  }

  // A1: Orçamentista só pode editar a própria solicitação
  if (perfil === 'ORCAMENTISTA' && !temPerfilAmplo && existing.orcamentista_id !== userId) {
    return NextResponse.json(
      { data: null, error: 'Você não tem permissão para editar esta solicitação. Somente o orçamentista responsável, Gestão Comercial ou Administrador podem editá-la.' },
      { status: 403 },
    )
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
    include: { orcamentista: { select: { id: true, nome: true, email: true } } },
  })

  // Registra campos alterados no histórico de alterações
  const camposVerificar = Object.keys(CAMPO_LABELS) as (keyof typeof CAMPO_LABELS)[]
  const historico: { solicitacao_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }[] = []
  for (const campo of camposVerificar) {
    const antigo = (existing as Record<string, unknown>)[campo]
    const novo = (updated as Record<string, unknown>)[campo]
    const antigoStr = antigo == null ? null : String(antigo instanceof Date ? antigo.toISOString() : antigo)
    const novoStr = novo == null ? null : String(novo instanceof Date ? novo.toISOString() : novo)
    if (antigoStr !== novoStr) {
      historico.push({
        solicitacao_id: id,
        campo: CAMPO_LABELS[campo],
        valor_de: formatSolicitacaoVal(campo, antigo),
        valor_para: formatSolicitacaoVal(campo, novo),
        created_by: Number(session.user.id),
      })
    }
  }
  // A3: quando ADM_GERAL edita, registrar uma entrada de auditoria extra
  if (historico.length > 0) {
    if (perfil === 'ADM_GERAL') {
      historico.push({
        solicitacao_id: id,
        campo: '_auditoria',
        valor_de: null,
        valor_para: `Edição realizada pelo perfil ADM_GERAL (usuário ID ${userId})`,
        created_by: userId,
      })
    }
    await prisma.historicoSolicitacao.createMany({ data: historico })
  }

  // Notifica quando orçamentista é transferido via edição
  if (data.orcamentista_id !== undefined && data.orcamentista_id !== existing.orcamentista_id) {
    const novoOrc = await prisma.user.findUnique({
      where: { id: data.orcamentista_id! },
      select: { id: true, nome: true },
    })
    if (existing.orcamentista) {
      createNotificacao(
        existing.orcamentista.id,
        `Transferência de solicitação — ${existing.numero}`,
        `A solicitação ${existing.numero} foi transferida para ${novoOrc?.nome ?? 'outro orçamentista'}. Você não é mais o responsável.`,
        '/orcamentos/painel',
      )
    }
    if (novoOrc) {
      createNotificacao(
        novoOrc.id,
        `Nova solicitação atribuída — ${existing.numero}`,
        `Você é o novo orçamentista responsável pela solicitação ${existing.numero}.`,
        '/orcamentos/painel',
      )
    }
  }

  // ALTO-7: notifica por e-mail o orçamentista; se não houver, notifica todos ADM_COMERCIAL
  if (data.status && data.status !== existing.status) {
    if (updated.orcamentista?.email) {
      emailStatusAlterado(updated.orcamentista.email, existing.numero, data.status)
    } else {
      prisma.user.findMany({ where: { perfil: 'ADM_COMERCIAL', ativo: true }, select: { email: true } })
        .then((admins) => { for (const a of admins) emailStatusAlterado(a.email, existing.numero, data.status!) })
        .catch(() => null)
    }
  }

  return NextResponse.json({ data: updated, error: null })
}

// ─── DELETE /api/solicitacoes/:id (soft cancel) ───────────────────────────────

const cancelSchema = z.object({
  acao: z.enum(['cancelar', 'suspender']).default('cancelar'),
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
  const { acao, cancel_reason } = parsed.data

  const existing = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      orcamentista: { select: { id: true, email: true, nome: true } },
    },
  })
  if (!existing) return NextResponse.json({ data: null, error: 'Não encontrada' }, { status: 404 })
  if (existing.cancelled_at || existing.status === 'CANCELADA') {
    return NextResponse.json({ data: null, error: 'Já cancelada' }, { status: 409 })
  }
  if (existing.status === 'SUSPENSA') {
    return NextResponse.json({ data: null, error: 'Já suspensa' }, { status: 409 })
  }

  // "Proposta enviada ao cliente" = qualquer proposta com data de envio (mesma
  // condição que faz a solicitação aparecer na aba Propostas).
  const temPropostaEnviada =
    !!(await prisma.propostaComercial.findFirst({ where: { solicitacao_id: id, data_envio: { not: null } } })) ||
    !!(await prisma.propostaTecnica.findFirst({ where: { solicitacao_id: id, data_envio: { not: null } } })) ||
    !!(await prisma.propostaFabricacao.findFirst({ where: { solicitacao_id: id, data_envio: { not: null } } }))

  // ── SUSPENDER ──────────────────────────────────────────────────────────────
  if (acao === 'suspender') {
    const updated = await prisma.solicitacao.update({
      where: { id },
      data: {
        status: 'SUSPENSA',
        suspended_at: new Date(),
        suspend_reason: cancel_reason,
      },
    })
    // Removida do painel do orçamentista (filtro de status exclui SUSPENSA).
    // As propostas já enviadas permanecem na aba Propostas (cancelled_at = null).
    if (existing.orcamentista) {
      createNotificacao(
        existing.orcamentista.id,
        `Solicitação suspensa — ${existing.numero}`,
        `A solicitação ${existing.numero} foi suspensa e removida do seu painel. As propostas já enviadas permanecem registradas.`,
        '/orcamentos/painel',
      )
    }
    return NextResponse.json({ data: updated, error: null })
  }

  // ── CANCELAR ───────────────────────────────────────────────────────────────
  // Só pode cancelar se nenhuma proposta foi enviada ao cliente.
  if (temPropostaEnviada) {
    return NextResponse.json(
      { data: null, error: 'Já há proposta enviada ao cliente — só é possível suspender.' },
      { status: 409 },
    )
  }

  // RN-12: Não cancelar quando proposta está com status Ganhou ou Perdeu
  const propostasAtivas = await prisma.propostaComercial.findFirst({
    where: { solicitacao_id: id, resultado: { in: ['GANHOU', 'PERDEU'] } },
  })
  if (propostasAtivas) {
    return NextResponse.json(
      { data: null, error: 'Não é possível cancelar — proposta com resultado Ganhou ou Perdeu' },
      { status: 409 },
    )
  }

  // RN-13: Encerra propostas pendentes e cancela solicitação atomicamente
  const updated = await prisma.$transaction(async (tx) => {
    await tx.propostaComercial.updateMany({
      where: { solicitacao_id: id, resultado: 'AGUARDANDO' },
      data: { resultado: 'PERDEU', motivo_perda: 'OUTRO' },
    })
    return tx.solicitacao.update({
      where: { id },
      data: {
        cancelled_at: new Date(),
        cancel_reason,
        status: 'CANCELADA',
        status_analise: 'REPROVADA',
      },
    })
  })

  if (existing.orcamentista) {
    createNotificacao(
      existing.orcamentista.id,
      `Solicitação cancelada — ${existing.numero}`,
      `A solicitação ${existing.numero} foi cancelada. Propostas pendentes foram encerradas automaticamente.`,
      '/orcamentos/painel',
    )
  }

  return NextResponse.json({ data: updated, error: null })
}
