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

  const [historico, fechamentos] = await Promise.all([
    prisma.fabricacaoItemHistorico.findMany({
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
    }),
    prisma.contratoHhFechamentoHistorico.findMany({
      where: { contrato_id: contratoId },
      orderBy: { created_at: 'desc' },
      select: { id: true, acao: true, motivo: true, created_at: true, usuario: { select: { nome: true } } },
    }),
  ])

  const dataItens = historico.map((h) => ({
    id: `item-${h.id}`,
    item: h.item.descricao,
    campo: h.campo,
    valor_de: h.valor_de,
    valor_para: h.valor_para,
    alterado_em: h.created_at.toISOString(),
    alterado_por: h.usuario.nome,
  }))
  const dataFechamentos = fechamentos.map((f) => ({
    id: `fech-${f.id}`,
    item: null,
    campo: f.acao === 'FECHADA' ? 'Fechamento' : 'Reabertura',
    valor_de: null,
    valor_para: f.acao === 'REABERTA' ? (f.motivo ?? '—') : 'Fabricação fechada',
    alterado_em: f.created_at.toISOString(),
    alterado_por: f.usuario.nome,
  }))

  const data = [...dataItens, ...dataFechamentos].sort((a, b) => b.alterado_em.localeCompare(a.alterado_em))

  return NextResponse.json({ data, error: null })
}
