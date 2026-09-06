import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const RAMO_LABELS: Record<string, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose', SIDERURGIA: 'Siderurgia', MINERACAO: 'Mineração',
  OLEO_GAS: 'Óleo e Gás', OUTROS: 'Outros',
}
const SEGMENTO_LABELS: Record<string, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose', SIDERURGIA: 'Siderurgia', OLEO_GAS: 'Óleo e Gás', OUTROS: 'Outros',
}

// GET /api/relatorios/clientes — CLI-01, CLI-03, CLI-04
// (Ficha do Cliente — CLI-02 — está em /api/relatorios/clientes/[id])
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const { searchParams } = req.nextUrl
  const anoParam = searchParams.get('ano')
  const ano = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear()

  const [contratos, todosClientes] = await Promise.all([
    prisma.contrato.findMany({
      where: { cancelled_at: null },
      select: {
        id: true, cliente_id: true,
        cliente: { select: { id: true, nome: true, ramo_atuacao: true } },
        subindices: {
          where: { deleted_at: null },
          select: { notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { data_emissao: true, valor_atribuido: true } } },
        },
      },
    }),
    prisma.cliente.findMany({ select: { id: true, nome: true, ramo_atuacao: true } }),
  ])

  // Faturado no ano, por cliente
  const faturadoPorCliente = new Map<number, { nome: string; ramo: string | null; valor: number }>()
  let totalFaturadoAno = 0
  for (const c of contratos) {
    for (const sub of c.subindices) {
      for (const nf of sub.notas_fiscais) {
        if (nf.data_emissao.getUTCFullYear() !== ano) continue
        const valor = Number(nf.valor_atribuido)
        totalFaturadoAno += valor
        const cur = faturadoPorCliente.get(c.cliente_id) ?? { nome: c.cliente.nome, ramo: c.cliente.ramo_atuacao, valor: 0 }
        cur.valor += valor
        faturadoPorCliente.set(c.cliente_id, cur)
      }
    }
  }

  // ── CLI-01: curva ABC ──────────────────────────────────────────────────────
  const ranking = Array.from(faturadoPorCliente.entries())
    .map(([id, v]) => ({ id, nome: v.nome, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor)
  let acumulado = 0
  const curvaAbc = ranking.map((r) => {
    acumulado += r.valor
    return {
      ...r,
      percentual: totalFaturadoAno > 0 ? (r.valor / totalFaturadoAno) * 100 : 0,
      percentual_acumulado: totalFaturadoAno > 0 ? (acumulado / totalFaturadoAno) * 100 : 0,
    }
  })

  // ── CLI-03: por ramo (faturamento) e por segmento (solicitações) ───────────
  const porRamo = new Map<string, number>()
  for (const v of Array.from(faturadoPorCliente.values())) {
    const ramo = v.ramo ?? 'OUTROS'
    porRamo.set(ramo, (porRamo.get(ramo) ?? 0) + v.valor)
  }
  const porRamoData = Object.keys(RAMO_LABELS)
    .map((ramo) => ({ ramo, label: RAMO_LABELS[ramo], valor: porRamo.get(ramo) ?? 0 }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const solicitacoesPorSegmento = await prisma.solicitacao.groupBy({
    by: ['segmento'],
    where: { cancelled_at: null, data_recebimento: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31T23:59:59`) } },
    _count: { _all: true },
  })
  const porSegmentoData = solicitacoesPorSegmento
    .filter((s) => s.segmento)
    .map((s) => ({ segmento: s.segmento as string, label: SEGMENTO_LABELS[s.segmento as string] ?? s.segmento, total: s._count._all }))
    .sort((a, b) => b.total - a.total)

  // ── CLI-04: recorrentes x novos ──────────────────────────────────────────────
  const primeiraPorCliente = await prisma.solicitacao.groupBy({
    by: ['cliente_id'],
    where: { cancelled_at: null },
    _min: { data_recebimento: true, created_at: true },
  })
  const primeiraData = new Map<number, Date>()
  for (const p of primeiraPorCliente) {
    primeiraData.set(p.cliente_id, p._min.data_recebimento ?? p._min.created_at ?? new Date(0))
  }
  let novosReceita = 0, recorrentesReceita = 0, novosCount = 0, recorrentesCount = 0
  for (const [clienteId, v] of Array.from(faturadoPorCliente.entries())) {
    const primeira = primeiraData.get(clienteId)
    const isNovo = primeira ? primeira.getFullYear() === ano : false
    if (isNovo) { novosReceita += v.valor; novosCount++ } else { recorrentesReceita += v.valor; recorrentesCount++ }
  }

  const data = {
    filtros: { anos_disponiveis: await anosDisponiveis(), clientes: todosClientes.map((c) => ({ id: c.id, nome: c.nome })) },
    ano,
    cli01_curva_abc: curvaAbc,
    cli01_total_ano: totalFaturadoAno,
    cli03_por_ramo: porRamoData,
    cli03_por_segmento: porSegmentoData,
    cli04: {
      novos: { clientes: novosCount, receita: novosReceita },
      recorrentes: { clientes: recorrentesCount, receita: recorrentesReceita },
    },
  }

  return NextResponse.json({ data, error: null })
}

async function anosDisponiveis(): Promise<number[]> {
  const rows = await prisma.notaFiscalContrato.findMany({
    where: { ativa: true, deleted_at: null },
    select: { data_emissao: true },
    distinct: ['data_emissao'],
  })
  const set = new Set<number>()
  rows.forEach((r) => set.add(r.data_emissao.getUTCFullYear()))
  const cur = new Date().getFullYear()
  set.add(cur)
  return Array.from(set).sort((a, b) => b - a)
}
