import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  numero_nf: z.string().min(1),
  valor: z.number().positive(),
  data_emissao: z.string(),
  data_vencimento: z.string(), // RN-21: obrigatório
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const acordoId = Number(params.id)
  if (isNaN(acordoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const nfs = await prisma.notaFiscal.findMany({
    where: { acordo_id: acordoId },
    orderBy: { data_emissao: 'desc' },
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
  }))

  return NextResponse.json({ data, error: null })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const acordoId = Number(params.id)
  if (isNaN(acordoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const acordo = await prisma.acordo.findUnique({ where: { id: acordoId } })
  if (!acordo || acordo.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Acordo não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const nf = await prisma.notaFiscal.create({
    data: {
      acordo_id: acordoId,
      numero_nf: parsed.data.numero_nf,
      valor: parsed.data.valor,
      data_emissao: new Date(parsed.data.data_emissao),
      data_vencimento: new Date(parsed.data.data_vencimento),
      created_by: Number(session.user.id),
    },
  })

  return NextResponse.json({ data: nf, error: null }, { status: 201 })
}
