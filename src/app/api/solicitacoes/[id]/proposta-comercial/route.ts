import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { exigirTitularSolicitacao } from '@/lib/permissaoApi'

const schemaPost = z.object({
  nao_aplicavel: z.boolean().optional(),
  proposta_tecnica_id: z.number().int().positive().optional(),
  // Obras/padrão: breakdown detalhado
  valor_montagem_mecanica: z.number().min(0).optional(),
  possui_terceiros: z.boolean().default(false),
  valor_eletrica: z.number().min(0).optional(),
  valor_isolamento: z.number().min(0).optional(),
  valor_civil: z.number().min(0).optional(),
  valor_hidraulica: z.number().min(0).optional(),
  valor_fibra: z.number().min(0).optional(),
  valor_tijolo_antiacido: z.number().min(0).optional(),
  valor_outros_terceiros: z.number().min(0).optional(),
  possui_fabricacao: z.boolean().default(false),
  valor_fabricacao: z.number().min(0).optional(),
  peso_fabricacao: z.number().min(0).optional(),
  // Paradas: valor total direto + terceiros opcionais
  valor_total_direto: z.number().min(0).optional(),
  valor_terceiros: z.number().min(0).optional(),
  data_base: z.string().optional(),
  data_envio: z.string().optional(),
})

