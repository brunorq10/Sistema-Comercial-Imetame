import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE — remove todos os dados de HH do contrato (excluindo-o do acompanhamento)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  await prisma.$transaction([
    prisma.hhLancamentoMes.deleteMany({
      where: { lancamento: { contrato_id: id } },
    }),
    prisma.hhLancamento.deleteMany({ where: { contrato_id: id } }),
    prisma.hhRealizado.deleteMany({ where: { contrato_id: id } }),
  ])

  return NextResponse.json({ data: null, error: null })
}
