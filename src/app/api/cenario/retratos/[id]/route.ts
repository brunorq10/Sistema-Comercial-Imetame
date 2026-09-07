import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { periodoCenario, totaisPorMes, calcularIndicadores, type CenarioLinha } from '@/lib/cenario'

// GET /api/cenario/retratos/:id — retrato congelado, no mesmo formato do cenário ao vivo
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao('cenario.ver')
  if (erro) return erro

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const retrato = await prisma.cenarioRetrato.findUnique({
    where: { id },
    include: { criador: { select: { nome: true } }, lancamentos: true },
  })
  if (!retrato) return NextResponse.json({ data: null, error: 'Retrato não encontrado' }, { status: 404 })

  // Retratos são uma cópia denormalizada sem detalhamento mês a mês — sempre efetivo_mensal null.
  const linhas: CenarioLinha[] = retrato.lancamentos.map((l) => ({
    id: l.id, proposta_comercial_id: l.proposta_comercial_id,
    cliente_nome: l.cliente_nome, cliente_final_nome: l.cliente_final_nome,
    cidade: l.cidade, estado: l.estado, escopo: l.escopo,
    classificacao: l.classificacao as 'OBRAS' | 'PARADAS' | 'FABRICACOES' | 'OLEO_GAS',
    origem: l.origem as 'CONTRATO' | 'PROPOSTA',
    data_inicio: l.data_inicio, data_fim: l.data_fim, efetivo: l.efetivo, efetivo_mensal: null, observacao: l.observacao,
  }))
  const periodo = periodoCenario(linhas)
  const totais = totaisPorMes(linhas, periodo, retrato.capacidade_efetivo)
  const indicadores = calcularIndicadores(linhas, retrato.capacidade_efetivo)

  return NextResponse.json({
    data: {
      id: retrato.id, nome: retrato.nome, observacao: retrato.observacao,
      created_at: retrato.created_at.toISOString(), autor: retrato.criador.nome,
      capacidade: retrato.capacidade_efetivo,
      lancamentos: retrato.lancamentos.map((l) => ({
        id: l.id, proposta_comercial_id: l.proposta_comercial_id,
        cliente_nome: l.cliente_nome, cliente_final_nome: l.cliente_final_nome,
        cidade: l.cidade, estado: l.estado, escopo: l.escopo, classificacao: l.classificacao,
        origem: l.origem, data_inicio: l.data_inicio.toISOString(), data_fim: l.data_fim.toISOString(),
        efetivo: l.efetivo, observacao: l.observacao,
      })),
      periodo, totais, indicadores,
    },
    error: null,
  })
}

// DELETE /api/cenario/retratos/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao('cenario.editar')
  if (erro) return erro

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const retrato = await prisma.cenarioRetrato.findUnique({ where: { id }, select: { id: true } })
  if (!retrato) return NextResponse.json({ data: null, error: 'Retrato não encontrado' }, { status: 404 })

  await prisma.cenarioRetrato.delete({ where: { id } })
  return NextResponse.json({ data: null, error: null })
}
