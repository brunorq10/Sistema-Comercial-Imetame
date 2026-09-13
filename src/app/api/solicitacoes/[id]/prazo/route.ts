import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularSolicitacao } from '@/lib/permissaoApi'
import { formatDate } from '@/lib/utils'

// PATCH — altera a data de envio da proposta técnica e/ou comercial de uma
// solicitação. Rota dedicada (em vez do PUT geral) porque tem regras próprias:
// motivo obrigatório, trava por proposta já enviada (por prazo, individualmente)
// e bloqueio por status — sem afetar o restante do formulário/fluxo de edição
// já existente (usado pela Administração Comercial via SolicitacaoForm).
const bodySchema = z.object({
  prazo_tecnica: z.string().min(1).optional(),
  prazo_comercial: z.string().min(1).optional(),
  motivo: z.string().trim().min(5, 'Informe o motivo da alteração (mínimo 5 caracteres)'),
}).refine((d) => d.prazo_tecnica !== undefined || d.prazo_comercial !== undefined, {
  message: 'Informe ao menos um prazo para alterar',
})

const STATUS_BLOQUEADOS = new Set(['CANCELADA', 'RECUSADA', 'SUSPENSA'])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.solicitacao.prazo.editar'); if (_n) return _n }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { motivo } = parsed.data

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    select: {
      status: true, cancelled_at: true, revisao_esperada: true,
      prazo_tecnica: true, prazo_tecnica_indeterminado: true,
      prazo_comercial: true, prazo_comercial_indeterminado: true,
      propostas_tecnicas: { select: { versao: true } },
      propostas_comerciais: { select: { versao: true } },
    },
  })
  if (!sol) return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  if (sol.cancelled_at || STATUS_BLOQUEADOS.has(sol.status)) {
    return NextResponse.json({ data: null, error: 'Esta solicitação está cancelada, recusada ou suspensa — o prazo não pode ser alterado.' }, { status: 403 })
  }

  // "Enviada" = existe proposta para a revisão vigente (mesmo critério já usado
  // em /api/painel/orcamentista para os badges Técnica/Comercial — Enviada).
  const maxVersaoTecnica = sol.propostas_tecnicas.reduce((m, p) => Math.max(m, p.versao), 0)
  const revisaoEsperada = Math.max(sol.revisao_esperada, maxVersaoTecnica)
  const tecnicaEnviada = sol.propostas_tecnicas.some((p) => p.versao === revisaoEsperada)
  const comercialEnviada = sol.propostas_comerciais.some((p) => p.versao === revisaoEsperada)

  if (parsed.data.prazo_tecnica !== undefined && tecnicaEnviada) {
    return NextResponse.json({ data: null, error: 'A proposta técnica já foi enviada nesta revisão — o prazo não pode mais ser alterado.' }, { status: 409 })
  }
  if (parsed.data.prazo_comercial !== undefined && comercialEnviada) {
    return NextResponse.json({ data: null, error: 'A proposta comercial já foi enviada nesta revisão — o prazo não pode mais ser alterado.' }, { status: 409 })
  }

  const userId = Number(session.user.id)
  const updateData: { prazo_tecnica?: Date; prazo_tecnica_indeterminado?: boolean; prazo_comercial?: Date; prazo_comercial_indeterminado?: boolean } = {}
  const hist: { solicitacao_id: number; campo: string; valor_de: string | null; valor_para: string; created_by: number }[] = []

  const fmtAtual = (data: Date | null, indeterminado: boolean) => indeterminado ? 'Não Determinado' : formatDate(data)

  if (parsed.data.prazo_tecnica !== undefined) {
    const novaData = new Date(parsed.data.prazo_tecnica)
    if (isNaN(novaData.getTime())) return NextResponse.json({ data: null, error: 'Data da proposta técnica inválida' }, { status: 400 })
    updateData.prazo_tecnica = novaData
    updateData.prazo_tecnica_indeterminado = false
    hist.push({
      solicitacao_id: id, campo: 'Prazo Técnica',
      valor_de: fmtAtual(sol.prazo_tecnica, sol.prazo_tecnica_indeterminado),
      valor_para: `${formatDate(novaData)} — Motivo: ${motivo}`,
      created_by: userId,
    })
  }
  if (parsed.data.prazo_comercial !== undefined) {
    const novaData = new Date(parsed.data.prazo_comercial)
    if (isNaN(novaData.getTime())) return NextResponse.json({ data: null, error: 'Data da proposta comercial inválida' }, { status: 400 })
    updateData.prazo_comercial = novaData
    updateData.prazo_comercial_indeterminado = false
    hist.push({
      solicitacao_id: id, campo: 'Prazo Comercial',
      valor_de: fmtAtual(sol.prazo_comercial, sol.prazo_comercial_indeterminado),
      valor_para: `${formatDate(novaData)} — Motivo: ${motivo}`,
      created_by: userId,
    })
  }

  const [updated] = await prisma.$transaction([
    prisma.solicitacao.update({ where: { id }, data: updateData }),
    prisma.historicoSolicitacao.createMany({ data: hist }),
  ])

  return NextResponse.json({
    data: {
      id: updated.id,
      prazo_tecnica: updated.prazo_tecnica?.toISOString() ?? null,
      prazo_tecnica_indeterminado: updated.prazo_tecnica_indeterminado,
      prazo_comercial: updated.prazo_comercial?.toISOString() ?? null,
      prazo_comercial_indeterminado: updated.prazo_comercial_indeterminado,
    },
    error: null,
  })
}
