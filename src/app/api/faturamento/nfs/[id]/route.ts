import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  ativa: z.boolean(),
  motivo_inativacao: z.string().optional(),
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

  const nf = await prisma.notaFiscalContrato.update({
    where: { id },
    data: {
      ativa: parsed.data.ativa,
      motivo_inativacao: parsed.data.ativa ? null : (parsed.data.motivo_inativacao ?? null),
    },
  })

  return NextResponse.json({ data: { id: nf.id, ativa: nf.ativa }, error: null })
}
