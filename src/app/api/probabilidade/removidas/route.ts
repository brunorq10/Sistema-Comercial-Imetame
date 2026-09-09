import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { resolverPropostaAtual } from '@/lib/probabilidade'

// GET /api/probabilidade/removidas?busca= — propostas comerciais enviadas e em
// aberto que já estiveram no painel e foram removidas (×) — usado por "Incluir
// proposta" para trazê-las de volta.
export async function GET(req: NextRequest) {
  const { erro } = await exigirPermissao('probabilidade.editar')
  if (erro) return erro

  const busca = req.nextUrl.searchParams.get('busca')?.trim() ?? ''

  const rows = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null,
      classificacao: { in: ['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS'] },
      painel_probabilidade: { cancelled_at: { not: null } },
      ...(busca ? {
        OR: [
          { numero: { contains: busca, mode: 'insensitive' } },
          { escopo: { contains: busca, mode: 'insensitive' } },
          { cliente: { nome: { contains: busca, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    select: {
      id: true, numero: true, cidade: true, estado: true, escopo: true, classificacao: true,
      cliente: { select: { nome: true } },
      propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true, resultado: true, valor_total: true } },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true, resultado: true, valor_total: true } },
    },
    orderBy: { numero: 'desc' },
    take: 50,
  })

  const data = rows
    .filter((s) => resolverPropostaAtual(s).aberta)
    .map((s) => ({
      solicitacao_id: s.id,
      numero: s.numero,
      cliente_nome: s.cliente.nome,
      cidade: s.cidade,
      estado: s.estado,
      escopo: s.escopo,
      classificacao: s.classificacao,
    }))

  return NextResponse.json({ data, error: null })
}
