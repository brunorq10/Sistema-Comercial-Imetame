import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Contratos elegíveis para Fabricações: classificação Fabricações ou Óleo e Gás
const CLASSIF_FABRICACAO = ['FABRICACOES', 'OLEO_GAS'] as const

// ── GET: lista contratos de Fabricação/Óleo-Gás com seus itens ────────────────
// ?disponivel=1 → contratos SEM itens (para o cadastro); senão → contratos COM itens
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const disponivel = req.nextUrl.searchParams.get('disponivel') === '1'

  const contratos = await prisma.contrato.findMany({
    where: { cancelled_at: null, classificacao: { in: CLASSIF_FABRICACAO as unknown as string[] as never } },
    orderBy: { indice: 'asc' },
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      fabricacao_itens: {
        orderBy: { ordem: 'asc' },
        include: {
          meses:      true,
          realizados: true,
        },
      },
    },
  })

  const data = contratos.map((c) => {
    const itens = c.fabricacao_itens.map((it) => ({
      id: it.id,
      descricao: it.descricao,
      peso_total: it.peso_total != null ? Number(it.peso_total) : null,
      data_inicio: it.data_inicio.toISOString(),
      data_fim: it.data_fim.toISOString(),
      ordem: it.ordem,
      meses: it.meses.map((m) => ({
        mes: m.mes, ano: m.ano,
        hh_orcado: m.hh_orcado, hh_previsto: m.hh_previsto,
      })),
      realizados: it.realizados.map((r) => ({
        mes: r.mes, ano: r.ano,
        hh_realizado: r.hh_realizado,
        pct_avanco: r.pct_avanco != null ? Number(r.pct_avanco) : null,
      })),
    }))

    const temItens = itens.length > 0
    const hhOrcado = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.hh_orcado ?? 0), 0), 0)
    const hhPrevisto = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.hh_previsto ?? 0), 0), 0)
    const hhRealizado = itens.reduce((a, i) => a + i.realizados.reduce((b, r) => b + (r.hh_realizado ?? 0), 0), 0)

    return {
      id: c.id, indice: c.indice, num_os: c.num_os,
      num_acordo: c.num_acordo ?? null, num_proposta: c.num_proposta ?? null,
      cidade: c.cidade, estado: c.estado, classificacao: c.classificacao,
      cliente: c.cliente, cliente_final: c.cliente_final ?? null,
      descricao: c.descricao, responsavel: c.responsavel,
      data_inicio: c.data_inicio?.toISOString() ?? null,
      data_fim:    c.data_fim?.toISOString()    ?? null,
      tem_itens: temItens,
      hh_orcado:   hhOrcado   > 0 ? hhOrcado   : null,
      hh_previsto: hhPrevisto > 0 ? hhPrevisto : null,
      hh_realizado: hhRealizado > 0 ? hhRealizado : null,
      itens,
    }
  })

  if (disponivel) return NextResponse.json({ data: data.filter((c) => !c.tem_itens), error: null })
  return NextResponse.json({ data: data.filter((c) => c.tem_itens), error: null })
}

// ── POST: substitui (upsert) todos os itens de um contrato ────────────────────
const mesSchema = z.object({
  mes: z.number().int().min(0).max(11),
  ano: z.number().int(),
  hh_orcado: z.number().int().nullable().optional(),
  hh_previsto: z.number().int().nullable().optional(),
})
const itemSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  peso_total: z.number().nonnegative().nullable().optional(),
  data_inicio: z.string().min(1, 'Data início obrigatória'),
  data_fim: z.string().min(1, 'Data final obrigatória'),
  meses: z.array(mesSchema).default([]),
})
const bodySchema = z.object({
  contrato_id: z.number().int().positive(),
  itens: z.array(itemSchema).min(1, 'Inclua ao menos um item'),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { contrato_id, itens } = parsed.data

  await prisma.$transaction(async (tx) => {
    // Remove itens anteriores (cascade apaga meses e realizados)
    await tx.fabricacaoItem.deleteMany({ where: { contrato_id } })

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      await tx.fabricacaoItem.create({
        data: {
          contrato_id,
          descricao: it.descricao,
          peso_total: it.peso_total ?? null,
          data_inicio: new Date(it.data_inicio),
          data_fim: new Date(it.data_fim),
          ordem: i,
          created_by: userId,
          meses: {
            create: it.meses
              .filter((m) => m.hh_orcado != null || m.hh_previsto != null)
              .map((m) => ({
                mes: m.mes, ano: m.ano,
                hh_orcado: m.hh_orcado ?? null,
                hh_previsto: m.hh_previsto ?? null,
              })),
          },
        },
      })
    }
  })

  return NextResponse.json({ data: { ok: true }, error: null })
}
