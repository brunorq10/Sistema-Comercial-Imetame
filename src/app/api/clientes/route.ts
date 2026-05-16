import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().optional(),
  contato_nome: z.string().optional(),
  contato_email: z.string().email().optional().or(z.literal('')),
  contato_telefone: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  ramo_atuacao: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'MINERACAO', 'OLEO_GAS', 'OUTROS']).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const full = searchParams.get('full') === '1'
  const busca = searchParams.get('busca') ?? undefined
  const includeInativo = searchParams.get('inativo') === '1'

  // Modo simples: id + nome + cidade/estado (para selects e auto-fill RN-09)
  if (!full) {
    const clientes = await prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cidade: true, estado: true },
    })
    return NextResponse.json({ data: clientes, error: null })
  }

  // Modo completo: listagem do cadastro
  const clientes = await prisma.cliente.findMany({
    where: {
      ...(!includeInativo && { ativo: true }),
      ...(busca && { nome: { contains: busca, mode: 'insensitive' } }),
    },
    orderBy: { nome: 'asc' },
  })

  const data = clientes.map((c) => ({
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj,
    contato_nome: c.contato_nome,
    contato_email: c.contato_email,
    contato_telefone: c.contato_telefone,
    cidade: c.cidade,
    estado: c.estado,
    ramo_atuacao: c.ramo_atuacao,
    ativo: c.ativo,
    created_at: c.created_at.toISOString(),
  }))

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

  const d = parsed.data
  const cliente = await prisma.cliente.create({
    data: {
      nome: d.nome,
      cnpj: d.cnpj || null,
      contato_nome: d.contato_nome || null,
      contato_email: d.contato_email || null,
      contato_telefone: d.contato_telefone || null,
      cidade: d.cidade || null,
      estado: d.estado || null,
      ramo_atuacao: d.ramo_atuacao ?? null,
      created_by: Number(session.user.id),
    },
  })

  return NextResponse.json({ data: cliente, error: null }, { status: 201 })
}
