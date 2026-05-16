import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const busca = searchParams.get('busca') ?? undefined
  const status = searchParams.get('status') ?? undefined // 'ativa' | 'inativa'
  const vencimento_de = searchParams.get('vencimento_de') ?? undefined
  const vencimento_ate = searchParams.get('vencimento_ate') ?? undefined
  const emissao_de = searchParams.get('emissao_de') ?? undefined
  const emissao_ate = searchParams.get('emissao_ate') ?? undefined
  const ano = searchParams.get('ano') ?? undefined

  const nfs = await prisma.notaFiscal.findMany({
    where: {
      ...(status === 'ativa' && { ativa: true }),
      ...(status === 'inativa' && { ativa: false }),
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
          { numero_nf: { contains: busca, mode: 'insensitive' } },
          { acordo: { numero: { contains: busca, mode: 'insensitive' } } },
          { acordo: { cliente: { nome: { contains: busca, mode: 'insensitive' } } } },
        ],
      }),
    },
    orderBy: { data_vencimento: 'asc' },
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
  })

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

  return NextResponse.json({ data, error: null })
}
