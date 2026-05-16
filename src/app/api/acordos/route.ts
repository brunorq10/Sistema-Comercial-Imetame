import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  cliente_id: z.number().int().positive(),
  descricao: z.string().optional(),
  valor_total: z.number().positive(),
  ano: z.number().int().min(2000).max(2100),
  valor_anos_seguintes: z.number().nonnegative().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const ano = searchParams.get('ano') ?? undefined
  const cliente_id = searchParams.get('cliente_id') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const busca = searchParams.get('busca') ?? undefined

  const items = await prisma.acordo.findMany({
    where: {
      cancelled_at: null,
      ...(ano && { ano: Number(ano) }),
      ...(cliente_id && { cliente_id: Number(cliente_id) }),
      ...(status && { status: status as never }),
      ...(busca && {
        OR: [
          { numero: { contains: busca, mode: 'insensitive' } },
          { cliente: { nome: { contains: busca, mode: 'insensitive' } } },
          { descricao: { contains: busca, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: [{ ano: 'desc' }, { created_at: 'desc' }],
    include: {
      cliente: { select: { id: true, nome: true } },
      notas_fiscais: true,
    },
  })

  const data = items.map((a) => {
    const nfsAtivas = a.notas_fiscais.filter((nf) => nf.ativa)
    const totalNfs = nfsAtivas.reduce((acc, nf) => acc + Number(nf.valor), 0)
    const valorTotal = Number(a.valor_total)
    const percExecutado = valorTotal > 0 ? (totalNfs / valorTotal) * 100 : 0
    const saldo = valorTotal - totalNfs

    return {
      id: a.id,
      numero: a.numero,
      created_at: a.created_at.toISOString(),
      cliente: a.cliente,
      descricao: a.descricao,
      valor_total: valorTotal,
      ano: a.ano,
      valor_anos_seguintes: a.valor_anos_seguintes ? Number(a.valor_anos_seguintes) : null,
      status: a.status,
      data_inicio: a.data_inicio?.toISOString() ?? null,
      data_fim: a.data_fim?.toISOString() ?? null,
      // Calculados RN-12
      total_nfs: totalNfs,
      perc_executado: Number(percExecutado.toFixed(1)),
      saldo,
      qt_nfs: a.notas_fiscais.length,
      qt_nfs_ativas: nfsAtivas.length,
    }
  })

  return NextResponse.json({ data, error: null })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const count = await prisma.acordo.count()
  const numero = `ACD-${String(count + 1).padStart(4, '0')}`

  const acordo = await prisma.acordo.create({
    data: {
      numero,
      cliente_id: parsed.data.cliente_id,
      descricao: parsed.data.descricao,
      valor_total: parsed.data.valor_total,
      ano: parsed.data.ano,
      valor_anos_seguintes: parsed.data.valor_anos_seguintes ?? null,
      data_inicio: parsed.data.data_inicio ? new Date(parsed.data.data_inicio) : null,
      data_fim: parsed.data.data_fim ? new Date(parsed.data.data_fim) : null,
      created_by: Number(session.user.id),
    },
    include: { cliente: { select: { id: true, nome: true } } },
  })

  return NextResponse.json({ data: acordo, error: null }, { status: 201 })
}
