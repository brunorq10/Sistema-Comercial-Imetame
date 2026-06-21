import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const mesLabel = (mes: number, ano: number) => `${MESES[mes]}/${String(ano).slice(2)}`
const fmtNum = (v: number | null | undefined) => (v == null ? '—' : String(v))
const fmtPeso = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── POST: lança/atualiza HH e peso realizado por item/mês + registra histórico ─
const lancSchema = z.object({
  item_id: z.number().int().positive(),
  mes: z.number().int().min(0).max(11),
  ano: z.number().int(),
  hh_realizado: z.number().int().nullable().optional(),
  peso_realizado: z.number().nonnegative().nullable().optional(),
  observacoes: z.string().nullable().optional(),
})
const bodySchema = z.object({
  lancamentos: z.array(lancSchema).min(1),
})

type Hist = { item_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const lancamentos = parsed.data.lancamentos

  // Estado atual para diff do histórico
  const itemIds = Array.from(new Set(lancamentos.map((l) => l.item_id)))
  const atuais = await prisma.fabricacaoRealizado.findMany({ where: { item_id: { in: itemIds } } })
  const atualByKey = new Map(atuais.map((r) => [`${r.item_id}-${r.ano}-${r.mes}`, r]))

  const hist: Hist[] = []
  for (const l of lancamentos) {
    const cur = atualByKey.get(`${l.item_id}-${l.ano}-${l.mes}`)
    const lbl = mesLabel(l.mes, l.ano)
    const vHh = cur?.hh_realizado ?? null
    const nHh = l.hh_realizado ?? null
    const vPeso = cur?.peso_realizado != null ? Number(cur.peso_realizado) : null
    const nPeso = l.peso_realizado ?? null
    if (vHh !== nHh) hist.push({ item_id: l.item_id, campo: `HH Realizado ${lbl}`, valor_de: fmtNum(vHh), valor_para: fmtNum(nHh), created_by: userId })
    if (vPeso !== nPeso) hist.push({ item_id: l.item_id, campo: `Peso Realizado ${lbl}`, valor_de: fmtPeso(vPeso), valor_para: fmtPeso(nPeso), created_by: userId })
  }

  await prisma.$transaction([
    ...lancamentos.map((l) => {
      const vazio = (l.hh_realizado == null || l.hh_realizado === 0) && (l.peso_realizado == null || l.peso_realizado === 0)
      if (vazio) {
        return prisma.fabricacaoRealizado.deleteMany({
          where: { item_id: l.item_id, mes: l.mes, ano: l.ano },
        })
      }
      return prisma.fabricacaoRealizado.upsert({
        where: { item_id_mes_ano: { item_id: l.item_id, mes: l.mes, ano: l.ano } },
        create: {
          item_id: l.item_id, mes: l.mes, ano: l.ano,
          hh_realizado: l.hh_realizado ?? null,
          peso_realizado: l.peso_realizado ?? null,
          observacoes: l.observacoes ?? null,
          created_by: userId,
        },
        update: {
          hh_realizado: l.hh_realizado ?? null,
          peso_realizado: l.peso_realizado ?? null,
          observacoes: l.observacoes ?? null,
        },
      })
    }),
    ...(hist.length > 0
      ? [prisma.fabricacaoItemHistorico.createMany({ data: hist as Prisma.FabricacaoItemHistoricoCreateManyInput[] })]
      : []),
  ])

  return NextResponse.json({ data: { ok: true }, error: null })
}

// ── DELETE: exclui todos os lançamentos (realizados) de um contrato, com motivo ─
const deleteSchema = z.object({
  contrato_id: z.number().int().positive(),
  motivo: z.string().min(1, 'Motivo obrigatório'),
})

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  const parsed = deleteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { contrato_id, motivo } = parsed.data

  const itens = await prisma.fabricacaoItem.findMany({
    where: { contrato_id },
    select: { id: true, _count: { select: { realizados: true } } },
  })
  const comLancamentos = itens.filter((it) => it._count.realizados > 0)
  const itemIds = comLancamentos.map((it) => it.id)

  if (itemIds.length === 0) {
    return NextResponse.json({ data: { ok: true, removidos: 0 }, error: null })
  }

  const hist: Prisma.FabricacaoItemHistoricoCreateManyInput[] = comLancamentos.map((it) => ({
    item_id: it.id,
    campo: 'Lançamentos excluídos',
    valor_de: `${it._count.realizados} lançamento(s)`,
    valor_para: `Motivo: ${motivo}`,
    created_by: userId,
  }))

  await prisma.$transaction([
    prisma.fabricacaoRealizado.deleteMany({ where: { item_id: { in: itemIds } } }),
    prisma.fabricacaoItemHistorico.createMany({ data: hist }),
  ])

  return NextResponse.json({ data: { ok: true, removidos: itemIds.length }, error: null })
}
