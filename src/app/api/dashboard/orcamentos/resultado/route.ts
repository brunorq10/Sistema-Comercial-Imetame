import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface ResultadoDashboardData {
  contratos_ganhos: number
  valor_ganhos: number
  ticket_medio: number
  taxa_conversao: number          // %
  ganhos_por_mes: number[]        // 0=Jan … 11=Dez
  valor_ganhos_por_mes: number[]  // valor R$ dos ganhos por mês
  rs_hh_medio: number | null
  rs_ton_medio: number | null
  hh_total: number
  hh_ton_medio: number | null
  valor_medio_proposta: number | null
  prazo_medio_tecnica: number | null    // dias
  prazo_medio_comercial: number | null  // dias
  pontualidade: Array<{ id: number; nome: string; enviadas: number; no_prazo: number; atrasadas: number; pct: number; em_elaboracao: number }>
  ticket_tipo: Array<{ classificacao: string; ganhos: number; hh_total: number; valor_total: number; ticket_medio: number; rs_hh: number | null }>
}

const DIA_MS = 86_400_000

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const ano             = searchParams.get('ano')             ?? undefined
  const de              = searchParams.get('de')              ?? undefined
  const ate             = searchParams.get('ate')             ?? undefined
  const classificacao   = searchParams.get('classificacao')   ?? undefined
  const interesse       = searchParams.get('interesse')       ?? undefined
  const cliente_id      = searchParams.get('cliente_id')      ?? undefined
  const orcamentista_id = searchParams.get('orcamentista_id') ?? undefined
  const segmento        = searchParams.get('segmento')        ?? undefined
  const cidade          = searchParams.get('cidade')          ?? undefined

  // Filtros multi-valor: lista separada por vírgula
  const multi = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : [])
  const classifList = multi(classificacao)
  const interesseList = multi(interesse)
  const segmentoList = multi(segmento)
  const clienteIds = multi(cliente_id).map(Number).filter((n) => !isNaN(n))
  const orcamentistaIds = multi(orcamentista_id).map(Number).filter((n) => !isNaN(n))
  const cidadeList = multi(cidade)

  const where = {
    cancelled_at: null,
    ...(classifList.length   && { classificacao: { in: classifList as never[] } }),
    ...(interesseList.length && { interesse: { in: interesseList as never[] } }),
    ...(segmentoList.length  && { segmento: { in: segmentoList as never[] } }),
    ...(clienteIds.length    && { cliente_id: { in: clienteIds } }),
    ...(orcamentistaIds.length && { orcamentista_id: { in: orcamentistaIds } }),
    ...(cidadeList.length    && { cidade: { in: cidadeList } }),
    // Período: prioriza intervalo DE/ATÉ; senão usa o ano (compat.)
    ...((de || ate)
      ? { data_recebimento: { ...(de && { gte: new Date(de) }), ...(ate && { lte: new Date(`${ate}T23:59:59`) }) } }
      : (ano ? { data_recebimento: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31T23:59:59`) } } : {})),
  }

  const items = await prisma.solicitacao.findMany({
    where,
    select: {
      id: true,
      classificacao: true,
      status: true,
      data_atribuicao: true,
      prazo_comercial: true,
      prazo_comercial_indeterminado: true,
      orcamentista: { select: { id: true, nome: true } },
      propostas_tecnicas: {
        select: { hh_direto: true, hh_indireto: true, hh_total: true, peso_montagem: true, data_envio: true },
        orderBy: { versao: 'desc' }, take: 1,
      },
      propostas_comerciais: {
        select: { valor_total: true, data_envio: true, resultado: true },
        orderBy: { versao: 'desc' }, take: 1,
      },
      propostas_fabricacao: {
        select: { valor_total: true, peso_total: true, data_envio: true, resultado: true },
        orderBy: { versao: 'desc' }, take: 1,
      },
    },
  })

  let valorGanhos = 0, contratosGanhos = 0, enviadas = 0
  let somaValorComHh = 0, somaHh = 0
  let somaValorComPeso = 0, somaPeso = 0
  let somaValorEnviadas = 0
  let somaPrazoTec = 0, nPrazoTec = 0
  let somaPrazoCom = 0, nPrazoCom = 0
  const ganhosPorMes = Array(12).fill(0)
  const valorGanhosPorMes = Array(12).fill(0)

  const pontMap = new Map<number, { id: number; nome: string; enviadas: number; no_prazo: number; atrasadas: number; em_elaboracao: number }>()
  const tipoMap = new Map<string, { ganhos: number; hh_total: number; valor_total: number }>()

  for (const s of items) {
    const isFab = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'
    const tec = s.propostas_tecnicas[0] ?? null
    const com = s.propostas_comerciais[0] ?? null
    const fab = s.propostas_fabricacao[0] ?? null

    const valor = isFab ? (fab?.valor_total != null ? Number(fab.valor_total) : null)
                        : (com?.valor_total != null ? Number(com.valor_total) : null)
    const resultado = isFab ? (fab?.resultado ?? null) : (com?.resultado ?? null)
    const dataEnvio = isFab ? (fab?.data_envio ?? null) : (com?.data_envio ?? null)
    const hh = isFab ? 0 : (tec ? (tec.hh_total ?? ((tec.hh_direto ?? 0) + (tec.hh_indireto ?? 0))) : 0)
    const peso = isFab ? (fab?.peso_total != null ? Number(fab.peso_total) : 0)
                       : (tec?.peso_montagem != null ? Number(tec.peso_montagem) : 0)

    const enviada = dataEnvio != null
    if (enviada && valor != null) {
      enviadas++
      somaValorEnviadas += valor
      if (hh > 0) { somaValorComHh += valor; somaHh += hh }
      if (peso > 0) { somaValorComPeso += valor; somaPeso += peso }
    }

    // Ganhos
    if (resultado === 'GANHOU' && valor != null) {
      contratosGanhos++
      valorGanhos += valor
      const ref = dataEnvio ?? s.data_atribuicao
      if (ref) { const mi = new Date(ref).getMonth(); ganhosPorMes[mi]++; valorGanhosPorMes[mi] += valor }
      if (s.classificacao) {
        const t = tipoMap.get(s.classificacao) ?? { ganhos: 0, hh_total: 0, valor_total: 0 }
        t.ganhos++; t.hh_total += hh; t.valor_total += valor
        tipoMap.set(s.classificacao, t)
      }
    }

    // Prazos médios
    if (tec?.data_envio && s.data_atribuicao) {
      const d = (new Date(tec.data_envio).getTime() - new Date(s.data_atribuicao).getTime()) / DIA_MS
      if (d >= 0) { somaPrazoTec += d; nPrazoTec++ }
    }
    if (com?.data_envio && tec?.data_envio) {
      const d = (new Date(com.data_envio).getTime() - new Date(tec.data_envio).getTime()) / DIA_MS
      if (d >= 0) { somaPrazoCom += d; nPrazoCom++ }
    }

    // Pontualidade + carga por orçamentista
    if (s.orcamentista) {
      const e = pontMap.get(s.orcamentista.id) ?? { id: s.orcamentista.id, nome: s.orcamentista.nome, enviadas: 0, no_prazo: 0, atrasadas: 0, em_elaboracao: 0 }
      if (enviada) {
        e.enviadas++
        const noPrazo = s.prazo_comercial_indeterminado || s.prazo_comercial == null
          ? true
          : new Date(dataEnvio!).getTime() <= new Date(s.prazo_comercial).getTime()
        if (noPrazo) e.no_prazo++; else e.atrasadas++
      } else if (s.status === 'EM_ELABORACAO') {
        e.em_elaboracao++
      }
      pontMap.set(s.orcamentista.id, e)
    }
  }

  const data: ResultadoDashboardData = {
    contratos_ganhos: contratosGanhos,
    valor_ganhos: valorGanhos,
    ticket_medio: contratosGanhos > 0 ? valorGanhos / contratosGanhos : 0,
    taxa_conversao: enviadas > 0 ? (contratosGanhos / enviadas) * 100 : 0,
    ganhos_por_mes: ganhosPorMes,
    valor_ganhos_por_mes: valorGanhosPorMes,
    rs_hh_medio: somaHh > 0 ? somaValorComHh / somaHh : null,
    rs_ton_medio: somaPeso > 0 ? somaValorComPeso / somaPeso : null,
    hh_total: somaHh,
    hh_ton_medio: somaPeso > 0 ? somaHh / somaPeso : null,
    valor_medio_proposta: enviadas > 0 ? somaValorEnviadas / enviadas : null,
    prazo_medio_tecnica: nPrazoTec > 0 ? somaPrazoTec / nPrazoTec : null,
    prazo_medio_comercial: nPrazoCom > 0 ? somaPrazoCom / nPrazoCom : null,
    pontualidade: Array.from(pontMap.values())
      .map((p) => ({ ...p, pct: p.enviadas > 0 ? (p.no_prazo / p.enviadas) * 100 : 0 }))
      .sort((a, b) => b.enviadas - a.enviadas),
    ticket_tipo: Array.from(tipoMap.entries())
      .map(([classificacao, t]) => ({
        classificacao,
        ganhos: t.ganhos, hh_total: t.hh_total, valor_total: t.valor_total,
        ticket_medio: t.ganhos > 0 ? t.valor_total / t.ganhos : 0,
        rs_hh: t.hh_total > 0 ? t.valor_total / t.hh_total : null,
      }))
      .sort((a, b) => b.valor_total - a.valor_total),
  }

  return NextResponse.json({ data, error: null })
}
