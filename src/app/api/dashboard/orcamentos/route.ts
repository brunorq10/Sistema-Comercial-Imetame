import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface OrcDashboardData {
  anos_disponiveis: number[]
  total: number
  aprovadas: number
  reprovadas: number
  em_analise: number
  por_mes: number[]           // índice 0=Jan … 11=Dez
  por_classificacao: Record<string, number>
  por_interesse: { ALTO: number; MEDIO: number; BAIXO: number }
  situacao_carteira: { no_prazo: number; atrasada: number; atendida: number }
  por_orc: Array<{ nome: string; total: number }>
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const ano = searchParams.get('ano') ?? undefined
  const classificacao = searchParams.get('classificacao') ?? undefined
  const interesse = searchParams.get('interesse') ?? undefined
  const cliente_id = searchParams.get('cliente_id') ?? undefined

  // ── Anos disponíveis (para popular o select dinamicamente) ──────────────
  const anosRaw = await prisma.solicitacao.findMany({
    where: { cancelled_at: null, data_recebimento: { not: null } },
    select: { data_recebimento: true },
    distinct: ['data_recebimento'],
  })
  const anosSet = new Set<number>()
  anosRaw.forEach((s) => {
    if (s.data_recebimento) anosSet.add(s.data_recebimento.getFullYear())
  })
  const anos_disponiveis = Array.from(anosSet).sort((a, b) => b - a)

  // ── Where base (filtros) ─────────────────────────────────────────────────
  const where = {
    cancelled_at: null,
    ...(classificacao && { classificacao: classificacao as never }),
    ...(interesse && { interesse: interesse as never }),
    ...(cliente_id && { cliente_id: Number(cliente_id) }),
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
      status: true,
      status_analise: true,
      interesse: true,
      classificacao: true,
      data_recebimento: true,
      created_at: true,
      prazo_tecnica: true,
      prazo_tecnica_indeterminado: true,
      prazo_comercial: true,
      prazo_comercial_indeterminado: true,
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
  const situacao = { no_prazo: 0, atrasada: 0, atendida: 0 }
  const orcMap = new Map<string, number>()
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

    // Situação da carteira — inclui todas as aprovadas (em elaboração, enviadas, ganhas)
    if (s.status_analise === 'APROVADA') {
      const isFab = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'

      if (isFab) {
        // Fabricação/Óleo&Gás: usa propostas_fabricacao
        const fab = s.propostas_fabricacao[0] ?? null
        if (fab?.data_envio) {
          situacao.atendida++
        } else {
          const atrasada =
            !s.prazo_tecnica_indeterminado &&
            s.prazo_tecnica != null &&
            s.prazo_tecnica < now
          if (atrasada) situacao.atrasada++
          else situacao.no_prazo++
        }
      } else {
        // Obras/Paradas: usa propostas_tecnicas + propostas_comerciais
        const tec = s.propostas_tecnicas[0] ?? null
        const com = s.propostas_comerciais[0] ?? null
        const tecAtendida = tec ? (!!tec.data_envio || tec.nao_aplicavel) : false
        const comAtendida = com ? (!!com.data_envio || com.nao_aplicavel) : false

        if (tecAtendida && comAtendida) {
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

          if (tecAtrasada || comAtrasada) situacao.atrasada++
          else situacao.no_prazo++
        }
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

  const data: OrcDashboardData = {
    anos_disponiveis,
    total: items.length,
    aprovadas,
    reprovadas,
    em_analise,
    por_mes: porMes,
    por_classificacao: porClassificacao,
    por_interesse: porInteresse,
    situacao_carteira: situacao,
    por_orc,
  }

  return NextResponse.json({ data, error: null })
}
