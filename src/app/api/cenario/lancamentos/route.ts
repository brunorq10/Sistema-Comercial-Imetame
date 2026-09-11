import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  proposta_comercial_id: z.number().int().positive(),
  cliente_nome: z.string().min(1),
  cliente_final_nome: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
  escopo: z.string().optional().nullable(),
  orcamentista_nome: z.string().optional().nullable(),
  classificacao: z.enum(['OBRAS', 'PARADAS', 'FABRICACOES', 'OLEO_GAS']),
  data_inicio: z.string().min(1),
  data_fim: z.string().min(1),
  efetivo: z.number().int().positive(),
  // Detalhamento mês a mês (Obras/Fabricações/Óleo e Gás) — chave "AAAA-MM".
  efetivo_mensal: z.record(z.string(), z.number().int().nonnegative()).optional().nullable(),
  observacao: z.string().optional().nullable(),
})

// POST /api/cenario/lancamentos — Etapa 2 do Novo Lançamento (confirma/ajusta e salva)
export async function POST(req: NextRequest) {
  const { erro, usuario } = await exigirPermissao('cenario.editar')
  if (erro) return erro

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data
  if (new Date(d.data_fim) < new Date(d.data_inicio)) {
    return NextResponse.json({ data: null, error: 'Data de fim não pode ser anterior à data de início' }, { status: 400 })
  }

  const proposta = await prisma.propostaComercial.findUnique({
    where: { id: d.proposta_comercial_id },
    select: { id: true, cenario_lancamento: { select: { id: true } } },
  })
  if (!proposta) return NextResponse.json({ data: null, error: 'Proposta não encontrada' }, { status: 404 })
  if (proposta.cenario_lancamento) {
    return NextResponse.json({ data: null, error: 'Esta proposta já está lançada no Cenário — edite o lançamento existente.' }, { status: 409 })
  }

  const lancamento = await prisma.cenarioLancamento.create({
    data: {
      proposta_comercial_id: d.proposta_comercial_id,
      cliente_nome: d.cliente_nome,
      cliente_final_nome: d.cliente_final_nome ?? null,
      cidade: d.cidade ?? null,
      estado: d.estado ?? null,
      escopo: d.escopo ?? null,
      orcamentista_nome: d.orcamentista_nome ?? null,
      classificacao: d.classificacao,
      data_inicio: new Date(d.data_inicio),
      data_fim: new Date(d.data_fim),
      efetivo: d.efetivo,
      efetivo_mensal: d.classificacao !== 'PARADAS' ? (d.efetivo_mensal ?? undefined) : undefined,
      observacao: d.observacao ?? null,
      created_by: usuario.id,
    },
  })

  return NextResponse.json({ data: lancamento, error: null }, { status: 201 })
}
