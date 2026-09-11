import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato } from '@/lib/permissaoApi'

// POST — fecha o acompanhamento de HH da Fabricação (consolida os
// lançamentos; nada mais pode ser ajustado até reabrir). Mesmo padrão de "Fechar Parada".
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.fab.realizado.lancar'); if (_n) return _n }

  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { hh_fechada_em: true },
  })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })
  if (contrato.hh_fechada_em) return NextResponse.json({ data: null, error: 'Esta Fabricação já está fechada' }, { status: 409 })

  const userId = Number(session.user.id)
  await prisma.$transaction([
    prisma.contrato.update({
      where: { id: contratoId },
      data: { hh_fechada_em: new Date(), hh_fechada_por: userId },
    }),
    prisma.contratoHhFechamentoHistorico.create({
      data: { contrato_id: contratoId, acao: 'FECHADA', created_by: userId },
    }),
  ])

  return NextResponse.json({ data: { ok: true }, error: null })
}
