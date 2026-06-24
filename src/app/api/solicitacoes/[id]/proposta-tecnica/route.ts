import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { exigirTitularSolicitacao } from '@/lib/permissaoApi'

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
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.proposta.enviar'); if (_n) return _n }

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
  // If a técnica already exists for the current revision, update it (don't create a new revision).
  // Only "Nova Revisão" (via /nova-revisao) is allowed to bump the revision number.
  const existingForRevision = sol.propostas_tecnicas.find(pt => pt.versao === revisaoEsperada) ?? null
  const versaoFinal = revisaoEsperada

  const tecData = {
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
  }

  try {
    const proposta = existingForRevision
      ? await prisma.propostaTecnica.update({
          where: { id: existingForRevision.id },
          data: tecData,
        })
      : await prisma.propostaTecnica.create({
          data: {
            solicitacao_id: id,
            versao: versaoFinal,
            ...tecData,
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
  } catch (err) {
    logger.error('[POST /api/solicitacoes/[id]/proposta-tecnica]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.proposta.enviar'); if (_n) return _n }

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

  // Log changes in SolicitacaoInfo
  type NumField = { label: string; before: number | null; after: number | null }
  type StrField = { label: string; before: string | null; after: string | null }
  type BoolField = { label: string; before: boolean | null; after: boolean | null }
  const numFields: NumField[] = [
    { label: 'HH Direto',   before: latest.hh_direto,   after: d.hh_direto ?? null },
    { label: 'HH Indireto', before: latest.hh_indireto, after: d.hh_indireto ?? null },
    { label: 'HH Total',    before: latest.hh_total,    after: resolveHhTotal(d) },
    { label: 'Efetivo Pico', before: latest.efetivo_pico, after: d.efetivo_pico ?? null },
    { label: 'Dias Parada',  before: latest.dias_parada,  after: d.dias_parada ?? null },
    { label: 'Peso Mont. (t)', before: latest.peso_montagem ? Number(latest.peso_montagem) : null, after: resolvePesoMontagem(d) },
    { label: 'Peso Equip. (t)', before: latest.peso_equipamentos ? Number(latest.peso_equipamentos) : null, after: d.peso_equipamentos ?? null },
    { label: 'Peso Tub. (t)',   before: latest.peso_tubulacoes  ? Number(latest.peso_tubulacoes)  : null, after: d.peso_tubulacoes  ?? null },
    { label: 'Peso Sup. (t)',   before: latest.peso_suportes    ? Number(latest.peso_suportes)    : null, after: d.peso_suportes    ?? null },
    { label: 'Peso Estr. (t)',  before: latest.peso_estruturas  ? Number(latest.peso_estruturas)  : null, after: d.peso_estruturas  ?? null },
  ]
  const strFields: StrField[] = [
    { label: 'Turno', before: latest.turno, after: d.turno ?? null },
    { label: 'Data Envio Tec.', before: latest.data_envio?.toISOString().split('T')[0] ?? null, after: d.data_envio ?? null },
  ]
  const boolFields: BoolField[] = [
    { label: 'Finais de Semana', before: latest.finais_de_semana, after: d.finais_de_semana ?? null },
  ]

  const diffs: string[] = []
  for (const f of numFields) {
    const a = f.before != null ? Number(f.before) : null
    const b = f.after != null ? Number(f.after) : null
    if (a !== b) diffs.push(`${f.label}: ${a ?? '—'} → ${b ?? '—'}`)
  }
  for (const f of strFields) {
    if ((f.before ?? '') !== (f.after ?? '')) diffs.push(`${f.label}: ${f.before ?? '—'} → ${f.after ?? '—'}`)
  }
  for (const f of boolFields) {
    if (f.before !== f.after) diffs.push(`${f.label}: ${f.before ? 'Sim' : 'Não'} → ${f.after ? 'Sim' : 'Não'}`)
  }

  if (diffs.length > 0) {
    const rev = `Rev${String(latest.versao).padStart(2, '0')}`
    const userId = Number(session.user.id)

    type HistEntry = { solicitacao_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }
    const histEntries: HistEntry[] = []

    for (const f of numFields) {
      const a = f.before != null ? Number(f.before) : null
      const b = f.after  != null ? Number(f.after)  : null
      if (a !== b) histEntries.push({ solicitacao_id: id, campo: `Proposta Técnica ${rev} — ${f.label}`, valor_de: a != null ? String(a) : null, valor_para: b != null ? String(b) : null, created_by: userId })
    }
    for (const f of strFields) {
      if ((f.before ?? '') !== (f.after ?? '')) histEntries.push({ solicitacao_id: id, campo: `Proposta Técnica ${rev} — ${f.label}`, valor_de: f.before, valor_para: f.after, created_by: userId })
    }
    for (const f of boolFields) {
      if (f.before !== f.after) histEntries.push({ solicitacao_id: id, campo: `Proposta Técnica ${rev} — ${f.label}`, valor_de: f.before != null ? (f.before ? 'Sim' : 'Não') : null, valor_para: f.after != null ? (f.after ? 'Sim' : 'Não') : null, created_by: userId })
    }

    await Promise.all([
      prisma.solicitacaoInfo.create({
        data: { solicitacao_id: id, data: new Date(), comentario: `[Edição Técnica ${rev}] ${diffs.join(' | ')}`, versao: latest.versao, created_by: userId },
      }),
      histEntries.length > 0 ? prisma.historicoSolicitacao.createMany({ data: histEntries }) : Promise.resolve(),
    ])
  }

  return NextResponse.json({ data: proposta, error: null })
}
