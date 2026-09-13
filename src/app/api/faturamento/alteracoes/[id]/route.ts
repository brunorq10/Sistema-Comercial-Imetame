import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { exigirPermissao } from '@/lib/permissaoApi'
import { formatCurrency } from '@/lib/utils'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

const putSchema = z.object({
  acao: z.enum(['APROVAR', 'REPROVAR']),
  motivo_recusa: z.string().min(3).optional(),
})

// PUT /api/faturamento/alteracoes/[id]
// Aprovar ou reprovar uma alteração. Apenas GESTAO_ACORDOS.
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  { const { erro } = await exigirPermissao('acordos.aprovacoes.decidir'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { acao, motivo_recusa } = parsed.data

  if (acao === 'REPROVAR' && (!motivo_recusa || motivo_recusa.trim().length < 3)) {
    return NextResponse.json(
      { data: null, error: 'Informe o motivo da reprovação (mínimo 3 caracteres)' },
      { status: 400 },
    )
  }

  const revisoreId = Number(session.user.id)

  try {
    const alteracao = await prisma.previsaoAlteracao.findUnique({ where: { id } })
    if (!alteracao) return NextResponse.json({ data: null, error: 'Alteração não encontrada' }, { status: 404 })
    if (alteracao.status !== 'PENDENTE') {
      return NextResponse.json({ data: null, error: 'Esta alteração já foi processada' }, { status: 409 })
    }

    const temValorTotal = alteracao.valor_total_para != null

    if (acao === 'APROVAR') {
      // Aplica os valores "para" no SubIndiceFaturamento
      const updateData: Record<string, number | null> = Object.fromEntries(
        MESES.map((m) => {
          const val = alteracao[`${m}_para` as keyof typeof alteracao]
          return [m === 'set' ? 'set' : m, val != null ? Number(val) : null]
        })
      )
      if (temValorTotal) updateData.valor_total = Number(alteracao.valor_total_para)

      const ops: Prisma.PrismaPromise<unknown>[] = [
        prisma.subIndiceFaturamento.update({
          where: { id: alteracao.subindice_id },
          data: updateData,
        }),
        prisma.previsaoAlteracao.update({
          where: { id },
          data: {
            status: 'APROVADO',
            revisor_id: revisoreId,
            reviewed_at: new Date(),
          },
        }),
      ]
      if (temValorTotal) {
        ops.push(prisma.historicoSubIndice.create({
          data: {
            subindice_id: alteracao.subindice_id,
            campo: 'Valor Total',
            valor_de: formatCurrency(Number(alteracao.valor_total_de)),
            valor_para: formatCurrency(Number(alteracao.valor_total_para)),
            created_by: revisoreId,
          },
        }))
      }
      await prisma.$transaction(ops)
    } else {
      await prisma.previsaoAlteracao.update({
        where: { id },
        data: {
          status: 'REPROVADO',
          motivo_recusa: motivo_recusa ?? null,
          revisor_id: revisoreId,
          reviewed_at: new Date(),
        },
      })
      if (temValorTotal) {
        await prisma.historicoSubIndice.create({
          data: {
            subindice_id: alteracao.subindice_id,
            campo: 'Valor Total — Recusado',
            valor_de: formatCurrency(Number(alteracao.valor_total_para)),
            valor_para: `Motivo: ${motivo_recusa}`,
            created_by: revisoreId,
          },
        })
      }
    }

    const updated = await prisma.previsaoAlteracao.findUnique({
      where: { id },
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

    // RN-CF-40: notificar o responsável sobre o resultado (não-bloqueante)
    const ctIndice  = updated?.subindice?.contrato?.indice ?? ''
    const descSub   = updated?.subindice?.descricao ?? ''
    const linkPainel = '/acordos/painel'
    const assunto = temValorTotal ? 'Valor Total' : 'previsão'
    if (acao === 'APROVAR') {
      createNotificacao(
        alteracao.responsavel_id,
        `Proposta de alteração de ${assunto} aprovada`,
        `Sua proposta para ${ctIndice} · ${descSub} foi aprovada e os valores foram atualizados.`,
        linkPainel,
      )
    } else {
      createNotificacao(
        alteracao.responsavel_id,
        `Proposta de alteração de ${assunto} reprovada`,
        `Sua proposta para ${ctIndice} · ${descSub} foi reprovada. Motivo: ${motivo_recusa ?? '—'}`,
        linkPainel,
      )
    }

    return NextResponse.json({ data: serializeAlteracao(updated!), error: null })
  } catch (err) {
    logger.error('[PUT /api/faturamento/alteracoes/[id]]', err)
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
