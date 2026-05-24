import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MESES_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

// GET /api/faturamento/consolidados
//   sem params  → lista consolidados disponíveis
//   ?mes=5&ano=2026 → retorna consolidado completo com faturado live
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const mesParam = searchParams.get('mes')
  const anoParam = searchParams.get('ano')

  // ── Lista de consolidados disponíveis ─────────────────────────────────────
  if (!mesParam || !anoParam) {
    const lista = await prisma.consolidadoMes.findMany({
      where: { arquivado_at: null },
      select: {
        id: true, mes: true, ano: true, created_at: true,
        _count: { select: { itens: true } },
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    })
    return NextResponse.json({
      data: lista.map((c) => ({
        id: c.id,
        mes: c.mes,
        ano: c.ano,
        created_at: c.created_at.toISOString(),
        qt_itens: c._count.itens,
      })),
      error: null,
    })
  }

  // ── Consolidado completo com faturado live ────────────────────────────────
  const mes = Number(mesParam)
  const ano = Number(anoParam)
  if (isNaN(mes) || isNaN(ano)) {
    return NextResponse.json({ data: null, error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const consolidado = await prisma.consolidadoMes.findFirst({
    where: { mes, ano, arquivado_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      itens: {
        include: {
          subindice: {
            include: {
              contrato: {
                include: { cliente: { select: { nome: true } } },
              },
              notas_fiscais: {
                where: { ativa: true },
              },
            },
          },
        },
        orderBy: { subindice: { contrato: { indice: 'asc' } } },
      },
    },
  })

  if (!consolidado) {
    return NextResponse.json({ data: null, error: null })
  }

  const inicioMes = new Date(ano, mes - 1, 1)
  const fimMes    = new Date(ano, mes, 1)

  const mesKey = MESES_KEYS[mes - 1]

  const itens = consolidado.itens.map((item) => {
    const faturado = item.subindice.notas_fiscais
      .filter((nf) => {
        const d = new Date(nf.data_emissao)
        return d >= inicioMes && d < fimMes
      })
      .reduce((a, nf) => a + Number(nf.valor_atribuido), 0)

    const valorConsolidado = Number(item.valor_previsto)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valorMesAtual    = Number((item.subindice as any)[mesKey] ?? 0)
    const perc = valorConsolidado > 0 ? (faturado / valorConsolidado) * 100 : 0

    return {
      id:                   item.id,
      subindice_id:         item.subindice_id,
      indice:               item.subindice.contrato.indice,
      cliente_nome:         item.subindice.contrato.cliente.nome,
      descricao_contrato:   item.subindice.contrato.descricao ?? null,
      ordem:                item.subindice.ordem,
      num_os:               item.subindice.num_os ?? null,
      descricao:            item.subindice.descricao,
      valor_consolidado:    valorConsolidado,
      valor_previsto:       valorMesAtual,
      valor_faturado:       faturado,
      percentual:           Number(perc.toFixed(1)),
    }
  })

  return NextResponse.json({
    data: {
      mes,
      ano,
      created_at: consolidado.created_at.toISOString(),
      itens,
    },
    error: null,
  })
}

// POST /api/faturamento/consolidados
//   body: { mes: number, ano: number, force?: boolean }
const schema = z.object({
  mes:   z.number().int().min(1).max(12),
  ano:   z.number().int().min(2000).max(2100),
  force: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  // RN-CF-14: apenas GESTAO_ACORDOS pode gerar consolidado
  if (session.user.perfil !== 'GESTAO_ACORDOS') {
    return NextResponse.json({ data: null, error: 'Apenas Gestão Acordos pode gerar consolidados' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const { mes, ano, force } = parsed.data
  const mesKey = MESES_KEYS[mes - 1]

  // Verifica se já existe consolidado ativo para este mês/ano
  const existente = await prisma.consolidadoMes.findFirst({
    where: { mes, ano, arquivado_at: null },
    select: { id: true },
  })

  if (existente && !force) {
    return NextResponse.json({ data: null, error: 'JA_EXISTE' }, { status: 409 })
  }

  // Busca todos os sub-índices com previsto > 0 para o mês
  const subindices = await prisma.subIndiceFaturamento.findMany({
    where: {
      contrato: { cancelled_at: null, ano_referencia: ano },
    },
    select: {
      id: true,
      jan: true, fev: true, mar: true, abr: true, mai: true, jun: true,
      jul: true, ago: true, set: true, out: true, nov: true, dez: true,
    },
  })

  // Filtra apenas os que têm valor previsto no mês solicitado
  const comPrevisto = subindices.filter((s) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (s as any)[mesKey]
    return v != null && Number(v) > 0
  })

  if (comPrevisto.length === 0) {
    return NextResponse.json({ data: null, error: 'Nenhum sub-índice com previsão para este mês' }, { status: 400 })
  }

  // RN-CF-12: arquiva o consolidado anterior em vez de excluir
  if (existente) {
    await prisma.consolidadoMes.update({
      where: { id: existente.id },
      data: { arquivado_at: new Date() },
    })
  }

  const consolidado = await prisma.consolidadoMes.create({
    data: {
      mes,
      ano,
      created_by: Number(session.user.id),
      itens: {
        create: comPrevisto.map((s) => ({
          subindice_id: s.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          valor_previsto: Number((s as any)[mesKey]),
        })),
      },
    },
    include: { _count: { select: { itens: true } } },
  })

  return NextResponse.json({
    data: { id: consolidado.id, mes, ano, qt_itens: consolidado._count.itens },
    error: null,
  }, { status: 201 })
}
