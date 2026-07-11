import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarNumeroSolicitacao } from '@/lib/utils'
import { emailNovaSolicitacao } from '@/lib/notifications'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaSemPermissao } from '@/lib/permissaoApi'
import type { Classificacao, Interesse, Origem, Segmento, StatusSolicitacao } from '@prisma/client'

// ─── GET /api/solicitacoes?modo=filtros ──────────────────────────────────────
// Retorna valores distintos para popular os dropdowns de filtro

async function getFiltros() {
  const rows = await prisma.solicitacao.findMany({
    select: {
      created_at:    true,
      classificacao: true,
      interesse:     true,
      status:        true,
      cidade:        true,
      estado:        true,
      cliente:      { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
      criador:      { select: { id: true, nome: true } },
    },
  })

  const clientesMap      = new Map<number, string>()
  const orcamentistasMap = new Map<number, string>()
  const responsaveisMap  = new Map<number, string>()
  const cidadesSet       = new Set<string>()

  const cidadeLabel = (s: { cidade: string | null; estado: string | null }) =>
    s.cidade ? (s.estado ? `${s.cidade}/${s.estado}` : s.cidade) : null

  for (const s of rows) {
    clientesMap.set(s.cliente.id, s.cliente.nome)
    if (s.orcamentista) orcamentistasMap.set(s.orcamentista.id, s.orcamentista.nome)
    if (s.criador)      responsaveisMap.set(s.criador.id, s.criador.nome)
    const cid = cidadeLabel(s)
    if (cid) cidadesSet.add(cid)
  }

  const sort = (m: Map<number, string>) =>
    Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))

  // Tuplas por solicitação para os filtros em cascata do cliente
  const linhas = rows.map((s) => ({
    ano:             String(s.created_at.getFullYear()),
    cliente_id:      String(s.cliente.id),
    cidade:          cidadeLabel(s),
    classificacao:   s.classificacao ?? null,
    interesse:       s.interesse ?? null,
    status:          s.status,
    responsavel_id:  s.criador ? String(s.criador.id) : null,
    orcamentista_id: s.orcamentista ? String(s.orcamentista.id) : null,
  }))

  return NextResponse.json({
    data: {
      clientes:      sort(clientesMap),
      orcamentistas: sort(orcamentistasMap),
      responsaveis:  sort(responsaveisMap),
      cidades:       Array.from(cidadesSet).sort(),
      linhas,
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
    const clienteIdParam = searchParams.get('cliente_id')
    const clienteId = clienteIdParam ? Number(clienteIdParam) : undefined
    const rows = await prisma.solicitacao.findMany({
      where: {
        numero: { contains: busca, mode: 'insensitive' },
        cancelled_at: null,
        ...(clienteId !== undefined && { cliente_id: clienteId }),
      },
      select: { id: true, numero: true, cliente: { select: { nome: true } } },
      orderBy: { numero: 'asc' },
      take: clienteId !== undefined ? undefined : 10,
    })
    return NextResponse.json({ data: rows.map((r) => ({ id: r.id, numero: r.numero, cliente: r.cliente.nome })), error: null })
  }
  const page  = Math.max(1, Number(searchParams.get('page')  ?? 1))
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 20))
  const skip  = (page - 1) * limit

  const ano = searchParams.get('ano') ?? undefined
  // Filtros multi-valor: lista separada por vírgula (ex.: cliente_id=1,2,3)
  const multi = (k: string) => { const v = searchParams.get(k); return v ? v.split(',').filter(Boolean) : [] }
  const clienteIds = multi('cliente_id').map(Number).filter((n) => !isNaN(n))
  // Cidade vem como "Cidade/UF" nas opções; a coluna guarda só a cidade
  const cidades = multi('cidade').map((c) => c.split('/')[0].trim()).filter(Boolean)
  const classificacoes = multi('classificacao') as Classificacao[]
  const interesses = multi('interesse') as Interesse[]
  const responsavelIds = multi('responsavel_id').map(Number).filter((n) => !isNaN(n))
  const orcamentistaIds = multi('orcamentista_id').map(Number).filter((n) => !isNaN(n))
  const status = (searchParams.get('status') as StatusSolicitacao) || undefined
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
    ...(clienteIds.length && { cliente_id: { in: clienteIds } }),
    ...(cidades.length && { cidade: { in: cidades } }),
    ...(classificacoes.length && { classificacao: { in: classificacoes } }),
    ...(interesses.length && { interesse: { in: interesses } }),
    ...(responsavelIds.length && { created_by: { in: responsavelIds } }),
    ...(orcamentistaIds.length && { orcamentista_id: { in: orcamentistaIds } }),
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
        is_portal: true,
        portal_hora: true,
        portal_fechamento: true,
        revisao_esperada: true,
        comprador: true,
        telefone_comprador: true,
        email_comprador: true,
        as_sold: true,
        cancelled_at: true,
        suspended_at: true,
        suspend_reason: true,
        data_atribuicao: true,
        motivo_reprovacao: true,
        obs_reprovacao: true,
        cliente: { select: { id: true, nome: true } },
        cliente_final: { select: { id: true, nome: true } },
        orcamentista: { select: { id: true, nome: true } },
        propostas_tecnicas: { select: { versao: true, data_envio: true }, orderBy: { versao: 'desc' } },
        propostas_comerciais: { where: { data_envio: { not: null } }, select: { id: true }, take: 1 },
        propostas_fabricacao: { where: { data_envio: { not: null } }, select: { id: true }, take: 1 },
        relatorio_os: { select: { id: true } },
      },
    }),
    prisma.solicitacao.count({ where }),
  ])

  const data = items.map((s) => {
    const { propostas_tecnicas, propostas_comerciais, propostas_fabricacao, relatorio_os, ...rest } = s
    const temPropostaEnviada =
      propostas_tecnicas.some((t) => t.data_envio != null) ||
      propostas_comerciais.length > 0 ||
      propostas_fabricacao.length > 0
    return {
      ...rest,
      tem_relatorio_os: !!relatorio_os,
      created_at: s.created_at.toISOString(),
      prazo_tecnica: s.prazo_tecnica?.toISOString() ?? null,
      prazo_comercial: s.prazo_comercial?.toISOString() ?? null,
      data_recebimento: s.data_recebimento?.toISOString() ?? null,
      data_visita: s.data_visita?.toISOString() ?? null,
      cancelled_at: s.cancelled_at?.toISOString() ?? null,
      suspended_at: s.suspended_at?.toISOString() ?? null,
      data_atribuicao: s.data_atribuicao?.toISOString() ?? null,
      // Revisão vigente = maior entre a aprovada (revisao_esperada) e a última técnica enviada
      versao_atual: Math.max(s.revisao_esperada ?? 1, propostas_tecnicas[0]?.versao ?? 1),
      tem_proposta_enviada: temPropostaEnviada,
    }
  })

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
  is_portal: z.boolean().optional(),
  portal_fechamento: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!pode(usuarioDaSessao(session), 'orc.solicitacao.criar')) return respostaSemPermissao()

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

  // Numeração: sempre MAX(numero existente) + 1. Com a remoção por cancelamento,
  // isso garante que um número excluído só é reutilizado se não houver nenhuma
  // solicitação com numeração posterior (mantém a sequência correta).
  const numeros = await prisma.solicitacao.findMany({ select: { numero: true } })
  const maxNum = numeros.reduce((max, s) => {
    const m = /^SOL-(\d+)$/.exec(s.numero)
    return m ? Math.max(max, parseInt(m[1], 10)) : max
  }, 0)
  const numero = gerarNumeroSolicitacao(maxNum + 1)

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
      is_portal: data.is_portal ?? false,
      portal_fechamento: data.is_portal && data.portal_fechamento ? new Date(data.portal_fechamento) : null,
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
