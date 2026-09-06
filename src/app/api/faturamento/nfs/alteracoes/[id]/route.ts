import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { exigirPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  acao: z.enum(['APROVAR', 'REPROVAR']),
  motivo_recusa: z.string().optional(),
})

// PUT /api/faturamento/nfs/alteracoes/[id]
// Aprova/reprova uma edição pendente de NF já ativa. Ao aprovar, os valores
// propostos substituem os atuais na NF; ao reprovar, a NF permanece como
// estava — em nenhum momento ela sai do faturamento por causa da edição.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('acordos.aprovacoes.decidir'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { acao, motivo_recusa } = parsed.data
  if (acao === 'REPROVAR' && (!motivo_recusa || motivo_recusa.trim().length < 3)) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da reprovação (mínimo 3 caracteres)' }, { status: 400 })
  }

  const alteracao = await prisma.notaFiscalAlteracao.findUnique({
    where: { id },
    include: { nf: { include: { subindice: { select: { ordem: true, descricao: true, contrato: { select: { id: true, indice: true } } } } } } },
  })
  if (!alteracao) return NextResponse.json({ data: null, error: 'Alteração não encontrada' }, { status: 404 })
  if (alteracao.status !== 'PENDENTE') {
    return NextResponse.json({ data: null, error: 'Esta alteração já foi processada' }, { status: 409 })
  }

  const revisorId = Number(session.user.id)
  const aprovado = acao === 'APROVAR'

  if (aprovado) {
    // RN-19: revalida o limite de 100% e a consistência do valor total contra
    // os demais lançamentos ativos dessa NF, com os valores PROPOSTOS.
    const [agg, existente] = await Promise.all([
      prisma.notaFiscalContrato.aggregate({
        where: { numero_nf: alteracao.numero_nf_para, ativa: true, deleted_at: null, id: { not: alteracao.nf_id } },
        _sum: { percentual: true },
      }),
      prisma.notaFiscalContrato.findFirst({
        where: { numero_nf: alteracao.numero_nf_para, ativa: true, deleted_at: null, id: { not: alteracao.nf_id } },
        orderBy: { created_at: 'asc' },
        select: { valor_total_nf: true },
      }),
    ])
    const jaAlocado = Number(agg._sum.percentual ?? 0)
    const percProp = Number(alteracao.percentual_para)
    if (jaAlocado + percProp > 100 + 0.001) {
      return NextResponse.json(
        { data: null, error: `Não é possível aprovar: a NF ${alteracao.numero_nf_para} ficaria com ${(jaAlocado + percProp).toFixed(2)}% alocados (máximo 100%). Já há ${jaAlocado.toFixed(2)}% ativos em outros lançamentos.` },
        { status: 422 },
      )
    }
    const valorExistente = existente ? Number(existente.valor_total_nf) : null
    const valorProp = Number(alteracao.valor_total_nf_para)
    if (valorExistente != null && Math.abs(valorExistente - valorProp) > 0.01) {
      return NextResponse.json(
        { data: null, error: `Não é possível aprovar: a NF ${alteracao.numero_nf_para} já está ativa com valor total de R$ ${valorExistente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, diferente do valor proposto (R$ ${valorProp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).` },
        { status: 422 },
      )
    }

    await prisma.$transaction([
      prisma.notaFiscalContrato.update({
        where: { id: alteracao.nf_id },
        data: {
          numero_nf: alteracao.numero_nf_para,
          valor_total_nf: alteracao.valor_total_nf_para,
          percentual: alteracao.percentual_para,
          valor_atribuido: (valorProp * percProp) / 100,
          data_emissao: alteracao.data_emissao_para,
          data_vencimento: alteracao.data_vencimento_para,
          subindice_id: alteracao.subindice_id_para,
        },
      }),
      prisma.notaFiscalAlteracao.update({
        where: { id },
        data: { status: 'APROVADO', revisor_id: revisorId, reviewed_at: new Date() },
      }),
    ])
  } else {
    await prisma.notaFiscalAlteracao.update({
      where: { id },
      data: { status: 'REPROVADO', motivo_recusa: motivo_recusa!.trim(), revisor_id: revisorId, reviewed_at: new Date() },
    })
  }

  // Notifica o solicitante sobre a decisão (não-bloqueante)
  const ct = alteracao.nf.subindice?.contrato
  const ref = `${ct?.indice ?? ''}.${alteracao.nf.subindice?.ordem ?? ''} · ${alteracao.nf.subindice?.descricao ?? ''} — NF ${alteracao.numero_nf_para}`
  createNotificacao(
    alteracao.responsavel_id,
    aprovado ? 'Edição de faturamento aprovada' : 'Edição de faturamento reprovada',
    aprovado ? `${ref} foi aprovada e os novos dados já constam no faturamento.` : `${ref} foi reprovada. Motivo: ${motivo_recusa!.trim()}`,
    ct?.id ? `/acordos/faturamento/${ct.id}` : undefined,
  )

  return NextResponse.json({ data: { ok: true }, error: null })
}
