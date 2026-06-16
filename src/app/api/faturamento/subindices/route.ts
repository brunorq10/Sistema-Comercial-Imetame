import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  void req
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const subindices = await prisma.subIndiceFaturamento.findMany({
    where: { contrato: { cancelled_at: null } },
    select: {
      id: true,
      ordem: true,
      descricao: true,
      contrato: {
        select: {
          id: true,
          indice: true,
          cliente: { select: { nome: true } },
        },
      },
    },
    orderBy: [{ contrato: { indice: 'asc' } }, { ordem: 'asc' }],
  })

  return NextResponse.json({ data: subindices, error: null })
}

const schema = z.object({
  contrato_id: z.number().int().positive(),
  descricao: z.string().min(1),
  num_os: z.string().optional().nullable(),
  valor_total: z.number().nonnegative(),
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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  try {
    const maxOrdem = await prisma.subIndiceFaturamento.aggregate({
      _max: { ordem: true },
      where: { contrato_id: parsed.data.contrato_id },
    })
    const ordem = (maxOrdem._max.ordem ?? 0) + 1

    const { set: set_val, contrato_id, data_inicio, data_fim, num_os, ...rest } = parsed.data

    const subindice = await prisma.subIndiceFaturamento.create({
      data: {
        contrato_id,
        ordem,
        descricao: rest.descricao,
        num_os: num_os ?? null,
        valor_total: rest.valor_total,
        data_inicio: data_inicio ? new Date(data_inicio) : null,
        data_fim: data_fim ? new Date(data_fim) : null,
        comentarios: rest.comentarios ?? null,
        jan: rest.jan ?? null, fev: rest.fev ?? null, mar: rest.mar ?? null,
        abr: rest.abr ?? null, mai: rest.mai ?? null, jun: rest.jun ?? null,
        jul: rest.jul ?? null, ago: rest.ago ?? null,
        set: set_val ?? null,
        out: rest.out ?? null, nov: rest.nov ?? null, dez: rest.dez ?? null,
        created_by: Number(session.user.id),
      },
    })

    return NextResponse.json({ data: subindice, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/faturamento/subindices]', err)
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
