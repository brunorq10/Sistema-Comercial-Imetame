import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarNumeroSolicitacao } from '@/lib/utils'
import { emailNovaSolicitacao } from '@/lib/notifications'
import type { Classificacao, Interesse, Origem, Segmento, StatusSolicitacao } from '@prisma/client'

// ─── GET /api/solicitacoes?modo=filtros ──────────────────────────────────────
// Retorna valores distintos para popular os dropdowns de filtro

async function getFiltros() {
  const rows = await prisma.solicitacao.findMany({
    select: {
      cliente:      { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
      criador:      { select: { id: true, nome: true } },
    },
  })

  const clientesMap      = new Map<number, string>()
  const orcamentistasMap = new Map<number, string>()
  const responsaveisMap  = new Map<number, string>()

  for (const s of rows) {
    clientesMap.set(s.cliente.id, s.cliente.nome)
    if (s.orcamentista) orcamentistasMap.set(s.orcamentista.id, s.orcamentista.nome)
    if (s.criador)      responsaveisMap.set(s.criador.id, s.criador.nome)
  }

  const sort = (m: Map<number, string>) =>
    Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))

  return NextResponse.json({
    data: {
      clientes:      sort(clientesMap),
      orcamentistas: sort(orcamentistasMap),
      responsaveis:  sort(responsaveisMap),
    },
    error: null,
  })
}

// ─── GET /api/solicitacoes ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl

  if (searchParams.get('modo') === 'filtros') return getFiltros()

  if (searchParams.get('modo') === 'autocomplete') {
    const busca = searchParams.get('busca') ?? ''
    const rows = await prisma.solicitacao.findMany({
      where: { numero: { contains: busca, mode: 'insensitive' }, cancelled_at: null },
      select: { id: true, numero: true, cliente: { select: { nome: true } } },
      orderBy: { numero: 'asc' },
      take: 10,
    })
    return NextResponse.json({ data: rows.map((r) => ({ id: r.id, numero: r.numero, cliente: r.cliente.nome })), error: null })
  }
  const page  = Math.max(1, Number(searchParams.get('page')  ?? 1))
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 20))
  const skip  = (page - 1) * limit

  const ano = searchParams.get('ano') ?? undefined
  const cliente_id = searchParams.get('cliente_id') ? Number(searchParams.get('cliente_id')) : undefined
  const classificacao = (searchParams.get('classificacao') as Classificacao) || undefined
  const interesse = (searchParams.get('interesse') as Interesse) || undefined
  const status = (searchParams.get('status') as StatusSolicitacao) || undefined
  const responsavel_id = searchParams.get('responsavel_id') ? Number(searchParams.get('responsavel_id')) : undefined
  const orcamentista_id = searchParams.get('orcamentista_id') ? Number(searchParams.get('orcamentista_id')) : undefined
  const data_de = searchParams.get('data_de') ?? undefined
  const data_ate = searchParams.get('data_ate') ?? undefined

  // RN-14: Canceladas permanecem visíveis com seu próprio filtro
  const isCanceladasTab = status === 'CANCELADA'

  const anoNum = ano ? Number(ano) : undefined

  const where = {
    ...(isCanceladasTab
      ? { cancelled_at: { not: null as Date | null }, status: 'CANCELADA' as StatusSolicitacao }
      : { cancelled_at: null, ...(status && { status }) }
    ),
    ...(anoNum && {
      created_at: {
        gte: new Date(`${anoNum}-01-01`),
        lt:  new Date(`${anoNum + 1}-01-01`),
      },
    }),
    ...(cliente_id && { cliente_id }),
    ...(classificacao && { classificacao }),
    ...(interesse && { interesse }),
    ...(responsavel_id && { created_by: responsavel_id }),
    ...(orcamentista_id && { orcamentista_id }),
    ...(!anoNum && (data_de || data_ate)
      ? {
          created_at: {
            ...(data_de && { gte: new Date(data_de) }),
            ...(data_ate && { lte: new Date(data_ate + 'T23:59:59') }),
          },
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.solicitacao.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        numero: true,
        created_at: true,
        contato: true,
        cidade: true,
        estado: true,
        segmento: true,
        origem: true,
        escopo: true,
        classificacao: true,
        interesse: true,
        data_recebimento: true,
        referencia_cliente: true,
        data_visita: true,
        status: true,
        status_analise: true,
        prazo_tecnica: true,
        prazo_tecnica_indeterminado: true,
        prazo_comercial: true,
        prazo_comercial_indeterminado: true,
        visita_tecnica: true,
        as_sold: true,
        cancelled_at: true,
        motivo_reprovacao: true,
        obs_reprovacao: true,
        cliente: { select: { id: true, nome: true } },
        cliente_final: { select: { id: true, nome: true } },
        orcamentista: { select: { id: true, nome: true } },
        propostas_tecnicas: { select: { versao: true }, orderBy: { versao: 'desc' }, take: 1 },
      },
    }),
    prisma.solicitacao.count({ where }),
  ])

  const data = items.map((s) => ({
    ...s,
    created_at: s.created_at.toISOString(),
    prazo_tecnica: s.prazo_tecnica?.toISOString() ?? null,
    prazo_comercial: s.prazo_comercial?.toISOString() ?? null,
    data_recebimento: s.data_recebimento?.toISOString() ?? null,
    data_visita: s.data_visita?.toISOString() ?? null,
    cancelled_at: s.cancelled_at?.toISOString() ?? null,
    versao_atual: s.propostas_tecnicas[0]?.versao ?? 1,
  }))

  return NextResponse.json({ data, total, page, limit, pages: Math.ceil(total / limit), error: null })
}

