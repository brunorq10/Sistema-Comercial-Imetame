import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  cliente_nome: z.string().min(1).optional(),
  cliente_final_nome: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
  escopo: z.string().optional().nullable(),
  orcamentista_nome: z.string().optional().nullable(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS']).optional(),
  data_inicio: z.string().min(1).optional(),
  data_fim: z.string().min(1).optional(),
  efetivo: z.number().int().positive().optional(),
  // Detalhamento mês a mês (Obras/Fabricações/Óleo e Gás) — chave "AAAA-MM".
  efetivo_mensal: z.record(z.string(), z.number().int().nonnegative()).optional().nullable(),
  observacao: z.string().optional().nullable(),
})

const CAMPO_LABELS: Record<string, string> = {
  cliente_nome: 'Cliente', cliente_final_nome: 'Cliente Final', cidade: 'Cidade', estado: 'Estado',
  escopo: 'Escopo', orcamentista_nome: 'Orçamentista', classificacao: 'Classificação', data_inicio: 'Data Início', data_fim: 'Data Fim',
  efetivo: 'Efetivo', efetivo_mensal: 'Efetivo mensal', observacao: 'Observação',
}

// PUT /api/cenario/lancamentos/:id — editar lançamento (Editar Cenário)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { erro, usuario } = await exigirPermissao('cenario.editar')
  if (erro) return erro

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const atual = await prisma.cenarioLancamento.findUnique({ where: { id } })
  if (!atual || atual.cancelled_at) return NextResponse.json({ data: null, error: 'Lançamento não encontrado' }, { status: 404 })

  const d = parsed.data
  const novaDataInicio = d.data_inicio ? new Date(d.data_inicio) : atual.data_inicio
  const novaDataFim = d.data_fim ? new Date(d.data_fim) : atual.data_fim
  if (novaDataFim < novaDataInicio) {
    return NextResponse.json({ data: null, error: 'Data de fim não pode ser anterior à data de início' }, { status: 400 })
  }

  const novaClassificacao = d.classificacao ?? atual.classificacao

  const updateData = {
    cliente_nome: d.cliente_nome ?? atual.cliente_nome,
    cliente_final_nome: d.cliente_final_nome !== undefined ? d.cliente_final_nome : atual.cliente_final_nome,
    cidade: d.cidade !== undefined ? d.cidade : atual.cidade,
    estado: d.estado !== undefined ? d.estado : atual.estado,
    escopo: d.escopo !== undefined ? d.escopo : atual.escopo,
    orcamentista_nome: d.orcamentista_nome !== undefined ? d.orcamentista_nome : atual.orcamentista_nome,
    classificacao: novaClassificacao,
    data_inicio: novaDataInicio,
    data_fim: novaDataFim,
    efetivo: d.efetivo ?? atual.efetivo,
    // Paradas não têm detalhamento mensal — zera se a classificação mudar para Paradas.
    efetivo_mensal: novaClassificacao === 'PARADAS'
      ? Prisma.DbNull
      : d.efetivo_mensal !== undefined
        ? (d.efetivo_mensal ?? Prisma.DbNull)
        : (atual.efetivo_mensal ?? Prisma.DbNull),
    observacao: d.observacao !== undefined ? d.observacao : atual.observacao,
    updated_by: usuario.id,
  }

  const lancamento = await prisma.cenarioLancamento.update({ where: { id }, data: updateData })

  // Histórico — diff campo a campo
  const fmt = (v: unknown) => v == null ? null : v instanceof Date ? v.toISOString().split('T')[0] : typeof v === 'object' ? JSON.stringify(v) : String(v)
  const campos: (keyof typeof updateData)[] = ['cliente_nome', 'cliente_final_nome', 'cidade', 'estado', 'escopo', 'orcamentista_nome', 'classificacao', 'data_inicio', 'data_fim', 'efetivo', 'efetivo_mensal', 'observacao']
  const historico = campos
    .filter((c) => fmt((atual as Record<string, unknown>)[c]) !== fmt(updateData[c]))
    .map((c) => ({
      lancamento_id: id, campo: CAMPO_LABELS[c] ?? c,
      valor_de: fmt((atual as Record<string, unknown>)[c]), valor_para: fmt(updateData[c]),
      created_by: usuario.id,
    }))
  if (historico.length > 0) await prisma.cenarioLancamentoHistorico.createMany({ data: historico })

  return NextResponse.json({ data: lancamento, error: null })
}

// DELETE /api/cenario/lancamentos/:id — remove do cenário (RN-18: soft-cancel com
// justificativa); não afeta a proposta/contrato de origem, que volta disponível.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { erro, usuario } = await exigirPermissao('cenario.editar')
  if (erro) return erro

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 5) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da exclusão (mínimo 5 caracteres).' }, { status: 400 })
  }

  const atual = await prisma.cenarioLancamento.findUnique({ where: { id } })
  if (!atual || atual.cancelled_at) return NextResponse.json({ data: null, error: 'Lançamento não encontrado' }, { status: 404 })

  await prisma.cenarioLancamento.update({
    where: { id },
    data: { cancelled_at: new Date(), cancel_reason: motivo, updated_by: usuario.id },
  })

  return NextResponse.json({ data: null, error: null })
}
