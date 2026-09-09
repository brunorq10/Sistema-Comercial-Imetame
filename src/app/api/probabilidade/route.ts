import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { resolverPropostaAtual } from '@/lib/probabilidade'

// GET /api/probabilidade — todas as propostas comerciais enviadas e em aberto,
// visíveis no painel (não removidas). Sem paginação/filtro no servidor — a tela
// filtra no cliente para os filtros responderem instantaneamente.
export async function GET() {
  const { erro } = await exigirPermissao('probabilidade.ver')
  if (erro) return erro

  const rows = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null,
      classificacao: { in: ['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS'] },
      AND: [
        {
          OR: [
            { propostas_comerciais: { some: { data_envio: { not: null } } } },
            { propostas_fabricacao: { some: { data_envio: { not: null } } } },
          ],
        },
        {
          OR: [
            { painel_probabilidade: null },
            { painel_probabilidade: { cancelled_at: null } },
          ],
        },
      ],
    },
    select: {
      id: true, numero: true, classificacao: true, cidade: true, estado: true, escopo: true, interesse: true, segmento: true,
      cliente: { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
      propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true, resultado: true, valor_total: true } },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true, resultado: true, valor_total: true } },
      painel_probabilidade: { select: { nivel: true, revisado_em: true, revisor: { select: { nome: true } } } },
    },
    orderBy: { numero: 'desc' },
  })

  const data = rows
    .map((s) => {
      const atual = resolverPropostaAtual(s)
      if (!atual.aberta) return null
      return {
        solicitacao_id: s.id,
        numero: s.numero,
        classificacao: s.classificacao,
        cliente: s.cliente,
        cidade: s.cidade,
        estado: s.estado,
        escopo: s.escopo,
        orcamentista: s.orcamentista,
        interesse: s.interesse,
        segmento: s.segmento,
        valor_total: atual.valorTotal,
        data_envio: atual.dataEnvio?.toISOString() ?? null,
        nivel: s.painel_probabilidade?.nivel ?? null,
        revisado_em: s.painel_probabilidade?.revisado_em?.toISOString() ?? null,
        revisado_por: s.painel_probabilidade?.revisor?.nome ?? null,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({ data, error: null })
}