const schemaPatch = z.object({
  resultado: z.enum(['AGUARDANDO', 'GANHOU', 'PERDEU']),
  motivo_perda: z.enum(['PRECO', 'PRAZO', 'ESCOPO', 'CONCORRENCIA', 'CLIENTE_DESISTIU', 'OUTRO']).optional(),
  justificativa: z.string().trim().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.proposta.enviar'); if (_n) return _n }

  const body = await req.json()
  const parsed = schemaPatch.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // RN-17: motivo obrigatório quando resultado = PERDEU
  if (parsed.data.resultado === 'PERDEU' && !parsed.data.motivo_perda) {
    return NextResponse.json(
      { data: null, error: 'Motivo de perda é obrigatório' },
      { status: 400 },
    )
  }

  const latestComercial = await prisma.propostaComercial.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latestComercial) {
    return NextResponse.json(
      { data: null, error: 'Nenhuma proposta comercial encontrada para esta solicitação' },
      { status: 404 },
    )
  }

  const resultado_anterior = latestComercial.resultado
  // Re-alteração de resultado já definido (Ganhou/Perdeu → outro) exige justificativa,
  // registrada no histórico de alterações.
  const reAlteracao = (resultado_anterior === 'GANHOU' || resultado_anterior === 'PERDEU') &&
    resultado_anterior !== parsed.data.resultado
  if (reAlteracao && (!parsed.data.justificativa || parsed.data.justificativa.length < 5)) {
    return NextResponse.json(
      { data: null, error: 'Justificativa obrigatória para alterar um resultado já definido (mín. 5 caracteres)' },
      { status: 400 },
    )
  }
  const result = await prisma.$transaction(async (tx) => {
    const comercial = await tx.propostaComercial.update({
      where: { id: latestComercial.id },
      data: {
        resultado: parsed.data.resultado,
        motivo_perda: parsed.data.resultado === 'PERDEU' ? (parsed.data.motivo_perda ?? null) : null,
      },
    })
    if (parsed.data.resultado === 'GANHOU') {
      await tx.solicitacao.update({
        where: { id },
        data: { status: 'CONTRATO_GANHO' },
      })
    }
    // Mudou o resultado depois de gravado o Relatorio de OS -> limpa (deve ser refeito)
    if (resultado_anterior !== parsed.data.resultado) {
      await tx.relatorioOS.deleteMany({ where: { solicitacao_id: id } })
    }
    return comercial
  })

  // Log resultado change
  if (resultado_anterior !== parsed.data.resultado) {
    const RESULTADO_LABELS: Record<string, string> = { AGUARDANDO: 'Aguardando', GANHOU: 'Ganhou', PERDEU: 'Perdeu' }
    const rev = `Rev${String(latestComercial.versao).padStart(2, '0')}`
    const userId = Number(session.user.id)
    const just = reAlteracao && parsed.data.justificativa ? ` — Justificativa: ${parsed.data.justificativa}` : ''
    const msg = (parsed.data.resultado === 'PERDEU' && parsed.data.motivo_perda
      ? `Resultado: ${RESULTADO_LABELS[resultado_anterior ?? ''] ?? resultado_anterior} → ${RESULTADO_LABELS[parsed.data.resultado]} (${parsed.data.motivo_perda})`
      : `Resultado: ${RESULTADO_LABELS[resultado_anterior ?? ''] ?? resultado_anterior} → ${RESULTADO_LABELS[parsed.data.resultado]}`) + just
    const valorPara = (parsed.data.resultado === 'PERDEU' && parsed.data.motivo_perda
      ? `${RESULTADO_LABELS[parsed.data.resultado]} — Motivo: ${parsed.data.motivo_perda}`
      : RESULTADO_LABELS[parsed.data.resultado]) + just

    await Promise.all([
      prisma.solicitacaoInfo.create({
        data: { solicitacao_id: id, data: new Date(), comentario: `[Resultado ${rev}] ${msg}`, versao: latestComercial.versao, created_by: userId },
      }),
      prisma.historicoSolicitacao.create({
        data: { solicitacao_id: id, campo: `Resultado da Proposta Comercial ${rev}`, valor_de: RESULTADO_LABELS[resultado_anterior ?? ''] ?? resultado_anterior ?? '—', valor_para: valorPara, created_by: userId },
      }),
    ])
  }

  // RN-50: Notificar GESTAO_ACORDOS quando resultado = GANHOU (não-bloqueante)
  if (parsed.data.resultado === 'GANHOU') {
    const sol = await prisma.solicitacao.findUnique({
      where: { id },
      select: { numero: true, cliente: { select: { nome: true } } },
    })
    const gestores = await prisma.user.findMany({
      where: { perfil: 'GESTAO_ACORDOS', ativo: true },
      select: { id: true },
    })
    for (const g of gestores) {
      createNotificacao(
        g.id,
        `Contrato ganho — ${sol?.numero ?? id}`,
        `Solicitação ${sol?.numero ?? id} (${sol?.cliente?.nome ?? ''}) marcada como Ganhou. Acesse Acordos para iniciar o contrato.`,
        `/orcamentos/solicitacoes/${id}`,
      )
    }
  }

  return NextResponse.json({ data: result, error: null })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.proposta.enviar'); if (_n) return _n }

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1 },
      propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1 },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const naoAplicavel = d.nao_aplicavel === true

  // Resolve proposta_tecnica_id: use provided, else auto-use latest técnica
  let tecnicaId: number | null = d.proposta_tecnica_id ?? null
  if (!naoAplicavel) {
    if (!tecnicaId) {
      return NextResponse.json({ data: null, error: 'Selecione a proposta técnica de referência' }, { status: 400 })
    }
    // Validate técnica belongs to this solicitação
    const tecnica = await prisma.propostaTecnica.findFirst({
      where: { id: tecnicaId, solicitacao_id: id },
    })
    if (!tecnica) {
      return NextResponse.json({ data: null, error: 'Proposta técnica não encontrada para esta solicitação' }, { status: 400 })
    }
  } else {
    // N/A comercial: auto-reference the latest técnica if available
    tecnicaId = sol.propostas_tecnicas[0]?.id ?? null
  }

  const maxVersaoCom = sol.propostas_comerciais[0]?.versao ?? 0
  const maxVersaoTecnica = sol.propostas_tecnicas[0]?.versao ?? 0
  const revisaoEsperada = Math.max(sol.revisao_esperada, maxVersaoTecnica)
  // If a comercial already exists for the current revision, update it (don't create a new revision).
  const existingComForRevision = sol.propostas_comerciais.find(pc => pc.versao === revisaoEsperada) ?? null
  const versaoFinal = revisaoEsperada

  let valorTotalGeral: number | null = null
  if (!naoAplicavel) {
    if (d.valor_total_direto !== undefined) {
      valorTotalGeral = d.valor_total_direto
    } else {
      const totalTerceiros = d.possui_terceiros
        ? (d.valor_eletrica ?? 0) + (d.valor_isolamento ?? 0) + (d.valor_civil ?? 0)
          + (d.valor_hidraulica ?? 0) + (d.valor_fibra ?? 0) + (d.valor_tijolo_antiacido ?? 0)
          + (d.valor_outros_terceiros ?? 0)
        : 0
      valorTotalGeral = (d.valor_montagem_mecanica ?? 0) + totalTerceiros + (d.possui_fabricacao ? (d.valor_fabricacao ?? 0) : 0)
    }
  }

  const comData = {
    proposta_tecnica_id: tecnicaId,
    nao_aplicavel: naoAplicavel,
    valor_montagem_mecanica: naoAplicavel ? null : (d.valor_montagem_mecanica ?? null),
    possui_terceiros: naoAplicavel ? false : d.possui_terceiros,
    valor_eletrica: (!naoAplicavel && d.possui_terceiros) ? (d.valor_eletrica ?? null) : null,
    valor_isolamento: (!naoAplicavel && d.possui_terceiros) ? (d.valor_isolamento ?? null) : null,
    valor_civil: (!naoAplicavel && d.possui_terceiros) ? (d.valor_civil ?? null) : null,
    valor_hidraulica: (!naoAplicavel && d.possui_terceiros) ? (d.valor_hidraulica ?? null) : null,
    valor_fibra: (!naoAplicavel && d.possui_terceiros) ? (d.valor_fibra ?? null) : null,
    valor_tijolo_antiacido: (!naoAplicavel && d.possui_terceiros) ? (d.valor_tijolo_antiacido ?? null) : null,
    valor_outros_terceiros: (!naoAplicavel && d.possui_terceiros) ? (d.valor_outros_terceiros ?? null) : null,
    possui_fabricacao: naoAplicavel ? false : d.possui_fabricacao,
    valor_fabricacao: (!naoAplicavel && d.possui_fabricacao) ? (d.valor_fabricacao ?? null) : null,
    peso_fabricacao: (!naoAplicavel && d.possui_fabricacao) ? (d.peso_fabricacao ?? null) : null,
    valor_terceiros: naoAplicavel ? null : (d.valor_terceiros ?? null),
    valor_total: valorTotalGeral,
    data_base: d.data_base ? new Date(d.data_base) : null,
    data_envio: d.data_envio ? new Date(d.data_envio) : new Date(),
  }

  try {
    const [proposta] = await prisma.$transaction([
      existingComForRevision
        ? prisma.propostaComercial.update({
            where: { id: existingComForRevision.id },
            data: comData,
          })
        : prisma.propostaComercial.create({
            data: { solicitacao_id: id, versao: versaoFinal, ...comData, created_by: Number(session.user.id) },
          }),
      // Submitting comercial (normal or N/A) always finalizes the revision
      prisma.solicitacao.update({
        where: { id },
        data: { status: 'PROPOSTA_ENVIADA' },
      }),
    ])

    // RN-50: Notificar ADM_COMERCIAL sobre nova proposta comercial (não-bloqueante)
    const admins = await prisma.user.findMany({
      where: { perfil: 'ADM_COMERCIAL', ativo: true },
      select: { id: true },
    })
    const linkSol = `/orcamentos/solicitacoes/${id}`
    for (const admin of admins) {
      createNotificacao(
        admin.id,
        `Proposta comercial enviada — ${sol.numero}`,
        `Rev${String(versaoFinal - 1).padStart(2, '0')} registrada${naoAplicavel ? ' (N/A)' : ''}.`,
        linkSol,
      )
    }

    return NextResponse.json({ data: proposta, error: null }, { status: 201 })
  } catch (err) {
    logger.error('[POST /api/solicitacoes/[id]/proposta-comercial]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.proposta.enviar'); if (_n) return _n }

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const latest = await prisma.propostaComercial.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta comercial encontrada' }, { status: 404 })
  }

  const d = parsed.data
  let valorTotalGeral: number
  if (d.valor_total_direto !== undefined) {
    valorTotalGeral = d.valor_total_direto
  } else {
    const totalTerceiros = d.possui_terceiros
      ? (d.valor_eletrica ?? 0) + (d.valor_isolamento ?? 0) + (d.valor_civil ?? 0)
        + (d.valor_hidraulica ?? 0) + (d.valor_fibra ?? 0) + (d.valor_tijolo_antiacido ?? 0)
        + (d.valor_outros_terceiros ?? 0)
      : 0
    valorTotalGeral = (d.valor_montagem_mecanica ?? 0) + totalTerceiros + (d.possui_fabricacao ? (d.valor_fabricacao ?? 0) : 0)
  }

  const proposta = await prisma.propostaComercial.update({
    where: { id: latest.id },
    data: {
      proposta_tecnica_id: d.proposta_tecnica_id,
      valor_montagem_mecanica: d.valor_montagem_mecanica ?? null,
      possui_terceiros: d.possui_terceiros,
      valor_eletrica: d.possui_terceiros ? (d.valor_eletrica ?? null) : null,
      valor_isolamento: d.possui_terceiros ? (d.valor_isolamento ?? null) : null,
      valor_civil: d.possui_terceiros ? (d.valor_civil ?? null) : null,
      valor_fibra: d.possui_terceiros ? (d.valor_fibra ?? null) : null,
      valor_outros_terceiros: d.possui_terceiros ? (d.valor_outros_terceiros ?? null) : null,
      possui_fabricacao: d.possui_fabricacao,
      valor_fabricacao: d.possui_fabricacao ? (d.valor_fabricacao ?? null) : null,
      valor_terceiros: d.valor_terceiros ?? null,
      valor_total: valorTotalGeral,
      data_base: d.data_base ? new Date(d.data_base) : latest.data_base,
      data_envio: d.data_envio ? new Date(d.data_envio) : latest.data_envio,
    },
  })

  // Log changes
  const fmtVal = (v: number | null | undefined) => v != null ? `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
  const comDiffs: string[] = []
  const numPairs: [string, number | null, number | null][] = [
    ['Valor Mont.', latest.valor_montagem_mecanica ? Number(latest.valor_montagem_mecanica) : null, d.valor_montagem_mecanica ?? null],
    ['Total Geral', latest.valor_total ? Number(latest.valor_total) : null, valorTotalGeral],
    ['Val. Terceiros', latest.valor_terceiros ? Number(latest.valor_terceiros) : null, d.valor_terceiros ?? null],
    ['Val. Fabricação', latest.valor_fabricacao ? Number(latest.valor_fabricacao) : null, d.possui_fabricacao ? (d.valor_fabricacao ?? null) : null],
  ]
  for (const [label, before, after] of numPairs) {
    const a = before != null ? Math.round(Number(before) * 100) : null
    const b = after  != null ? Math.round(Number(after)  * 100) : null
    if (a !== b) comDiffs.push(`${label}: ${fmtVal(before)} → ${fmtVal(after)}`)
  }
  if ((latest.data_envio?.toISOString().split('T')[0] ?? '') !== (d.data_envio ?? ''))
    comDiffs.push(`Data Envio: ${latest.data_envio?.toISOString().split('T')[0] ?? '—'} → ${d.data_envio ?? '—'}`)

  if (comDiffs.length > 0) {
    const rev = `Rev${String(latest.versao).padStart(2, '0')}`
    const userId = Number(session.user.id)

    type HistEntry = { solicitacao_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }
    const histEntries: HistEntry[] = []

    for (const [label, before, after] of numPairs) {
      const a = before != null ? Math.round(Number(before) * 100) : null
      const b = after  != null ? Math.round(Number(after)  * 100) : null
      if (a !== b) histEntries.push({ solicitacao_id: id, campo: `Proposta Comercial ${rev} — ${label}`, valor_de: before != null ? fmtVal(before) : null, valor_para: after != null ? fmtVal(after) : null, created_by: userId })
    }
    if ((latest.data_envio?.toISOString().split('T')[0] ?? '') !== (d.data_envio ?? ''))
      histEntries.push({ solicitacao_id: id, campo: `Proposta Comercial ${rev} — Data Envio Comercial`, valor_de: latest.data_envio?.toISOString().split('T')[0] ?? null, valor_para: d.data_envio ?? null, created_by: userId })

    await Promise.all([
      prisma.solicitacaoInfo.create({
        data: { solicitacao_id: id, data: new Date(), comentario: `[Edição Comercial ${rev}] ${comDiffs.join(' | ')}`, versao: latest.versao, created_by: userId },
      }),
      histEntries.length > 0 ? prisma.historicoSolicitacao.createMany({ data: histEntries }) : Promise.resolve(),
    ])
  }

  return NextResponse.json({ data: proposta, error: null })
}
