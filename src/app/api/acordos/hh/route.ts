import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const classificacao  = searchParams.get('classificacao') ?? 'OBRAS'
  const disponivel     = searchParams.get('disponivel') === '1' // contratos SEM HH para o novo lançamento

  const contratos = await prisma.contrato.findMany({
    where: {
      cancelled_at: null,
      ...(classificacao !== 'TODOS' && { classificacao: classificacao as never }),
    },
    orderBy: { indice: 'asc' },
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      hh_lancamentos: {
        orderBy: { versao: 'desc' },
        take: 1,
        include: { meses: true, criador: { select: { nome: true } } },
      },
      hh_realizados: {
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
      },
    },
  })

  const data = contratos.map(c => {
    const lancamento    = c.hh_lancamentos[0] ?? null
    const temLancamento = lancamento !== null
    const hhPrevisto    = lancamento ? lancamento.meses.reduce((s, m) => s + (m.hh_previsto  ?? 0), 0) : null
    const hhPlanejado   = lancamento ? lancamento.meses.reduce((s, m) => s + (m.hh_planejado ?? 0), 0) : null
    const hhRealizado   = c.hh_realizados.length > 0
      ? c.hh_realizados.reduce((s, r) => s + r.hh_realizado, 0) : null

    return {
      id: c.id,
      indice: c.indice,
      num_os: c.num_os,
      cidade: c.cidade,
      estado: c.estado,
      classificacao: c.classificacao,
      cliente:       c.cliente,
      cliente_final: c.cliente_final ?? null,
      descricao: c.descricao,
      responsavel: c.responsavel,
      data_inicio: c.data_inicio?.toISOString() ?? null,
      data_fim:    c.data_fim?.toISOString()    ?? null,
      tem_lancamento: temLancamento,
      hh_previsto:  hhPrevisto,
      hh_planejado: hhPlanejado,
      hh_realizado: hhRealizado,
      lancamento_atual: lancamento ? {
        id: lancamento.id, versao: lancamento.versao,
        data_inicio: lancamento.data_inicio.toISOString(),
        data_fim:    lancamento.data_fim.toISOString(),
        motivo: lancamento.motivo,
        created_at: lancamento.created_at.toISOString(),
        criador: (lancamento as typeof lancamento & { criador: { nome: string } }).criador.nome,
        meses: lancamento.meses,
      } : null,
      realizados: c.hh_realizados,
    }
  })

  // Modo "disponível": contratos sem HH (para seleção no Novo Lançamento)
  if (disponivel) {
    return NextResponse.json({ data: data.filter(c => !c.tem_lancamento), error: null })
  }

  // Modo padrão: só mostra contratos que JÁ têm lançamento
  return NextResponse.json({ data: data.filter(c => c.tem_lancamento), error: null })
}
