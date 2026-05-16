import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const ano = searchParams.get('ano') ? Number(searchParams.get('ano')) : new Date().getFullYear()
  const cliente_id = searchParams.get('cliente_id') ?? undefined
  const busca = searchParams.get('busca') ?? undefined

  const acordos = await prisma.acordo.findMany({
    where: {
      cancelled_at: null,
      status: { in: ['ATIVO', 'ENCERRADO'] },
      ano,
      ...(cliente_id && { cliente_id: Number(cliente_id) }),
      ...(busca && {
        OR: [
          { numero: { contains: busca, mode: 'insensitive' } },
          { cliente: { nome: { contains: busca, mode: 'insensitive' } } },
          { descricao: { contains: busca, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { created_at: 'desc' },
    include: {
      cliente: { select: { id: true, nome: true } },
      notas_fiscais: { orderBy: { data_vencimento: 'asc' } },
    },
  })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const em30Dias = new Date(hoje)
  em30Dias.setDate(em30Dias.getDate() + 30)

  const data = acordos.map((a) => {
    const nfsAtivas = a.notas_fiscais.filter((nf) => nf.ativa)
    const totalFaturado = nfsAtivas.reduce((acc, nf) => acc + Number(nf.valor), 0)
    const valorTotal = Number(a.valor_total)
    const saldo = valorTotal - totalFaturado
    const percExecutado = valorTotal > 0 ? (totalFaturado / valorTotal) * 100 : 0

    const nfsVencidas = nfsAtivas.filter((nf) => new Date(nf.data_vencimento) < hoje)
    const nfsProximas = nfsAtivas.filter((nf) => {
      const v = new Date(nf.data_vencimento)
      return v >= hoje && v <= em30Dias
    })
    const proximoVencimento = nfsAtivas
      .filter((nf) => new Date(nf.data_vencimento) >= hoje)
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0]

    return {
      id: a.id,
      numero: a.numero,
      created_at: a.created_at.toISOString(),
      cliente: a.cliente,
      descricao: a.descricao,
      valor_total: valorTotal,
      valor_anos_seguintes: a.valor_anos_seguintes ? Number(a.valor_anos_seguintes) : null,
      ano: a.ano,
      status: a.status,
      data_inicio: a.data_inicio?.toISOString() ?? null,
      data_fim: a.data_fim?.toISOString() ?? null,
      // Calculados
      total_faturado: totalFaturado,
      perc_executado: Number(percExecutado.toFixed(1)),
      saldo,
      qt_nfs: a.notas_fiscais.length,
      qt_nfs_ativas: nfsAtivas.length,
      qt_vencidas: nfsVencidas.length,
      qt_proximas_30d: nfsProximas.length,
      proximo_vencimento: proximoVencimento?.data_vencimento.toISOString() ?? null,
      // Para modais
      total_nfs: totalFaturado,
      perc_executado_raw: percExecutado,
    }
  })

  return NextResponse.json({ data, error: null })
}
