import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

// GET /api/cenario/propostas-disponiveis?busca=
// Etapa 1 do Novo Lançamento — propostas ENVIADAS de Obras/Paradas (v1), com os
// dados de pré-preenchimento (datas previstas de execução vêm da Proposta
// Técnica; efetivo vem de efetivo_pico — só existe para Paradas). Propostas já
// lançadas no cenário voltam marcadas (ja_lancada), não excluídas da lista.
export async function GET(req: NextRequest) {
  const { erro } = await exigirPermissao('cenario.ver')
  if (erro) return erro

  const busca = req.nextUrl.searchParams.get('busca')?.trim() ?? ''

  const solicitacoes = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null,
      classificacao: { in: ['OBRAS', 'PARADAS'] },
      ...(busca ? {
        OR: [
          { numero: { contains: busca, mode: 'insensitive' } },
          { escopo: { contains: busca, mode: 'insensitive' } },
          { cliente: { nome: { contains: busca, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    select: {
      id: true, numero: true, classificacao: true, cidade: true, estado: true, escopo: true,
      cliente: { select: { id: true, nome: true } },
      cliente_final: { select: { id: true, nome: true } },
      propostas_comerciais: {
        orderBy: { versao: 'desc' },
        take: 1,
        select: {
          id: true, data_envio: true, resultado: true,
          proposta_tecnica: {
            select: {
              data_prevista_inicio_execucao: true,
              data_prevista_fim_execucao: true,
              efetivo_pico: true,
            },
          },
          cenario_lancamento: { select: { id: true } },
        },
      },
    },
    orderBy: { numero: 'desc' },
    take: 200,
  })

  const data = solicitacoes
    .map((s) => {
      const com = s.propostas_comerciais[0]
      if (!com || !com.data_envio || com.resultado === 'PERDEU') return null
      return {
        solicitacao_id: s.id,
        numero: s.numero,
        classificacao: s.classificacao,
        cliente: { id: s.cliente.id, nome: s.cliente.nome },
        cliente_final: s.cliente_final ? { id: s.cliente_final.id, nome: s.cliente_final.nome } : null,
        cidade: s.cidade,
        estado: s.estado,
        escopo: s.escopo,
        proposta_comercial_id: com.id,
        data_prevista_inicio_execucao: com.proposta_tecnica?.data_prevista_inicio_execucao?.toISOString() ?? null,
        data_prevista_fim_execucao: com.proposta_tecnica?.data_prevista_fim_execucao?.toISOString() ?? null,
        efetivo_pico: com.proposta_tecnica?.efetivo_pico ?? null,
        ja_lancada: !!com.cenario_lancamento,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({ data, error: null })
}
