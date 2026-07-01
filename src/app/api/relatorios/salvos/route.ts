import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { guardRelatorios } from '@/lib/relatorios/guard'
import { reportRequestSchema } from '@/lib/relatorios/service'

// GET — lista os relatórios salvos do usuário (Favoritos), com a versão atual.
export async function GET() {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res
  const userId = Number(guard.session.user.id)

  const relatorios = await prisma.relatorioSalvo.findMany({
    where: { created_by: userId, deleted_at: null },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true, nome: true, updated_at: true,
      versoes: { orderBy: { versao: 'desc' }, take: 1, select: { versao: true } },
    },
  })

  return NextResponse.json({
    data: relatorios.map((r) => ({ id: r.id, nome: r.nome, versaoAtual: r.versoes[0]?.versao ?? 0, updated_at: r.updated_at })),
    error: null,
  })
}

const salvarSchema = z.object({
  nome: z.string().trim().min(1, 'Informe um nome').max(120),
  relatorioId: z.number().int().positive().optional(),
  config: reportRequestSchema,
})

// POST — salva. Cada save cria uma NOVA versão (não sobrescreve). Se relatorioId
// vier, adiciona versão ao relatório existente; senão cria um novo (v1).
export async function POST(req: NextRequest) {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res
  const userId = Number(guard.session.user.id)

  const parsed = salvarSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  const { nome, relatorioId, config } = parsed.data
  const configJson = config as unknown as Prisma.InputJsonValue

  try {
    if (relatorioId) {
      const rel = await prisma.relatorioSalvo.findFirst({ where: { id: relatorioId, created_by: userId, deleted_at: null } })
      if (!rel) return NextResponse.json({ data: null, error: 'Relatório não encontrado' }, { status: 404 })
      const ultima = await prisma.relatorioVersao.findFirst({ where: { relatorio_id: relatorioId }, orderBy: { versao: 'desc' }, select: { versao: true } })
      const novaVersao = (ultima?.versao ?? 0) + 1
      await prisma.$transaction([
        prisma.relatorioVersao.create({ data: { relatorio_id: relatorioId, versao: novaVersao, config: configJson, created_by: userId } }),
        prisma.relatorioSalvo.update({ where: { id: relatorioId }, data: { nome } }),
      ])
      return NextResponse.json({ data: { id: relatorioId, versao: novaVersao }, error: null })
    }

    const criado = await prisma.relatorioSalvo.create({
      data: { nome, created_by: userId, versoes: { create: { versao: 1, config: configJson, created_by: userId } } },
    })
    return NextResponse.json({ data: { id: criado.id, versao: 1 }, error: null })
  } catch (err) {
    logger.error('[POST /api/relatorios/salvos]', err)
    return NextResponse.json({ data: null, error: 'Erro ao salvar o relatório.' }, { status: 500 })
  }
}
