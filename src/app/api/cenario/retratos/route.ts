import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'
import { computeOrigem, calcularIndicadores, CENARIO_LANCAMENTO_INCLUDE, toLinha, type CenarioLinha } from '@/lib/cenario'

// GET /api/cenario/retratos — histórico de retratos (mais recente primeiro)
export async function GET() {
  const { erro } = await exigirPermissao('cenario.ver')
  if (erro) return erro

  const retratos = await prisma.cenarioRetrato.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      criador: { select: { nome: true } },
      lancamentos: true,
    },
  })

  const data = retratos.map((r, i) => {
    const linhas: CenarioLinha[] = r.lancamentos.map((l) => ({
      id: l.id, proposta_comercial_id: l.proposta_comercial_id,
      cliente_nome: l.cliente_nome, cliente_final_nome: l.cliente_final_nome,
      cidade: l.cidade, estado: l.estado, escopo: l.escopo,
      classificacao: l.classificacao as 'OBRAS' | 'PARADAS' | 'FABRICACOES' | 'OLEO_GAS',
      origem: l.origem as 'CONTRATO' | 'PROPOSTA',
      data_inicio: l.data_inicio, data_fim: l.data_fim, efetivo: l.efetivo, efetivo_mensal: null, observacao: l.observacao,
    }))
    const ind = calcularIndicadores(linhas, r.capacidade_efetivo)
    return {
      id: r.id, nome: r.nome, observacao: r.observacao,
      created_at: r.created_at.toISOString(), autor: r.criador.nome,
      qtd_lancamentos: linhas.length, pico: ind.pico, mes_pico: ind.mesPico,
      mais_recente: i === 0,
    }
  })

  return NextResponse.json({ data, error: null })
}

const schema = z.object({
  nome: z.string().min(1),
  observacao: z.string().optional().nullable(),
})

// POST /api/cenario/retratos — congela o cenário atual como um retrato imutável
export async function POST(req: NextRequest) {
  const { erro, usuario } = await exigirPermissao('cenario.editar')
  if (erro) return erro

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const [cfg, rows] = await Promise.all([
    prisma.cenarioConfig.findFirst({ orderBy: { id: 'desc' } }),
    prisma.cenarioLancamento.findMany({ where: { cancelled_at: null }, include: CENARIO_LANCAMENTO_INCLUDE }),
  ])
  const ativos = rows.filter((r) => r.proposta_comercial.resultado !== 'PERDEU')
  const capacidade = cfg?.capacidade_efetivo ?? 0

  const retrato = await prisma.cenarioRetrato.create({
    data: {
      nome: parsed.data.nome,
      observacao: parsed.data.observacao ?? null,
      capacidade_efetivo: capacidade,
      created_by: usuario.id,
      lancamentos: {
        create: ativos.map((r) => {
          const l = toLinha(r)
          return {
            proposta_comercial_id: l.proposta_comercial_id,
            cliente_nome: l.cliente_nome, cliente_final_nome: l.cliente_final_nome,
            cidade: l.cidade, estado: l.estado, escopo: l.escopo,
            classificacao: l.classificacao, origem: computeOrigem(r.proposta_comercial.resultado),
            data_inicio: l.data_inicio, data_fim: l.data_fim, efetivo: l.efetivo, observacao: l.observacao,
          }
        }),
      },
    },
    include: { lancamentos: true },
  })

  return NextResponse.json({ data: { id: retrato.id, nome: retrato.nome, qtd_lancamentos: retrato.lancamentos.length }, error: null }, { status: 201 })
}
