import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  nome: z.string().min(2).optional(),
  cnpj: z.string().nullable().optional(),
  contato_nome: z.string().nullable().optional(),
  contato_email: z.string().email().nullable().optional().or(z.literal('')),
  contato_telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().max(2).nullable().optional(),
  ramo_atuacao: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'MINERACAO', 'OLEO_GAS', 'OUTROS']).nullable().optional(),
  segmento: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'OLEO_GAS', 'OUTROS']).nullable().optional(),
  ativo: z.boolean().optional(),
  filiais: z.array(z.object({
    cidade: z.string().min(1),
    estado: z.string().length(2),
  })).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      filiais: {
        where: { ativo: true },
        orderBy: { cidade: 'asc' },
      },
    },
  })

  if (!cliente) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ data: cliente, error: null })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

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

  const d = parsed.data

  const cliente = await prisma.$transaction(async (tx) => {
    const updated = await tx.cliente.update({
      where: { id },
      data: {
        ...(d.nome !== undefined && { nome: d.nome }),
        ...(d.cnpj !== undefined && { cnpj: d.cnpj }),
        ...(d.contato_nome !== undefined && { contato_nome: d.contato_nome }),
        ...(d.contato_email !== undefined && { contato_email: d.contato_email || null }),
        ...(d.contato_telefone !== undefined && { contato_telefone: d.contato_telefone }),
        ...(d.cidade !== undefined && { cidade: d.cidade }),
        ...(d.estado !== undefined && { estado: d.estado }),
        ...(d.ramo_atuacao !== undefined && { ramo_atuacao: d.ramo_atuacao }),
        ...(d.segmento !== undefined && { segmento: d.segmento }),
        ...(d.ativo !== undefined && { ativo: d.ativo }),
      },
    })

    if (d.filiais !== undefined) {
      await tx.filial.updateMany({
        where: { cliente_id: id },
        data: { ativo: false },
      })
      if (d.filiais.length > 0) {
        await tx.filial.createMany({
          data: d.filiais.map((f) => ({
            cliente_id: id,
            cidade: f.cidade,
            estado: f.estado,
            created_by: Number(session.user.id),
          })),
        })
      }
    }

    return updated
  })

  return NextResponse.json({ data: cliente, error: null })
}
