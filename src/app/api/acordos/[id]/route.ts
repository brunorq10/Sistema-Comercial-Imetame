import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  descricao: z.string().optional(),
  valor_total: z.number().positive().optional(),
  valor_anos_seguintes: z.number().nonnegative().nullable().optional(),
  status: z.enum(['ATIVO', 'ENCERRADO']).optional(),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
  cancel_reason: z.string().min(5).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { cancel_reason, ...rest } = parsed.data

  // Cancelamento (RN-18)
  if (cancel_reason) {
    const acordo = await prisma.acordo.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        cancelled_at: new Date(),
        cancel_reason,
      },
    })
    return NextResponse.json({ data: acordo, error: null })
  }

  const acordo = await prisma.acordo.update({
    where: { id },
    data: {
      ...(rest.descricao !== undefined && { descricao: rest.descricao }),
      ...(rest.valor_total !== undefined && { valor_total: rest.valor_total }),
      ...(rest.valor_anos_seguintes !== undefined && { valor_anos_seguintes: rest.valor_anos_seguintes }),
      ...(rest.status !== undefined && { status: rest.status }),
      ...(rest.data_inicio !== undefined && { data_inicio: rest.data_inicio ? new Date(rest.data_inicio) : null }),
      ...(rest.data_fim !== undefined && { data_fim: rest.data_fim ? new Date(rest.data_fim) : null }),
    },
  })

  return NextResponse.json({ data: acordo, error: null })
}
