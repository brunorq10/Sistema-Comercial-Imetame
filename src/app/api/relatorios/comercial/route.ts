import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const DIA_MS = 86_400_000
const MOTIVO_REPROVACAO_LABELS: Record<string, string> = {
  VOLUME_ADJUDICADO: 'Volume já adjudicado',
  FORA_LINHA_FORNECIMENTO: 'Fora da linha de fornecimento',
  INDISPONIBILIDADE_MO: 'Indisponibilidade de mão de obra',
  SEM_SERVICO_LOCAL: 'Sem serviço local',
  LIMITACAO_EQUIPAMENTOS: 'Limitação de equipamentos',
  DIFICULDADE_PARCERIA: 'Dificuldade de parceria',
  OUTROS: 'Outros',
}
const MOTIVO_PERDA_LABELS: Record<string, string> = {
  PRECO: 'Preço', PRAZO: 'Prazo', ESCOPO: 'Escopo',
  CONCORRENCIA: 'Concorrência', CLIENTE_DESISTIU: 'Cliente desistiu', OUTRO: 'Outro',
}

// GET /api/relatorios/comercial — COM-01..06 (funil, atrasadas, motivos,
// desempenho por orçamentista, pipeline em valor, ciclo comercial)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const { searchParams } = req.nextUrl
  const de   = searchParams.get('de')   ?? undefined
  const ate  = searchParams.get('ate')  ?? undefined
  const classificacao = searchParams.get('classificacao') ?? undefined

  const multi = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : [])
  const classifList = multi(classificacao)

  const [clientes, orcamentistas] = await Promise.all([
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.user.findMany({ where: { ativo: true, solicitacoes_atribuidas: { some: {} } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])

  const where = {
    cancelled_at: null,
    ...(classifList.length && { classificacao: { in: classifList as never[] } }),
    ...((de || ate) && {
      data_recebimento: { ...(de && { gte: new Date(de) }), ...(ate && { lte: new Date(`${ate}T23:59:59`) }) },
    }),
  }

  const items = await prisma.solicitacao.findMany({
    where,
    select: {
      id: true, status: true, status_analise: true, classificacao: true, interesse: true,
      motivo_reprovacao: true, data_recebimento: true, created_at: true, data_atribuicao: true,
      prazo_comercial: true, prazo_comercial_indeterminado: true,
      orcamentista: { select: { id: true, nome: true } },
      propostas_tecnicas: {
        select: { data_envio: true, nao_aplicavel: true },
        orderBy: { versao: 'desc' }, take: 1,
      },
      propostas_comerciais: {
        select: { valor_total: true, data_envio: true, resultado: true, motivo_perda: true, nao_aplicavel: true },
        orderBy: { versao: 'desc' }, take: 1,
      },
      propostas_fabricacao: {
        select: { valor_total: true, data_envio: true, resultado: true, motivo_perda: true },
        orderBy: { versao: 'desc' }, take: 1,
      },
    },
  })

  // ── COM-01: funil por status ──────────────────────────────────────────────
  const funil = { AGUARDANDO_ANALISE: 0, EM_ELABORACAO: 0, PROPOSTA_ENVIADA: 0, CONTRATO_GANHO: 0, RECUSADA: 0 }
  let emElaboracaoTecPendente = 0

  // ── COM-02: propostas paradas/atrasadas ───────────────────────────────────
  const atrasadas: Array<{ id: number; classificacao: string | null; orcamentista: string | null; dias_atraso: number }> = []

  // ── COM-03: motivos ────────────────────────────────────────────────────────
  const porMotivoReprovacao: Record<string, number> = {}
  const porMotivoPerda: Record<string, number> = {}

  // ── COM-04: desempenho por orçamentista ───────────────────────────────────
  const orcMap = new Map<number, { id: number; nome: string; em_carteira: number; enviadas: number; no_prazo: number; ganhas: number; valor_ganho: number }>()

  // ── COM-05: pipeline em valor ──────────────────────────────────────────────
  let pipelineTotal = 0
  const pipelinePorClassif = new Map<string, number>()
  const pipelinePorInteresse = { ALTO: 0, MEDIO: 0, BAIXO: 0 }
  const pipelineMaiores: Array<{ id: number; classificacao: string | null; interesse: string | null; valor: number }> = []

  // ── COM-06: ciclo comercial ────────────────────────────────────────────────
  let somaPrazoCiclo = 0, nPrazoCiclo = 0
  const cicloPorClassif = new Map<string, { soma: number; n: number }>()

  const now = new Date()

  for (const s of items) {
    const isFab = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'
    const tec = s.propostas_tecnicas[0] ?? null
    const com = s.propostas_comerciais[0] ?? null
    const fab = s.propostas_fabricacao[0] ?? null

    const valor = isFab ? (fab?.valor_total != null ? Number(fab.valor_total) : null) : (com?.valor_total != null ? Number(com.valor_total) : null)
    const resultado = isFab ? (fab?.resultado ?? null) : (com?.resultado ?? null)
    const dataEnvioComercial = isFab ? (fab?.data_envio ?? null) : (com?.data_envio ?? null)
    const motivoPerda = isFab ? fab?.motivo_perda : com?.motivo_perda

    // COM-01
    if (s.status in funil) funil[s.status as keyof typeof funil]++
    if (s.status === 'EM_ELABORACAO') {
      const tecOk = tec ? (!!tec.data_envio || tec.nao_aplicavel) : false
      if (!tecOk) emElaboracaoTecPendente++
    }

    // COM-02: só solicitações ainda em andamento (aprovadas, sem resultado final)
    if (s.status_analise === 'APROVADA' && dataEnvioComercial == null && s.status !== 'CANCELADA' && s.status !== 'RECUSADA') {
      const prazoRef = s.prazo_comercial
      if (!s.prazo_comercial_indeterminado && prazoRef && prazoRef < now) {
        atrasadas.push({
          id: s.id, classificacao: s.classificacao,
          orcamentista: s.orcamentista?.nome ?? null,
          dias_atraso: Math.floor((now.getTime() - prazoRef.getTime()) / DIA_MS),
        })
      }
    }

    // COM-03
    if (s.motivo_reprovacao) porMotivoReprovacao[s.motivo_reprovacao] = (porMotivoReprovacao[s.motivo_reprovacao] ?? 0) + 1
    if (resultado === 'PERDEU' && motivoPerda) porMotivoPerda[motivoPerda] = (porMotivoPerda[motivoPerda] ?? 0) + 1

    // COM-04
    if (s.orcamentista) {
      const row = orcMap.get(s.orcamentista.id) ?? { id: s.orcamentista.id, nome: s.orcamentista.nome, em_carteira: 0, enviadas: 0, no_prazo: 0, ganhas: 0, valor_ganho: 0 }
      if (s.status !== 'RECUSADA' && s.status !== 'CANCELADA') row.em_carteira++
      if (dataEnvioComercial != null) {
        row.enviadas++
        const noPrazo = s.prazo_comercial_indeterminado || s.prazo_comercial == null || dataEnvioComercial <= s.prazo_comercial
        if (noPrazo) row.no_prazo++
      }
      if (resultado === 'GANHOU') { row.ganhas++; row.valor_ganho += valor ?? 0 }
      orcMap.set(s.orcamentista.id, row)
    }

    // COM-05: enviada, aguardando resultado
    const enviadaAguardando = dataEnvioComercial != null && (resultado === 'AGUARDANDO' || resultado == null) && valor != null
    if (enviadaAguardando && valor != null) {
      pipelineTotal += valor
      if (s.classificacao) pipelinePorClassif.set(s.classificacao, (pipelinePorClassif.get(s.classificacao) ?? 0) + valor)
      if (s.interesse && s.interesse in pipelinePorInteresse) pipelinePorInteresse[s.interesse as keyof typeof pipelinePorInteresse] += valor
      pipelineMaiores.push({ id: s.id, classificacao: s.classificacao, interesse: s.interesse, valor })
    }

    // COM-06: ciclo — do recebimento/atribuição até o envio comercial
    if (dataEnvioComercial != null) {
      const ref = s.data_atribuicao ?? s.data_recebimento ?? s.created_at
      const d = (dataEnvioComercial.getTime() - ref.getTime()) / DIA_MS
      if (d >= 0) {
        somaPrazoCiclo += d; nPrazoCiclo++
        if (s.classificacao) {
          const c = cicloPorClassif.get(s.classificacao) ?? { soma: 0, n: 0 }
          c.soma += d; c.n++
          cicloPorClassif.set(s.classificacao, c)
        }
      }
    }
  }

  const data = {
    filtros: { clientes, orcamentistas },

    com01_funil: {
      aguardando_analise: funil.AGUARDANDO_ANALISE,
      em_elaboracao: funil.EM_ELABORACAO,
      em_elaboracao_tecnica_pendente: emElaboracaoTecPendente,
      proposta_enviada: funil.PROPOSTA_ENVIADA,
      contrato_ganho: funil.CONTRATO_GANHO,
      recusada: funil.RECUSADA,
    },

    com02_atrasadas: atrasadas.sort((a, b) => b.dias_atraso - a.dias_atraso),

    com03_motivos: {
      reprovacao: Object.entries(porMotivoReprovacao)
        .map(([motivo, total]) => ({ motivo, label: MOTIVO_REPROVACAO_LABELS[motivo] ?? motivo, total }))
        .sort((a, b) => b.total - a.total),
      perda: Object.entries(porMotivoPerda)
        .map(([motivo, total]) => ({ motivo, label: MOTIVO_PERDA_LABELS[motivo] ?? motivo, total }))
        .sort((a, b) => b.total - a.total),
    },

    com04_orcamentistas: Array.from(orcMap.values())
      .map((r) => ({ ...r, pct_no_prazo: r.enviadas > 0 ? (r.no_prazo / r.enviadas) * 100 : 0, ticket_medio: r.ganhas > 0 ? r.valor_ganho / r.ganhas : 0 }))
      .sort((a, b) => b.valor_ganho - a.valor_ganho),

    com05_pipeline: {
      total: pipelineTotal,
      por_classificacao: Array.from(pipelinePorClassif.entries()).map(([classificacao, valor]) => ({ classificacao, valor })).sort((a, b) => b.valor - a.valor),
      por_interesse: pipelinePorInteresse,
      maiores: pipelineMaiores.sort((a, b) => b.valor - a.valor).slice(0, 8),
    },

    com06_ciclo: {
      media_geral: nPrazoCiclo > 0 ? somaPrazoCiclo / nPrazoCiclo : null,
      por_classificacao: Array.from(cicloPorClassif.entries())
        .map(([classificacao, v]) => ({ classificacao, media_dias: v.n > 0 ? v.soma / v.n : 0 }))
        .sort((a, b) => a.media_dias - b.media_dias),
    },
  }

  return NextResponse.json({ data, error: null })
}
