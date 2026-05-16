import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PERFIS_VALIDOS = ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ORCAMENTISTA', 'GESTAO_ACORDOS', 'ACORDOS', 'ADM_GERAL'] as const

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  funcao: z.string().optional(),
  perfil: z.enum(PERFIS_VALIDOS),
  senha: z.string().min(6),
  is_analista_critico: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const busca = searchParams.get('busca') ?? undefined
  const includeInativo = searchParams.get('inativo') === '1'

  const usuarios = await prisma.user.findMany({
    where: {
      ...(!includeInativo && { ativo: true }),
      ...(busca && {
        OR: [
          { nome: { contains: busca, mode: 'insensitive' } },
          { email: { contains: busca, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      email: true,
      funcao: true,
      perfil: true,
      ativo: true,
      is_analista_critico: true,
      created_at: true,
    },
  })

  const data = usuarios.map((u) => ({
    ...u,
    created_at: u.created_at.toISOString(),
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

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json({ data: null, error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(parsed.data.senha, 12)

  // Se definido como analista crítico, remover flag dos demais
  if (parsed.data.is_analista_critico) {
    await prisma.user.updateMany({ data: { is_analista_critico: false } })
  }

  const usuario = await prisma.user.create({
    data: {
      nome: parsed.data.nome,
      email: parsed.data.email,
      funcao: parsed.data.funcao || null,
      perfil: parsed.data.perfil,
      password_hash,
      is_analista_critico: parsed.data.is_analista_critico ?? false,
    },
    select: { id: true, nome: true, email: true, funcao: true, perfil: true, ativo: true, is_analista_critico: true, created_at: true },
  })

  return NextResponse.json({ data: usuario, error: null }, { status: 201 })
}
