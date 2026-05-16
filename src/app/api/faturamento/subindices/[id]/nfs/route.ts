import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  numero_nf: z.string().min(1),
  valor_total_nf: z.number().positive(),
  percentual: z.number().min(0.01).max(100),
  data_emissao: z.string(),
  data_vencimento: z.string(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const subindiceId = Number(params.id)
  if (isNaN(subindiceId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const valor_atribuido = (parsed.data.valor_total_nf * parsed.data.percentual) / 100

  const nf = await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: subindiceId,
      numero_nf: parsed.data.numero_nf,
      valor_total_nf: parsed.data.valor_total_nf,
      percentual: parsed.data.percentual,
      valor_atribuido,
      data_emissao: new Date(parsed.data.data_emissao),
      data_vencimento: new Date(parsed.data.data_vencimento),
      created_by: Number(session.user.id),
    },
  })

  return NextResponse.json({
    data: {
      id: nf.id,
      numero_nf: nf.numero_nf,
      valor_total_nf: Number(nf.valor_total_nf),
      percentual: Number(nf.percentual),
      valor_atribuido: Number(nf.valor_atribuido),
      data_emissao: nf.data_emissao.toISOString(),
      data_vencimento: nf.data_vencimento.toISOString(),
      ativa: nf.ativa,
    },
    error: null,
  }, { status: 201 })
}
