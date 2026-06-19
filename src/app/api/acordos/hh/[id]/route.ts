import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE — remove todos os dados de HH do contrato (excluindo-o do acompanhamento)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  // Busca IDs de lançamentos para deletar os meses sem filtro relacional
  const lancamentos = await prisma.hhLancamento.findMany({
    where: { contrato_id: id },
    select: { id: true },
  })
  const lancamentoIds = lancamentos.map(l => l.id)

  // Busca config de parada para deletar dias sem filtro relacional
  const paradaConfig = await prisma.paradaHhConfig.findUnique({
    where: { contrato_id: id },
    select: { id: true },
  })

  await prisma.$transaction([
    // Obras: remove meses → lançamentos → realizados
    ...(lancamentoIds.length > 0
      ? [prisma.hhLancamentoMes.deleteMany({ where: { lancamento_id: { in: lancamentoIds } } })]
      : []),
    prisma.hhLancamento.deleteMany({ where: { contrato_id: id } }),
    prisma.hhRealizado.deleteMany({ where: { contrato_id: id } }),
    // Paradas: remove dias → config
    ...(paradaConfig
      ? [prisma.paradaHhDia.deleteMany({ where: { config_id: paradaConfig.id } })]
      : []),
    prisma.paradaHhConfig.deleteMany({ where: { contrato_id: id } }),
  ])

  return NextResponse.json({ data: null, error: null })
}
