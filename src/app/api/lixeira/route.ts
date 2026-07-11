import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { purgarVencidos, cutoffLixeira, LIXEIRA_RETENCAO_DIAS, TIPO_LABELS, type TipoLixeira } from '@/lib/lixeira'

interface ItemLixeira {
  tipo: TipoLixeira
  tipoLabel: string
  id: number
  titulo: string
  contexto: string
  deleted_at: string
  deleted_by_nome: string | null
  expira_em: string
}

function expira(deletedAt: Date): string {
  return new Date(deletedAt.getTime() + LIXEIRA_RETENCAO_DIAS * 86400000).toISOString()
}

// GET — itens na lixeira (últimos 15 dias). Executa o expurgo dos vencidos.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  await purgarVencidos()
  const cutoff = cutoffLixeira()
  const cond = { deleted_at: { not: null, gte: cutoff } }

  const [nfs, subs, multas, ocorrencias, infos, contratos, hhRemovidos, users] = await Promise.all([
    prisma.notaFiscalContrato.findMany({
      where: cond,
      select: { id: true, numero_nf: true, valor_atribuido: true, deleted_at: true, deleted_by: true,
        subindice: { select: { descricao: true, contrato: { select: { indice: true, cliente: { select: { nome: true } } } } } } },
    }),
    prisma.subIndiceFaturamento.findMany({
      where: cond,
      select: { id: true, descricao: true, valor_total: true, deleted_at: true, deleted_by: true,
        contrato: { select: { indice: true, cliente: { select: { nome: true } } } } },
    }),
    prisma.multaPenalidade.findMany({
      where: cond,
      select: { id: true, tipo: true, descricao: true, valor_total: true, deleted_at: true, deleted_by: true,
        contrato: { select: { indice: true, cliente: { select: { nome: true } } } } },
    }),
    prisma.ocorrenciaContratual.findMany({
      where: cond,
      select: { id: true, codigo: true, tipo: true, descricao: true, deleted_at: true, deleted_by: true,
        contrato: { select: { indice: true, cliente: { select: { nome: true } } } } },
    }),
    prisma.solicitacaoInfo.findMany({
      where: cond,
      select: { id: true, codigo: true, comentario: true, deleted_at: true, deleted_by: true,
        solicitacao: { select: { numero: true, cliente: { select: { nome: true } } } } },
    }),
    prisma.contrato.findMany({
      where: cond,
      select: { id: true, indice: true, ano_referencia: true, deleted_at: true, deleted_by: true,
        cliente: { select: { nome: true } } },
    }),
    prisma.contrato.findMany({
      where: { hh_cancelado_at: { not: null, gte: cutoff } },
      select: { id: true, indice: true, hh_cancelado_at: true, hh_cancelado_por: true, hh_cancel_motivo: true,
        cliente: { select: { nome: true } } },
    }),
    prisma.user.findMany({ select: { id: true, nome: true } }),
  ])

  const nome = (id: number | null) => users.find((u) => u.id === id)?.nome ?? null
  const fmt = (v: unknown) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const itens: ItemLixeira[] = [
    ...nfs.map((n) => ({
      tipo: 'nf' as const, tipoLabel: TIPO_LABELS.nf, id: n.id,
      titulo: `NF ${n.numero_nf} · ${fmt(n.valor_atribuido)}`,
      contexto: `${n.subindice.contrato.indice} · ${n.subindice.contrato.cliente.nome} — ${n.subindice.descricao}`,
      deleted_at: n.deleted_at!.toISOString(), deleted_by_nome: nome(n.deleted_by), expira_em: expira(n.deleted_at!),
    })),
    ...subs.map((s) => ({
      tipo: 'subindice' as const, tipoLabel: TIPO_LABELS.subindice, id: s.id,
      titulo: `${s.descricao} · ${fmt(s.valor_total)}`,
      contexto: `${s.contrato.indice} · ${s.contrato.cliente.nome}`,
      deleted_at: s.deleted_at!.toISOString(), deleted_by_nome: nome(s.deleted_by), expira_em: expira(s.deleted_at!),
    })),
    ...multas.map((m) => ({
      tipo: 'multa' as const, tipoLabel: TIPO_LABELS.multa, id: m.id,
      titulo: `${m.tipo} · ${fmt(m.valor_total)} — ${m.descricao.slice(0, 60)}`,
      contexto: `${m.contrato.indice} · ${m.contrato.cliente.nome}`,
      deleted_at: m.deleted_at!.toISOString(), deleted_by_nome: nome(m.deleted_by), expira_em: expira(m.deleted_at!),
    })),
    ...ocorrencias.map((o) => ({
      tipo: 'ocorrencia' as const, tipoLabel: TIPO_LABELS.ocorrencia, id: o.id,
      titulo: `${o.codigo} · ${o.tipo} — ${o.descricao.slice(0, 60)}`,
      contexto: `${o.contrato.indice} · ${o.contrato.cliente.nome}`,
      deleted_at: o.deleted_at!.toISOString(), deleted_by_nome: nome(o.deleted_by), expira_em: expira(o.deleted_at!),
    })),
    ...infos.map((i) => ({
      tipo: 'informacao' as const, tipoLabel: TIPO_LABELS.informacao, id: i.id,
      titulo: `${i.codigo ?? 'Registro'} — ${i.comentario.slice(0, 60)}`,
      contexto: `${i.solicitacao.numero} · ${i.solicitacao.cliente.nome}`,
      deleted_at: i.deleted_at!.toISOString(), deleted_by_nome: nome(i.deleted_by), expira_em: expira(i.deleted_at!),
    })),
    ...contratos.map((c) => ({
      tipo: 'contrato' as const, tipoLabel: TIPO_LABELS.contrato, id: c.id,
      titulo: `Contrato ${c.indice}`,
      contexto: `${c.cliente.nome} · Ano ${c.ano_referencia}`,
      deleted_at: c.deleted_at!.toISOString(), deleted_by_nome: nome(c.deleted_by), expira_em: expira(c.deleted_at!),
    })),
    ...hhRemovidos.map((c) => ({
      tipo: 'hh' as const, tipoLabel: TIPO_LABELS.hh, id: c.id,
      titulo: `HH — Contrato ${c.indice}`,
      contexto: `${c.cliente.nome}${c.hh_cancel_motivo ? ` — ${c.hh_cancel_motivo.slice(0, 60)}` : ''}`,
      deleted_at: c.hh_cancelado_at!.toISOString(), deleted_by_nome: nome(c.hh_cancelado_por), expira_em: expira(c.hh_cancelado_at!),
    })),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))

  return NextResponse.json({ data: { itens, retencaoDias: LIXEIRA_RETENCAO_DIAS }, error: null })
}

