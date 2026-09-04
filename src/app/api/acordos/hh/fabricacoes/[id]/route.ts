import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FAB_CONTRATO_INCLUDE, mapContratoFab } from '@/lib/fabricacoes'

// GET — dados de UM contrato de Fabricação/Óleo e Gás (itens + meses + realizados).
// Alimenta a página dedicada /acordos/hh/fabricacoes/[id].
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: FAB_CONTRATO_INCLUDE,
  })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })

  return NextResponse.json({ data: mapContratoFab(contrato), error: null })
}
