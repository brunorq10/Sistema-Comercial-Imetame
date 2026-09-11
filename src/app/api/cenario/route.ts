import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { computeOrigem, periodoCenario, totaisPorMes, calcularIndicadores, CENARIO_LANCAMENTO_INCLUDE, toLinha } from '@/lib/cenario'

async function getCapacidade(): Promise<number> {
  const cfg = await prisma.cenarioConfig.findFirst({ orderBy: { id: 'desc' } })
  return cfg?.capacidade_efetivo ?? 0
}

// GET /api/cenario — cenário AO VIVO: capacidade, lançamentos, período, totais por mês e indicadores
export async function GET() {
  const { erro } = await exigirPermissao('cenario.ver')
  if (erro) return erro

  const [capacidade, rows] = await Promise.all([
    getCapacidade(),
    prisma.cenarioLancamento.findMany({
      where: { cancelled_at: null },
      include: CENARIO_LANCAMENTO_INCLUDE,
      orderBy: { data_inicio: 'asc' },
    }),
  ])

  // Proposta perdida sai do cenário automaticamente — nunca listada como PERDEU
  const linhas = rows
    .filter((r) => r.proposta_comercial.resultado !== 'PERDEU')
    .map(toLinha)

  const periodo = periodoCenario(linhas)
  const totais = totaisPorMes(linhas, periodo, capacidade)
  const indicadores = calcularIndicadores(linhas, capacidade)

  return NextResponse.json({
    data: {
      capacidade,
      lancamentos: rows.filter((r) => r.proposta_comercial.resultado !== 'PERDEU').map((r) => ({
        id: r.id, proposta_comercial_id: r.proposta_comercial_id,
        cliente_nome: r.cliente_nome, cliente_final_nome: r.cliente_final_nome,
        cidade: r.cidade, estado: r.estado, escopo: r.escopo, orcamentista_nome: r.orcamentista_nome,
        classificacao: r.classificacao,
        origem: computeOrigem(r.proposta_comercial.resultado),
        data_inicio: r.data_inicio.toISOString(), data_fim: r.data_fim.toISOString(),
        efetivo: r.efetivo, efetivo_mensal: (r.efetivo_mensal as Record<string, number> | null) ?? null,
        observacao: r.observacao,
      })),
      periodo,
      totais,
      indicadores,
    },
    error: null,
  })
}