const restoreSchema = z.object({
  tipo: z.enum(['nf', 'subindice', 'multa', 'ocorrencia', 'informacao', 'contrato', 'hh']),
  id: z.number().int().positive(),
})

// POST — restaura um item da lixeira (limpa deleted_at/deleted_by).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const parsed = restoreSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Dados inválidos' }, { status: 400 })
  const { tipo, id } = parsed.data
  const userId = Number(session.user.id)

  // Pode restaurar: quem excluiu, gestão, ADMs e analista crítico
  const perfil = session.user.perfil
  const ehGestor = perfil === 'ADM_GERAL' || perfil === 'ADM_COMERCIAL' ||
    perfil === 'GESTAO_ACORDOS' || perfil === 'GESTAO_COMERCIAL' || !!session.user.is_analista_critico

  const data = { deleted_at: null, deleted_by: null }
  try {
    const restaurar = async (deletedBy: number | null): Promise<NextResponse | null> => {
      if (!ehGestor && deletedBy !== userId) {
        return NextResponse.json({ data: null, error: 'Apenas quem excluiu ou a gestão pode restaurar este item' }, { status: 403 })
      }
      return null
    }

    if (tipo === 'nf') {
      const item = await prisma.notaFiscalContrato.findFirst({ where: { id, deleted_at: { not: null } }, select: { deleted_by: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.deleted_by); if (neg) return neg
      await prisma.notaFiscalContrato.update({ where: { id }, data })
    } else if (tipo === 'subindice') {
      const item = await prisma.subIndiceFaturamento.findFirst({ where: { id, deleted_at: { not: null } }, select: { deleted_by: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.deleted_by); if (neg) return neg
      await prisma.subIndiceFaturamento.update({ where: { id }, data })
    } else if (tipo === 'multa') {
      const item = await prisma.multaPenalidade.findFirst({ where: { id, deleted_at: { not: null } }, select: { deleted_by: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.deleted_by); if (neg) return neg
      await prisma.multaPenalidade.update({ where: { id }, data })
    } else if (tipo === 'ocorrencia') {
      const item = await prisma.ocorrenciaContratual.findFirst({ where: { id, deleted_at: { not: null } }, select: { deleted_by: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.deleted_by); if (neg) return neg
      await prisma.ocorrenciaContratual.update({ where: { id }, data })
    } else if (tipo === 'contrato') {
      const item = await prisma.contrato.findFirst({ where: { id, deleted_at: { not: null } }, select: { deleted_by: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.deleted_by); if (neg) return neg
      // Restaura também o cancelamento aplicado na exclusão e volta ao status base
      await prisma.contrato.update({
        where: { id },
        data: { ...data, cancelled_at: null, cancel_reason: null, status: 'A_FATURAR' },
      })
    } else if (tipo === 'hh') {
      const item = await prisma.contrato.findFirst({ where: { id, hh_cancelado_at: { not: null } }, select: { hh_cancelado_por: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.hh_cancelado_por); if (neg) return neg
      await prisma.$transaction([
        prisma.contrato.update({
          where: { id },
          data: { hh_cancelado_at: null, hh_cancel_motivo: null, hh_cancelado_por: null },
        }),
        prisma.hhAcompanhamentoHistorico.create({
          data: { contrato_id: id, acao: 'REATIVADO', motivo: 'Restaurado da lixeira', created_by: userId },
        }),
      ])
    } else {
      const item = await prisma.solicitacaoInfo.findFirst({ where: { id, deleted_at: { not: null } }, select: { deleted_by: true } })
      if (!item) return NextResponse.json({ data: null, error: 'Item não encontrado na lixeira' }, { status: 404 })
      const neg = await restaurar(item.deleted_by); if (neg) return neg
      await prisma.solicitacaoInfo.update({ where: { id }, data })
    }

    return NextResponse.json({ data: { tipo, id, restaurado: true }, error: null })
  } catch (err) {
    logger.error('[POST /api/lixeira]', err)
    return NextResponse.json({ data: null, error: 'Erro ao restaurar o item.' }, { status: 500 })
  }
}
