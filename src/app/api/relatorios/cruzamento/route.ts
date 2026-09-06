import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { calcParadaHhTotais } from '@/lib/hh'

// GET /api/relatorios/cruzamento — CRZ-01..03
// Depende do vínculo opcional Contrato.solicitacao_id — hoje preenchido em
// poucos contratos (ver cobertura retornada). Mostra o que dá pra cruzar hoje
// e é honesto sobre o que fica de fora.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const { searchParams } = req.nextUrl
  const contratoIdParam = searchParams.get('contrato_id')

  const [totalAtivos, comVinculo] = await Promise.all([
    prisma.contrato.count({ where: { cancelled_at: null } }),
    prisma.contrato.count({ where: { cancelled_at: null, solicitacao_id: { not: null } } }),
  ])

  const contratos = await prisma.contrato.findMany({
    where: { cancelled_at: null, solicitacao_id: { not: null } },
    select: {
      id: true, indice: true, classificacao: true, created_at: true, data_inicio: true,
      cliente: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      hh_lancamentos: { orderBy: { versao: 'desc' }, take: 1, select: { meses: { select: { hh_previsto: true } } } },
      hh_realizados: { select: { hh_realizado: true } },
      parada_hh_config: { include: { dias: true } },
      fabricacao_itens: { where: { deleted_at: null }, select: { realizados: { select: { hh_realizado: true } } } },
      subindices: {
        where: { deleted_at: null },
        select: { notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { valor_atribuido: true, data_emissao: true }, orderBy: { data_emissao: 'asc' } } },
      },
      solicitacao: {
        select: {
          id: true, numero: true, data_recebimento: true, created_at: true, data_atribuicao: true,
          propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1, select: { hh_direto: true, hh_indireto: true, hh_total: true, data_envio: true } },
          propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1, select: { valor_total: true, data_envio: true, resultado: true } },
          propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1, select: { valor_total: true, data_envio: true, resultado: true } },
        },
      },
    },
  })

  type CrzRow = {
    id: number; indice: string; cliente: string; classificacao: string | null
    hh_orcado: number | null; hh_realizado: number | null; desvio_hh_pct: number | null
    valor_vendido: number | null; valor_faturado: number
    rs_hh_vendido: number | null; rs_hh_realizado: number | null
  }
  const rows: CrzRow[] = []
  let timelineTarget: unknown = null

  for (const c of contratos) {
    if (!c.solicitacao) continue
    const isFab = c.classificacao === 'FABRICACOES' || c.classificacao === 'OLEO_GAS'
    const tec = c.solicitacao.propostas_tecnicas[0] ?? null
    const com = c.solicitacao.propostas_comerciais[0] ?? null
    const fab = c.solicitacao.propostas_fabricacao[0] ?? null

    const hhOrcado = tec ? (tec.hh_total ?? ((tec.hh_direto ?? 0) + (tec.hh_indireto ?? 0))) : null
    let hhRealizado: number | null = null
    if (c.classificacao === 'OBRAS') hhRealizado = c.hh_realizados.reduce((a, r) => a + r.hh_realizado, 0)
    else if (c.classificacao === 'PARADAS' && c.parada_hh_config) hhRealizado = calcParadaHhTotais(c.parada_hh_config).hhTotalReal
    else if (isFab) hhRealizado = c.fabricacao_itens.reduce((a, it) => a + it.realizados.reduce((b, r) => b + (r.hh_realizado ?? 0), 0), 0)

    const valorVendido = isFab ? (fab?.valor_total != null ? Number(fab.valor_total) : null) : (com?.valor_total != null ? Number(com.valor_total) : null)
    const valorFaturado = c.subindices.reduce((a, s) => a + s.notas_fiscais.reduce((b, nf) => b + Number(nf.valor_atribuido), 0), 0)

    rows.push({
      id: c.id, indice: c.indice, cliente: c.cliente.nome, classificacao: c.classificacao,
      hh_orcado: hhOrcado && hhOrcado > 0 ? hhOrcado : null,
      hh_realizado: hhRealizado != null && hhRealizado > 0 ? hhRealizado : null,
      desvio_hh_pct: hhOrcado && hhOrcado > 0 && hhRealizado != null ? ((hhRealizado - hhOrcado) / hhOrcado) * 100 : null,
      valor_vendido: valorVendido, valor_faturado: valorFaturado,
      rs_hh_vendido: valorVendido != null && hhOrcado && hhOrcado > 0 ? valorVendido / hhOrcado : null,
      rs_hh_realizado: valorFaturado > 0 && hhRealizado != null && hhRealizado > 0 ? valorFaturado / hhRealizado : null,
    })

    if (contratoIdParam && c.id === Number(contratoIdParam)) {
      const primeiraNf = c.subindices.flatMap((s) => s.notas_fiscais)[0] ?? null
      const ultimaNf = c.subindices.flatMap((s) => s.notas_fiscais).slice(-1)[0] ?? null
      timelineTarget = {
        contrato: { id: c.id, indice: c.indice, cliente: c.cliente.nome },
        etapas: [
          { label: 'Solicitação recebida', data: (c.solicitacao.data_recebimento ?? c.solicitacao.created_at).toISOString() },
          { label: 'Orçamentista atribuído', data: c.solicitacao.data_atribuicao?.toISOString() ?? null },
          { label: 'Proposta técnica enviada', data: tec?.data_envio?.toISOString() ?? null },
          { label: 'Proposta comercial enviada', data: (isFab ? fab?.data_envio : com?.data_envio)?.toISOString() ?? null },
          { label: 'Contrato criado (Acordos)', data: c.created_at.toISOString() },
          { label: 'Primeira NF', data: primeiraNf?.data_emissao.toISOString() ?? null },
          { label: 'Última NF', data: ultimaNf?.data_emissao.toISOString() ?? null },
        ],
      }
    }
  }

  const data = {
    cobertura: { total_contratos_ativos: totalAtivos, com_vinculo_solicitacao: comVinculo },
    filtros: { contratos_vinculados: rows.map((r) => ({ id: r.id, indice: r.indice, cliente: r.cliente })) },
    crz01_orcado_executado: rows.filter((r) => r.hh_orcado != null || r.hh_realizado != null).sort((a, b) => Math.abs(b.desvio_hh_pct ?? 0) - Math.abs(a.desvio_hh_pct ?? 0)),
    crz02_rentabilidade: rows.filter((r) => r.rs_hh_vendido != null || r.rs_hh_realizado != null),
    crz03_timeline: timelineTarget,
  }

  return NextResponse.json({ data, error: null })
}
