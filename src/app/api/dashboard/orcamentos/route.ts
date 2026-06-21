import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface SolicitacaoAberta {
  id: number
  numero: string
  escopo: string | null
  situacao: 'no_prazo' | 'em_atraso'
  cliente: string
  cliente_final: string | null
  orcamentista: string | null
  data_recebimento: string | null
  data_atribuicao: string | null
  prazo_tecnica: string | null
  prazo_tecnica_indeterminado: boolean
  prazo_tecnica_enviada: boolean
  data_envio_tecnica: string | null
  prazo_comercial: string | null
  prazo_comercial_indeterminado: boolean
  prazo_comercial_enviada: boolean
  data_envio_comercial: string | null
}

export interface OrcDashboardData {
  anos_disponiveis: number[]
  orcamentistas_disponiveis: Array<{ id: number; nome: string }>
  cidades_disponiveis: Array<{ cidade: string; estado: string }>
  total: number
  aprovadas: number
  reprovadas: number
  em_analise: number
  por_mes: number[]           // índice 0=Jan … 11=Dez
  por_classificacao: Record<string, number>
  por_interesse: { ALTO: number; MEDIO: number; BAIXO: number }
  por_motivo_recusa: Array<{ motivo: string; total: number }>
  por_responsavel: Array<{ id: number; nome: string; OBRAS: number; PARADAS: number; OLEO_GAS: number; FABRICACOES: number }>
  situacao_carteira: { no_prazo: number; atrasada: number; atendida: number }
  por_orc: Array<{ nome: string; total: number }>
  solicitacoes_abertas: SolicitacaoAberta[]
  abertas_counts: { total: number; no_prazo: number; em_atraso: number }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const ano             = searchParams.get('ano')             ?? undefined
  const classificacao   = searchParams.get('classificacao')   ?? undefined
  const interesse       = searchParams.get('interesse')       ?? undefined
  const cliente_id      = searchParams.get('cliente_id')      ?? undefined
  const orcamentista_id = searchParams.get('orcamentista_id') ?? undefined
  const segmento        = searchParams.get('segmento')        ?? undefined
  const cidade          = searchParams.get('cidade')          ?? undefined

