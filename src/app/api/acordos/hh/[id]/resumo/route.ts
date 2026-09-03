import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcParadaHhTotais, bucketParadaHhPorMes, bucketMesesPrevistoRealizado, type MesHh } from '@/lib/hh'

// GET — resumo de HH (previsto/realizado total + quebra mensal) de UM contrato,
// consolidando as três fontes do Controle de HH (Obras/Paradas/Fabricações) num
// formato único, para uso fora do módulo (ex.: Visão Geral do Contrato).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const contrato = await prisma.contrato.findUnique({
    where: { id },
    select: {
      classificacao: true,
      hh_lancamentos: { orderBy: { versao: 'desc' }, take: 1, include: { meses: true } },
      hh_realizados: true,
      parada_hh_config: { include: { dias: true } },
      fabricacao_itens: { include: { meses: true, realizados: true } },
    },
  })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })

  let hhPrevistoTotal: number | null = null
  let hhRealizadoTotal: number | null = null
  let meses: MesHh[] = []

  const lancamento = contrato.hh_lancamentos[0] ?? null
  if (lancamento) {
    // Obras
    meses = bucketMesesPrevistoRealizado(
      lancamento.meses.map((m) => ({ ano: m.ano, mes: m.mes, valor: m.hh_previsto })),
      contrato.hh_realizados.map((r) => ({ ano: r.ano, mes: r.mes, valor: r.hh_realizado })),
    )
    const previstoTotal = lancamento.meses.reduce((s, m) => s + (m.hh_previsto ?? 0), 0)
    const realizadoTotal = contrato.hh_realizados.reduce((s, r) => s + r.hh_realizado, 0)
    hhPrevistoTotal = previstoTotal > 0 ? previstoTotal : null
    hhRealizadoTotal = realizadoTotal > 0 ? realizadoTotal : null
  } else if (contrato.parada_hh_config) {
    // Paradas
    const totais = calcParadaHhTotais(contrato.parada_hh_config)
    hhPrevistoTotal = totais.hhTotalPrev > 0 ? totais.hhTotalPrev : null
    hhRealizadoTotal = totais.hhTotalReal > 0 ? totais.hhTotalReal : null
    meses = bucketParadaHhPorMes(contrato.parada_hh_config.dias)
  } else if (contrato.fabricacao_itens.length > 0) {
    // Fabricações / Óleo e Gás
    meses = bucketMesesPrevistoRealizado(
      contrato.fabricacao_itens.flatMap((it) => it.meses.map((m) => ({ ano: m.ano, mes: m.mes, valor: m.hh_previsto }))),
      contrato.fabricacao_itens.flatMap((it) => it.realizados.map((r) => ({ ano: r.ano, mes: r.mes, valor: r.hh_realizado }))),
    )
    const previstoTotal = contrato.fabricacao_itens.reduce((a, it) => a + it.meses.reduce((b, m) => b + (m.hh_previsto ?? 0), 0), 0)
    const realizadoTotal = contrato.fabricacao_itens.reduce((a, it) => a + it.realizados.reduce((b, r) => b + (r.hh_realizado ?? 0), 0), 0)
    hhPrevistoTotal = previstoTotal > 0 ? previstoTotal : null
    hhRealizadoTotal = realizadoTotal > 0 ? realizadoTotal : null
  }

  return NextResponse.json({
    data: {
      classificacao: contrato.classificacao,
      hh_previsto_total: hhPrevistoTotal,
      hh_realizado_total: hhRealizadoTotal,
      meses,
    },
    error: null,
  })
}
