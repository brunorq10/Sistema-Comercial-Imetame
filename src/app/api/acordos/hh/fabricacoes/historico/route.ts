import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── GET: histórico de alterações de todos os itens de um contrato ─────────────
// ?contrato_id=123
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(req.nextUrl.searchParams.get('contrato_id'))
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'contrato_id inválido' }, { status: 400 })

  const historico = await prisma.fabricacaoItemHistorico.findMany({
    where: { item: { contrato_id: contratoId } },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      campo: true,
      valor_de: true,
      valor_para: true,
      created_at: true,
      item: { select: { descricao: true } },
      usuario: { select: { nome: true } },
    },
  })

  const data = historico.map((h) => ({
    id: h.id,
    item: h.item.descricao,
    campo: h.campo,
    valor_de: h.valor_de,
    valor_para: h.valor_para,
    alterado_em: h.created_at.toISOString(),
    alterado_por: h.usuario.nome,
  }))

  return NextResponse.json({ data, error: null })
}
