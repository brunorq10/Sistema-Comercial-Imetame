import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { exigirPermissao } from '@/lib/permissaoApi'

const subindiceSchema = z.object({
  descricao: z.string().min(1),
  num_os: z.string().optional().nullable(),
  valor_total: z.number().nonnegative(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  comentarios: z.string().optional(),
  jan: z.number().nonnegative().optional(),
  fev: z.number().nonnegative().optional(),
  mar: z.number().nonnegative().optional(),
  abr: z.number().nonnegative().optional(),
  mai: z.number().nonnegative().optional(),
  jun: z.number().nonnegative().optional(),
  jul: z.number().nonnegative().optional(),
  ago: z.number().nonnegative().optional(),
  set: z.number().nonnegative().optional(),
  out: z.number().nonnegative().optional(),
  nov: z.number().nonnegative().optional(),
  dez: z.number().nonnegative().optional(),
})

const schema = z.object({
  ano_referencia: z.number().int().min(2000).max(2100),
  status: z.enum(['A_FATURAR', 'FATURADO', 'PARCIAL', 'CANCELADO']).optional(),
  cliente_id: z.number().int().positive(),
  cliente_final_id: z.number().int().positive().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
  num_os: z.string().optional(),
  num_acordo: z.string().optional(),
  num_proposta: z.string().optional(),
  responsavel_id: z.number().int().positive().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  descricao: z.string().optional(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES']).optional().nullable(),
  valor_contrato: z.number().nonnegative().optional().nullable(),
  rascunho: z.boolean().optional().default(false),
  subindices: z.array(subindiceSchema).min(0),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const ano = searchParams.get('ano') ?? undefined
  // Filtros multi-valor: aceitam lista separada por vírgula (ex.: cliente_id=1,2,3)
  const multi = (k: string) => { const v = searchParams.get(k); return v ? v.split(',').filter(Boolean) : [] }
  const clienteIds   = multi('cliente_id').map(Number).filter((n) => !isNaN(n))
  const statusList   = multi('status')
  const responsavelIds = multi('responsavel_id').map(Number).filter((n) => !isNaN(n))
  const numOsList    = multi('num_os')
  const numAcordoList = multi('num_acordo')
  const numPropostaList = multi('num_proposta')
  const mercadoList  = multi('mercado')

  try {
    const anoNum = ano ? Number(ano) : undefined

    // Contratos que têm ano_referencia = ano OU que possuem sub-índice com data_inicio no ano
    const whereAnual = anoNum ? {
      OR: [
        { ano_referencia: anoNum },
        {
          subindices: {
            some: {
              deleted_at: null,
              data_inicio: {
                gte: new Date(`${anoNum}-01-01`),
                lt: new Date(`${anoNum + 1}-01-01`),
              },
            },
          },
        },
      ],
    } : {}

    const contratos = await prisma.contrato.findMany({
      where: {
        cancelled_at: null,
        ...whereAnual,
        ...(clienteIds.length && { cliente_id: { in: clienteIds } }),
        ...(statusList.length && { status: { in: statusList as never[] } }),
        ...(responsavelIds.length && { responsavel_id: { in: responsavelIds } }),
        ...(numOsList.length && { num_os: { in: numOsList } }),
        ...(numAcordoList.length && { num_acordo: { in: numAcordoList } }),
        ...(numPropostaList.length && { num_proposta: { in: numPropostaList } }),
        ...(mercadoList.length && { cliente: { ramo_atuacao: { in: mercadoList as never[] } } }),
      },
      orderBy: [{ indice: 'asc' }],
      include: {
        cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
        cliente_final: { select: { id: true, nome: true } },
        responsavel:   { select: { id: true, nome: true } },
        subindices: {
          where: { deleted_at: null },
          orderBy: { ordem: 'asc' },
          include: { notas_fiscais: { where: { deleted_at: null } } },
        },
      },
    })

    // Compute total % launched per NF number across entire DB
    const allNFNumbers = Array.from(new Set(
      contratos.flatMap((c) => c.subindices.flatMap((s) => s.notas_fiscais?.map((nf: { numero_nf: string }) => nf.numero_nf) ?? []))
    ))
    const nfTotals = allNFNumbers.length > 0
      ? await prisma.notaFiscalContrato.groupBy({
          by: ['numero_nf'],
          where: { numero_nf: { in: allNFNumbers }, deleted_at: null },
          _sum: { percentual: true },
        })
      : []
    const nfTotalMap: Record<string, number> = {}
    nfTotals.forEach((t) => { nfTotalMap[t.numero_nf] = Number(t._sum.percentual ?? 0) })

    const data = contratos.map((c) => serializeContrato(c, anoNum, nfTotalMap))
    return NextResponse.json({ data, error: null })
  } catch (err) {
    logger.error('[GET /api/faturamento/contratos]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('acordos.faturamento.novo'); if (erro) return erro }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  // Requer ao menos 1 sub-índice quando não for rascunho
  if (!parsed.data.rascunho && parsed.data.subindices.length === 0) {
    return NextResponse.json({ data: null, error: 'Adicione ao menos um evento de medição' }, { status: 400 })
  }

  // RN-CF-03: soma dos sub-índices deve coincidir com valor_contrato (apenas aviso — não bloqueia)
  let sumWarning: string | null = null
  if (!parsed.data.rascunho && parsed.data.valor_contrato != null && parsed.data.subindices.length > 0) {
    const soma = parsed.data.subindices.reduce((acc, s) => acc + s.valor_total, 0)
    if (Math.abs(soma - parsed.data.valor_contrato) > 0.01) {
      sumWarning = `Soma dos sub-índices (R$ ${soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do Valor do Contrato (R$ ${parsed.data.valor_contrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
    }
  }

  try {
  const count = await prisma.contrato.count()
  const indice = `CT-${String(count + 1).padStart(3, '0')}`

  // Vincula a solicitação de origem quando o Nº Proposta corresponde ao número
  // de uma solicitação — é o elo usado nos relatórios cruzados Comercial × Acordos.
  let solicitacaoId: number | null = null
  if (parsed.data.num_proposta) {
    const sol = await prisma.solicitacao.findFirst({
      where: { numero: parsed.data.num_proposta.trim(), cancelled_at: null },
      select: { id: true },
    })
    solicitacaoId = sol?.id ?? null
  }

  const contrato = await prisma.contrato.create({
    data: {
      indice,
      ano_referencia: parsed.data.ano_referencia,
      status: parsed.data.status ?? 'A_FATURAR',
      cliente_id:       parsed.data.cliente_id,
      cliente_final_id: parsed.data.cliente_final_id ?? null,
      cidade:           parsed.data.cidade ?? null,
      estado:           parsed.data.estado ?? null,
      num_os: parsed.data.num_os ?? null,
      num_acordo: parsed.data.num_acordo ?? null,
      num_proposta: parsed.data.num_proposta ?? null,
      solicitacao_id: solicitacaoId,
      responsavel_id: parsed.data.responsavel_id ?? null,
      data_inicio: parsed.data.data_inicio ? new Date(parsed.data.data_inicio) : null,
      data_fim: parsed.data.data_fim ? new Date(parsed.data.data_fim) : null,
      descricao: parsed.data.descricao ?? null,
      classificacao: parsed.data.classificacao ?? null,
      valor_contrato: parsed.data.valor_contrato ?? null,
      rascunho: parsed.data.rascunho ?? false,
      created_by: Number(session.user.id),
      subindices: {
        create: parsed.data.subindices.map((s, i) => ({
          ordem: i + 1,
          descricao: s.descricao,
          num_os: s.num_os ?? null,
          valor_total: s.valor_total,
          data_inicio: s.data_inicio ? new Date(s.data_inicio) : null,
          data_fim: s.data_fim ? new Date(s.data_fim) : null,
          comentarios: s.comentarios ?? null,
          jan: s.jan ?? null, fev: s.fev ?? null, mar: s.mar ?? null,
          abr: s.abr ?? null, mai: s.mai ?? null, jun: s.jun ?? null,
          jul: s.jul ?? null, ago: s.ago ?? null, set: s.set ?? null,
          out: s.out ?? null, nov: s.nov ?? null, dez: s.dez ?? null,
          created_by: Number(session.user.id),
        })),
      },
    },
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      subindices: { where: { deleted_at: null }, orderBy: { ordem: 'asc' }, include: { notas_fiscais: { where: { deleted_at: null } } } },
    },
  })

  return NextResponse.json({ data: serializeContrato(contrato, undefined, {}), warning: sumWarning, error: null }, { status: 201 })
  } catch (err) {
    logger.error('[POST /api/faturamento/contratos]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeContrato(c: any, anoFiltro?: number, nfTotalMap: Record<string, number> = {}) {
  // Calcula prev_anos_seguintes ANTES de filtrar — soma valor_total dos sub-índices de anos futuros
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevProxAnos = anoFiltro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? c.subindices.reduce((acc: number, s: any) => {
        const ano = s.data_inicio ? s.data_inicio.getUTCFullYear() : c.ano_referencia
        return ano > anoFiltro ? acc + Number(s.valor_total) : acc
      }, 0)
    : 0

  // Filtra sub-índices pelo ano solicitado:
  // - se tem data_inicio, usa o ano da data; se não tem, usa ano_referencia do contrato
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subsFiltrados: any[] = anoFiltro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? c.subindices.filter((s: any) => {
        if (s.data_inicio) return s.data_inicio.getUTCFullYear() === anoFiltro
        return c.ano_referencia === anoFiltro
      })
    : c.subindices

  // RN-CF-19: status calculado dinamicamente a partir dos sub-índices filtrados
  const computedStatus = (() => {
    if (c.cancelled_at) return 'CANCELADO'
    if (subsFiltrados.length === 0) return c.status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statuses = subsFiltrados.map((s: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fat = (s.notas_fiscais ?? []).filter((nf: any) => nf.ativa).reduce((a: number, nf: any) => a + Number(nf.valor_atribuido), 0)
      if (fat === 0) return 'A_FATURAR'
      if (fat >= Number(s.valor_total)) return 'FATURADO'
      return 'PARCIAL'
    })
    if (statuses.every((s: string) => s === 'FATURADO')) return 'FATURADO'
    if (statuses.some((s: string) => s === 'FATURADO' || s === 'PARCIAL')) return 'PARCIAL'
    return 'A_FATURAR'
  })()

  return {
    id: c.id,
    indice: c.indice,
    ano_referencia: c.ano_referencia,
    status: computedStatus,
    cliente: c.cliente,
    cliente_final: c.cliente_final ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    responsavel: c.responsavel,
    num_os: c.num_os,
    num_acordo: c.num_acordo,
    num_proposta: c.num_proposta,
    data_inicio: c.data_inicio?.toISOString() ?? null,
    data_fim: c.data_fim?.toISOString() ?? null,
    descricao: c.descricao,
    classificacao: c.classificacao ?? null,
    valor_contrato: c.valor_contrato ? Number(c.valor_contrato) : null,
    cancelled_at: c.cancelled_at?.toISOString() ?? null,
    prev_anos_seguintes: prevProxAnos,
    rascunho: c.rascunho ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subindices: subsFiltrados.map((s: any) => serializeSubindice(s, c.subindices, anoFiltro, nfTotalMap)),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSubindice(s: any, allSubindices?: any[], anoFiltro?: number, nfTotalMap: Record<string, number> = {}) {
  const nfsAtivas = s.notas_fiscais?.filter((nf: any) => nf.ativa) ?? []
  const totalFaturado = nfsAtivas.reduce((acc: number, nf: any) => acc + Number(nf.valor_atribuido), 0)
  const status: 'A_FATURAR' | 'FATURADO' | 'PARCIAL' =
    totalFaturado === 0 ? 'A_FATURAR'
    : totalFaturado >= Number(s.valor_total) ? 'FATURADO'
    : 'PARCIAL'

  // Calcula previsão de anos seguintes para este sub-índice:
  // sub-índices de anos futuros com a mesma descrição pertencem ao mesmo evento lógico
  const prevSubProxAnos = (anoFiltro && allSubindices)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? allSubindices.reduce((acc: number, other: any) => {
        const outroAno = other.data_inicio ? other.data_inicio.getUTCFullYear() : 0
        if (outroAno > anoFiltro && other.descricao === s.descricao) {
          return acc + Number(other.valor_total)
        }
        return acc
      }, 0)
    : 0

  return {
    id: s.id,
    contrato_id: s.contrato_id,
    ordem: s.ordem,
    descricao: s.descricao,
    num_os: s.num_os ?? null,
    valor_total: Number(s.valor_total),
    data_inicio: s.data_inicio?.toISOString() ?? null,
    data_fim: s.data_fim?.toISOString() ?? null,
    comentarios: s.comentarios,
    jan: s.jan ? Number(s.jan) : null,
    fev: s.fev ? Number(s.fev) : null,
    mar: s.mar ? Number(s.mar) : null,
    abr: s.abr ? Number(s.abr) : null,
    mai: s.mai ? Number(s.mai) : null,
    jun: s.jun ? Number(s.jun) : null,
    jul: s.jul ? Number(s.jul) : null,
    ago: s.ago ? Number(s.ago) : null,
    set: s.set ? Number(s.set) : null,
    out: s.out ? Number(s.out) : null,
    nov: s.nov ? Number(s.nov) : null,
    dez: s.dez ? Number(s.dez) : null,
    total_faturado: totalFaturado,
    status_faturamento: status,
    prev_anos_seguintes: prevSubProxAnos,
    notas_fiscais: s.notas_fiscais?.map((nf: any) => ({
      id: nf.id,
      numero_nf: nf.numero_nf,
      valor_total_nf: Number(nf.valor_total_nf),
      percentual: Number(nf.percentual),
      percentual_total: nfTotalMap[nf.numero_nf] ?? Number(nf.percentual),
      valor_atribuido: Number(nf.valor_atribuido),
      data_emissao: nf.data_emissao.toISOString(),
      data_vencimento: nf.data_vencimento.toISOString(),
      ativa: nf.ativa,
      motivo_inativacao: nf.motivo_inativacao,
      tipo_documento: nf.tipo_documento ?? 'NF',
      status_aprovacao: nf.status_aprovacao ?? 'APROVADO',
    })) ?? [],
  }
}
