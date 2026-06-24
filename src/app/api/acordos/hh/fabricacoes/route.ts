import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

// Contratos elegíveis para Fabricações: classificação Fabricações ou Óleo e Gás
const CLASSIF_FABRICACAO = ['FABRICACOES', 'OLEO_GAS'] as const
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const mesLabel = (mes: number, ano: number) => `${MESES[mes]}/${String(ano).slice(2)}`

const fmtNum = (v: number | null | undefined) => (v == null ? '—' : String(v))
const fmtPeso = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (iso: string) => {
  const d = iso.slice(0, 10).split('-')
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso
}

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
        peso_previsto: m.peso_previsto != null ? Number(m.peso_previsto) : null,
      })),
      realizados: it.realizados.map((r) => ({
        mes: r.mes, ano: r.ano,
        hh_realizado: r.hh_realizado,
        peso_realizado: r.peso_realizado != null ? Number(r.peso_realizado) : null,
      })),
    }))

    const temItens = itens.length > 0
    const hhOrcado = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.hh_orcado ?? 0), 0), 0)
    const hhPrevisto = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.hh_previsto ?? 0), 0), 0)
    const hhRealizado = itens.reduce((a, i) => a + i.realizados.reduce((b, r) => b + (r.hh_realizado ?? 0), 0), 0)
    const pesoPrevisto = itens.reduce((a, i) => a + i.meses.reduce((b, m) => b + (m.peso_previsto ?? 0), 0), 0)
    const pesoRealizado = itens.reduce((a, i) => a + i.realizados.reduce((b, r) => b + (r.peso_realizado ?? 0), 0), 0)
    const pesoTotal = itens.reduce((a, i) => a + (i.peso_total ?? 0), 0)

    return {
      id: c.id, indice: c.indice, num_os: c.num_os, ano_referencia: c.ano_referencia,
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
      peso_total:     pesoTotal     > 0 ? pesoTotal     : null,
      peso_previsto:  pesoPrevisto  > 0 ? pesoPrevisto  : null,
      peso_realizado: pesoRealizado > 0 ? pesoRealizado : null,
      itens,
    }
  })

  if (disponivel) return NextResponse.json({ data: data.filter((c) => !c.tem_itens), error: null })
  return NextResponse.json({ data: data.filter((c) => c.tem_itens), error: null })
}

// ── POST: cria/atualiza itens de um contrato (in-place) + registra histórico ──
const mesSchema = z.object({
  mes: z.number().int().min(0).max(11),
  ano: z.number().int(),
  hh_orcado: z.number().int().nullable().optional(),
  hh_previsto: z.number().int().nullable().optional(),
  peso_previsto: z.number().nonnegative().nullable().optional(),
})
const itemSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
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

type Hist = { item_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const userId = Number(session.user.id)
  { const { erro } = await exigirPermissao('acordos.fab.itens.editar'); if (erro) return erro }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { contrato_id, itens } = parsed.data

  await prisma.$transaction(async (tx) => {
    const existentes = await tx.fabricacaoItem.findMany({
      where: { contrato_id },
      include: { meses: true },
    })
    const existentesById = new Map(existentes.map((it) => [it.id, it]))
    const idsPayload = new Set(itens.filter((it) => it.id != null).map((it) => it.id as number))
    const hist: Hist[] = []

    // Itens removidos
    for (const ex of existentes) {
      if (!idsPayload.has(ex.id)) {
        await tx.fabricacaoItem.delete({ where: { id: ex.id } })
      }
    }

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      const ex = it.id != null ? existentesById.get(it.id) : undefined

      if (!ex) {
        // ── Novo item ──
        const novo = await tx.fabricacaoItem.create({
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
                .filter((m) => m.hh_orcado != null || m.hh_previsto != null || m.peso_previsto != null)
                .map((m) => ({
                  mes: m.mes, ano: m.ano,
                  hh_orcado: m.hh_orcado ?? null,
                  hh_previsto: m.hh_previsto ?? null,
                  peso_previsto: m.peso_previsto ?? null,
                })),
            },
          },
        })
        hist.push({ item_id: novo.id, campo: 'Item criado', valor_de: null, valor_para: it.descricao, created_by: userId })
        continue
      }

      // ── Item existente: diff dos campos básicos ──
      const push = (campo: string, de: string, para: string) => {
        if (de !== para) hist.push({ item_id: ex.id, campo, valor_de: de, valor_para: para, created_by: userId })
      }
      push('Descrição', ex.descricao, it.descricao)
      push('Peso total (t)', fmtPeso(ex.peso_total != null ? Number(ex.peso_total) : null), fmtPeso(it.peso_total ?? null))
      push('Data início', fmtData(ex.data_inicio.toISOString()), fmtData(it.data_inicio))
      push('Data final', fmtData(ex.data_fim.toISOString()), fmtData(it.data_fim))

      await tx.fabricacaoItem.update({
        where: { id: ex.id },
        data: {
          descricao: it.descricao,
          peso_total: it.peso_total ?? null,
          data_inicio: new Date(it.data_inicio),
          data_fim: new Date(it.data_fim),
          ordem: i,
        },
      })

      // ── Diff dos meses (plano) ──
      const mesExById = new Map(ex.meses.map((m) => [`${m.ano}-${m.mes}`, m]))
      const chaves = new Set<string>([
        ...ex.meses.map((m) => `${m.ano}-${m.mes}`),
        ...it.meses.map((m) => `${m.ano}-${m.mes}`),
      ])
      for (const ch of Array.from(chaves)) {
        const novo = it.meses.find((m) => `${m.ano}-${m.mes}` === ch)
        const velho = mesExById.get(ch)
        const [ano, mes] = ch.split('-').map(Number)
        const lbl = mesLabel(mes, ano)

        const vO = velho?.hh_orcado ?? null,   nO = novo?.hh_orcado ?? null
        const vP = velho?.hh_previsto ?? null, nP = novo?.hh_previsto ?? null
        const vW = velho?.peso_previsto != null ? Number(velho.peso_previsto) : null
        const nW = novo?.peso_previsto ?? null
        if (vO !== nO) hist.push({ item_id: ex.id, campo: `HH Orçado ${lbl}`, valor_de: fmtNum(vO), valor_para: fmtNum(nO), created_by: userId })
        if (vP !== nP) hist.push({ item_id: ex.id, campo: `HH Previsto ${lbl}`, valor_de: fmtNum(vP), valor_para: fmtNum(nP), created_by: userId })
        if (vW !== nW) hist.push({ item_id: ex.id, campo: `Peso Previsto ${lbl}`, valor_de: fmtPeso(vW), valor_para: fmtPeso(nW), created_by: userId })
      }

      // Substitui os meses do item
      await tx.fabricacaoItemMes.deleteMany({ where: { item_id: ex.id } })
      const mesesValidos = it.meses.filter((m) => m.hh_orcado != null || m.hh_previsto != null || m.peso_previsto != null)
      if (mesesValidos.length > 0) {
        await tx.fabricacaoItemMes.createMany({
          data: mesesValidos.map((m) => ({
            item_id: ex.id, mes: m.mes, ano: m.ano,
            hh_orcado: m.hh_orcado ?? null,
            hh_previsto: m.hh_previsto ?? null,
            peso_previsto: m.peso_previsto ?? null,
          })),
        })
      }
    }

    if (hist.length > 0) {
      await tx.fabricacaoItemHistorico.createMany({ data: hist as Prisma.FabricacaoItemHistoricoCreateManyInput[] })
    }
  })

  return NextResponse.json({ data: { ok: true }, error: null })
}
