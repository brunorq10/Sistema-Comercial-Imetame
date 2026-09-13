import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao, exigirTitularContrato } from '@/lib/permissaoApi'
import { formatCurrency, formatDate } from '@/lib/utils'

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
  // Obrigatório quando valor_total muda (alteração de valor financeiro já lançado)
  motivo: z.string().optional(),
})

const CAMPO_LABELS: Record<string, string> = {
  tipo: 'Tipo', descricao: 'Descrição', data_ocorrencia: 'Data Ocorrência',
  data_notificacao_cliente: 'Data Notificação Cliente', data_desconto: 'Data Desconto',
  valor_total: 'Valor Total',
}

// PUT — edita ou inativa/reativa uma multa (gestão, ou responsável pelo próprio contrato).
export async function PUT(req: NextRequest, { params }: { params: { multaId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.multaId)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const multaAtual = await prisma.multaPenalidade.findUnique({ where: { id } })
  if (!multaAtual) return NextResponse.json({ data: null, error: 'Multa não encontrada' }, { status: 404 })
  { const erro = await exigirTitularContrato(session, multaAtual.contrato_id, 'acordos.multas.editar'); if (erro) return erro }

  const parsed = putSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data

  // RN-20: inativação exige motivo
  if (d.ativa === false && !d.motivo_inativacao?.trim()) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da inativação.' }, { status: 400 })
  }
  // Alteração de valor financeiro já lançado exige motivo
  if (d.valor_total !== undefined && d.valor_total !== Number(multaAtual.valor_total) && !d.motivo?.trim()) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da alteração de valor.' }, { status: 400 })
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

  const autorId = Number(session.user.id)
  const atualizada = await prisma.multaPenalidade.update({ where: { id }, data })

  const fmtVal = (campo: string, v: unknown): string | null => {
    if (v == null) return null
    if (campo === 'valor_total') return formatCurrency(Number(v))
    if (campo.startsWith('data_')) return formatDate(v as Date)
    return String(v)
  }
  const hist: { multa_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }[] = []
  for (const campo of Object.keys(CAMPO_LABELS)) {
    const antigo = (multaAtual as Record<string, unknown>)[campo]
    const novo = (atualizada as Record<string, unknown>)[campo]
    const antigoStr = fmtVal(campo, antigo)
    const novoStr = fmtVal(campo, novo)
    if (antigoStr !== novoStr) {
      hist.push({ multa_id: id, campo: CAMPO_LABELS[campo] + (campo === 'valor_total' && d.motivo ? ` — Motivo: ${d.motivo}` : ''), valor_de: antigoStr, valor_para: novoStr, created_by: autorId })
    }
  }
  if (d.ativa !== undefined && d.ativa !== multaAtual.ativa) {
    hist.push({ multa_id: id, campo: 'Status', valor_de: multaAtual.ativa ? 'Ativa' : 'Inativa', valor_para: (d.ativa ? 'Ativa' : `Inativa — Motivo: ${d.motivo_inativacao}`), created_by: autorId })
  }
  if (hist.length > 0) {
    await prisma.multaPenalidadeHistorico.createMany({ data: hist })
  }

  return NextResponse.json({ data: { id }, error: null })
}

// DELETE — exclusão exclusiva do ADM Geral (mesma regra de exclusão de NF).
export async function DELETE(req: NextRequest, { params }: { params: { multaId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.multaId)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  { const { erro } = await exigirPermissao('acordos.nf.excluir'); if (erro) return erro }

  const body = await req.json().catch(() => ({}))
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 3) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da exclusão (mínimo 3 caracteres).' }, { status: 400 })
  }

  const autorId = Number(session.user.id)
  // Lixeira: soft-delete recuperável por 15 dias (não apaga o registro)
  await prisma.$transaction([
    prisma.multaPenalidade.update({
      where: { id },
      data: { deleted_at: new Date(), deleted_by: autorId, motivo_exclusao: motivo },
    }),
    prisma.multaPenalidadeHistorico.create({
      data: { multa_id: id, campo: 'Exclusão', valor_de: 'Ativo', valor_para: `Excluído — Motivo: ${motivo}`, created_by: autorId },
    }),
  ])
  return NextResponse.json({ data: { ok: true }, error: null })
}
