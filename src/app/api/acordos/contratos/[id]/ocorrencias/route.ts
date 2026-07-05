import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPOS_OCORRENCIA, RESPONSABILIDADES, IMPACTOS_OCORRENCIA } from '@/lib/ocorrencias'
import { exigirTitularContrato, usuarioDaSessao } from '@/lib/permissaoApi'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const TIPO_VALUES = TIPOS_OCORRENCIA.map((t) => t.value) as [string, ...string[]]
const RESP_VALUES = RESPONSABILIDADES.map((r) => r.value) as [string, ...string[]]
const IMPACTO_VALUES = IMPACTOS_OCORRENCIA.map((i) => i.value) as [string, ...string[]]

// Próximo código sequencial por contrato (OC-0001, OC-0002, ...).
// Considera TAMBÉM itens na lixeira: códigos não podem ser reutilizados
// (unique [contrato_id, codigo] segue ocupado pelo soft-delete).
async function gerarCodigo(contratoId: number): Promise<string> {
  const ultima = await prisma.ocorrenciaContratual.findFirst({
    where: { contrato_id: contratoId },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  })
  const n = ultima ? parseInt(ultima.codigo.replace(/\D/g, ''), 10) + 1 : 1
  return `OC-${String(n).padStart(4, '0')}`
}

function inicioPeriodo(periodo: string): Date | null {
  const hoje = new Date()
  if (periodo === '30d') return new Date(hoje.getTime() - 30 * 86400000)
  if (periodo === '90d') return new Date(hoje.getTime() - 90 * 86400000)
  if (periodo === 'mes_atual') return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return null
}

// GET — lista de ocorrências do contrato, com filtros server-side.
// Visível para qualquer usuário com acesso ao contrato (histórico coletivo).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const periodo = sp.get('periodo') ?? 'all'
  const responsavel = sp.get('responsavel') ?? ''
  const responsabilidade = sp.get('responsabilidade') ?? ''
  const tipo = sp.get('tipo') ?? ''

  // Filtros multi-valor: lista separada por vírgula
  const tipos = tipo ? tipo.split(',').filter(Boolean) : []
  const responsaveisIds = responsavel ? responsavel.split(',').map(Number).filter((n) => !isNaN(n)) : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { contrato_id: contratoId, deleted_at: null }
  if (responsabilidade) where.responsabilidade = responsabilidade
  if (tipos.length) where.tipo = { in: tipos }
  if (responsaveisIds.length) where.created_by = { in: responsaveisIds }
  const desde = inicioPeriodo(periodo)
  if (desde) where.data = { gte: desde }

  if (q) {
    const nq = norm(q)
    const tiposMatch = TIPOS_OCORRENCIA.filter((t) => norm(t.label).includes(nq)).map((t) => t.value)
    const respMatch = RESPONSABILIDADES.filter((r) => norm(r.label).includes(nq)).map((r) => r.value)
    const impMatch = IMPACTOS_OCORRENCIA.filter((i) => norm(i.label).includes(nq)).map((i) => i.value)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [
      { codigo: { contains: q, mode: 'insensitive' } },
      { descricao: { contains: q, mode: 'insensitive' } },
      { criador: { nome: { contains: q, mode: 'insensitive' } } },
    ]
    if (tiposMatch.length) or.push({ tipo: { in: tiposMatch } })
    if (respMatch.length) or.push({ responsabilidade: { in: respMatch } })
    if (impMatch.length) or.push({ impacto: { hasSome: impMatch } })
    where.AND = [{ OR: or }]
  }

  const [ocorrencias, responsaveisRaw] = await Promise.all([
    prisma.ocorrenciaContratual.findMany({
      where,
      orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
      include: {
        criador: { select: { nome: true } },
        anexos: { orderBy: { id: 'asc' } },
      },
    }),
    // Responsáveis (autores) de TODAS as ocorrências do contrato — para o select
    prisma.ocorrenciaContratual.findMany({
      where: { contrato_id: contratoId, deleted_at: null },
      distinct: ['created_by'],
      select: { created_by: true, criador: { select: { nome: true } } },
      orderBy: { criador: { nome: 'asc' } },
    }),
  ])

  return NextResponse.json({
    data: {
      total: ocorrencias.length,
      proximoCodigo: await gerarCodigo(contratoId),
      responsaveis: responsaveisRaw.map((r) => ({ id: r.created_by, nome: r.criador.nome })),
      items: ocorrencias.map((o) => ({
        id: o.id,
        codigo: o.codigo,
        tipo: o.tipo,
        data: o.data.toISOString(),
        responsabilidade: o.responsabilidade,
        impacto: o.impacto,
        descricao: o.descricao,
        data_notificacao_cliente: o.data_notificacao_cliente?.toISOString() ?? null,
        created_by: o.created_by,
        autor: o.criador.nome,
        created_at: o.created_at.toISOString(),
        anexos: o.anexos.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, url: a.url, tamanho: a.tamanho })),
      })),
    },
    error: null,
  })
}

