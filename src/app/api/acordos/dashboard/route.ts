import { NextResponse } from 'next/server'
import { Prisma, RamoAtuacao } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bucketMesesPrevistoRealizado, bucketParadaHhPorMes } from '@/lib/hh'

const MONTH_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

function getMonthValue(sub: Record<string, unknown>, month: number): number {
  const key = MONTH_KEYS[month - 1]
  const val = sub[key]
  return val ? Number(val) : 0
}

const RAMO_LABELS: Record<string, string> = {
  PAPEL_CELULOSE_OBRAS:   'Papel e Celulose - Obras',
  PAPEL_CELULOSE_PARADAS: 'Papel e Celulose - Paradas',
  SIDERURGIA:             'Siderurgia',
  OLEO_GAS:               'Óleo e Gás',
  OLEO_GAS_PETRO:         'Óleo e Gás - Petro',
  OUTROS:                 'Outros',
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anoParam       = searchParams.get('ano')
  const clienteId      = searchParams.get('clienteId')
  const clienteFinalId = searchParams.get('clienteFinalId')
  const ramoFiltro     = searchParams.get('ramo')
  const responsavelId  = searchParams.get('responsavelId')
  const cidadeFiltro   = searchParams.get('cidade')
  const escopoFiltro   = searchParams.get('escopo')

  const hoje        = new Date()
  const anoAtual    = anoParam ? parseInt(anoParam, 10) : hoje.getFullYear()
  const mesAtual    = hoje.getMonth() + 1
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
  const anoMesAnt   = mesAtual === 1 ? anoAtual - 1 : anoAtual
  const mesProximo  = mesAtual === 12 ? 1  : mesAtual + 1
  const anoMesProx  = mesAtual === 12 ? anoAtual + 1 : anoAtual

  // Filtros multi-valor: lista separada por vírgula (ex.: clienteId=1,2,3)
  const clienteIds     = clienteId    ? clienteId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const clienteFinalIds = clienteFinalId ? clienteFinalId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const ramos          = ramoFiltro   ? ramoFiltro.split(',').filter(Boolean) : []
  const responsavelIds = responsavelId ? responsavelId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const cidades        = cidadeFiltro ? cidadeFiltro.split(',').filter(Boolean) : []

  const whereContrato: Prisma.ContratoWhereInput = { cancelled_at: null }
  if (clienteIds.length)     whereContrato.cliente_id     = { in: clienteIds }
  if (clienteFinalIds.length) whereContrato.cliente_final_id = { in: clienteFinalIds }
  if (ramos.length)          whereContrato.cliente        = { is: { ramo_atuacao: { in: ramos as RamoAtuacao[] } } }
  if (responsavelIds.length) whereContrato.responsavel_id = { in: responsavelIds }
  if (cidades.length)        whereContrato.cidade         = { in: cidades }
  if (escopoFiltro?.trim())  whereContrato.descricao      = { contains: escopoFiltro.trim(), mode: 'insensitive' }

  const [contratos, consolidados, clientes, filtroMeta] = await Promise.all([
    // Carrega apenas os campos usados na agregação (evita trazer linhas inteiras)
    prisma.contrato.findMany({
      where: whereContrato,
      select: {
        id: true, indice: true, ano_referencia: true, num_os: true,
        cliente: { select: { id: true, nome: true, ramo_atuacao: true } },
        responsavel: { select: { id: true, nome: true } },
        subindices: {
          where: { deleted_at: null },
          select: {
            valor_total: true, data_inicio: true,
            jan: true, fev: true, mar: true, abr: true, mai: true, jun: true,
            jul: true, ago: true, set: true, out: true, nov: true, dez: true,
            notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { data_emissao: true, valor_atribuido: true } },
          },
        },
        // HH previsto/realizado — mesma fonte/lógica de src/app/api/acordos/hh/[id]/resumo/route.ts,
        // usada aqui para agregar por mercado (indicador "HH por mercado").
        hh_lancamentos: { orderBy: { versao: 'desc' }, take: 1, select: { meses: { select: { ano: true, mes: true, hh_previsto: true } } } },
        hh_realizados: { select: { ano: true, mes: true, hh_realizado: true } },
        parada_hh_config: { select: { dias: { select: { data: true, etapa: true, hh_plan: true, hh_real: true } } } },
        fabricacao_itens: {
          where: { deleted_at: null },
          select: {
            meses: { select: { ano: true, mes: true, hh_previsto: true } },
            realizados: { select: { ano: true, mes: true, hh_realizado: true } },
          },
        },
      },
    }),
    prisma.consolidadoMes.findMany({
      where: { ano: anoAtual },
      select: { mes: true, itens: { select: { valor_previsto: true } } },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    // Opções dos filtros de Responsável/Cidade — lista completa (não recorta
    // pelos filtros já aplicados), mesmo critério já usado para `clientes` acima.
    prisma.contrato.findMany({
      where: { cancelled_at: null },
      select: { cidade: true, responsavel: { select: { id: true, nome: true } }, cliente_final: { select: { id: true, nome: true } } },
    }),
  ])

  const responsaveisMap = new Map<number, string>()
  const cidadesSet = new Set<string>()
  const clientesFinaisMap = new Map<number, string>()
  for (const c of filtroMeta) {
    if (c.responsavel) responsaveisMap.set(c.responsavel.id, c.responsavel.nome)
    if (c.cidade) cidadesSet.add(c.cidade)
    if (c.cliente_final) clientesFinaisMap.set(c.cliente_final.id, c.cliente_final.nome)
  }
  const responsaveisOpts = Array.from(responsaveisMap.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
  const cidadesOpts = Array.from(cidadesSet).sort()
  const clientesFinaisOpts = Array.from(clientesFinaisMap.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

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

  const porRamo         = new Map<string, number>()
  const porRamoPrevisto = new Map<string, number>()
  const porRamoHhPrevisto = new Map<string, number>()
  const porRamoHhReal     = new Map<string, number>()
  const porCliente = new Map<number, { nome: string; valor: number }>()
  const porClientePrevisto = new Map<number, number>()
  const clienteNomes = new Map<number, string>()
  const previstoSubPorMes = new Array<number>(12).fill(0)
  const faturadoPorMes    = new Array<number>(12).fill(0)

  // Acumulador para aderência por responsável
  const porResp = new Map<string, { id: number | null; nome: string; contratos: number; valorSobGestao: number; previsto: number; realizado: number }>()

  for (const contrato of contratos) {
    let contratoTotal = 0          // valor total do contrato (soma dos sub-índices)
    let contratoNFsAno = 0         // faturado no ano de referência
    let contratoPrevistoAno = 0    // previsto no ano de referência
    clienteNomes.set(contrato.cliente.id, contrato.cliente.nome)

    for (const sub of contrato.subindices) {
      const subRec = sub as unknown as Record<string, unknown>
      const anoSub = sub.data_inicio
        ? new Date(sub.data_inicio).getUTCFullYear()
        : contrato.ano_referencia

      const valorSub = Number(sub.valor_total)
      contratoTotal += valorSub

      const mensalSub = Array.from({ length: 12 }, (_, i) => getMonthValue(subRec, i + 1)).reduce((a, b) => a + b, 0)

      if (anoSub === anoAtual) {
        prevMesAtual += getMonthValue(subRec, mesAtual)
        for (let m = 1; m <= 12; m++) previstoSubPorMes[m - 1] += getMonthValue(subRec, m)
        contratoPrevistoAno += mensalSub

        // Previsto por mercado (para o toggle Previsto/Real do indicador
        // "Faturamento por mercado") — mesmo critério de ano do faturado.
        const ramoPrev = contrato.cliente.ramo_atuacao ?? 'OUTROS'
        porRamoPrevisto.set(ramoPrev, (porRamoPrevisto.get(ramoPrev) ?? 0) + mensalSub)

        // Previsto por cliente (toggle Previsto/Real de "Participação de cada
        // empresa no faturamento do ano atual").
        porClientePrevisto.set(contrato.cliente.id, (porClientePrevisto.get(contrato.cliente.id) ?? 0) + mensalSub)
      }
      if (anoSub > anoAtual) faturamentoProxAnos += valorSub
      if (anoSub === anoMesProx)  prevProxMes  += getMonthValue(subRec, mesProximo)

      for (const nf of sub.notas_fiscais) {
        const emissao = new Date(nf.data_emissao)
        const nfAno   = emissao.getUTCFullYear()
        const nfMes   = emissao.getUTCMonth() + 1
        const valor   = Number(nf.valor_atribuido)

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

    // HH por mercado — mesma lógica/fonte de src/app/api/acordos/hh/[id]/resumo/route.ts
    // (Obras: HhLancamento mais recente + HhRealizado; Paradas: grade diária;
    // Fabricações: FabricacaoItemMes/FabricacaoRealizado), agregado por ramo e
    // recortado pelo ano selecionado no filtro (mesmo critério do faturamento).
    const lancamento = contrato.hh_lancamentos[0] ?? null
    let mesesHh: { ano: number; mes: number; previsto: number; realizado: number | null }[] = []
    if (lancamento) {
      mesesHh = bucketMesesPrevistoRealizado(
        lancamento.meses.map((m) => ({ ano: m.ano, mes: m.mes, valor: m.hh_previsto })),
        contrato.hh_realizados.map((r) => ({ ano: r.ano, mes: r.mes, valor: r.hh_realizado })),
      )
    } else if (contrato.parada_hh_config) {
      mesesHh = bucketParadaHhPorMes(contrato.parada_hh_config.dias)
    } else if (contrato.fabricacao_itens.length > 0) {
      mesesHh = bucketMesesPrevistoRealizado(
        contrato.fabricacao_itens.flatMap((it) => it.meses.map((m) => ({ ano: m.ano, mes: m.mes, valor: m.hh_previsto }))),
        contrato.fabricacao_itens.flatMap((it) => it.realizados.map((r) => ({ ano: r.ano, mes: r.mes, valor: r.hh_realizado }))),
      )
    }
    const hhPrevistoAno = mesesHh.filter((m) => m.ano === anoAtual).reduce((s, m) => s + m.previsto, 0)
    const hhRealizadoAno = mesesHh.filter((m) => m.ano === anoAtual).reduce((s, m) => s + (m.realizado ?? 0), 0)
    if (hhPrevistoAno > 0 || hhRealizadoAno > 0) {
      const ramoHh = contrato.cliente.ramo_atuacao ?? 'OUTROS'
      porRamoHhPrevisto.set(ramoHh, (porRamoHhPrevisto.get(ramoHh) ?? 0) + hhPrevistoAno)
      porRamoHhReal.set(ramoHh, (porRamoHhReal.get(ramoHh) ?? 0) + hhRealizadoAno)
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
  }

  // Previsto do ano = soma das colunas mensais dos subíndices (mesma base da tabela)
  prevFaturamentoAno = previstoSubPorMes.reduce((a, b) => a + b, 0)

  const aFaturarAno = Math.max(0, prevFaturamentoAno - totalFaturadoAno)

  // Ramo
  // Todos os mercados aparecem sempre, mesmo sem nenhum lançamento (zerado) —
  // ordenação por %/valor fica a cargo do front (alterna conforme o toggle
  // Previsto/Real do card "Faturamento por mercado").
  const porRamoData = Object.keys(RAMO_LABELS).map((ramo) => ({
    ramo:     RAMO_LABELS[ramo],
    real:     porRamo.get(ramo) ?? 0,
    previsto: porRamoPrevisto.get(ramo) ?? 0,
  }))

  // HH por mercado — mesmo formato/config do "Faturamento por mercado".
  const porRamoHhData = Object.keys(RAMO_LABELS).map((ramo) => ({
    ramo:     RAMO_LABELS[ramo],
    real:     porRamoHhReal.get(ramo) ?? 0,
    previsto: porRamoHhPrevisto.get(ramo) ?? 0,
  }))

  // Participação de cada empresa no faturamento do ano — união de quem tem
  // faturado (real) e/ou previsto no ano, para suportar o toggle Real/Previsto.
  const idsClientes = new Set<number>([...Array.from(porCliente.keys()), ...Array.from(porClientePrevisto.keys())])
  const porClienteData = Array.from(idsClientes)
    .map((id) => ({
      id,
      nome: clienteNomes.get(id) ?? porCliente.get(id)?.nome ?? '—',
      real: porCliente.get(id)?.valor ?? 0,
      previsto: porClientePrevisto.get(id) ?? 0,
    }))
    .sort((a, b) => b.real - a.real)

  // Por mês: usa consolidado quando disponível, senão usa previsto dos subíndices
  const MES_LABEL_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const mes           = i + 1
    const hasConsolidado = consolidadosPorMes.has(mes)
    const valorFixado   = hasConsolidado ? (consolidadosPorMes.get(mes) ?? 0) : null
    // "previsto" mescla o valor fixado (consolidado) quando existe — usado no
    // % Fat./Fixado, no Resultado e no acumulado do gráfico Meta x Faturado
    // (ver percFaturadoGeral abaixo). "previsto_bruto" é sempre a soma crua dos
    // sub-índices, sem substituição — usado só na coluna "Previsto" da tabela
    // de detalhamento, para bater com o card "Previsão de faturamento no ano"
    // (prevFaturamentoAno), que também é sempre bruto.
    const previstoBruto = previstoSubPorMes[i]
    const previsto      = hasConsolidado ? (valorFixado ?? 0) : previstoBruto
    const faturado      = faturadoPorMes[i]
    const pct           = previsto > 0 ? (faturado / previsto) * 100 : 0
    return {
      mes,
      label:          MES_LABEL_PT[i],
      previsto,
      previsto_bruto: previstoBruto,
      valor_fixado:   valorFixado,
      faturado,
      percentual:     Number(pct.toFixed(1)),
      resultado:      faturado - previsto,
      consolidado:    hasConsolidado,
    }
  })

  // % faturado geral do ano — mesma base do gráfico "Meta acumulada x Faturado
  // acumulado" (ContratoAvancoPercentualChart no dashboard): usa o previsto
  // "mesclado" por mês (valor fixado do consolidado quando existe, sub-índice
  // cru quando não existe), não a soma crua dos sub-índices. Sem teto em 100%,
  // para bater exatamente com o acumulado do gráfico quando o faturado supera
  // o previsto.
  const totalPrevistoMesclado = porMes.reduce((a, m) => a + m.previsto, 0)
  const percFaturadoGeral = totalPrevistoMesclado > 0
    ? (totalFaturadoAno / totalPrevistoMesclado) * 100
    : 0

  // Aderência por responsável
  const porResponsavel = Array.from(porResp.values())
    .map((r) => ({
      id: r.id, nome: r.nome, contratos: r.contratos,
      valorSobGestao: r.valorSobGestao, previsto: r.previsto, realizado: r.realizado,
      aderencia: r.previsto > 0 ? (r.realizado / r.previsto) * 100 : 0,
      saldo: Math.max(0, r.previsto - r.realizado),
    }))
    .sort((a, b) => b.valorSobGestao - a.valorSobGestao)

  // Ocorrências contratuais lançadas por responsável (autor do registro)
  const ocorrenciasRaw = await prisma.ocorrenciaContratual.groupBy({
    by: ['created_by'],
    where: { contrato: whereContrato },
    _count: { _all: true },
  })
  const ocAutores = ocorrenciasRaw.length
    ? await prisma.user.findMany({ where: { id: { in: ocorrenciasRaw.map((o) => o.created_by) } }, select: { id: true, nome: true } })
    : []
  const ocNomeById = new Map(ocAutores.map((u) => [u.id, u.nome]))
  const ocPorResp = new Map(ocorrenciasRaw.map((o) => [o.created_by, o._count._all]))

  // OS sob gestão por responsável (contratos com Nº OS) + nomes
  const osPorResp = new Map<number, number>()
  const nomeResp = new Map<number, string>()
  for (const c of contratos) {
    if (!c.responsavel) continue
    nomeResp.set(c.responsavel.id, c.responsavel.nome)
    if (c.num_os) osPorResp.set(c.responsavel.id, (osPorResp.get(c.responsavel.id) ?? 0) + 1)
  }
  ocNomeById.forEach((nome, id) => nomeResp.set(id, nome))

  const idsResp = Array.from(new Set([...Array.from(osPorResp.keys()), ...Array.from(ocPorResp.keys())]))
  const ocorrenciasPorResponsavel = idsResp
    .map((id) => ({
      id,
      nome: nomeResp.get(id) ?? '—',
      osSobGestao: osPorResp.get(id) ?? 0,
      total: ocPorResp.get(id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || b.osSobGestao - a.osSobGestao)

  return NextResponse.json({
    data: {
      anoAtual,
      mesAtual,
      clientes,
      clientesFinais: clientesFinaisOpts,
      responsaveis: responsaveisOpts,
      cidades: cidadesOpts,
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
      porRamoHh:  porRamoHhData,
      porCliente: porClienteData,
      porMes,
      porResponsavel,
      ocorrenciasPorResponsavel,
    },
    error: null,
  })
}
