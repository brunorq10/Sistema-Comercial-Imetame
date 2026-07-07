import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularSolicitacao } from '@/lib/permissaoApi'

const schema = z.object({
  cliente_faturamento_id: z.number().int().positive(),
  data_inicio: z.string().min(1),
  data_fim: z.string().min(1),
  responsavel_imetame: z.string().trim().min(1),
  local_realizacao: z.string().trim().min(1),
  gestor_cliente: z.string().trim().min(1),
  unidade_medida: z.enum(['KG', 'TON', 'PC', 'CJ']),
  quantidade: z.number().positive(),
  ncm: z.string().trim().optional(),
  pintura: z.boolean(),
  retorno: z.boolean(),
  memorial_calculo: z.boolean(),
  material: z.enum(['IMETAME', 'TERCEIROS', 'AMBOS']).optional(),
  art: z.boolean(),
  databook: z.boolean(),
  material_apoio: z.boolean(),
  comentario: z.string().trim().optional(),
  // obrigatória apenas na edição de um relatório já gravado
  justificativa: z.string().trim().optional(),
})

// GET — consulta o Relatório de OS da solicitação (aba Solicitações e Propostas)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const rel = await prisma.relatorioOS.findUnique({
    where: { solicitacao_id: id },
    include: { cliente_faturamento: { select: { id: true, nome: true } }, criador: { select: { nome: true } } },
  })
  if (!rel) return NextResponse.json({ data: null, error: null })

  return NextResponse.json({
    data: {
      ...rel,
      valor_estimado: Number(rel.valor_estimado),
      quantidade: Number(rel.quantidade),
      data_inicio: rel.data_inicio.toISOString(),
      data_fim: rel.data_fim.toISOString(),
      created_at: rel.created_at.toISOString(),
      updated_at: rel.updated_at.toISOString(),
      criador: rel.criador.nome,
    },
    error: null,
  })
}

// POST — grava (cria ou edita). Edição exige justificativa, registrada no histórico.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularSolicitacao(session, id, 'orc.proposta.enviar'); if (_n) return _n }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data

  // Contexto: campos automáticos vêm da solicitação/proposta consolidada
  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente_final: { select: { nome: true } },
      propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1, select: { valor_total: true, resultado: true } },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1, select: { valor_total: true, resultado: true } },
    },
  })
  if (!sol || sol.cancelled_at) return NextResponse.json({ data: null, error: 'Solicitação não encontrada' }, { status: 404 })

  const com = sol.propostas_comerciais[0]
  const fab = sol.propostas_fabricacao[0]
  const ganhou = com?.resultado === 'GANHOU' || fab?.resultado === 'GANHOU'
  if (!ganhou) {
    return NextResponse.json({ data: null, error: 'O Relatório de OS só está disponível quando o resultado da proposta é Ganhou.' }, { status: 409 })
  }
  const valorEstimado = Number(com?.valor_total ?? fab?.valor_total ?? 0)

  const existente = await prisma.relatorioOS.findUnique({ where: { solicitacao_id: id } })
  if (existente && (!d.justificativa || d.justificativa.length < 5)) {
    return NextResponse.json({ data: null, error: 'Justificativa obrigatória para editar o Relatório de OS (mín. 5 caracteres)' }, { status: 400 })
  }

  const dados = {
    classificacao: sol.classificacao ?? '',
    cliente_faturamento_id: d.cliente_faturamento_id,
    cliente_final: sol.cliente_final?.nome ?? null,
    numero_solicitacao: sol.numero,
    data_inicio: new Date(d.data_inicio),
    data_fim: new Date(d.data_fim),
    responsavel_imetame: d.responsavel_imetame,
    local_realizacao: d.local_realizacao,
    gestor_cliente: d.gestor_cliente,
    valor_estimado: valorEstimado,
    escopo: sol.escopo ?? '',
    unidade_medida: d.unidade_medida,
    quantidade: d.quantidade,
    ncm: d.ncm || null,
    pintura: d.pintura,
    retorno: d.retorno,
    memorial_calculo: d.memorial_calculo,
    material: d.material ?? null,
    art: d.art,
    databook: d.databook,
    material_apoio: d.material_apoio,
    comentario: d.comentario || null,
  }

  const rel = existente
    ? await prisma.relatorioOS.update({ where: { solicitacao_id: id }, data: dados })
    : await prisma.relatorioOS.create({ data: { ...dados, solicitacao_id: id, created_by: Number(session.user.id) } })

  // Edição fica registrada no histórico com data e justificativa
  if (existente) {
    await prisma.historicoSolicitacao.create({
      data: {
        solicitacao_id: id,
        campo: 'Relatório de OS',
        valor_de: 'Editado',
        valor_para: `Justificativa: ${d.justificativa}`,
        created_by: Number(session.user.id),
      },
    })
  }

  return NextResponse.json({ data: { id: rel.id }, error: null })
}
