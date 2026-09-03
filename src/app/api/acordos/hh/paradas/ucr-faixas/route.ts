import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao, respostaNaoAutorizado } from '@/lib/permissaoApi'
import { UCR_CAMPOS, UCR_REGIOES, type UcrCampo } from '@/lib/ucr'

const hojeISO = () => new Date().toISOString().substring(0, 10)

// GET — vigências de UCR por região (vigentes + histórico de versões vencidas)
// + histórico de alterações de campo + regiões sem cobertura hoje (alerta).
// Leitura liberada a qualquer usuário autenticado do módulo Acordos.
export async function GET() {
  const session = await auth()
  if (!session) return respostaNaoAutorizado()

  const [todas, alteracoes] = await Promise.all([
    prisma.ucrFaixaVigencia.findMany({
      include: { criador: { select: { nome: true } }, atualizador: { select: { nome: true } } },
      orderBy: [{ regiao: 'asc' }, { vigencia_inicio: 'desc' }],
    }),
    prisma.ucrFaixaHistorico.findMany({
      include: { usuario: { select: { nome: true } }, vigencia: { select: { regiao: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
  ])

  const hoje = hojeISO()
  const serialize = (v: (typeof todas)[number]) => ({
    id: v.id,
    regiao: v.regiao,
    vigencia_inicio: v.vigencia_inicio.toISOString().substring(0, 10),
    vigencia_fim: v.vigencia_fim.toISOString().substring(0, 10),
    ucr_nao_suficiente: Number(v.ucr_nao_suficiente),
    ucr_a_evoluir: Number(v.ucr_a_evoluir),
    ucr_bom: Number(v.ucr_bom),
    ucr_otimo: Number(v.ucr_otimo),
    ucr_esplendido: Number(v.ucr_esplendido),
    created_at: v.created_at.toISOString(),
    criador_nome: v.criador.nome,
    updated_at: v.updated_at.toISOString(),
    atualizador_nome: v.atualizador?.nome ?? null,
  })

  const vigentes  = todas.filter((v) => v.vigencia_fim.toISOString().substring(0, 10) >= hoje).map(serialize)
  const historico = todas.filter((v) => v.vigencia_fim.toISOString().substring(0, 10) <  hoje).map(serialize)

  // Alerta: regiões sem nenhuma vigência cobrindo hoje
  const regioesSemCobertura = UCR_REGIOES.map((r) => r.regiao).filter((regiao) =>
    !vigentes.some((v) => v.regiao === regiao && v.vigencia_inicio <= hoje && v.vigencia_fim >= hoje))

  return NextResponse.json({
    data: {
      vigentes,
      historico,
      alertas: regioesSemCobertura,
      alteracoes: alteracoes.map((h) => ({
        id: h.id,
        regiao: h.vigencia.regiao,
        vigencia_id: h.vigencia_id,
        campo: h.campo,
        valor_de: h.valor_de,
        valor_para: h.valor_para,
        created_at: h.created_at.toISOString(),
        usuario_nome: h.usuario.nome,
      })),
    },
    error: null,
  })
}

const valoresSchema = {
  ucr_nao_suficiente: z.number(),
  ucr_a_evoluir: z.number(),
  ucr_bom: z.number(),
  ucr_otimo: z.number(),
  ucr_esplendido: z.number(),
}

const createSchema = z.object({
  regiao: z.enum(['ES', 'MG', 'BAHIA', 'SP', 'OUTROS']),
  vigencia_inicio: z.string(),
  vigencia_fim: z.string(),
  ...valoresSchema,
})

// Duas vigências da mesma região se sobrepõem se um período começa antes do
// outro terminar e termina depois do outro começar.
async function existeSobreposicao(regiao: string, inicio: string, fim: string, excluirId?: number) {
  const conflito = await prisma.ucrFaixaVigencia.findFirst({
    where: {
      regiao: regiao as never,
      ...(excluirId ? { id: { not: excluirId } } : {}),
      vigencia_inicio: { lte: new Date(fim) },
      vigencia_fim: { gte: new Date(inicio) },
    },
  })
  return !!conflito
}

// POST — cadastra uma nova vigência (período + 5 valores) para uma região.
// Bloqueia sobreposição de datas com vigências já cadastradas da mesma região.
export async function POST(req: NextRequest) {
  const { erro, usuario } = await exigirPermissao('acordos.paradas.ucr.editar')
  if (erro) return erro

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Dados inválidos' }, { status: 400 })
  const { regiao, vigencia_inicio, vigencia_fim, ...valores } = parsed.data

  if (vigencia_fim < vigencia_inicio) {
    return NextResponse.json({ data: null, error: 'A data de fim deve ser posterior à data de início' }, { status: 400 })
  }
  if (await existeSobreposicao(regiao, vigencia_inicio, vigencia_fim)) {
    return NextResponse.json({ data: null, error: 'Já existe uma vigência cadastrada para esta região neste período' }, { status: 409 })
  }

  const vigencia = await prisma.ucrFaixaVigencia.create({
    data: {
      regiao, vigencia_inicio: new Date(vigencia_inicio), vigencia_fim: new Date(vigencia_fim),
      ...valores, created_by: usuario.id,
    },
  })

  return NextResponse.json({ data: { vigencia }, error: null })
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  vigencia_inicio: z.string(),
  vigencia_fim: z.string(),
  ...valoresSchema,
})

// PUT — edita uma vigência existente (valores e/ou período). Grava histórico
// De/Para apenas dos campos que realmente mudaram.
export async function PUT(req: NextRequest) {
  const { erro, usuario } = await exigirPermissao('acordos.paradas.ucr.editar')
  if (erro) return erro

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Dados inválidos' }, { status: 400 })
  const { id, vigencia_inicio, vigencia_fim, ...valores } = parsed.data

  const atual = await prisma.ucrFaixaVigencia.findUnique({ where: { id } })
  if (!atual) return NextResponse.json({ data: null, error: 'Vigência não encontrada' }, { status: 404 })

  if (vigencia_fim < vigencia_inicio) {
    return NextResponse.json({ data: null, error: 'A data de fim deve ser posterior à data de início' }, { status: 400 })
  }
  if (await existeSobreposicao(atual.regiao, vigencia_inicio, vigencia_fim, id)) {
    return NextResponse.json({ data: null, error: 'Já existe uma vigência cadastrada para esta região neste período' }, { status: 409 })
  }

  const historicoParaCriar: { vigencia_id: number; campo: string; valor_de: string | null; valor_para: string; created_by: number }[] = []
  for (const campo of UCR_CAMPOS as UcrCampo[]) {
    const valorPara = valores[campo]
    const valorDe = Number(atual[campo])
    if (valorDe !== valorPara) {
      historicoParaCriar.push({ vigencia_id: id, campo, valor_de: String(valorDe), valor_para: String(valorPara), created_by: usuario.id })
    }
  }
  const inicioAtualStr = atual.vigencia_inicio.toISOString().substring(0, 10)
  const fimAtualStr = atual.vigencia_fim.toISOString().substring(0, 10)
  if (inicioAtualStr !== vigencia_inicio) {
    historicoParaCriar.push({ vigencia_id: id, campo: 'vigencia_inicio', valor_de: inicioAtualStr, valor_para: vigencia_inicio, created_by: usuario.id })
  }
  if (fimAtualStr !== vigencia_fim) {
    historicoParaCriar.push({ vigencia_id: id, campo: 'vigencia_fim', valor_de: fimAtualStr, valor_para: vigencia_fim, created_by: usuario.id })
  }

  const [vigencia] = await prisma.$transaction([
    prisma.ucrFaixaVigencia.update({
      where: { id },
      data: { vigencia_inicio: new Date(vigencia_inicio), vigencia_fim: new Date(vigencia_fim), ...valores, updated_by: usuario.id },
    }),
    ...(historicoParaCriar.length > 0 ? [prisma.ucrFaixaHistorico.createMany({ data: historicoParaCriar })] : []),
  ])

  return NextResponse.json({ data: { vigencia, alteracoes: historicoParaCriar.length }, error: null })
}
