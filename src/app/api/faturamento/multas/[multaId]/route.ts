import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const TIPOS = ['MULTA', 'GLOSAS', 'REEMBOLSOS', 'OUTROS'] as const

const putSchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  descricao: z.string().min(1).optional(),
  data_ocorrencia: z.string().optional(),
  data_notificacao_cliente: z.string().nullable().optional(),
  data_desconto: z.string().nullable().optional(),
  valor_total: z.number().positive().optional(),
  ativa: z.boolean().optional(),
  motivo_inativacao: z.string().nullable().optional(),
})

// PUT — edita ou inativa/reativa uma multa (gestão).
export async function PUT(req: NextRequest, { params }: { params: { multaId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.multaId)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  { const { erro } = await exigirPermissao('acordos.faturamento.item.editar'); if (erro) return erro }

  const parsed = putSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data

  // RN-20: inativação exige motivo
  if (d.ativa === false && !d.motivo_inativacao?.trim()) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da inativação.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (d.tipo !== undefined) data.tipo = d.tipo
  if (d.descricao !== undefined) data.descricao = d.descricao
  if (d.data_ocorrencia !== undefined) data.data_ocorrencia = new Date(d.data_ocorrencia)
  if (d.data_notificacao_cliente !== undefined) data.data_notificacao_cliente = d.data_notificacao_cliente ? new Date(d.data_notificacao_cliente) : null
  if (d.data_desconto !== undefined) data.data_desconto = d.data_desconto ? new Date(d.data_desconto) : null
  if (d.valor_total !== undefined) data.valor_total = d.valor_total
  if (d.ativa !== undefined) {
    data.ativa = d.ativa
    data.motivo_inativacao = d.ativa ? null : (d.motivo_inativacao ?? null)
  }

  await prisma.multaPenalidade.update({ where: { id }, data })
  return NextResponse.json({ data: { id }, error: null })
}

// DELETE — exclusão exclusiva do ADM Geral (mesma regra de exclusão de NF).
export async function DELETE(_req: NextRequest, { params }: { params: { multaId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.multaId)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  { const { erro } = await exigirPermissao('acordos.nf.excluir'); if (erro) return erro }

  // Lixeira: soft-delete recuperável por 15 dias (não apaga o registro)
  await prisma.multaPenalidade.update({
    where: { id },
    data: { deleted_at: new Date(), deleted_by: Number(session.user.id) },
  })
  return NextResponse.json({ data: { ok: true }, error: null })
}
