import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schemaEquipamento = z.object({
  descricao: z.string().min(1),
  peso_ton: z.number().positive(),
  valor_total: z.number().min(0),
  observacoes: z.string().optional(),
})

const schemaPost = z.object({
  equipamentos: z.array(schemaEquipamento).min(1),
  possui_testes: z.boolean().default(false),
  descricao_testes: z.string().optional(),
  valor_testes: z.number().min(0).optional(),
  possui_montagem: z.boolean().default(false),
  valor_montagem: z.number().min(0).optional(),
  data_envio: z.string().min(1),
})

const schemaPatch = z.object({
  resultado: z.enum(['AGUARDANDO', 'GANHOU', 'PERDEU']),
  motivo_perda: z.enum(['PRECO', 'PRAZO', 'ESCOPO', 'CONCORRENCIA', 'CLIENTE_DESISTIU', 'OUTRO']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schemaPatch.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  if (parsed.data.resultado === 'PERDEU' && !parsed.data.motivo_perda) {
    return NextResponse.json({ data: null, error: 'Motivo de perda é obrigatório' }, { status: 400 })
  }

  const latest = await prisma.propostaFabricacao.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta de fabricação encontrada' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const fab = await tx.propostaFabricacao.update({
      where: { id: latest.id },
      data: {
        resultado: parsed.data.resultado,
        motivo_perda: parsed.data.resultado === 'PERDEU' ? (parsed.data.motivo_perda ?? null) : null,
      },
    })
    if (parsed.data.resultado === 'GANHOU') {
      await tx.solicitacao.update({ where: { id }, data: { status: 'CONTRATO_GANHO' } })
    }
    return fab
  })

  return NextResponse.json({ data: result, error: null })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: { propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1 } },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const pesoTotal = d.equipamentos.reduce((acc, e) => acc + e.peso_ton, 0)
  const valorEquipamentos = d.equipamentos.reduce((acc, e) => acc + e.valor_total, 0)
  const valorTestes = d.possui_testes ? (d.valor_testes ?? 0) : 0
  const valorMontagem = d.possui_montagem ? (d.valor_montagem ?? 0) : 0
  const valorTotal = valorEquipamentos + valorTestes + valorMontagem
  const proximaVersao = (sol.propostas_fabricacao[0]?.versao ?? 0) + 1

  const proposta = await prisma.$transaction(async (tx) => {
    const pf = await tx.propostaFabricacao.create({
      data: {
        solicitacao_id: id,
        versao: proximaVersao,
        possui_testes: d.possui_testes,
        descricao_testes: d.possui_testes ? (d.descricao_testes ?? null) : null,
        valor_testes: d.possui_testes ? valorTestes : null,
        possui_montagem: d.possui_montagem,
        valor_montagem: d.possui_montagem ? valorMontagem : null,
        peso_total: pesoTotal,
        valor_total: valorTotal,
        data_envio: new Date(d.data_envio),
        created_by: Number(session.user.id),
        equipamentos: {
          create: d.equipamentos.map((e, i) => ({
            ordem: i + 1,
            descricao: e.descricao,
            peso_ton: e.peso_ton,
            valor_total: e.valor_total,
            observacoes: e.observacoes ?? null,
          })),
        },
      },
      include: { equipamentos: true },
    })
    await tx.solicitacao.update({
      where: { id },
      data: { status: 'PROPOSTA_ENVIADA' },
    })
    return pf
  })

  return NextResponse.json({ data: proposta, error: null }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const latest = await prisma.propostaFabricacao.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta de fabricação encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const pesoTotal = d.equipamentos.reduce((acc, e) => acc + e.peso_ton, 0)
  const valorEquipamentos = d.equipamentos.reduce((acc, e) => acc + e.valor_total, 0)
  const valorTestes = d.possui_testes ? (d.valor_testes ?? 0) : 0
  const valorMontPut = d.possui_montagem ? (d.valor_montagem ?? 0) : 0
  const valorTotal = valorEquipamentos + valorTestes + valorMontPut

  const proposta = await prisma.$transaction(async (tx) => {
    return tx.propostaFabricacao.update({
      where: { id: latest.id },
      data: {
        possui_testes: d.possui_testes,
        descricao_testes: d.possui_testes ? (d.descricao_testes ?? null) : null,
        valor_testes: d.possui_testes ? valorTestes : null,
        possui_montagem: d.possui_montagem,
        valor_montagem: d.possui_montagem ? valorMontPut : null,
        peso_total: pesoTotal,
        valor_total: valorTotal,
        data_envio: new Date(d.data_envio),
        equipamentos: {
          deleteMany: {},
          create: d.equipamentos.map((e, i) => ({
            ordem: i + 1,
            descricao: e.descricao,
            peso_ton: e.peso_ton,
            valor_total: e.valor_total,
            observacoes: e.observacoes ?? null,
          })),
        },
      },
      include: { equipamentos: true },
    })
  })

  return NextResponse.json({ data: proposta, error: null })
}
