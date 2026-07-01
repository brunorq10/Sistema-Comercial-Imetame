import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { guardRelatorios } from '@/lib/relatorios/guard'

// GET — relatório + histórico de versões (cada uma com sua config, p/ restaurar).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res
  const userId = Number(guard.session.user.id)
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const rel = await prisma.relatorioSalvo.findFirst({
    where: { id, created_by: userId, deleted_at: null },
    select: {
      id: true, nome: true,
      versoes: {
        orderBy: { versao: 'desc' },
        select: { versao: true, config: true, created_at: true, autor: { select: { nome: true } } },
      },
    },
  })
  if (!rel) return NextResponse.json({ data: null, error: 'Relatório não encontrado' }, { status: 404 })

  return NextResponse.json({
    data: {
      id: rel.id, nome: rel.nome,
      versoes: rel.versoes.map((v) => ({ versao: v.versao, config: v.config, created_at: v.created_at, autor: v.autor.nome })),
    },
    error: null,
  })
}

// PATCH — renomear.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res
  const userId = Number(guard.session.user.id)
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const parsed = z.object({ nome: z.string().trim().min(1).max(120) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Nome inválido' }, { status: 400 })

  const rel = await prisma.relatorioSalvo.findFirst({ where: { id, created_by: userId, deleted_at: null } })
  if (!rel) return NextResponse.json({ data: null, error: 'Relatório não encontrado' }, { status: 404 })

  try {
    await prisma.relatorioSalvo.update({ where: { id }, data: { nome: parsed.data.nome } })
    return NextResponse.json({ data: { id }, error: null })
  } catch (err) {
    logger.error('[PATCH /api/relatorios/salvos/[id]]', err)
    return NextResponse.json({ data: null, error: 'Erro ao renomear.' }, { status: 500 })
  }
}

// DELETE — soft delete (RN-18: não exclui de fato).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res
  const userId = Number(guard.session.user.id)
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const rel = await prisma.relatorioSalvo.findFirst({ where: { id, created_by: userId, deleted_at: null } })
  if (!rel) return NextResponse.json({ data: null, error: 'Relatório não encontrado' }, { status: 404 })

  try {
    await prisma.relatorioSalvo.update({ where: { id }, data: { deleted_at: new Date() } })
    return NextResponse.json({ data: { id }, error: null })
  } catch (err) {
    logger.error('[DELETE /api/relatorios/salvos/[id]]', err)
    return NextResponse.json({ data: null, error: 'Erro ao excluir.' }, { status: 500 })
  }
}
