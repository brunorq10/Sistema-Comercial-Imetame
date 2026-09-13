import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { exigirTitularSubindice, usuarioDaSessao, resolverAutoria } from '@/lib/permissaoApi'
import { formatCurrency } from '@/lib/utils'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

const postSchema = z.object({
  subindice_id: z.number().int().positive(),
  valores_para: z.object({
    jan: z.number().nonnegative().nullable().optional(),
    fev: z.number().nonnegative().nullable().optional(),
    mar: z.number().nonnegative().nullable().optional(),
    abr: z.number().nonnegative().nullable().optional(),
    mai: z.number().nonnegative().nullable().optional(),
    jun: z.number().nonnegative().nullable().optional(),
    jul: z.number().nonnegative().nullable().optional(),
    ago: z.number().nonnegative().nullable().optional(),
    set: z.number().nonnegative().nullable().optional(),
    out: z.number().nonnegative().nullable().optional(),
    nov: z.number().nonnegative().nullable().optional(),
    dez: z.number().nonnegative().nullable().optional(),
  }),
  // Alteração de Valor Total (opcional — mesma solicitação de previsão pode
  // também mexer no valor total do subíndice). Motivo obrigatório quando vem.
  valor_total_para: z.number().nonnegative().optional(),
  motivo: z.string().trim().min(1).optional(),
})

