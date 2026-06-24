import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  ativa: z.boolean(),
  motivo_inativacao: z.string().min(5).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('acordos.nf.inativar'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // RN-20: inativação exige motivo
  if (!parsed.data.ativa && !parsed.data.motivo_inativacao) {
    return NextResponse.json(
      { data: null, error: 'Informe o motivo para inativar a NF' },
      { status: 400 },
    )
  }

  const nf = await prisma.notaFiscal.update({
    where: { id },
    data: {
      ativa: parsed.data.ativa,
      motivo_inativacao: parsed.data.ativa ? null : parsed.data.motivo_inativacao,
    },
  })

  return NextResponse.json({ data: nf, error: null })
}
