import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailNovaRevisao, createNotificacao } from '@/lib/notifications'

const schema = z.object({
  as_sold: z.boolean().optional().default(false),
  // campos atualizáveis da solicitação
  cliente_id:                    z.number().int().positive().optional(),
  cliente_final_id:              z.number().int().positive().nullable().optional(),
  cidade:                        z.string().optional(),
  estado:                        z.string().optional(),
  data_recebimento:              z.string().nullable().optional(),
  segmento:                      z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'OLEO_GAS', 'OUTROS']).optional(),
  origem:                        z.enum(['EMAIL', 'TELEFONE', 'VISITA', 'INDICACAO', 'OUTRO']).optional(),
  escopo:                        z.string().optional(),
  referencia_cliente:            z.string().optional(),
  prazo_tecnica:                 z.string().nullable().optional(),
  prazo_tecnica_indeterminado:   z.boolean().optional(),
  prazo_comercial:               z.string().nullable().optional(),
  prazo_comercial_indeterminado: z.boolean().optional(),
  visita_tecnica:                z.boolean().optional(),
  data_visita:                   z.string().nullable().optional(),
  classificacao:                 z.string().nullable().optional(),
  interesse:                     z.string().nullable().optional(),
  comprador:                     z.string().nullable().optional(),
  telefone_comprador:            z.string().nullable().optional(),
  email_comprador:               z.string().nullable().optional(),
  orcamentista_id:               z.number().int().positive().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  if (!['ADM_COMERCIAL', 'ADM_GERAL'].includes(session.user.perfil as string)) {
    return NextResponse.json({ data: null, error: 'Apenas administradores podem criar revisões' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1 },
      orcamentista: { select: { email: true, nome: true } },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (!sol.orcamentista_id) {
    return NextResponse.json({ data: null, error: 'Solicitação sem orçamentista atribuído' }, { status: 400 })
  }
  if (sol.as_sold) {
    return NextResponse.json(
      { data: null, error: 'Esta solicitação já possui uma revisão As Sold. Não é possível criar novas revisões.' },
      { status: 409 },
    )
  }

  const ultimaVersao = sol.propostas_tecnicas[0]?.versao ?? 0
  const novaRevisao = Math.max(sol.revisao_esperada, ultimaVersao) + 1

  const d = parsed.data

  const pendenteCount = await prisma.propostaComercial.count({
    where: { solicitacao_id: id, resultado: 'AGUARDANDO' },
  })

  // RN-46: Encerra propostas comerciais pendentes do ciclo atual
  await prisma.propostaComercial.updateMany({
    where: { solicitacao_id: id, resultado: 'AGUARDANDO' },
    data: { resultado: 'PERDEU', motivo_perda: 'OUTRO' },
  })

  // CRÍTICO-2: compare-and-swap via WHERE revisao_esperada
  const updateResult = await prisma.solicitacao.updateMany({
    where: { id, revisao_esperada: sol.revisao_esperada },
    data: {
      revisao_esperada: novaRevisao,
      status: 'EM_ELABORACAO',
      as_sold: d.as_sold ?? false,
      ...(d.cliente_id !== undefined && { cliente_id: d.cliente_id }),
      ...(d.cliente_final_id !== undefined && { cliente_final_id: d.cliente_final_id }),
      ...(d.cidade !== undefined && { cidade: d.cidade }),
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(d.data_recebimento !== undefined && {
        data_recebimento: d.data_recebimento ? new Date(d.data_recebimento) : null,
      }),
      ...(d.segmento !== undefined && { segmento: d.segmento }),
      ...(d.origem !== undefined && { origem: d.origem }),
      ...(d.escopo !== undefined && { escopo: d.escopo }),
      ...(d.referencia_cliente !== undefined && { referencia_cliente: d.referencia_cliente }),
      ...(d.prazo_tecnica !== undefined && {
        prazo_tecnica: d.prazo_tecnica ? new Date(d.prazo_tecnica) : null,
      }),
      ...(d.prazo_tecnica_indeterminado !== undefined && {
        prazo_tecnica_indeterminado: d.prazo_tecnica_indeterminado,
      }),
      ...(d.prazo_comercial !== undefined && {
        prazo_comercial: d.prazo_comercial ? new Date(d.prazo_comercial) : null,
      }),
      ...(d.prazo_comercial_indeterminado !== undefined && {
        prazo_comercial_indeterminado: d.prazo_comercial_indeterminado,
      }),
      ...(d.visita_tecnica !== undefined && { visita_tecnica: d.visita_tecnica }),
      ...(d.data_visita !== undefined && {
        data_visita: d.data_visita ? new Date(d.data_visita) : null,
      }),
      ...(d.classificacao !== undefined && { classificacao: d.classificacao as never }),
      ...(d.interesse !== undefined && { interesse: d.interesse as never }),
      ...(d.comprador !== undefined && { comprador: d.comprador }),
      ...(d.telefone_comprador !== undefined && { telefone_comprador: d.telefone_comprador }),
      ...(d.email_comprador !== undefined && { email_comprador: d.email_comprador }),
      ...(d.orcamentista_id !== undefined && { orcamentista_id: d.orcamentista_id }),
    },
  })

  if (updateResult.count === 0) {
    return NextResponse.json(
      { data: null, error: 'Revisão já foi criada. Recarregue a página e tente novamente.' },
      { status: 409 },
    )
  }

  // ALTO-6: notifica orçamentista se havia propostas pendentes encerradas
  if (pendenteCount > 0 && sol.orcamentista_id) {
    const label = d.as_sold ? 'As Sold.' : `Rev${String(novaRevisao - 1).padStart(2, '0')}`
    createNotificacao(
      sol.orcamentista_id,
      `Nova revisão criada — ${sol.numero}`,
      `A revisão ${label} foi aberta. ${pendenteCount} proposta(s) pendente(s) foram encerradas automaticamente.`,
      '/orcamentos/painel',
    )
  }

  if (sol.orcamentista?.email) {
    emailNovaRevisao(sol.orcamentista.email, sol.numero, novaRevisao)
  }

  const updated = await prisma.solicitacao.findUnique({ where: { id } })
  return NextResponse.json({ data: updated, error: null }, { status: 200 })
}
