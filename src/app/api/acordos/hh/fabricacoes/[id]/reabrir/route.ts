import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato } from '@/lib/permissaoApi'

const bodySchema = z.object({ motivo: z.string().trim().min(5, 'Justificativa obrigatória (mín. 5 caracteres)') })

// POST — reabre uma Fabricação fechada, mediante justificativa. Mesmo padrão de "Reabrir Parada".
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.fab.reabrir'); if (_n) return _n }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })

  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { hh_fechada_em: true } })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })
  if (!contrato.hh_fechada_em) return NextResponse.json({ data: null, error: 'Esta Fabricação não está fechada' }, { status: 409 })

  const userId = Number(session.user.id)
  await prisma.$transaction([
    prisma.contrato.update({
      where: { id: contratoId },
      data: { hh_fechada_em: null, hh_fechada_por: null },
    }),
    prisma.contratoHhFechamentoHistorico.create({
      data: { contrato_id: contratoId, acao: 'REABERTA', motivo: parsed.data.motivo, created_by: userId },
    }),
  ])

  return NextResponse.json({ data: { ok: true }, error: null })
}
