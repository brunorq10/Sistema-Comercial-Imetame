import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  nome: z.string().min(2, 'Razão Social obrigatória'),
  cnpj: z.string().optional(),
  contato_nome: z.string().optional(),
  contato_email: z.string().email().optional().or(z.literal('')),
  contato_telefone: z.string().optional(),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  estado: z.string().length(2, 'UF obrigatória'),
  ramo_atuacao: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'MINERACAO', 'OLEO_GAS', 'OUTROS'], {
    required_error: 'Ramo de atuação obrigatório',
    invalid_type_error: 'Ramo de atuação obrigatório',
  }),
  segmento: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'OLEO_GAS', 'OUTROS'], {
    required_error: 'Segmento obrigatório',
    invalid_type_error: 'Segmento obrigatório',
  }),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const full = searchParams.get('full') === '1'
  const busca = searchParams.get('busca') ?? undefined
  const includeInativo = searchParams.get('inativo') === '1'

  // Modo simples: id + nome + cidade/estado + segmento (para selects e auto-fill)
  if (!full) {
    const clientes = await prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        cidade: true,
        estado: true,
        ramo_atuacao: true,
        segmento: true,
      },
    })
    // Cada filial é cadastrada como cliente próprio — campo mantido vazio por compatibilidade
    const data = clientes.map((c) => ({ ...c, filiais: [] as never[] }))
    return NextResponse.json({ data, error: null })
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
    codigo: c.codigo ?? null,
    nome: c.nome,
    cnpj: c.cnpj,
    contato_nome: c.contato_nome,
    contato_email: c.contato_email,
    contato_telefone: c.contato_telefone,
    cidade: c.cidade,
    estado: c.estado,
    ramo_atuacao: c.ramo_atuacao,
    segmento: c.segmento,
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
      cidade: d.cidade,
      estado: d.estado,
      ramo_atuacao: d.ramo_atuacao,
      segmento: d.segmento,
      created_by: Number(session.user.id),
    },
  })

  const codigo = `CLI-${String(cliente.id).padStart(4, '0')}`
  await prisma.cliente.update({ where: { id: cliente.id }, data: { codigo } })

  return NextResponse.json({ data: { ...cliente, codigo }, error: null }, { status: 201 })
}
