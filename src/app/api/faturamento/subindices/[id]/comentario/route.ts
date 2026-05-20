import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sub = await prisma.subIndiceFaturamento.findUnique({
    where: { id },
    select: {
      comentarios: true,
      comentario_updated_at: true,
      comentario_autor: { select: { nome: true } },
    },
  })

  if (!sub) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({
    data: {
      comentarios: sub.comentarios ?? null,
      updated_at: sub.comentario_updated_at?.toISOString() ?? null,
      updated_by: sub.comentario_autor?.nome ?? null,
    },
    error: null,
  })
}