  // ── Opções disponíveis (sem filtros, para popular selects) ──────────────
  const [anosRaw, orcDisp, cidadesDisp] = await Promise.all([
    prisma.solicitacao.findMany({
      where: { cancelled_at: null, data_recebimento: { not: null } },
      select: { data_recebimento: true },
      distinct: ['data_recebimento'],
    }),
    prisma.user.findMany({
      where: { ativo: true, solicitacoes_atribuidas: { some: {} } },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.solicitacao.findMany({
      where: { cancelled_at: null, cidade: { not: null }, estado: { not: null } },
      select: { cidade: true, estado: true },
      distinct: ['cidade', 'estado'],
      orderBy: [{ estado: 'asc' }, { cidade: 'asc' }],
    }),
  ])

  const anosSet = new Set<number>()
  anosRaw.forEach((s) => { if (s.data_recebimento) anosSet.add(s.data_recebimento.getFullYear()) })
  const anos_disponiveis = Array.from(anosSet).sort((a, b) => b - a)

  const orcamentistas_disponiveis = orcDisp
  const cidades_disponiveis = cidadesDisp
    .filter((c): c is { cidade: string; estado: string } => !!c.cidade && !!c.estado)

  // ── Where base (filtros) ─────────────────────────────────────────────────
  const where = {
    cancelled_at: null,
    ...(classificacao   && { classificacao: classificacao as never }),
    ...(interesse       && { interesse: interesse as never }),
    ...(segmento        && { segmento: segmento as never }),
    ...(cliente_id      && { cliente_id: Number(cliente_id) }),
    ...(orcamentista_id && { orcamentista_id: Number(orcamentista_id) }),
    ...(cidade          && { cidade }),
    ...(ano && {
      data_recebimento: {
        gte: new Date(`${ano}-01-01`),
        lte: new Date(`${ano}-12-31T23:59:59`),
      },
    }),
  }

  const items = await prisma.solicitacao.findMany({
    where,
    select: {
      id: true,
      numero: true,
      escopo: true,
      status: true,
      status_analise: true,
      interesse: true,
      classificacao: true,
      motivo_reprovacao: true,
      data_recebimento: true,
      created_at: true,
      criador: { select: { id: true, nome: true } },
      prazo_tecnica: true,
      prazo_tecnica_indeterminado: true,
      prazo_comercial: true,
      prazo_comercial_indeterminado: true,
      orcamentista_id: true,
      cliente: { select: { nome: true } },
      cliente_final: { select: { nome: true } },
      orcamentista: { select: { nome: true } },
      propostas_tecnicas: {
        select: { data_envio: true, nao_aplicavel: true },
        orderBy: { versao: 'desc' },
        take: 1,
      },
      propostas_comerciais: {
        select: { data_envio: true, nao_aplicavel: true },
        orderBy: { versao: 'desc' },
        take: 1,
      },
      propostas_fabricacao: {
        select: { data_envio: true },
        orderBy: { versao: 'desc' },
        take: 1,
      },
    },
  })

  // ── Agregações ───────────────────────────────────────────────────────────
  let aprovadas = 0, reprovadas = 0, em_analise = 0
  const porMes = Array(12).fill(0)
  const porClassificacao: Record<string, number> = {}
  const porInteresse = { ALTO: 0, MEDIO: 0, BAIXO: 0 }
  const porMotivo: Record<string, number> = {}
  type RespRow = { id: number; nome: string; OBRAS: number; PARADAS: number; OLEO_GAS: number; FABRICACOES: number }
  const respMap = new Map<number, RespRow>()
  const CLASSIF_KEYS = ['OBRAS', 'PARADAS', 'OLEO_GAS', 'FABRICACOES'] as const
  const situacao = { no_prazo: 0, atrasada: 0, atendida: 0 }
  const orcMap = new Map<string, number>()
  const solicitacoes_abertas: SolicitacaoAberta[] = []
  const now = new Date()

  for (const s of items) {
    // KPIs de análise
    if (s.status_analise === 'APROVADA') aprovadas++
    else if (s.status_analise === 'REPROVADA') reprovadas++
    else em_analise++

    // Distribuição por mês (usa data_recebimento, fallback created_at)
    const dt = s.data_recebimento ?? s.created_at
    porMes[dt.getMonth()]++

    // Por classificação
    if (s.classificacao) {
      porClassificacao[s.classificacao] = (porClassificacao[s.classificacao] ?? 0) + 1
    }

    // Por interesse
    if (s.interesse && s.interesse in porInteresse) {
      porInteresse[s.interesse as keyof typeof porInteresse]++
    }

    // Motivos de recusa (preenchidos em solicitações recusadas)
    if (s.motivo_reprovacao) {
      porMotivo[s.motivo_reprovacao] = (porMotivo[s.motivo_reprovacao] ?? 0) + 1
    }

    // Por responsável (criador) × classificação
    if (s.classificacao && s.criador && (CLASSIF_KEYS as readonly string[]).includes(s.classificacao)) {
      const row = respMap.get(s.criador.id) ?? { id: s.criador.id, nome: s.criador.nome, OBRAS: 0, PARADAS: 0, OLEO_GAS: 0, FABRICACOES: 0 }
      row[s.classificacao as typeof CLASSIF_KEYS[number]]++
      respMap.set(s.criador.id, row)
    }

    // Situação da carteira — inclui todas as aprovadas (em elaboração, enviadas, ganhas)
    if (s.status_analise === 'APROVADA') {
      const isFab = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'
      let situacaoItem: 'no_prazo' | 'em_atraso' | 'atendida'

      if (isFab) {
        const fab = s.propostas_fabricacao[0] ?? null
        if (fab?.data_envio) {
          situacaoItem = 'atendida'
          situacao.atendida++
        } else {
          const atrasada =
            !s.prazo_tecnica_indeterminado &&
            s.prazo_tecnica != null &&
            s.prazo_tecnica < now
          situacaoItem = atrasada ? 'em_atraso' : 'no_prazo'
          if (atrasada) situacao.atrasada++
          else situacao.no_prazo++
        }
      } else {
        const tec = s.propostas_tecnicas[0] ?? null
        const com = s.propostas_comerciais[0] ?? null
        const tecAtendida = tec ? (!!tec.data_envio || tec.nao_aplicavel) : false
        const comAtendida = com ? (!!com.data_envio || com.nao_aplicavel) : false

        if (tecAtendida && comAtendida) {
          situacaoItem = 'atendida'
          situacao.atendida++
        } else {
          const tecAtrasada =
            !tecAtendida &&
            !s.prazo_tecnica_indeterminado &&
            s.prazo_tecnica != null &&
            s.prazo_tecnica < now
          const comAtrasada =
            !comAtendida &&
            !s.prazo_comercial_indeterminado &&
            s.prazo_comercial != null &&
            s.prazo_comercial < now
          const atrasada = tecAtrasada || comAtrasada
          situacaoItem = atrasada ? 'em_atraso' : 'no_prazo'
          if (atrasada) situacao.atrasada++
          else situacao.no_prazo++
        }
      }

      if (situacaoItem !== 'atendida') {
        const tec = s.propostas_tecnicas[0] ?? null
        const com = s.propostas_comerciais[0] ?? null
        const fab = s.propostas_fabricacao[0] ?? null
        const isFabType = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'
        solicitacoes_abertas.push({
          id: s.id,
          numero: s.numero,
          escopo: s.escopo,
          situacao: situacaoItem,
          cliente: s.cliente.nome,
          cliente_final: s.cliente_final?.nome ?? null,
          orcamentista: s.orcamentista?.nome ?? null,
          data_recebimento: s.data_recebimento ? s.data_recebimento.toISOString() : null,
          data_atribuicao: s.orcamentista_id ? s.created_at.toISOString() : null,
          prazo_tecnica: s.prazo_tecnica ? s.prazo_tecnica.toISOString() : null,
          prazo_tecnica_indeterminado: s.prazo_tecnica_indeterminado,
          prazo_tecnica_enviada: isFabType
            ? !!(fab?.data_envio)
            : !!(tec?.data_envio || tec?.nao_aplicavel),
          data_envio_tecnica: isFabType
            ? (fab?.data_envio ? fab.data_envio.toISOString() : null)
            : (tec?.data_envio ? tec.data_envio.toISOString() : null),
          prazo_comercial: s.prazo_comercial ? s.prazo_comercial.toISOString() : null,
          prazo_comercial_indeterminado: s.prazo_comercial_indeterminado,
          prazo_comercial_enviada: isFabType
            ? !!(fab?.data_envio)
            : !!(com?.data_envio || com?.nao_aplicavel),
          data_envio_comercial: isFabType
            ? (fab?.data_envio ? fab.data_envio.toISOString() : null)
            : (com?.data_envio ? com.data_envio.toISOString() : null),
        })
      }
    }

    // Por orçamentista
    if (s.orcamentista) {
      const nome = s.orcamentista.nome
      orcMap.set(nome, (orcMap.get(nome) ?? 0) + 1)
    }
  }

  const por_orc = Array.from(orcMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)

  const abertas_counts = {
    total: solicitacoes_abertas.length,
    no_prazo: solicitacoes_abertas.filter((s) => s.situacao === 'no_prazo').length,
    em_atraso: solicitacoes_abertas.filter((s) => s.situacao === 'em_atraso').length,
  }

  const data: OrcDashboardData = {
    anos_disponiveis,
    orcamentistas_disponiveis,
    cidades_disponiveis,
    total: items.length,
    aprovadas,
    reprovadas,
    em_analise,
    por_mes: porMes,
    por_classificacao: porClassificacao,
    por_interesse: porInteresse,
    por_motivo_recusa: Object.entries(porMotivo).map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total),
    por_responsavel: Array.from(respMap.values()).sort((a, b) =>
      (b.OBRAS + b.PARADAS + b.OLEO_GAS + b.FABRICACOES) - (a.OBRAS + a.PARADAS + a.OLEO_GAS + a.FABRICACOES)),
    situacao_carteira: situacao,
    por_orc,
    solicitacoes_abertas,
    abertas_counts,
  }

  return NextResponse.json({ data, error: null })
}
