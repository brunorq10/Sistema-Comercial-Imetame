import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { withApi } from '@/lib/apiHandler'
import { exigirTitularSubindice } from '@/lib/permissaoApi'

const schema = z.object({
  numero_nf: z.string().min(1),
  valor_total_nf: z.number().positive(),
  percentual: z.number().min(0.01).max(100),
  data_emissao: z.string(),
  data_vencimento: z.string(),
  tipo_documento: z.string().optional().default('NF'),
})

export const POST = withApi(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const subindiceId = Number(params.id)
  if (isNaN(subindiceId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSubindice(session, subindiceId, 'acordos.faturamento.lancar'); if (_n) return _n }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  // RN-CF-07: bloquear lançamento quando há alteração de previsão pendente
  const alteracaoPendente = await prisma.previsaoAlteracao.count({
    where: { subindice_id: subindiceId, status: 'PENDENTE' },
  })
  if (alteracaoPendente > 0) {
    return NextResponse.json(
      { data: null, error: 'Não é possível lançar NF: existe uma solicitação de alteração de previsão pendente para este sub-índice. Aguarde a aprovação ou reprovação pelo Gestão Acordos.' },
      { status: 422 },
    )
  }

  // Validate total % for this NF across all active records globally
  const totalExistente = await prisma.notaFiscalContrato.aggregate({
    where: { numero_nf: parsed.data.numero_nf, ativa: true, deleted_at: null },
    _sum: { percentual: true },
  })
  const totalAlocado = Number(totalExistente._sum.percentual ?? 0)
  const restante = 100 - totalAlocado
  if (totalAlocado + parsed.data.percentual > 100 + 0.001) {
    return NextResponse.json(
      { data: null, error: `NF ${parsed.data.numero_nf} já possui ${totalAlocado.toFixed(2)}% alocados. Restam ${restante.toFixed(2)}% disponíveis.` },
      { status: 422 },
    )
  }

  const valor_atribuido = (parsed.data.valor_total_nf * parsed.data.percentual) / 100

  // Fluxo de aprovação: coordenação (GESTAO_ACORDOS/ADM_GERAL) lança direto;
  // responsável (ACORDOS) envia para aprovação — não conta no faturamento até aprovar.
  const perfil = session.user.perfil
  const isCoordenacao = perfil === 'GESTAO_ACORDOS' || perfil === 'ADM_GERAL'
  const userId = Number(session.user.id)

  const nf = await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: subindiceId,
      numero_nf: parsed.data.numero_nf,
      valor_total_nf: parsed.data.valor_total_nf,
      percentual: parsed.data.percentual,
      valor_atribuido,
      data_emissao: new Date(parsed.data.data_emissao),
      data_vencimento: new Date(parsed.data.data_vencimento),
      tipo_documento: parsed.data.tipo_documento ?? 'NF',
      created_by: userId,
      status_aprovacao: isCoordenacao ? 'APROVADO' : 'PENDENTE',
      ativa: isCoordenacao,
      solicitado_por: isCoordenacao ? null : userId,
    },
  })

  // Notifica a coordenação quando um responsável envia faturamento para aprovação
  if (!isCoordenacao) {
    const sub = await prisma.subIndiceFaturamento.findUnique({
      where: { id: subindiceId },
      select: { ordem: true, descricao: true, contrato: { select: { id: true, indice: true, cliente: { select: { nome: true } } } } },
    })
    const gestores = await prisma.user.findMany({ where: { perfil: 'GESTAO_ACORDOS', ativo: true }, select: { id: true } })
    for (const g of gestores) {
      createNotificacao(
        g.id,
        'Novo lançamento de faturamento para aprovação',
        `${sub?.contrato?.indice ?? ''}.${sub?.ordem ?? ''} · ${sub?.descricao ?? ''} (${sub?.contrato?.cliente?.nome ?? ''}) — NF ${parsed.data.numero_nf} enviada por ${session.user.nome ?? 'responsável'}.`,
        sub?.contrato?.id ? `/acordos/faturamento/${sub.contrato.id}` : undefined,
      )
    }
  }

  // RN-CF-16: alerta informativo (não bloqueio) quando faturado ultrapassa valor total
  const subindice = await prisma.subIndiceFaturamento.findUnique({
    where: { id: subindiceId },
    select: { valor_total: true },
  })
  const totalFaturado = await prisma.notaFiscalContrato.aggregate({
    where: { subindice_id: subindiceId, ativa: true, deleted_at: null },
    _sum: { valor_atribuido: true },
  })
  const fatAcumulado = Number(totalFaturado._sum.valor_atribuido ?? 0)
  const valorTotal   = Number(subindice?.valor_total ?? 0)
  const warning = fatAcumulado > valorTotal + 0.01
    ? `Atenção: o faturamento acumulado (R$ ${fatAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) ultrapassa o valor total previsto do sub-índice (R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
    : null

  return NextResponse.json({
    data: {
      id: nf.id,
      numero_nf: nf.numero_nf,
      valor_total_nf: Number(nf.valor_total_nf),
      percentual: Number(nf.percentual),
      valor_atribuido: Number(nf.valor_atribuido),
      data_emissao: nf.data_emissao.toISOString(),
      data_vencimento: nf.data_vencimento.toISOString(),
      ativa: nf.ativa,
      tipo_documento: nf.tipo_documento ?? 'NF',
      status_aprovacao: nf.status_aprovacao,
    },
    pendente: !isCoordenacao,
    warning,
    error: null,
  }, { status: 201 })
})
