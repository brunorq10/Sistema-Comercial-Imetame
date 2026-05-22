import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

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
})

// GET /api/faturamento/alteracoes
// GESTAO_ACORDOS: ?status=PENDENTE (default) ou todas; outros: apenas as próprias
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const statusParam = searchParams.get('status') ?? undefined
  const perfil = session.user.perfil
  const isGestao = perfil === 'GESTAO_ACORDOS'
  const userId = Number(session.user.id)

  try {
    const where = isGestao
      ? { ...(statusParam ? { status: statusParam as never } : { status: 'PENDENTE' as const }) }
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
                cliente: { select: { id: true, nome: true } },
              },
            },
          },
        },
        responsavel: { select: { id: true, nome: true } },
        revisor: { select: { id: true, nome: true } },
      },
    })

    const data = alteracoes.map(serializeAlteracao)
    return NextResponse.json({ data, error: null })
  } catch (err) {
    console.error('[GET /api/faturamento/alteracoes]', err)
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
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

  const { subindice_id, valores_para } = parsed.data

  try {
    // Verifica se o subindice existe
    const subindice = await prisma.subIndiceFaturamento.findUnique({
      where: { id: subindice_id },
      include: { contrato: { select: { responsavel_id: true } } },
    })

    if (!subindice) {
      return NextResponse.json({ data: null, error: 'Sub-índice não encontrado' }, { status: 404 })
    }

    // Captura valores atuais como "de"
    const valoresDe = Object.fromEntries(
      MESES.map((m) => [`${m}_de`, subindice[m as keyof typeof subindice] != null ? Number(subindice[m as keyof typeof subindice]) : null])
    )

    // Monta valores "para"
    const valoresPara = Object.fromEntries(
      MESES.map((m) => [`${m}_para`, valores_para[m as keyof typeof valores_para] ?? null])
    )

    // Cancela alterações PENDENTES anteriores do mesmo subindice pelo mesmo responsável
    await prisma.previsaoAlteracao.updateMany({
      where: {
        subindice_id,
        responsavel_id: userId,
        status: 'PENDENTE',
      },
      data: { status: 'REPROVADO', motivo_recusa: 'Substituída por nova proposta' },
    })

    // Cria nova alteração
    const alteracao = await prisma.previsaoAlteracao.create({
      data: {
        subindice_id,
        responsavel_id: userId,
        created_by: userId,
        ...valoresDe,
        ...valoresPara,
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
                cliente: { select: { id: true, nome: true } },
              },
            },
          },
        },
        responsavel: { select: { id: true, nome: true } },
        revisor: { select: { id: true, nome: true } },
      },
    })

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
    for (const gestor of gestores) {
      createNotificacao(
        gestor.id,
        'Nova proposta de alteração de previsão',
        `${ctIndice} · ${descSub} (${nomeCliente}) — proposta enviada por ${nomeResp}.`,
        linkContrato,
      )
    }

    return NextResponse.json({ data: serializeAlteracao(alteracao), error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/faturamento/alteracoes]', err)
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeAlteracao(a: any) {
  return {
    id: a.id,
    subindice_id: a.subindice_id,
    responsavel_id: a.responsavel_id,
    status: a.status,
    motivo_recusa: a.motivo_recusa,
    revisor_id: a.revisor_id,
    reviewed_at: a.reviewed_at?.toISOString() ?? null,
    created_at: a.created_at.toISOString(),
    updated_at: a.updated_at.toISOString(),
    created_by: a.created_by,
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
