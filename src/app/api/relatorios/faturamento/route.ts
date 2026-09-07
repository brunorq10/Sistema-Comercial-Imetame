import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MES_LABEL_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getMonthValue(sub: Record<string, unknown>, mes1a12: number): number {
  const key = MESES[mes1a12 - 1]
  const val = sub[key]
  return val ? Number(val) : 0
}

// GET /api/relatorios/faturamento — FAT-01..06
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const { searchParams } = req.nextUrl
  const anoParam = searchParams.get('ano')
  const ano = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear()
  const mesRefParam = searchParams.get('mes_ref')
  const mesRef = mesRefParam ? parseInt(mesRefParam, 10) : new Date().getMonth() + 1

  const [contratos, responsaveis, clientes] = await Promise.all([
    prisma.contrato.findMany({
      where: { cancelled_at: null },
      select: {
        id: true, indice: true, ano_referencia: true, classificacao: true, status: true, valor_contrato: true, cidade: true, descricao: true,
        cliente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        subindices: {
          where: { deleted_at: null },
          select: {
            valor_total: true, data_inicio: true,
            jan: true, fev: true, mar: true, abr: true, mai: true, jun: true, jul: true, ago: true, set: true, out: true, nov: true, dez: true,
            notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { valor_atribuido: true, data_emissao: true } },
          },
        },
      },
    }),
    prisma.user.findMany({ where: { ativo: true, contratos_responsavel: { some: {} } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])

  // ── FAT-01: previsto x realizado do ano ────────────────────────────────────
  const previstoPorMes = new Array(12).fill(0)
  const faturadoPorMes = new Array(12).fill(0)
  // Evolução multi-ano (FAT-03): últimos 4 anos incluindo o selecionado
  const anosEvolucao = [ano - 3, ano - 2, ano - 1, ano]
  const faturadoPorAnoMes = new Map<number, number[]>(anosEvolucao.map((a) => [a, new Array(12).fill(0)]))

  // FAT-02: saldo a faturar por contrato
  type SaldoRow = { id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; responsavel: string | null; classificacao: string | null; valor_total: number; faturado: number; saldo: number; status_faturamento: 'A_FATURAR' | 'PARCIAL' | 'FATURADO' }
  const saldoRows: SaldoRow[] = []

  // FAT-04: por classificação
  const porClassifFaturado = new Map<string, number>()
  const porClassifPrevisto = new Map<string, number>()

  // FAT-05: aderência do mês de referência, por contrato
  type AderenciaRow = { id: number; indice: string; escopo: string | null; cidade: string | null; cliente: string; previsto_mes: number; faturado_mes: number; desvio: number; desvio_pct: number | null }
  const aderenciaRows: AderenciaRow[] = []

  for (const c of contratos) {
    let contratoTotal = 0
    let contratoFaturadoTotal = 0
    let previstoMesRefContrato = 0
    let faturadoMesRefContrato = 0

    for (const sub of c.subindices) {
      const subRec = sub as unknown as Record<string, unknown>
      const anoSub = sub.data_inicio ? new Date(sub.data_inicio).getUTCFullYear() : c.ano_referencia
      const valorSub = Number(sub.valor_total)
      contratoTotal += valorSub

      if (anoSub === ano) {
        for (let m = 1; m <= 12; m++) previstoPorMes[m - 1] += getMonthValue(subRec, m)
        if (anoSub === ano) previstoMesRefContrato += getMonthValue(subRec, mesRef)
        if (c.classificacao) {
          const mensalSub = Array.from({ length: 12 }, (_, i) => getMonthValue(subRec, i + 1)).reduce((a, b) => a + b, 0)
          porClassifPrevisto.set(c.classificacao, (porClassifPrevisto.get(c.classificacao) ?? 0) + mensalSub)
        }
      }

      for (const nf of sub.notas_fiscais) {
        const valor = Number(nf.valor_atribuido)
        contratoFaturadoTotal += valor
        const emissao = nf.data_emissao
        const nfAno = emissao.getUTCFullYear()
        const nfMes = emissao.getUTCMonth() + 1
        if (nfAno === ano) {
          faturadoPorMes[nfMes - 1] += valor
          if (c.classificacao) porClassifFaturado.set(c.classificacao, (porClassifFaturado.get(c.classificacao) ?? 0) + valor)
        }
        if (nfAno === ano && nfMes === mesRef) faturadoMesRefContrato += valor
        if (faturadoPorAnoMes.has(nfAno)) faturadoPorAnoMes.get(nfAno)![nfMes - 1] += valor
      }
    }

    const saldo = contratoTotal - contratoFaturadoTotal
    saldoRows.push({
      id: c.id, indice: c.indice, escopo: c.descricao, cidade: c.cidade, cliente: c.cliente.nome, responsavel: c.responsavel?.nome ?? null,
      classificacao: c.classificacao, valor_total: contratoTotal, faturado: contratoFaturadoTotal, saldo,
      status_faturamento: contratoFaturadoTotal === 0 ? 'A_FATURAR' : contratoFaturadoTotal >= contratoTotal ? 'FATURADO' : 'PARCIAL',
    })

    if (previstoMesRefContrato > 0 || faturadoMesRefContrato > 0) {
      const desvio = faturadoMesRefContrato - previstoMesRefContrato
      aderenciaRows.push({
        id: c.id, indice: c.indice, escopo: c.descricao, cidade: c.cidade, cliente: c.cliente.nome,
        previsto_mes: previstoMesRefContrato, faturado_mes: faturadoMesRefContrato, desvio,
        desvio_pct: previstoMesRefContrato > 0 ? (desvio / previstoMesRefContrato) * 100 : null,
      })
    }
  }

  const prevAno = previstoPorMes.reduce((a, b) => a + b, 0)
  const fatAno = faturadoPorMes.reduce((a, b) => a + b, 0)

  // ── FAT-06: NFs / edições pendentes de aprovação ───────────────────────────
  const [nfsPendentes, edicoesPendentes] = await Promise.all([
    prisma.notaFiscalContrato.findMany({
      where: { status_aprovacao: 'PENDENTE', deleted_at: null },
      select: {
        id: true, numero_nf: true, created_at: true,
        subindice: { select: { contrato: { select: { indice: true, cidade: true, descricao: true, cliente: { select: { nome: true } } } } } },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.notaFiscalAlteracao.findMany({
      where: { status: 'PENDENTE' },
      select: {
        id: true, numero_nf_de: true, created_at: true,
        nf: { select: { subindice: { select: { contrato: { select: { indice: true, cidade: true, descricao: true, cliente: { select: { nome: true } } } } } } } },
      },
      orderBy: { created_at: 'asc' },
    }),
  ])
  const now = Date.now()
  const DIA_MS = 86_400_000
  const pendencias = [
    ...nfsPendentes.map((n) => ({
      id: n.id, tipo: 'Novo lançamento' as const, numero_nf: n.numero_nf,
      contrato: n.subindice.contrato.indice, escopo: n.subindice.contrato.descricao, cidade: n.subindice.contrato.cidade, cliente: n.subindice.contrato.cliente.nome,
      dias_em_espera: Math.floor((now - n.created_at.getTime()) / DIA_MS),
    })),
    ...edicoesPendentes.map((e) => ({
      id: e.id, tipo: 'Edição de NF' as const, numero_nf: e.numero_nf_de,
      contrato: e.nf.subindice.contrato.indice, escopo: e.nf.subindice.contrato.descricao, cidade: e.nf.subindice.contrato.cidade, cliente: e.nf.subindice.contrato.cliente.nome,
      dias_em_espera: Math.floor((now - e.created_at.getTime()) / DIA_MS),
    })),
  ].sort((a, b) => b.dias_em_espera - a.dias_em_espera)

  const data = {
    filtros: { anos_disponiveis: [ano - 3, ano - 2, ano - 1, ano, ano + 1].sort((a, b) => b - a), responsaveis, clientes, mes_ref_label: MES_LABEL_PT[mesRef - 1] },
    ano, mes_ref: mesRef,

    fat01_mensal: MES_LABEL_PT.map((label, i) => ({
      mes: i + 1, label, previsto: previstoPorMes[i], faturado: faturadoPorMes[i],
      percentual: previstoPorMes[i] > 0 ? (faturadoPorMes[i] / previstoPorMes[i]) * 100 : 0,
    })),
    fat01_total: { previsto: prevAno, faturado: fatAno, percentual: prevAno > 0 ? (fatAno / prevAno) * 100 : 0 },

    fat02_saldo: saldoRows.filter((r) => r.saldo > 0.01).sort((a, b) => b.saldo - a.saldo),

    fat03_evolucao: anosEvolucao.map((a) => ({ ano: a, meses: faturadoPorAnoMes.get(a)!, total: faturadoPorAnoMes.get(a)!.reduce((x, y) => x + y, 0) })),

    fat04_por_classificacao: Array.from(new Set([...Array.from(porClassifFaturado.keys()), ...Array.from(porClassifPrevisto.keys())]))
      .map((classificacao) => ({
        classificacao, faturado: porClassifFaturado.get(classificacao) ?? 0, previsto: porClassifPrevisto.get(classificacao) ?? 0,
      }))
      .sort((a, b) => b.faturado - a.faturado),

    fat05_aderencia: aderenciaRows.sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio)),

    fat06_pendencias: pendencias,
  }

  return NextResponse.json({ data, error: null })
}
