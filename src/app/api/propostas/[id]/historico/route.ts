import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente:       { select: { nome: true } },
      cliente_final: { select: { nome: true } },
      orcamentista:  { select: { nome: true } },
      propostas_tecnicas:   { orderBy: { versao: 'asc' } },
      propostas_comerciais: { orderBy: { versao: 'asc' } },
    },
  })

  if (!sol) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({
    data: {
      id: sol.id,
      numero: sol.numero,
      created_at: sol.created_at.toISOString(),
      data_recebimento: sol.data_recebimento?.toISOString() ?? null,
      cliente: sol.cliente.nome,
      cliente_final: sol.cliente_final?.nome ?? null,
      cidade: sol.cidade,
      estado: sol.estado,
      classificacao: sol.classificacao,
      escopo: sol.escopo,
      orcamentista: sol.orcamentista?.nome ?? null,
      as_sold: sol.as_sold,
      propostas_tecnicas: sol.propostas_tecnicas.map((pt) => ({
        id: pt.id,
        versao: pt.versao,
        hh_direto: pt.hh_direto,
        hh_indireto: pt.hh_indireto,
        hh_total: pt.hh_total,
        efetivo_pico: pt.efetivo_pico,
        dias_parada: pt.dias_parada,
        turno: pt.turno,
        data_envio: pt.data_envio?.toISOString() ?? null,
      })),
      propostas_comerciais: sol.propostas_comerciais.map((pc) => ({
        id: pc.id,
        versao: pc.versao,
        valor_total: pc.valor_total?.toString() ?? null,
        valor_terceiros: pc.valor_terceiros?.toString() ?? null,
        data_envio: pc.data_envio?.toISOString() ?? null,
        resultado: pc.resultado,
        proposta_tecnica_id: pc.proposta_tecnica_id,
      })),
    },
    error: null,
  })
}
