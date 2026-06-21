import { NextResponse } from 'next/server'
import { Prisma, RamoAtuacao } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MONTH_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMonthValue(sub: any, month: number): number {
  const key = MONTH_KEYS[month - 1]
  const val = sub[key]
  return val ? Number(val) : 0
}

const RAMO_LABELS: Record<string, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose',
  SIDERURGIA:     'Siderurgia',
  MINERACAO:      'Mineração',
  OLEO_GAS:       'Óleo e Gás',
  OUTROS:         'Outros',
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anoParam    = searchParams.get('ano')
  const clienteId   = searchParams.get('clienteId')
  const ramoFiltro  = searchParams.get('ramo')

  const hoje        = new Date()
  const anoAtual    = anoParam ? parseInt(anoParam, 10) : hoje.getFullYear()
  const mesAtual    = hoje.getMonth() + 1
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
  const anoMesAnt   = mesAtual === 1 ? anoAtual - 1 : anoAtual
  const mesProximo  = mesAtual === 12 ? 1  : mesAtual + 1
  const anoMesProx  = mesAtual === 12 ? anoAtual + 1 : anoAtual

  const whereContrato: Prisma.ContratoWhereInput = { cancelled_at: null }
  if (clienteId)  whereContrato.cliente_id = parseInt(clienteId, 10)
  if (ramoFiltro) whereContrato.cliente    = { is: { ramo_atuacao: ramoFiltro as RamoAtuacao } }

  const [contratos, consolidados, clientes] = await Promise.all([
    prisma.contrato.findMany({
      where: whereContrato,
      include: {
        cliente: { select: { id: true, nome: true, ramo_atuacao: true } },
        responsavel: { select: { id: true, nome: true } },
        subindices: {
          include: { notas_fiscais: { where: { ativa: true } } },
        },
      },
    }),
    prisma.consolidadoMes.findMany({
      where: { ano: anoAtual },
      include: { itens: true },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  // Mapa mes -> previsto fixado (soma dos itens do consolidado)
  const consolidadosPorMes = new Map<number, number>()
  for (const cons of consolidados) {
    const total = cons.itens.reduce((s, i) => s + Number(i.valor_previsto), 0)
    consolidadosPorMes.set(cons.mes, total)
  }

  let totalFaturadoAno       = 0
  let prevFaturamentoAno     = 0
  let faturamentoProxAnos    = 0
  let prevMesAtual           = 0
  let prevProxMes            = 0
  let faturadoMesAtual       = 0
  let faturadoUltimoMes      = 0

  const porRamo    = new Map<string, number>()
  const porCliente = new Map<number, { nome: string; valor: number }>()
  const previstoSubPorMes = new Array<number>(12).fill(0)
  const faturadoPorMes    = new Array<number>(12).fill(0)

  // Acumuladores para projeção multi-ano, aderência por responsável e contratos ativos
  const previstoPorAno  = new Map<number, number>()
  const realizadoPorAno = new Map<number, number>()
  const porResp = new Map<string, { id: number | null; nome: string; contratos: number; valorSobGestao: number; previsto: number; realizado: number }>()
  const contratosAtivos: { id: number; indice: string; cliente: string; valorTotal: number; faturado: number; pct: number }[] = []

  for (const contrato of contratos) {
    let contratoTotal = 0          // valor total do contrato (soma dos sub-índices)
    let contratoNFsTotal = 0       // faturado (todas as NFs, todos os anos)
    let contratoNFsAno = 0         // faturado no ano de referência
    let contratoPrevistoAno = 0    // previsto no ano de referência

    for (const sub of contrato.subindices) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anoSub = (sub as any).data_inicio
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? new Date((sub as any).data_inicio).getUTCFullYear()
        : contrato.ano_referencia

      const valorSub = Number(sub.valor_total)
      contratoTotal += valorSub

      const mensalSub = Array.from({ length: 12 }, (_, i) => getMonthValue(sub, i + 1)).reduce((a, b) => a + b, 0)
      if (anoSub != null) previstoPorAno.set(anoSub, (previstoPorAno.get(anoSub) ?? 0) + mensalSub)

      if (anoSub === anoAtual) {
        prevMesAtual += getMonthValue(sub, mesAtual)
        for (let m = 1; m <= 12; m++) previstoSubPorMes[m - 1] += getMonthValue(sub, m)
        contratoPrevistoAno += mensalSub
      }
      if (anoSub > anoAtual) faturamentoProxAnos += valorSub
      if (anoSub === anoMesProx)  prevProxMes  += getMonthValue(sub, mesProximo)

      for (const nf of sub.notas_fiscais) {
        const emissao = new Date(nf.data_emissao)
        const nfAno   = emissao.getUTCFullYear()
        const nfMes   = emissao.getUTCMonth() + 1
        const valor   = Number(nf.valor_atribuido)

        contratoNFsTotal += valor
        realizadoPorAno.set(nfAno, (realizadoPorAno.get(nfAno) ?? 0) + valor)

        if (nfAno === anoAtual) {
          totalFaturadoAno += valor
          faturadoPorMes[nfMes - 1] += valor
          contratoNFsAno += valor

          // Agrupamento por ramo e cliente (faturado no ano atual)
          const ramo = contrato.cliente.ramo_atuacao ?? 'OUTROS'
          porRamo.set(ramo, (porRamo.get(ramo) ?? 0) + valor)

          const cli = porCliente.get(contrato.cliente.id)
          if (cli) cli.valor += valor
          else porCliente.set(contrato.cliente.id, { nome: contrato.cliente.nome, valor })

          if (nfMes === mesAtual)                              faturadoMesAtual  += valor
          if (nfAno === anoMesAnt && nfMes === mesAnterior)   faturadoUltimoMes += valor
        }
      }
    }

    // Aderência por responsável
    const respKey = contrato.responsavel ? String(contrato.responsavel.id) : 'none'
    const respEntry = porResp.get(respKey) ?? {
      id: contrato.responsavel?.id ?? null,
      nome: contrato.responsavel?.nome ?? 'Não atribuído',
      contratos: 0, valorSobGestao: 0, previsto: 0, realizado: 0,
    }
    respEntry.contratos += 1
    respEntry.valorSobGestao += contratoTotal
    respEntry.previsto += contratoPrevistoAno
    respEntry.realizado += contratoNFsAno
    porResp.set(respKey, respEntry)

    // Contratos ativos — progresso de faturamento
    if (contratoTotal > 0) {
      contratosAtivos.push({
        id: contrato.id, indice: contrato.indice, cliente: contrato.cliente.nome,
        valorTotal: contratoTotal, faturado: contratoNFsTotal,
        pct: (contratoNFsTotal / contratoTotal) * 100,
      })
    }
  }

  // Previsto do ano = soma das colunas mensais dos subíndices (mesma base da tabela)
  prevFaturamentoAno = previstoSubPorMes.reduce((a, b) => a + b, 0)

  const aFaturarAno      = Math.max(0, prevFaturamentoAno - totalFaturadoAno)
  const percFaturadoGeral = prevFaturamentoAno > 0
    ? Math.min(100, (totalFaturadoAno / prevFaturamentoAno) * 100)
    : 0

  // Ramo
  const totalRamo = Array.from(porRamo.values()).reduce((a, b) => a + b, 0)
  const porRamoData = Object.keys(RAMO_LABELS)
    .map((ramo) => ({
      ramo:       RAMO_LABELS[ramo],
      valor:      porRamo.get(ramo) ?? 0,
      percentual: totalRamo > 0 ? ((porRamo.get(ramo) ?? 0) / totalRamo) * 100 : 0,
    }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  // Cliente (treemap)
  const totalCliente = Array.from(porCliente.values()).reduce((a, b) => a + b.valor, 0)
  const porClienteData = Array.from(porCliente.values())
    .map((c) => ({ ...c, percentual: totalCliente > 0 ? (c.valor / totalCliente) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 12)

  // Por mês: usa consolidado quando disponível, senão usa previsto dos subíndices
  const MES_LABEL_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const mes           = i + 1
    const hasConsolidado = consolidadosPorMes.has(mes)
    const valorFixado   = hasConsolidado ? (consolidadosPorMes.get(mes) ?? 0) : null
    const previsto      = hasConsolidado ? (valorFixado ?? 0) : previstoSubPorMes[i]
    const faturado      = faturadoPorMes[i]
    const pct           = previsto > 0 ? (faturado / previsto) * 100 : 0
    return {
      mes,
      label:        MES_LABEL_PT[i],
      previsto,
      valor_fixado: valorFixado,
      faturado,
      percentual:   Number(pct.toFixed(1)),
      resultado:    faturado - previsto,
      consolidado:  hasConsolidado,
    }
  })

  // Projeção multi-ano (carteira contratada): realizado x a faturar por ano
  const anosSet = new Set<number>([...Array.from(previstoPorAno.keys()), ...Array.from(realizadoPorAno.keys())])
  const projecaoMultiAno = Array.from(anosSet)
    .filter((a) => !isNaN(a))
    .sort((a, b) => a - b)
    .map((a) => {
      const realizado = realizadoPorAno.get(a) ?? 0
      const previsto  = previstoPorAno.get(a) ?? 0
      return { ano: a, realizado, aFaturar: Math.max(0, previsto - realizado) }
    })
    .filter((p) => p.realizado > 0 || p.aFaturar > 0)

  // Aderência por responsável
  const porResponsavel = Array.from(porResp.values())
    .map((r) => ({
      id: r.id, nome: r.nome, contratos: r.contratos,
      valorSobGestao: r.valorSobGestao, previsto: r.previsto, realizado: r.realizado,
      aderencia: r.previsto > 0 ? (r.realizado / r.previsto) * 100 : 0,
      saldo: Math.max(0, r.previsto - r.realizado),
    }))
    .sort((a, b) => b.valorSobGestao - a.valorSobGestao)

  // Contratos ativos — ordenados por % faturado desc
  const contratosAtivosData = contratosAtivos
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 30)

  return NextResponse.json({
    data: {
      anoAtual,
      mesAtual,
      clientes,
      totalFaturadoAno,
      prevFaturamentoAno,
      aFaturarAno,
      faturamentoProxAnos,
      prevMesAtual,
      faturadoMesAtual,
      faturadoUltimoMes,
      prevProxMes,
      percFaturadoGeral: Number(percFaturadoGeral.toFixed(1)),
      porRamo:    porRamoData,
      porCliente: porClienteData,
      porMes,
      projecaoMultiAno,
      porResponsavel,
      contratosAtivos: contratosAtivosData,
    },
    error: null,
  })
}
