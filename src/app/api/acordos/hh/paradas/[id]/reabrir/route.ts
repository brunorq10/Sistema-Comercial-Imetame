import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato } from '@/lib/permissaoApi'

const bodySchema = z.object({ motivo: z.string().trim().min(5, 'Justificativa obrigatória (mín. 5 caracteres)') })

// POST — reabre uma Parada fechada, mediante justificativa. Restrito a
// Analista Crítico, Gestão Acordos e ADM Geral (acordos.paradas.reabrir).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.paradas.reabrir'); if (_n) return _n }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const config = await prisma.paradaHhConfig.findUnique({ where: { contrato_id: contratoId }, select: { id: true, fechada_em: true } })
  if (!config) return NextResponse.json({ data: null, error: 'Nenhum acompanhamento de HH lançado para este contrato ainda' }, { status: 400 })
  if (!config.fechada_em) return NextResponse.json({ data: null, error: 'Esta Parada não está fechada' }, { status: 409 })

  const userId = Number(session.user.id)
  await prisma.$transaction([
    prisma.paradaHhConfig.update({
      where: { id: config.id },
      data: { fechada_em: null, fechada_por: null },
    }),
    prisma.paradaFechamentoHistorico.create({
      data: { config_id: config.id, acao: 'REABERTA', motivo: parsed.data.motivo, created_by: userId },
    }),
  ])

  return NextResponse.json({ data: { ok: true }, error: null })
}