// ─── POST /api/solicitacoes ───────────────────────────────────────────────────

const createSchema = z.object({
  cliente_id: z.number().int().positive(),
  cliente_final_id: z.number().int().positive().optional(),
  data_recebimento: z.string().optional(),
  segmento: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'OLEO_GAS', 'OUTROS']).optional(),
  contato: z.string().optional(),
  referencia_cliente: z.string().optional(),
  comprador: z.string().optional(),
  telefone_comprador: z.string().optional(),
  email_comprador: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  origem: z.enum(['EMAIL', 'TELEFONE', 'VISITA', 'INDICACAO', 'OUTRO']).optional(),
  escopo: z.string().optional(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']).optional(),
  interesse: z.enum(['ALTO', 'MEDIO', 'BAIXO']).optional(),
  prazo_tecnica: z.string().optional(),
  prazo_tecnica_indeterminado: z.boolean().optional(),
  prazo_comercial: z.string().optional(),
  prazo_comercial_indeterminado: z.boolean().optional(),
  orcamentista_id: z.number().int().positive().optional(),
  visita_tecnica: z.boolean().optional(),
  data_visita: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { data } = parsed

  // Auto-fill cidade/estado from cliente_final if not provided (RN-09)
  let cidadeAutoFill = data.cidade
  let estadoAutoFill = data.estado
  if (data.cliente_final_id && (!cidadeAutoFill || !estadoAutoFill)) {
    const cf = await prisma.cliente.findUnique({
      where: { id: data.cliente_final_id },
      select: { cidade: true, estado: true },
    })
    if (cf) {
      cidadeAutoFill = cidadeAutoFill || cf.cidade || undefined
      estadoAutoFill = estadoAutoFill || cf.estado || undefined
    }
  }

  const last = await prisma.solicitacao.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  })
  const numero = gerarNumeroSolicitacao((last?.id ?? 0) + 1)

  const solicitacao = await prisma.solicitacao.create({
    data: {
      numero,
      cliente_id: data.cliente_id,
      cliente_final_id: data.cliente_final_id,
      data_recebimento: data.data_recebimento ? new Date(data.data_recebimento) : undefined,
      segmento: data.segmento as Segmento | undefined,
      contato: data.contato,
      referencia_cliente: data.referencia_cliente,
      comprador: data.comprador,
      telefone_comprador: data.telefone_comprador,
      email_comprador: data.email_comprador,
      cidade: cidadeAutoFill,
      estado: estadoAutoFill,
      origem: data.origem as Origem | undefined,
      escopo: data.escopo,
      classificacao: data.classificacao as Classificacao | undefined,
      interesse: data.interesse as Interesse | undefined,
      prazo_tecnica: data.prazo_tecnica ? new Date(data.prazo_tecnica) : undefined,
      prazo_tecnica_indeterminado: data.prazo_tecnica_indeterminado ?? false,
      prazo_comercial: data.prazo_comercial ? new Date(data.prazo_comercial) : undefined,
      prazo_comercial_indeterminado: data.prazo_comercial_indeterminado ?? false,
      orcamentista_id: data.orcamentista_id,
      visita_tecnica: data.visita_tecnica ?? false,
      data_visita: data.data_visita ? new Date(data.data_visita) : undefined,
      created_by: Number(session.user.id),
    },
    include: {
      cliente: { select: { nome: true } },
      orcamentista: { select: { email: true, nome: true } },
    },
  })

  if (solicitacao.orcamentista?.email) {
    emailNovaSolicitacao(
      solicitacao.orcamentista.email,
      numero,
      solicitacao.cliente.nome,
    )
  }

  return NextResponse.json({ data: solicitacao, error: null }, { status: 201 })
}