// GET /api/faturamento/alteracoes
// GESTAO_ACORDOS: ?status=PENDENTE (default) ou todas; outros: apenas as próprias
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const statusParam = searchParams.get('status') ?? undefined
  const historyParam = searchParams.get('history')
  const perfil = session.user.perfil
  const isGestao = perfil === 'GESTAO_ACORDOS' || perfil === 'ADM_GERAL'
  const userId = Number(session.user.id)

  try {
    // RN-CF-39: suporte a history=true para retornar APROVADO+REPROVADO
    const where = isGestao
      ? historyParam === 'true'
        ? { status: { in: ['APROVADO', 'REPROVADO'] as ['APROVADO', 'REPROVADO'] } }
        : { ...(statusParam ? { status: statusParam as never } : { status: 'PENDENTE' as const }) }
      : { responsavel_id: userId, ...(statusParam ? { status: statusParam as never } : {}) }

    const alteracoes = await prisma.previsaoAlteracao.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      include: {
        subindice: {
          select: {
            id: true,
            ordem: true,
            descricao: true,
            contrato_id: true,
            contrato: {
              select: {
                id: true,
                indice: true,
                descricao: true,
                cliente: { select: { id: true, nome: true } },
              },
            },
          },
        },
        responsavel: { select: { id: true, nome: true } },
        revisor: { select: { id: true, nome: true } },
      },
    })

    // Previsão completa do item (todos os anos com previsão) p/ exibir nas aprovações
    const contratoIds = Array.from(
      new Set(alteracoes.map((a) => a.subindice?.contrato_id).filter((x): x is number => x != null)),
    )
    const subsByContrato = new Map<number, Array<Record<string, unknown>>>()
    if (contratoIds.length > 0) {
      const subs = await prisma.subIndiceFaturamento.findMany({
        where: { contrato_id: { in: contratoIds } },
        select: {
          id: true, contrato_id: true, ordem: true, descricao: true, data_inicio: true,
          jan: true, fev: true, mar: true, abr: true, mai: true, jun: true,
          jul: true, ago: true, set: true, out: true, nov: true, dez: true,
          contrato: { select: { ano_referencia: true } },
        },
      })
      for (const s of subs) {
        const arr = subsByContrato.get(s.contrato_id) ?? []
        arr.push(s as unknown as Record<string, unknown>)
        subsByContrato.set(s.contrato_id, arr)
      }
    }

    const buildItemPrevisao = (a: typeof alteracoes[number]) => {
      const cid = a.subindice?.contrato_id
      const desc = a.subindice?.descricao
      if (cid == null) return []
      const irmaos = (subsByContrato.get(cid) ?? []).filter((s) => s.descricao === desc)
      return irmaos
        .map((s) => {
          const di = s.data_inicio as Date | null
          const ano = di ? new Date(di).getUTCFullYear() : Number((s.contrato as { ano_referencia: number }).ano_referencia)
          return {
            subindice_id: Number(s.id),
            ano,
            ordem: Number(s.ordem),
            is_altered: Number(s.id) === a.subindice_id,
            meses: Object.fromEntries(MESES.map((m) => [m, s[m] != null ? Number(s[m]) : null])),
          }
        })
        .sort((x, y) => x.ano - y.ano)
    }

    const data = alteracoes.map((a) => ({ ...serializeAlteracao(a), item_previsao: buildItemPrevisao(a) }))
    return NextResponse.json({ data, error: null })
  } catch (err) {
    logger.error('[GET /api/faturamento/alteracoes]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

// POST /api/faturamento/alteracoes
// Cria nova alteração pendente, cancela PENDENTE anterior do mesmo subindice+responsavel
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const userId = Number(session.user.id)
  const body = await req.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { subindice_id, valores_para, valor_total_para, motivo } = parsed.data

  if (valor_total_para != null && !motivo) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da alteração do Valor Total' }, { status: 400 })
  }

  // Solicitar alteração de previsão = editar previsão no Meu Painel (titularidade)
  { const _n = await exigirTitularSubindice(session, subindice_id, 'acordos.painel.prev.editar'); if (_n) return _n }

  try {
    // Verifica se o subindice existe
    const subindice = await prisma.subIndiceFaturamento.findUnique({
      where: { id: subindice_id },
      include: { contrato: { select: { responsavel_id: true } } },
    })

    if (!subindice) {
      return NextResponse.json({ data: null, error: 'Sub-índice não encontrado' }, { status: 404 })
    }

    const usuario = usuarioDaSessao(session)!
    const autoria = resolverAutoria(usuario, subindice.contrato, 'contrato')

    // RN: só pode haver 1 alteração de Valor Total pendente por vez para o
    // mesmo subíndice (independente de quem solicitou) — diferente da previsão
    // mensal, que substitui automaticamente a proposta anterior do responsável.
    if (valor_total_para != null) {
      const pendenteValor = await prisma.previsaoAlteracao.findFirst({
        where: { subindice_id, status: 'PENDENTE', valor_total_para: { not: null } },
      })
      if (pendenteValor) {
        return NextResponse.json({
          data: null,
          error: 'Já existe uma alteração de Valor Total pendente de aprovação para este subíndice. Aguarde a resolução antes de enviar uma nova.',
        }, { status: 409 })
      }
    }

    // Captura valores atuais como "de"
    const valoresDe = Object.fromEntries(
      MESES.map((m) => [`${m}_de`, subindice[m as keyof typeof subindice] != null ? Number(subindice[m as keyof typeof subindice]) : null])
    )

    // Monta valores "para"
    const valoresPara = Object.fromEntries(
      MESES.map((m) => [`${m}_para`, valores_para[m as keyof typeof valores_para] ?? null])
    )

    const valorTotalAtual = Number(subindice.valor_total)
    const valorTotalCampos = valor_total_para != null
      ? { valor_total_de: valorTotalAtual, valor_total_para, motivo }
      : {}

    // Cancela alterações PENDENTES anteriores do mesmo subindice pelo mesmo
    // responsável — só as de previsão (valor_total_para null), para não
    // derrubar uma alteração de Valor Total pendente por conta de uma proposta
    // de previsão não relacionada (ver regra acima).
    await prisma.previsaoAlteracao.updateMany({
      where: {
        subindice_id,
        responsavel_id: userId,
        status: 'PENDENTE',
        valor_total_para: null,
      },
      data: { status: 'REPROVADO', motivo_recusa: 'Substituída por nova proposta' },
    })

    // Cria nova alteração
    const alteracao = await prisma.previsaoAlteracao.create({
      data: {
        subindice_id,
        responsavel_id: userId,
        ...autoria,
        ...valoresDe,
        ...valoresPara,
        ...valorTotalCampos,
      },
      include: {
        subindice: {
          select: {
            id: true,
            ordem: true,
            descricao: true,
            contrato_id: true,
            contrato: {
              select: {
                id: true,
                indice: true,
                descricao: true,
                cliente: { select: { id: true, nome: true } },
              },
            },
          },
        },
        responsavel: { select: { id: true, nome: true } },
        revisor: { select: { id: true, nome: true } },
      },
    })

    // Registra a solicitação no histórico do subíndice (já usado por outras
    // edições — botão "Histórico" existente), com o valor anterior, o
    // solicitado e o motivo informado.
    if (valor_total_para != null) {
      await prisma.historicoSubIndice.create({
        data: {
          subindice_id,
          campo: 'Valor Total — Solicitação',
          valor_de: formatCurrency(valorTotalAtual),
          valor_para: `${formatCurrency(valor_total_para)} — Motivo: ${motivo}`,
          ...autoria,
        },
      })
    }

    // RN-CF-40: notificar GESTAO_ACORDOS sobre nova proposta (não-bloqueante)
    const gestores = await prisma.user.findMany({
      where: { perfil: 'GESTAO_ACORDOS', ativo: true },
      select: { id: true },
    })
    const ctIndice   = alteracao.subindice?.contrato?.indice ?? ''
    const descSub    = alteracao.subindice?.descricao ?? ''
    const nomeCliente = alteracao.subindice?.contrato?.cliente?.nome ?? ''
    const nomeResp   = alteracao.responsavel?.nome ?? 'responsável'
    const linkContrato = alteracao.subindice?.contrato?.id
      ? `/acordos/faturamento/${alteracao.subindice.contrato.id}`
      : undefined
    const tituloNotif = valor_total_para != null
      ? 'Nova proposta de alteração de Valor Total'
      : 'Nova proposta de alteração de previsão'
    for (const gestor of gestores) {
      createNotificacao(
        gestor.id,
        tituloNotif,
        `${ctIndice} · ${descSub} (${nomeCliente}) — proposta enviada por ${nomeResp}.`,
        linkContrato,
      )
    }

    return NextResponse.json({ data: serializeAlteracao(alteracao), error: null }, { status: 201 })
  } catch (err) {
    logger.error('[POST /api/faturamento/alteracoes]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeAlteracao(a: any) {
  return {
    id: a.id,
    subindice_id: a.subindice_id,
    responsavel_id: a.responsavel_id,
    status: a.status,
    motivo: a.motivo ?? null,
    motivo_recusa: a.motivo_recusa,
    revisor_id: a.revisor_id,
    reviewed_at: a.reviewed_at?.toISOString() ?? null,
    created_at: a.created_at.toISOString(),
    updated_at: a.updated_at.toISOString(),
    created_by: a.created_by,
    valor_total_de: a.valor_total_de != null ? Number(a.valor_total_de) : null,
    valor_total_para: a.valor_total_para != null ? Number(a.valor_total_para) : null,
    ...Object.fromEntries(MESES.map((m) => [`${m}_de`, a[`${m}_de`] ? Number(a[`${m}_de`]) : null])),
    ...Object.fromEntries(MESES.map((m) => [`${m}_para`, a[`${m}_para`] ? Number(a[`${m}_para`]) : null])),
    subindice: a.subindice
      ? {
          id: a.subindice.id,
          ordem: a.subindice.ordem,
          descricao: a.subindice.descricao,
          contrato_id: a.subindice.contrato_id,
        }
      : undefined,
    responsavel: a.responsavel,
    revisor: a.revisor ?? null,
    contrato: a.subindice?.contrato ?? undefined,
  }
}
