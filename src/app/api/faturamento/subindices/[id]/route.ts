import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  descricao: z.string().min(1).optional(),
  valor_total: z.number().nonnegative().optional(),
  data_inicio: z.string().optional().nullable(),
  data_fim: z.string().optional().nullable(),
  comentarios: z.string().optional().nullable(),
  jan: z.number().nonnegative().optional().nullable(),
  fev: z.number().nonnegative().optional().nullable(),
  mar: z.number().nonnegative().optional().nullable(),
  abr: z.number().nonnegative().optional().nullable(),
  mai: z.number().nonnegative().optional().nullable(),
  jun: z.number().nonnegative().optional().nullable(),
  jul: z.number().nonnegative().optional().nullable(),
  ago: z.number().nonnegative().optional().nullable(),
  set: z.number().nonnegative().optional().nullable(),
  out: z.number().nonnegative().optional().nullable(),
  nov: z.number().nonnegative().optional().nullable(),
  dez: z.number().nonnegative().optional().nullable(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const { set: set_val, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (set_val !== undefined) data.set = set_val
  if (rest.data_inicio !== undefined) data.data_inicio = rest.data_inicio ? new Date(rest.data_inicio) : null
  if (rest.data_fim !== undefined) data.data_fim = rest.data_fim ? new Date(rest.data_fim) : null

  const subindice = await prisma.subIndiceFaturamento.update({
    where: { id },
    data,
    include: { notas_fiscais: true },
  })

  return NextResponse.json({ data: subindice, error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  await prisma.subIndiceFaturamento.delete({ where: { id } })
  return NextResponse.json({ data: null, error: null })
}
