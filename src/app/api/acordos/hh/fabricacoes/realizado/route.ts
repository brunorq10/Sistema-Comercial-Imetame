import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── POST: lança/atualiza HH realizado + % de avanço (incremento) por item/mês ──
const lancSchema = z.object({
  item_id: z.number().int().positive(),
  mes: z.number().int().min(0).max(11),
  ano: z.number().int(),
  hh_realizado: z.number().int().nullable().optional(),
  pct_avanco: z.number().nullable().optional(),
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

  await prisma.$transaction(
    parsed.data.lancamentos.map((l) => {
      const vazio = (l.hh_realizado == null || l.hh_realizado === 0) && (l.pct_avanco == null || l.pct_avanco === 0)
      // Célula vazia → remove eventual registro existente
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
          pct_avanco: l.pct_avanco ?? null,
          observacoes: l.observacoes ?? null,
          created_by: userId,
        },
        update: {
          hh_realizado: l.hh_realizado ?? null,
          pct_avanco: l.pct_avanco ?? null,
          observacoes: l.observacoes ?? null,
        },
      })
    }),
  )

  return NextResponse.json({ data: { ok: true }, error: null })
}
