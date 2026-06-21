import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── POST: lança/atualiza HH e peso realizado por item/mês ─────────────────────
// O % de avanço (incremento do mês) é CALCULADO = peso_realizado / peso_total do item.
const lancSchema = z.object({
  item_id: z.number().int().positive(),
  mes: z.number().int().min(0).max(11),
  ano: z.number().int(),
  hh_realizado: z.number().int().nullable().optional(),
  peso_previsto: z.number().nonnegative().nullable().optional(),
  peso_realizado: z.number().nonnegative().nullable().optional(),
  observacoes: z.string().nullable().optional(),
})
const bodySchema = z.object({
  lancamentos: z.array(lancSchema).min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  // Peso total de cada item envolvido → base do cálculo do % de avanço
  const itemIds = Array.from(new Set(parsed.data.lancamentos.map((l) => l.item_id)))
  const itens = await prisma.fabricacaoItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, peso_total: true },
  })
  const pesoTotalPorItem = new Map(itens.map((it) => [it.id, it.peso_total != null ? Number(it.peso_total) : 0]))

  await prisma.$transaction(
    parsed.data.lancamentos.map((l) => {
      const vazio =
        (l.hh_realizado == null || l.hh_realizado === 0) &&
        (l.peso_previsto == null || l.peso_previsto === 0) &&
        (l.peso_realizado == null || l.peso_realizado === 0)
      // Célula vazia → remove eventual registro existente
      if (vazio) {
        return prisma.fabricacaoRealizado.deleteMany({
          where: { item_id: l.item_id, mes: l.mes, ano: l.ano },
        })
      }
      // % de avanço do mês = peso realizado / peso total do item × 100 (incremento)
      const pesoTotal = pesoTotalPorItem.get(l.item_id) ?? 0
      const pct = l.peso_realizado != null && pesoTotal > 0
        ? Number(((l.peso_realizado / pesoTotal) * 100).toFixed(2))
        : null
      return prisma.fabricacaoRealizado.upsert({
        where: { item_id_mes_ano: { item_id: l.item_id, mes: l.mes, ano: l.ano } },
        create: {
          item_id: l.item_id, mes: l.mes, ano: l.ano,
          hh_realizado: l.hh_realizado ?? null,
          peso_previsto: l.peso_previsto ?? null,
          peso_realizado: l.peso_realizado ?? null,
          pct_avanco: pct,
          observacoes: l.observacoes ?? null,
          created_by: userId,
        },
        update: {
          hh_realizado: l.hh_realizado ?? null,
          peso_previsto: l.peso_previsto ?? null,
          peso_realizado: l.peso_realizado ?? null,
          pct_avanco: pct,
          observacoes: l.observacoes ?? null,
        },
      })
    }),
  )

  return NextResponse.json({ data: { ok: true }, error: null })
}
