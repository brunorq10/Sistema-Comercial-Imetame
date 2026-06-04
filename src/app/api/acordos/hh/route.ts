import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const classificacao   = searchParams.get('classificacao') ?? 'OBRAS'
  const os              = searchParams.get('os') ?? undefined
  const responsavel_id  = searchParams.get('responsavel_id') ?? undefined
  const status_hh       = searchParams.get('status_hh') ?? undefined // 'com' | 'sem'

  const contratos = await prisma.contrato.findMany({
    where: {
      cancelled_at: null,
      ...(classificacao !== 'TODOS' && { classificacao: classificacao as never }),
      ...(os && { num_os: { contains: os, mode: 'insensitive' } }),
      ...(responsavel_id && { responsavel_id: Number(responsavel_id) }),
    },
    orderBy: { indice: 'asc' },
    include: {
      cliente:     { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      hh_lancamentos: {
        orderBy: { versao: 'desc' },
        take: 1,
        include: { meses: true },
      },
      hh_realizados: {
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
      },
    },
  })

  const data = contratos.map(c => {
    const lancamento = c.hh_lancamentos[0] ?? null
    const temLancamento = lancamento !== null

    const hhPrevisto = lancamento
      ? lancamento.meses.reduce((s, m) => s + (m.hh_previsto ?? 0), 0)
      : null
    const hhPlanejado = lancamento
      ? lancamento.meses.reduce((s, m) => s + (m.hh_planejado ?? 0), 0)
      : null
    const hhRealizado = c.hh_realizados.reduce((s, r) => s + r.hh_realizado, 0)
    const hhRealizadoTotal = c.hh_realizados.length > 0 ? hhRealizado : null

    return {
      id: c.id,
      indice: c.indice,
      num_os: c.num_os,
      classificacao: c.classificacao,
      cliente: c.cliente,
      descricao: c.descricao,
      responsavel: c.responsavel,
      data_inicio: c.data_inicio?.toISOString() ?? null,
      data_fim: c.data_fim?.toISOString() ?? null,
      tem_lancamento: temLancamento,
      hh_previsto: hhPrevisto,
      hh_planejado: hhPlanejado,
      hh_realizado: hhRealizadoTotal,
      lancamento_atual: lancamento ? {
        id: lancamento.id,
        versao: lancamento.versao,
        data_inicio: lancamento.data_inicio.toISOString(),
        data_fim: lancamento.data_fim.toISOString(),
        motivo: lancamento.motivo,
        meses: lancamento.meses,
      } : null,
      realizados: c.hh_realizados,
    }
  }).filter(c => {
    if (status_hh === 'com') return c.tem_lancamento
    if (status_hh === 'sem') return !c.tem_lancamento
    return true
  })

  return NextResponse.json({ data, error: null })
}
