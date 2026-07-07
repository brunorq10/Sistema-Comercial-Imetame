import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { exigirTitularSolicitacao } from '@/lib/permissaoApi'

const schemaEquipamento = z.object({
  descricao: z.string().min(1),
  peso_ton: z.number().positive(),
  valor_total: z.number().min(0),
  hh_previsto: z.number().int().min(0).optional(),
  observacoes: z.string().optional(),
})

const schemaPost = z.object({
  equipamentos: z.array(schemaEquipamento).min(1),
  possui_testes: z.boolean().default(false),
  descricao_testes: z.string().optional(),
  valor_testes: z.number().min(0).optional(),
  possui_montagem: z.boolean().default(false),
  valor_montagem: z.number().min(0).optional(),
  data_base: z.string().optional(),
  data_envio: z.string().min(1),
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
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  if (parsed.data.resultado === 'PERDEU' && !parsed.data.motivo_perda) {
    return NextResponse.json({ data: null, error: 'Motivo de perda é obrigatório' }, { status: 400 })
  }

  const latest = await prisma.propostaFabricacao.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta de fabricação encontrada' }, { status: 404 })
  }

  const resultado_anterior = latest.resultado
  // Re-alteração de resultado já definido (Ganhou/Perdeu → outro) exige justificativa
  const reAlteracao = (resultado_anterior === 'GANHOU' || resultado_anterior === 'PERDEU') &&
    resultado_anterior !== parsed.data.resultado
  if (reAlteracao && (!parsed.data.justificativa || parsed.data.justificativa.length < 5)) {
    return NextResponse.json(
      { data: null, error: 'Justificativa obrigatória para alterar um resultado já definido (mín. 5 caracteres)' },
      { status: 400 },
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const fab = await tx.propostaFabricacao.update({
      where: { id: latest.id },
      data: {
        resultado: parsed.data.resultado,
        motivo_perda: parsed.data.resultado === 'PERDEU' ? (parsed.data.motivo_perda ?? null) : null,
      },
    })
    if (parsed.data.resultado === 'GANHOU') {
      await tx.solicitacao.update({ where: { id }, data: { status: 'CONTRATO_GANHO' } })
    }
    return fab
  })

  // Log resultado change in HistoricoSolicitacao
  if (resultado_anterior !== parsed.data.resultado) {
    const RESULTADO_LABELS: Record<string, string> = { AGUARDANDO: 'Aguardando', GANHOU: 'Ganhou', PERDEU: 'Perdeu' }
    const rev = `Rev${String(latest.versao).padStart(2, '0')}`
    const just = reAlteracao && parsed.data.justificativa ? ` — Justificativa: ${parsed.data.justificativa}` : ''
    const valorPara = (parsed.data.resultado === 'PERDEU' && parsed.data.motivo_perda
      ? `${RESULTADO_LABELS[parsed.data.resultado]} — Motivo: ${parsed.data.motivo_perda}`
      : RESULTADO_LABELS[parsed.data.resultado]) + just
    await prisma.historicoSolicitacao.create({
      data: { solicitacao_id: id, campo: `Resultado da Proposta de Fabricação ${rev}`, valor_de: RESULTADO_LABELS[resultado_anterior ?? ''] ?? resultado_anterior ?? '—', valor_para: valorPara, created_by: Number(session.user.id) },
    })
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
    include: { propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1 } },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const pesoTotal = d.equipamentos.reduce((acc, e) => acc + e.peso_ton, 0)
  const valorEquipamentos = d.equipamentos.reduce((acc, e) => acc + e.valor_total, 0)
  const valorTestes = d.possui_testes ? (d.valor_testes ?? 0) : 0
  const valorMontagem = d.possui_montagem ? (d.valor_montagem ?? 0) : 0
  const valorTotal = valorEquipamentos + valorTestes + valorMontagem
  const proximaVersao = (sol.propostas_fabricacao[0]?.versao ?? 0) + 1

  try {
    const proposta = await prisma.$transaction(async (tx) => {
      const pf = await tx.propostaFabricacao.create({
        data: {
          solicitacao_id: id,
          versao: proximaVersao,
          possui_testes: d.possui_testes,
          descricao_testes: d.possui_testes ? (d.descricao_testes ?? null) : null,
          valor_testes: d.possui_testes ? valorTestes : null,
          possui_montagem: d.possui_montagem,
          valor_montagem: d.possui_montagem ? valorMontagem : null,
          peso_total: pesoTotal,
          valor_total: valorTotal,
          data_base: d.data_base ? new Date(d.data_base) : null,
          data_envio: new Date(d.data_envio),
          created_by: Number(session.user.id),
          equipamentos: {
            create: d.equipamentos.map((e, i) => ({
              ordem: i + 1,
              descricao: e.descricao,
              peso_ton: e.peso_ton,
              valor_total: e.valor_total,
              hh_previsto: e.hh_previsto ?? null,
              observacoes: e.observacoes ?? null,
            })),
          },
        },
        include: { equipamentos: true },
      })
      await tx.solicitacao.update({
        where: { id },
        data: { status: 'PROPOSTA_ENVIADA' },
      })
      return pf
    })

    return NextResponse.json({ data: proposta, error: null }, { status: 201 })
  } catch (err) {
    logger.error('[POST /api/solicitacoes/[id]/proposta-fabricacao]', err)
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

  const latest = await prisma.propostaFabricacao.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta de fabricação encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const pesoTotal = d.equipamentos.reduce((acc, e) => acc + e.peso_ton, 0)
  const valorEquipamentos = d.equipamentos.reduce((acc, e) => acc + e.valor_total, 0)
  const valorTestes = d.possui_testes ? (d.valor_testes ?? 0) : 0
  const valorMontPut = d.possui_montagem ? (d.valor_montagem ?? 0) : 0
  const valorTotal = valorEquipamentos + valorTestes + valorMontPut

  const proposta = await prisma.$transaction(async (tx) => {
    return tx.propostaFabricacao.update({
      where: { id: latest.id },
      data: {
        possui_testes: d.possui_testes,
        descricao_testes: d.possui_testes ? (d.descricao_testes ?? null) : null,
        valor_testes: d.possui_testes ? valorTestes : null,
        possui_montagem: d.possui_montagem,
        valor_montagem: d.possui_montagem ? valorMontPut : null,
        peso_total: pesoTotal,
        valor_total: valorTotal,
        data_base: d.data_base ? new Date(d.data_base) : latest.data_base,
        data_envio: new Date(d.data_envio),
        equipamentos: {
          deleteMany: {},
          create: d.equipamentos.map((e, i) => ({
            ordem: i + 1,
            descricao: e.descricao,
            peso_ton: e.peso_ton,
            valor_total: e.valor_total,
            observacoes: e.observacoes ?? null,
          })),
        },
      },
      include: { equipamentos: true },
    })
  })

  // Log changes in HistoricoSolicitacao
  const rev = `Rev${String(latest.versao).padStart(2, '0')}`
  const userId = Number(session.user.id)
  const fmtV = (v: number | null | undefined) =>
    v != null ? `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  type HistEntry = { solicitacao_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }
  const fabHistEntries: HistEntry[] = []

  if (Math.round(Number(latest.valor_total) * 100) !== Math.round(valorTotal * 100))
    fabHistEntries.push({ solicitacao_id: id, campo: `Proposta Fabricação ${rev} — Valor Total`, valor_de: fmtV(Number(latest.valor_total)), valor_para: fmtV(valorTotal), created_by: userId })
  if (Math.round(Number(latest.peso_total) * 1000) !== Math.round(pesoTotal * 1000))
    fabHistEntries.push({ solicitacao_id: id, campo: `Proposta Fabricação ${rev} — Peso Total (t)`, valor_de: latest.peso_total != null ? String(Number(latest.peso_total)) : null, valor_para: String(pesoTotal), created_by: userId })
  if (Math.round((latest.valor_testes ? Number(latest.valor_testes) : 0) * 100) !== Math.round(valorTestes * 100))
    fabHistEntries.push({ solicitacao_id: id, campo: `Proposta Fabricação ${rev} — Valor Testes`, valor_de: fmtV(latest.valor_testes ? Number(latest.valor_testes) : null), valor_para: fmtV(valorTestes), created_by: userId })
  if (Math.round((latest.valor_montagem ? Number(latest.valor_montagem) : 0) * 100) !== Math.round(valorMontPut * 100))
    fabHistEntries.push({ solicitacao_id: id, campo: `Proposta Fabricação ${rev} — Valor Montagem`, valor_de: fmtV(latest.valor_montagem ? Number(latest.valor_montagem) : null), valor_para: fmtV(valorMontPut), created_by: userId })
  if ((latest.data_envio?.toISOString().split('T')[0] ?? null) !== d.data_envio)
    fabHistEntries.push({ solicitacao_id: id, campo: `Proposta Fabricação ${rev} — Data Envio`, valor_de: latest.data_envio?.toISOString().split('T')[0] ?? null, valor_para: d.data_envio, created_by: userId })

  if (fabHistEntries.length > 0) {
    await prisma.historicoSolicitacao.createMany({ data: fabHistEntries })
  }

  return NextResponse.json({ data: proposta, error: null })
}
