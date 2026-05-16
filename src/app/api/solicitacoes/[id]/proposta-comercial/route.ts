import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schemaPost = z.object({
  nao_aplicavel: z.boolean().optional(),
  proposta_tecnica_id: z.number().int().positive().optional(),
  // Obras/padrão: breakdown detalhado
  valor_montagem_mecanica: z.number().min(0).optional(),
  possui_terceiros: z.boolean().default(false),
  valor_eletrica: z.number().min(0).optional(),
  valor_isolamento: z.number().min(0).optional(),
  valor_civil: z.number().min(0).optional(),
  valor_hidraulica: z.number().min(0).optional(),
  valor_fibra: z.number().min(0).optional(),
  valor_tijolo_antiacido: z.number().min(0).optional(),
  valor_outros_terceiros: z.number().min(0).optional(),
  possui_fabricacao: z.boolean().default(false),
  valor_fabricacao: z.number().min(0).optional(),
  // Paradas: valor total direto + terceiros opcionais
  valor_total_direto: z.number().min(0).optional(),
  valor_terceiros: z.number().min(0).optional(),
  data_envio: z.string().optional(),
})

const schemaPatch = z.object({
  resultado: z.enum(['AGUARDANDO', 'GANHOU', 'PERDEU']),
  motivo_perda: z.enum(['PRECO', 'PRAZO', 'ESCOPO', 'CONCORRENCIA', 'CLIENTE_DESISTIU', 'OUTRO']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schemaPatch.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // RN-17: motivo obrigatório quando resultado = PERDEU
  if (parsed.data.resultado === 'PERDEU' && !parsed.data.motivo_perda) {
    return NextResponse.json(
      { data: null, error: 'Motivo de perda é obrigatório' },
      { status: 400 },
    )
  }

  const latestComercial = await prisma.propostaComercial.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latestComercial) {
    return NextResponse.json(
      { data: null, error: 'Nenhuma proposta comercial encontrada para esta solicitação' },
      { status: 404 },
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const comercial = await tx.propostaComercial.update({
      where: { id: latestComercial.id },
      data: {
        resultado: parsed.data.resultado,
        motivo_perda: parsed.data.resultado === 'PERDEU' ? (parsed.data.motivo_perda ?? null) : null,
      },
    })
    if (parsed.data.resultado === 'GANHOU') {
      await tx.solicitacao.update({
        where: { id },
        data: { status: 'CONTRATO_GANHO' },
      })
    }
    return comercial
  })

  return NextResponse.json({ data: result, error: null })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1 },
      propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1 },
    },
  })
  if (!sol || sol.cancelled_at) {
    return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })
  }

  const d = parsed.data
  const naoAplicavel = d.nao_aplicavel === true

  // Resolve proposta_tecnica_id: use provided, else auto-use latest técnica
  let tecnicaId: number | null = d.proposta_tecnica_id ?? null
  if (!naoAplicavel) {
    if (!tecnicaId) {
      return NextResponse.json({ data: null, error: 'Selecione a proposta técnica de referência' }, { status: 400 })
    }
    // Validate técnica belongs to this solicitação
    const tecnica = await prisma.propostaTecnica.findFirst({
      where: { id: tecnicaId, solicitacao_id: id },
    })
    if (!tecnica) {
      return NextResponse.json({ data: null, error: 'Proposta técnica não encontrada para esta solicitação' }, { status: 400 })
    }
  } else {
    // N/A comercial: auto-reference the latest técnica if available
    tecnicaId = sol.propostas_tecnicas[0]?.id ?? null
  }

  const maxVersaoCom = sol.propostas_comerciais[0]?.versao ?? 0
  const maxVersaoTecnica = sol.propostas_tecnicas[0]?.versao ?? 0
  const revisaoEsperada = Math.max(sol.revisao_esperada, maxVersaoTecnica)
  const versaoFinal = maxVersaoCom < revisaoEsperada ? revisaoEsperada : maxVersaoCom + 1

  let valorTotalGeral: number | null = null
  if (!naoAplicavel) {
    if (d.valor_total_direto !== undefined) {
      valorTotalGeral = d.valor_total_direto
    } else {
      const totalTerceiros = d.possui_terceiros
        ? (d.valor_eletrica ?? 0) + (d.valor_isolamento ?? 0) + (d.valor_civil ?? 0)
          + (d.valor_hidraulica ?? 0) + (d.valor_fibra ?? 0) + (d.valor_tijolo_antiacido ?? 0)
          + (d.valor_outros_terceiros ?? 0)
        : 0
      valorTotalGeral = (d.valor_montagem_mecanica ?? 0) + totalTerceiros + (d.possui_fabricacao ? (d.valor_fabricacao ?? 0) : 0)
    }
  }

  const [proposta] = await prisma.$transaction([
    prisma.propostaComercial.create({
      data: {
        solicitacao_id: id,
        proposta_tecnica_id: tecnicaId,
        versao: versaoFinal,
        nao_aplicavel: naoAplicavel,
        valor_montagem_mecanica: naoAplicavel ? null : (d.valor_montagem_mecanica ?? null),
        possui_terceiros: naoAplicavel ? false : d.possui_terceiros,
        valor_eletrica: (!naoAplicavel && d.possui_terceiros) ? (d.valor_eletrica ?? null) : null,
        valor_isolamento: (!naoAplicavel && d.possui_terceiros) ? (d.valor_isolamento ?? null) : null,
        valor_civil: (!naoAplicavel && d.possui_terceiros) ? (d.valor_civil ?? null) : null,
        valor_hidraulica: (!naoAplicavel && d.possui_terceiros) ? (d.valor_hidraulica ?? null) : null,
        valor_fibra: (!naoAplicavel && d.possui_terceiros) ? (d.valor_fibra ?? null) : null,
        valor_tijolo_antiacido: (!naoAplicavel && d.possui_terceiros) ? (d.valor_tijolo_antiacido ?? null) : null,
        valor_outros_terceiros: (!naoAplicavel && d.possui_terceiros) ? (d.valor_outros_terceiros ?? null) : null,
        possui_fabricacao: naoAplicavel ? false : d.possui_fabricacao,
        valor_fabricacao: (!naoAplicavel && d.possui_fabricacao) ? (d.valor_fabricacao ?? null) : null,
        valor_terceiros: naoAplicavel ? null : (d.valor_terceiros ?? null),
        valor_total: valorTotalGeral,
        data_envio: d.data_envio ? new Date(d.data_envio) : new Date(),
        created_by: Number(session.user.id),
      },
    }),
    // Submitting comercial (normal or N/A) always finalizes the revision
    prisma.solicitacao.update({
      where: { id },
      data: { status: 'PROPOSTA_ENVIADA' },
    }),
  ])

  return NextResponse.json({ data: proposta, error: null }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schemaPost.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const latest = await prisma.propostaComercial.findFirst({
    where: { solicitacao_id: id },
    orderBy: { versao: 'desc' },
  })
  if (!latest) {
    return NextResponse.json({ data: null, error: 'Nenhuma proposta comercial encontrada' }, { status: 404 })
  }

  const d = parsed.data
  let valorTotalGeral: number
  if (d.valor_total_direto !== undefined) {
    valorTotalGeral = d.valor_total_direto
  } else {
    const totalTerceiros = d.possui_terceiros
      ? (d.valor_eletrica ?? 0) + (d.valor_isolamento ?? 0) + (d.valor_civil ?? 0)
        + (d.valor_hidraulica ?? 0) + (d.valor_fibra ?? 0) + (d.valor_tijolo_antiacido ?? 0)
        + (d.valor_outros_terceiros ?? 0)
      : 0
    valorTotalGeral = (d.valor_montagem_mecanica ?? 0) + totalTerceiros + (d.possui_fabricacao ? (d.valor_fabricacao ?? 0) : 0)
  }

  const proposta = await prisma.propostaComercial.update({
    where: { id: latest.id },
    data: {
      proposta_tecnica_id: d.proposta_tecnica_id,
      valor_montagem_mecanica: d.valor_montagem_mecanica ?? null,
      possui_terceiros: d.possui_terceiros,
      valor_eletrica: d.possui_terceiros ? (d.valor_eletrica ?? null) : null,
      valor_isolamento: d.possui_terceiros ? (d.valor_isolamento ?? null) : null,
      valor_civil: d.possui_terceiros ? (d.valor_civil ?? null) : null,
      valor_fibra: d.possui_terceiros ? (d.valor_fibra ?? null) : null,
      valor_outros_terceiros: d.possui_terceiros ? (d.valor_outros_terceiros ?? null) : null,
      possui_fabricacao: d.possui_fabricacao,
      valor_fabricacao: d.possui_fabricacao ? (d.valor_fabricacao ?? null) : null,
      valor_terceiros: d.valor_terceiros ?? null,
      valor_total: valorTotalGeral,
      data_envio: d.data_envio ? new Date(d.data_envio) : latest.data_envio,
    },
  })

  return NextResponse.json({ data: proposta, error: null })
}
