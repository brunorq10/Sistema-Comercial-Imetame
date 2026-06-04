import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  mes:          z.number().int().min(1).max(12),
  ano:          z.number().int(),
  hh_realizado: z.number().int().min(0),
  observacoes:  z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const d = parsed.data
  const result = await prisma.hhRealizado.upsert({
    where: { contrato_id_mes_ano: { contrato_id: id, mes: d.mes, ano: d.ano } },
    create: {
      contrato_id: id, mes: d.mes, ano: d.ano,
      hh_realizado: d.hh_realizado,
      observacoes: d.observacoes ?? null,
      created_by: Number(session.user.id),
    },
    update: {
      hh_realizado: d.hh_realizado,
      observacoes: d.observacoes ?? null,
    },
  })

  return NextResponse.json({ data: result, error: null })
}
