import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { calcParadaHhTotais } from '@/lib/hh'
import { regiaoPorEstado, resolverVigencia, classificarUcr } from '@/lib/ucr'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

// GET /api/relatorios/contratos — CTR-01..05
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const { searchParams } = req.nextUrl
  const janelaDias = Number(searchParams.get('janela') ?? '90')

  const [contratos, vigenciasRows] = await Promise.all([
    prisma.contrato.findMany({
      where: { cancelled_at: null },
      select: {
        id: true, indice: true, ano_referencia: true, classificacao: true, estado: true,
        data_inicio: true, data_fim: true, valor_contrato: true,
        cliente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        hh_cancelado_at: true,
        hh_lancamentos: { orderBy: { versao: 'desc' }, take: 1, select: { meses: { select: { hh_previsto: true } } } },
        hh_realizados: { select: { hh_realizado: true } },
        parada_hh_config: { include: { dias: true } },
        fabricacao_itens: {
          where: { deleted_at: null },
          select: {
            id: true, descricao: true,
            meses: { select: { hh_orcado: true, hh_previsto: true, peso_previsto: true } },
            realizados: { select: { hh_realizado: true, peso_realizado: true } },
          },
        },
        subindices: {
          where: { deleted_at: null },
          select: { valor_total: true, notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { valor_atribuido: true } } },
        },
      },
    }),
    prisma.ucrFaixaVigencia.findMany(),
  ])
  const vigencias = vigenciasRows.map((v) => ({
    ...v,
    vigencia_inicio: v.vigencia_inicio.toISOString(), vigencia_fim: v.vigencia_fim.toISOString(),
    ucr_nao_suficiente: Number(v.ucr_nao_suficiente), ucr_a_evoluir: Number(v.ucr_a_evoluir),
    ucr_bom: Number(v.ucr_bom), ucr_otimo: Number(v.ucr_otimo), ucr_esplendido: Number(v.ucr_esplendido),
  }))

  // ── CTR-01: carteira ativa ─────────────────────────────────────────────────
  const ativos = contratos.filter((c) => c.hh_cancelado_at == null)
  const porClassif = new Map<string, { contratos: number; valor: number }>()
  const porResponsavel = new Map<string, { nome: string; contratos: number; valor: number }>()
  for (const c of ativos) {
    const valor = Number(c.valor_contrato ?? c.subindices.reduce((a, s) => a + Number(s.valor_total), 0))
    if (c.classificacao) {
      const e = porClassif.get(c.classificacao) ?? { contratos: 0, valor: 0 }
      e.contratos++; e.valor += valor
      porClassif.set(c.classificacao, e)
    }
    const respKey = c.responsavel ? String(c.responsavel.id) : 'none'
    const respNome = c.responsavel?.nome ?? 'Não atribuído'
    const r = porResponsavel.get(respKey) ?? { nome: respNome, contratos: 0, valor: 0 }
    r.contratos++; r.valor += valor
    porResponsavel.set(respKey, r)
  }

  // ── CTR-02: aderência de HH (Obras + Paradas) ─────────────────────────────
  type HhRow = { id: number; indice: string; cliente: string; classificacao: string | null; previsto: number; realizado: number; desvio_pct: number | null }
  const hhRows: HhRow[] = []
  for (const c of ativos) {
    if (c.classificacao === 'OBRAS') {
      const previsto = c.hh_lancamentos[0]?.meses.reduce((s, m) => s + (m.hh_previsto ?? 0), 0) ?? 0
      const realizado = c.hh_realizados.reduce((s, r) => s + r.hh_realizado, 0)
      if (previsto > 0 || realizado > 0) {
        hhRows.push({ id: c.id, indice: c.indice, cliente: c.cliente.nome, classificacao: c.classificacao, previsto, realizado, desvio_pct: previsto > 0 ? ((realizado - previsto) / previsto) * 100 : null })
      }
    } else if (c.classificacao === 'PARADAS' && c.parada_hh_config) {
      const { hhTotalPrev, hhTotalReal } = calcParadaHhTotais(c.parada_hh_config)
      if (hhTotalPrev > 0 || hhTotalReal > 0) {
        hhRows.push({ id: c.id, indice: c.indice, cliente: c.cliente.nome, classificacao: c.classificacao, previsto: hhTotalPrev, realizado: hhTotalReal, desvio_pct: hhTotalPrev > 0 ? ((hhTotalReal - hhTotalPrev) / hhTotalPrev) * 100 : null })
      }
    }
  }

  // ── CTR-03: avanço de fabricação (por item) ───────────────────────────────
  // R$/kg não entra aqui: o valor do contrato fica no sub-índice de Faturamento
  // e o peso fica no item de Controle de HH — não há uma ligação item-a-item
  // entre os dois lados hoje, então dividir o valor do contrato pelos itens
  // daria um R$/kg artificial. Fica só o avanço físico (peso) e de HH.
  type FabRow = { contrato_id: number; indice: string; cliente: string; item: string; hh_orcado: number; hh_previsto: number; hh_realizado: number; peso_previsto: number; peso_realizado: number; pct_avanco: number }
  const fabRows: FabRow[] = []
  for (const c of ativos) {
    if (c.classificacao !== 'FABRICACOES' && c.classificacao !== 'OLEO_GAS') continue
    for (const item of c.fabricacao_itens) {
      const hhOrcado = item.meses.reduce((a, m) => a + (m.hh_orcado ?? 0), 0)
      const hhPrevisto = item.meses.reduce((a, m) => a + (m.hh_previsto ?? 0), 0)
      const pesoPrevisto = item.meses.reduce((a, m) => a + Number(m.peso_previsto ?? 0), 0)
      const hhRealizado = item.realizados.reduce((a, r) => a + (r.hh_realizado ?? 0), 0)
      const pesoRealizado = item.realizados.reduce((a, r) => a + Number(r.peso_realizado ?? 0), 0)
      if (hhPrevisto === 0 && hhRealizado === 0 && pesoPrevisto === 0) continue
      fabRows.push({
        contrato_id: c.id, indice: c.indice, cliente: c.cliente.nome, item: item.descricao,
        hh_orcado: hhOrcado, hh_previsto: hhPrevisto, hh_realizado: hhRealizado,
        peso_previsto: pesoPrevisto, peso_realizado: pesoRealizado,
        pct_avanco: pesoPrevisto > 0 ? (pesoRealizado / pesoPrevisto) * 100 : 0,
      })
    }
  }

  // ── CTR-04: R$/HH por contrato de Parada (UCR) ────────────────────────────
  type UcrRow = { id: number; indice: string; cliente: string; regiao: string; rs_hh: number | null; classificacao_ucr: string | null }
  const ucrRows: UcrRow[] = []
  const ucrContagem: Record<string, number> = { 'Não Suficiente': 0, 'A Evoluir': 0, Bom: 0, Ótimo: 0, Esplêndido: 0 }
  for (const c of ativos) {
    if (c.classificacao !== 'PARADAS' || !c.parada_hh_config) continue
    const cfg = c.parada_hh_config
    const { hhTotalReal } = calcParadaHhTotais(cfg)
    if (hhTotalReal <= 0) continue
    const valorFaturado = c.subindices.reduce((a, s) => a + s.notas_fiscais.reduce((b, nf) => b + Number(nf.valor_atribuido), 0), 0)
    const rsHH = valorFaturado > 0 ? valorFaturado / hhTotalReal : null
    const dataRef = cfg.parada_inicio ?? c.data_inicio
    const regiao = regiaoPorEstado(c.estado)
    const faixa = dataRef ? resolverVigencia(vigencias, regiao, dataRef) : null
    const classif = classificarUcr(rsHH, faixa)
    if (classif) ucrContagem[classif] = (ucrContagem[classif] ?? 0) + 1
    ucrRows.push({ id: c.id, indice: c.indice, cliente: c.cliente.nome, regiao, rs_hh: rsHH, classificacao_ucr: classif })
  }

  // ── CTR-05: contratos encerrando (radar de renovação) ─────────────────────
  const hoje = new Date()
  const limite = new Date(hoje.getTime() + janelaDias * 86_400_000)
  const encerrando = ativos.filter((c) => c.data_fim && c.data_fim >= hoje && c.data_fim <= limite)
  const clienteIdsEncerrando = Array.from(new Set(encerrando.map((c) => c.cliente.id)))
  const pipelineDoCliente = clienteIdsEncerrando.length
    ? await prisma.solicitacao.groupBy({
        by: ['cliente_id'],
        where: { cliente_id: { in: clienteIdsEncerrando }, cancelled_at: null, status: { in: ['EM_ELABORACAO', 'PROPOSTA_ENVIADA'] } },
        _count: { _all: true },
      })
    : []
  const pipelineMap = new Map(pipelineDoCliente.map((p) => [p.cliente_id, p._count._all]))

  const totalContratosComFim = ativos.filter((c) => c.data_fim != null).length

  const data = {
    filtros: {
      responsaveis: Array.from(new Map(ativos.filter((c) => c.responsavel).map((c) => [c.responsavel!.id, c.responsavel!.nome])).entries()).map(([id, nome]) => ({ id, nome })),
    },

    ctr01_carteira: {
      total_contratos: ativos.length,
      valor_total: Array.from(porClassif.values()).reduce((a, b) => a + b.valor, 0),
      por_classificacao: Array.from(porClassif.entries()).map(([classificacao, v]) => ({ classificacao, ...v })).sort((a, b) => b.valor - a.valor),
      por_responsavel: Array.from(porResponsavel.values()).sort((a, b) => b.valor - a.valor),
    },

    ctr02_hh: hhRows.sort((a, b) => Math.abs(b.desvio_pct ?? 0) - Math.abs(a.desvio_pct ?? 0)),

    ctr03_fabricacao: fabRows.sort((a, b) => a.pct_avanco - b.pct_avanco),

    ctr04_ucr: {
      contagem_por_faixa: ucrContagem,
      contratos: ucrRows.sort((a, b) => (a.rs_hh ?? 0) - (b.rs_hh ?? 0)),
    },

    ctr05_encerrando: {
      janela_dias: janelaDias,
      cobertura: `${totalContratosComFim} de ${ativos.length} contratos ativos têm data de encerramento preenchida`,
      contratos: encerrando.map((c) => ({
        id: c.id, indice: c.indice, cliente: c.cliente.nome, classificacao: c.classificacao,
        data_fim: c.data_fim!.toISOString(),
        dias_restantes: Math.ceil((c.data_fim!.getTime() - hoje.getTime()) / 86_400_000),
        propostas_em_andamento_mesmo_cliente: pipelineMap.get(c.cliente.id) ?? 0,
      })).sort((a, b) => a.dias_restantes - b.dias_restantes),
    },
  }

  return NextResponse.json({ data, error: null })
}
