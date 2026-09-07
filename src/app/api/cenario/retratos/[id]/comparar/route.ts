import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { mesesDoIntervalo, totaisPorMes, calcularIndicadores, mesKey, CENARIO_LANCAMENTO_INCLUDE, toLinha, type CenarioLinha, type MesRef } from '@/lib/cenario'

interface LinhaComparacao {
  proposta_comercial_id: number
  cliente_nome: string
  escopo: string | null
  classificacao: string
  origem: string
  data_inicio: string
  data_fim: string
  efetivo: number
}

function toComparacao(l: CenarioLinha): LinhaComparacao {
  return {
    proposta_comercial_id: l.proposta_comercial_id, cliente_nome: l.cliente_nome, escopo: l.escopo,
    classificacao: l.classificacao, origem: l.origem,
    data_inicio: l.data_inicio.toISOString(), data_fim: l.data_fim.toISOString(), efetivo: l.efetivo,
  }
}

// GET /api/cenario/retratos/:id/comparar — diff somente leitura vs o cenário atual
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao('cenario.ver')
  if (erro) return erro

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const [retrato, atualCfg, atualRows] = await Promise.all([
    prisma.cenarioRetrato.findUnique({ where: { id }, include: { lancamentos: true } }),
    prisma.cenarioConfig.findFirst({ orderBy: { id: 'desc' } }),
    prisma.cenarioLancamento.findMany({ where: { cancelled_at: null }, include: CENARIO_LANCAMENTO_INCLUDE }),
  ])
  if (!retrato) return NextResponse.json({ data: null, error: 'Retrato não encontrado' }, { status: 404 })

  const linhasRetrato: CenarioLinha[] = retrato.lancamentos.map((l) => ({
    id: l.id, proposta_comercial_id: l.proposta_comercial_id,
    cliente_nome: l.cliente_nome, cliente_final_nome: l.cliente_final_nome,
    cidade: l.cidade, estado: l.estado, escopo: l.escopo,
    classificacao: l.classificacao as 'OBRAS' | 'PARADAS', origem: l.origem as 'CONTRATO' | 'PROPOSTA',
    data_inicio: l.data_inicio, data_fim: l.data_fim, efetivo: l.efetivo, observacao: l.observacao,
  }))
  const linhasAtual: CenarioLinha[] = atualRows
    .filter((r) => r.proposta_comercial.resultado !== 'PERDEU')
    .map(toLinha)
  const capacidadeAtual = atualCfg?.capacidade_efetivo ?? 0

  const mapRetrato = new Map(linhasRetrato.map((l) => [l.proposta_comercial_id, l]))
  const mapAtual = new Map(linhasAtual.map((l) => [l.proposta_comercial_id, l]))

  const entraram = linhasAtual.filter((l) => !mapRetrato.has(l.proposta_comercial_id)).map(toComparacao)
  const sairam = linhasRetrato.filter((l) => !mapAtual.has(l.proposta_comercial_id)).map(toComparacao)
  const mudaram: { antes: LinhaComparacao; depois: LinhaComparacao }[] = []
  for (const [propId, antes] of Array.from(mapRetrato)) {
    const depois = mapAtual.get(propId)
    if (!depois) continue
    const mudou = antes.data_inicio.getTime() !== depois.data_inicio.getTime()
      || antes.data_fim.getTime() !== depois.data_fim.getTime()
      || antes.efetivo !== depois.efetivo
      || antes.origem !== depois.origem
      || antes.classificacao !== depois.classificacao
    if (mudou) mudaram.push({ antes: toComparacao(antes), depois: toComparacao(depois) })
  }

  // Período conjunto (união) para comparar totais mês a mês
  const todasLinhas = [...linhasRetrato, ...linhasAtual]
  let periodoConjunto: MesRef[] = []
  if (todasLinhas.length > 0) {
    const inicioMin = new Date(Math.min(...todasLinhas.map((l) => l.data_inicio.getTime())))
    const fimMax = new Date(Math.max(...todasLinhas.map((l) => l.data_fim.getTime())))
    periodoConjunto = mesesDoIntervalo(inicioMin, fimMax)
  }
  const totaisRetrato = totaisPorMes(linhasRetrato, periodoConjunto, retrato.capacidade_efetivo)
  const totaisAtual = totaisPorMes(linhasAtual, periodoConjunto, capacidadeAtual)
  const totaisAtualMap = new Map(totaisAtual.map((t) => [mesKey(t), t]))
  const diferencaPorMes = totaisRetrato.map((t) => {
    const atual = totaisAtualMap.get(mesKey(t))
    return { ano: t.ano, mes: t.mes, total_retrato: t.total, total_atual: atual?.total ?? 0, diferenca: (atual?.total ?? 0) - t.total }
  })

  const indicadoresRetrato = calcularIndicadores(linhasRetrato, retrato.capacidade_efetivo)
  const indicadoresAtual = calcularIndicadores(linhasAtual, capacidadeAtual)

  return NextResponse.json({
    data: { entraram, sairam, mudaram, diferencaPorMes, indicadoresRetrato, indicadoresAtual },
    error: null,
  })
}
