import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function buildWhere(params: URLSearchParams) {
  const busca = params.get('busca') ?? undefined
  const status = params.get('status') ?? undefined
  const vencimento_de = params.get('vencimento_de') ?? undefined
  const vencimento_ate = params.get('vencimento_ate') ?? undefined
  const emissao_de = params.get('emissao_de') ?? undefined
  const emissao_ate = params.get('emissao_ate') ?? undefined
  const ano = params.get('ano') ?? undefined
  const venc_status = params.get('venc_status') ?? undefined

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const em30 = new Date(hoje)
  em30.setDate(em30.getDate() + 30)

  return {
    ...(status === 'ativa' && { ativa: true }),
    ...(status === 'inativa' && { ativa: false }),
    ...(venc_status === 'vencidas' && { ativa: true, data_vencimento: { lt: hoje } }),
    ...(venc_status === 'proximas' && { ativa: true, data_vencimento: { gte: hoje, lte: em30 } }),
    ...(venc_status === 'ok' && { ativa: true, data_vencimento: { gt: em30 } }),
    ...(venc_status === 'inativas' && { ativa: false }),
    ...(vencimento_de || vencimento_ate
      ? {
          data_vencimento: {
            ...(vencimento_de && { gte: new Date(vencimento_de) }),
            ...(vencimento_ate && { lte: new Date(vencimento_ate + 'T23:59:59') }),
          },
        }
      : {}),
    ...(emissao_de || emissao_ate
      ? {
          data_emissao: {
            ...(emissao_de && { gte: new Date(emissao_de) }),
            ...(emissao_ate && { lte: new Date(emissao_ate + 'T23:59:59') }),
          },
        }
      : {}),
    ...(ano && { acordo: { ano: Number(ano) } }),
    ...(busca && {
      OR: [
        { numero_nf: { contains: busca, mode: 'insensitive' as const } },
        { acordo: { numero: { contains: busca, mode: 'insensitive' as const } } },
        { acordo: { cliente: { nome: { contains: busca, mode: 'insensitive' as const } } } },
      ],
    }),
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const modo = searchParams.get('modo')

  if (modo === 'contagens') {
    const baseWhere = buildWhere(searchParams)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em30 = new Date(hoje)
    em30.setDate(em30.getDate() + 30)

    const [total, vencidas, proximas, ok, inativas, somaAtivas, somaVencidas] = await Promise.all([
      prisma.notaFiscal.count({ where: baseWhere }),
      prisma.notaFiscal.count({ where: { ...baseWhere, ativa: true, data_vencimento: { lt: hoje } } }),
      prisma.notaFiscal.count({ where: { ...baseWhere, ativa: true, data_vencimento: { gte: hoje, lte: em30 } } }),
      prisma.notaFiscal.count({ where: { ...baseWhere, ativa: true, data_vencimento: { gt: em30 } } }),
      prisma.notaFiscal.count({ where: { ...baseWhere, ativa: false } }),
      prisma.notaFiscal.aggregate({ where: { ...baseWhere, ativa: true }, _sum: { valor: true } }),
      prisma.notaFiscal.aggregate({ where: { ...baseWhere, ativa: true, data_vencimento: { lt: hoje } }, _sum: { valor: true } }),
    ])

    return NextResponse.json({
      data: {
        total,
        vencidas,
        proximas,
        ok,
        inativas,
        totalValor: Number(somaAtivas._sum.valor ?? 0),
        totalVencidas: Number(somaVencidas._sum.valor ?? 0),
      },
      error: null,
    })
  }

  const where = buildWhere(searchParams)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = 50
  const skip = (page - 1) * limit

  const [nfs, totalCount] = await Promise.all([
    prisma.notaFiscal.findMany({
      where,
      orderBy: { data_vencimento: 'asc' },
      skip,
      take: limit,
      include: {
        acordo: {
          select: {
            id: true,
            numero: true,
            ano: true,
            cliente: { select: { id: true, nome: true } },
          },
        },
      },
    }),
    prisma.notaFiscal.count({ where }),
  ])

  const data = nfs.map((nf) => ({
    id: nf.id,
    numero_nf: nf.numero_nf,
    valor: Number(nf.valor),
    data_emissao: nf.data_emissao.toISOString(),
    data_vencimento: nf.data_vencimento.toISOString(),
    ativa: nf.ativa,
    motivo_inativacao: nf.motivo_inativacao,
    created_at: nf.created_at.toISOString(),
    acordo_id: nf.acordo_id,
    acordo: {
      id: nf.acordo.id,
      numero: nf.acordo.numero,
      ano: nf.acordo.ano,
    },
    cliente: nf.acordo.cliente,
  }))

  return NextResponse.json({
    data,
    total: totalCount,
    pages: Math.ceil(totalCount / limit),
    error: null,
  })
}
