import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/solicitacoes/:id/contrato
// Resolve o contrato (módulo Acordos) vinculado a esta solicitação — vínculo
// real por Contrato.solicitacao_id; cai para o casamento por texto
// (num_proposta = Solicitacao.numero) só em contratos antigos ainda não
// migrados para o vínculo por ID. Read-only / visão.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({ where: { id }, select: { numero: true } })
  if (!sol) return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })

  const contrato = await prisma.contrato.findFirst({
    where: { OR: [{ solicitacao_id: id }, { num_proposta: sol.numero }], cancelled_at: null },
    select: { id: true, indice: true, cidade: true, estado: true, cliente: { select: { nome: true } } },
  })

  return NextResponse.json({
    data: contrato
      ? { id: contrato.id, indice: contrato.indice, cliente: contrato.cliente.nome, cidade: contrato.cidade, estado: contrato.estado }
      : null,
    error: null,
  })
}