const anexoSchema = z.object({
  nome: z.string().min(1),
  tipo: z.string().min(1),
  url: z.string().min(1),       // data URL (base64) ou URL externa
  tamanho: z.number().int().nullable().optional(),
})
const postSchema = z.object({
  tipo: z.enum(TIPO_VALUES, { required_error: 'Selecione o tipo de ocorrência' }),
  responsabilidade: z.enum(RESP_VALUES, { required_error: 'Selecione a responsabilidade' }),
  data: z.string().min(1, 'Informe a data do evento'),
  descricao: z.string().min(1, 'Informe a descrição'),
  impactos: z.array(z.enum(IMPACTO_VALUES)).min(1, 'Selecione pelo menos um impacto'),
  data_notificacao_cliente: z.string().nullable().optional(),
  anexos: z.array(anexoSchema).optional().default([]),
})

// POST — cria ocorrência (código sequencial gerado no servidor).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const guard = await exigirTitularContrato(session, contratoId, 'acordos.ocorrencia.criar')
  if (guard) return guard

  const parsed = postSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data

  // Limite defensivo de payload (anexos em base64 ~1,33x): mantém o request
  // dentro do limite da plataforma serverless (~4,5 MB).
  const totalBytes = d.anexos.reduce((s, a) => s + a.url.length, 0)
  if (totalBytes > 5 * 1024 * 1024) {
    return NextResponse.json({ data: null, error: 'Anexos excedem o limite total permitido.' }, { status: 413 })
  }

  // Gera o código com 1 retry em caso de corrida (unique [contrato_id, codigo])
  let criada
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const codigo = await gerarCodigo(contratoId)
    try {
      criada = await prisma.ocorrenciaContratual.create({
        data: {
          contrato_id: contratoId,
          codigo,
          tipo: d.tipo,
          data: new Date(d.data),
          responsabilidade: d.responsabilidade,
          impacto: d.impactos,
          descricao: d.descricao,
          data_notificacao_cliente: d.data_notificacao_cliente ? new Date(d.data_notificacao_cliente) : null,
          created_by: usuario!.id,
          anexos: d.anexos.length
            ? { create: d.anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, url: a.url, tamanho: a.tamanho ?? null })) }
            : undefined,
        },
        include: { criador: { select: { nome: true } }, anexos: { orderBy: { id: 'asc' } } },
      })
      break
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && tentativa === 0) continue
      throw e
    }
  }
  if (!criada) return NextResponse.json({ data: null, error: 'Não foi possível gerar o código. Tente novamente.' }, { status: 409 })

  return NextResponse.json({
    data: {
      id: criada.id,
      codigo: criada.codigo,
      tipo: criada.tipo,
      data: criada.data.toISOString(),
      responsabilidade: criada.responsabilidade,
      impacto: criada.impacto,
      descricao: criada.descricao,
      data_notificacao_cliente: criada.data_notificacao_cliente?.toISOString() ?? null,
      created_by: criada.created_by,
      autor: criada.criador.nome,
      created_at: criada.created_at.toISOString(),
      anexos: criada.anexos.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, url: a.url, tamanho: a.tamanho })),
    },
    error: null,
  }, { status: 201 })
}
