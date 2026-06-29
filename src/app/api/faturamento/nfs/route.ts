import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ano = searchParams.get('ano')
  const clienteId = searchParams.get('cliente_id')
  const ativa = searchParams.get('ativa')
  const busca = searchParams.get('busca')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (ativa !== null && ativa !== '') {
    where.ativa = ativa === 'true'
  }

  if (busca) {
    where.numero_nf = { contains: busca, mode: 'insensitive' }
  }

  if (ano) {
    const anoNum = Number(ano)
    where.data_emissao = {
      gte: new Date(`${anoNum}-01-01`),
      lt:  new Date(`${anoNum + 1}-01-01`),
    }
  }

  if (clienteId) {
    // Aceita lista separada por vírgula (multi-seleção)
    const ids = clienteId.split(',').map(Number).filter((n) => !isNaN(n))
    if (ids.length) where.subindice = { contrato: { cliente_id: { in: ids } } }
  }

  const nfs = await prisma.notaFiscalContrato.findMany({
    where,
    include: {
      subindice: {
        include: {
          contrato: {
            include: {
              cliente: { select: { id: true, nome: true } },
            },
          },
        },
      },
    },
    orderBy: { data_emissao: 'desc' },
  })

  // Compute total % launched per NF number across entire DB
  const nfNumbers = Array.from(new Set(nfs.map((nf) => nf.numero_nf)))
  const nfTotals = nfNumbers.length > 0
    ? await prisma.notaFiscalContrato.groupBy({
        by: ['numero_nf'],
        where: { numero_nf: { in: nfNumbers } },
        _sum: { percentual: true },
      })
    : []
  const nfTotalMap: Record<string, number> = {}
  nfTotals.forEach((t) => { nfTotalMap[t.numero_nf] = Number(t._sum.percentual ?? 0) })

  const data = nfs.map((nf) => ({
    id: nf.id,
    numero_nf: nf.numero_nf,
    valor_total_nf: Number(nf.valor_total_nf),
    percentual: Number(nf.percentual),
    percentual_total: nfTotalMap[nf.numero_nf] ?? Number(nf.percentual),
    valor_atribuido: Number(nf.valor_atribuido),
    data_emissao: nf.data_emissao.toISOString(),
    data_vencimento: nf.data_vencimento.toISOString(),
    ativa: nf.ativa,
    motivo_inativacao: nf.motivo_inativacao,
    created_at: nf.created_at.toISOString(),
    subindice: {
      id: nf.subindice.id,
      ordem: nf.subindice.ordem,
      descricao: nf.subindice.descricao,
    },
    contrato: {
      id: nf.subindice.contrato.id,
      indice: nf.subindice.contrato.indice,
      num_acordo: nf.subindice.contrato.num_acordo,
      num_proposta: nf.subindice.contrato.num_proposta,
    },
    cliente: {
      id: nf.subindice.contrato.cliente.id,
      nome: nf.subindice.contrato.cliente.nome,
    },
  }))

  return NextResponse.json({ data, error: null })
}
