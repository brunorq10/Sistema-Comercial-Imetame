import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

const schema = z.object({
  nao_aplicavel: z.boolean().optional(),
  data_base: z.string().optional(),
  // Campos comuns (Obras/Paradas)
  hh_direto: z.number().int().positive().optional(),
  hh_indireto: z.number().int().min(0).optional(),
  hh_total: z.number().int().positive().optional(), // entrada direta para Obras
  peso_montagem: z.number().positive().optional(),
  data_envio: z.string().optional(),
  // Campos exclusivos Paradas
  efetivo_pico: z.number().int().positive().optional(),
  dias_parada: z.number().int().positive().optional(),
  turno: z.string().max(100).optional(),
  finais_de_semana: z.boolean().optional(),
  // Campos exclusivos Obras (pesos por categoria)
  peso_equipamentos: z.number().min(0).optional(),
  peso_tubulacoes: z.number().min(0).optional(),
  peso_suportes: z.number().min(0).optional(),
  peso_estruturas: z.number().min(0).optional(),
})

function resolveHhTotal(d: z.infer<typeof schema>): number | null {
  if (d.hh_total !== undefined) return d.hh_total
  if (d.hh_direto !== undefined && d.hh_indireto !== undefined) return d.hh_direto + d.hh_indireto
  return null
}

function resolvePesoMontagem(d: z.infer<typeof schema>): number | null {
  if (d.peso_montagem !== undefined) return d.peso_montagem
  const hasCategoria = d.peso_equipamentos !== undefined || d.peso_tubulacoes !== undefined
    || d.peso_suportes !== undefined || d.peso_estruturas !== undefined
  if (hasCategoria) {
    return (d.peso_equipamentos ?? 0) + (d.peso_tubulacoes ?? 0)
      + (d.peso_suportes ?? 0) + (d.peso_estruturas ?? 0)
  }
  return null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: { propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1 } },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const naoAplicavel = d.nao_aplicavel === true

  if (!naoAplicavel) {
    const hasHh = (d.hh_direto !== undefined && d.hh_indireto !== undefined) || d.hh_total !== undefined
    const hasPeso = d.peso_montagem !== undefined || d.peso_equipamentos !== undefined
      || d.peso_tubulacoes !== undefined || d.peso_suportes !== undefined || d.peso_estruturas !== undefined
    if (!hasHh && !hasPeso) {
      return NextResponse.json({ data: null, error: 'Informe os dados da proposta técnica' }, { status: 400 })
    }
  }

  const maxVersaoTecnica = sol.propostas_tecnicas[0]?.versao ?? 0
  const revisaoEsperada = Math.max(sol.revisao_esperada, maxVersaoTecnica)
  const versaoFinal = maxVersaoTecnica < revisaoEsperada ? revisaoEsperada : maxVersaoTecnica + 1

  const proposta = await prisma.propostaTecnica.create({
    data: {
      solicitacao_id: id,
      versao: versaoFinal,
      nao_aplicavel: naoAplicavel,
      hh_direto: naoAplicavel ? null : (d.hh_direto ?? null),
      hh_indireto: naoAplicavel ? null : (d.hh_indireto ?? null),
      hh_total: naoAplicavel ? null : resolveHhTotal(d),
      peso_montagem: naoAplicavel ? null : resolvePesoMontagem(d),
      peso_equipamentos: naoAplicavel ? null : (d.peso_equipamentos ?? null),
      peso_tubulacoes: naoAplicavel ? null : (d.peso_tubulacoes ?? null),
      peso_suportes: naoAplicavel ? null : (d.peso_suportes ?? null),
      peso_estruturas: naoAplicavel ? null : (d.peso_estruturas ?? null),
      efetivo_pico: naoAplicavel ? null : (d.efetivo_pico ?? null),
      dias_parada: naoAplicavel ? null : (d.dias_parada ?? null),
      turno: naoAplicavel ? null : (d.turno ?? null),
      finais_de_semana: naoAplicavel ? null : (d.finais_de_semana ?? null),
      data_base: d.data_base ? new Date(d.data_base) : null,
      data_envio: d.data_envio ? new Date(d.data_envio) : new Date(),
      created_by: Number(session.user.id),
    },
  })

  const novoStatus = sol.status === 'AGUARDANDO_ANALISE' ? 'EM_ELABORACAO' : undefined
  if (novoStatus) {
    await prisma.solicitacao.update({ where: { id }, data: { status: novoStatus } })
  }

  // RN-50: Notificar ADM_COMERCIAL sobre nova proposta técnica (não-bloqueante)
  const admins = await prisma.user.findMany({
    where: { perfil: 'ADM_COMERCIAL', ativo: true },
    select: { id: true },
  })
  const linkSol = `/orcamentos/solicitacoes/${id}`
  for (const admin of admins) {
    createNotificacao(
      admin.id,
      `Proposta técnica enviada — ${sol.numero}`,
      `Rev${String(versaoFinal - 1).padStart(2, '0')} registrada${naoAplicavel ? ' (N/A)' : ''}.`,
      linkSol,
    )
  }

  return NextResponse.json({ data: proposta, error: null }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const latest = await prisma.propostaTecnica.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta técnica encontrada' }, { status: 404 })
  }

  const d = parsed.data

  const proposta = await prisma.propostaTecnica.update({
    where: { id: latest.id },
    data: {
      hh_direto: d.hh_direto ?? null,
      hh_indireto: d.hh_indireto ?? null,
      hh_total: resolveHhTotal(d),
      peso_montagem: resolvePesoMontagem(d),
      peso_equipamentos: d.peso_equipamentos ?? null,
      peso_tubulacoes: d.peso_tubulacoes ?? null,
      peso_suportes: d.peso_suportes ?? null,
      peso_estruturas: d.peso_estruturas ?? null,
      efetivo_pico: d.efetivo_pico ?? null,
      dias_parada: d.dias_parada ?? null,
      turno: d.turno ?? null,
      finais_de_semana: d.finais_de_semana ?? null,
      data_base: d.data_base ? new Date(d.data_base) : latest.data_base,
      data_envio: d.data_envio ? new Date(d.data_envio) : latest.data_envio,
    },
  })

  return NextResponse.json({ data: proposta, error: null })
}
