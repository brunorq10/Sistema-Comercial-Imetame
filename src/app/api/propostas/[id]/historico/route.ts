import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sol = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      cliente:       { select: { nome: true } },
      cliente_final: { select: { nome: true } },
      orcamentista:  { select: { nome: true } },
      propostas_tecnicas:   { orderBy: { versao: 'asc' } },
      propostas_comerciais: { orderBy: { versao: 'asc' } },
      propostas_fabricacao: {
        orderBy: { versao: 'asc' },
        include: { equipamentos: { orderBy: { ordem: 'asc' } } },
      },
      // Linha do Tempo é carregada sob demanda (paginada/filtrada) por
      // /api/solicitacoes/[id]/informacoes — não embutimos tudo aqui.
    },
  })

  if (!sol) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  const dataBase =
    sol.propostas_comerciais.slice().reverse().find((pc) => pc.data_base)?.data_base ??
    sol.propostas_fabricacao.slice().reverse().find((pf) => pf.data_base)?.data_base ??
    null

  return NextResponse.json({
    data: {
      id: sol.id,
      data_base: dataBase?.toISOString() ?? null,
      numero: sol.numero,
      created_at: sol.created_at.toISOString(),
      data_recebimento: sol.data_recebimento?.toISOString() ?? null,
      cliente: sol.cliente.nome,
      cliente_final: sol.cliente_final?.nome ?? null,
      cidade: sol.cidade,
      estado: sol.estado,
      classificacao: sol.classificacao,
      escopo: sol.escopo,
      orcamentista: sol.orcamentista?.nome ?? null,
      as_sold: sol.as_sold,
      propostas_tecnicas: sol.propostas_tecnicas.map((pt) => ({
        id: pt.id,
        versao: pt.versao,
        hh_direto: pt.hh_direto,
        hh_indireto: pt.hh_indireto,
        hh_total: pt.hh_total,
        efetivo_pico: pt.efetivo_pico,
        dias_parada: pt.dias_parada,
        turno: pt.turno,
        finais_de_semana: pt.finais_de_semana,
        peso_montagem: pt.peso_montagem?.toString() ?? null,
        peso_equipamentos: pt.peso_equipamentos?.toString() ?? null,
        peso_tubulacoes: pt.peso_tubulacoes?.toString() ?? null,
        peso_suportes: pt.peso_suportes?.toString() ?? null,
        peso_estruturas: pt.peso_estruturas?.toString() ?? null,
        nao_aplicavel: pt.nao_aplicavel,
        data_base: pt.data_base?.toISOString() ?? null,
        data_envio: pt.data_envio?.toISOString() ?? null,
      })),
      propostas_comerciais: sol.propostas_comerciais.map((pc) => ({
        id: pc.id,
        versao: pc.versao,
        valor_total: pc.valor_total?.toString() ?? null,
        valor_terceiros: pc.valor_terceiros?.toString() ?? null,
        valor_montagem_mecanica: pc.valor_montagem_mecanica?.toString() ?? null,
        possui_fabricacao: pc.possui_fabricacao,
        valor_fabricacao: pc.valor_fabricacao?.toString() ?? null,
        possui_terceiros: pc.possui_terceiros,
        valor_eletrica: pc.valor_eletrica?.toString() ?? null,
        valor_isolamento: pc.valor_isolamento?.toString() ?? null,
        valor_civil: pc.valor_civil?.toString() ?? null,
        valor_hidraulica: pc.valor_hidraulica?.toString() ?? null,
        valor_fibra: pc.valor_fibra?.toString() ?? null,
        valor_tijolo_antiacido: pc.valor_tijolo_antiacido?.toString() ?? null,
        valor_outros_terceiros: pc.valor_outros_terceiros?.toString() ?? null,
        nao_aplicavel: pc.nao_aplicavel,
        data_base: pc.data_base?.toISOString() ?? null,
        data_envio: pc.data_envio?.toISOString() ?? null,
        resultado: pc.resultado,
        proposta_tecnica_id: pc.proposta_tecnica_id,
      })),
      propostas_fabricacao: sol.propostas_fabricacao.map((pf) => ({
        id: pf.id,
        versao: pf.versao,
        peso_total: pf.peso_total.toString(),
        valor_total: pf.valor_total.toString(),
        possui_testes: pf.possui_testes,
        descricao_testes: pf.descricao_testes,
        valor_testes: pf.valor_testes?.toString() ?? null,
        resultado: pf.resultado,
        data_base: pf.data_base?.toISOString() ?? null,
        data_envio: pf.data_envio?.toISOString() ?? null,
        equipamentos: pf.equipamentos.map((e) => ({
          id: e.id,
          ordem: e.ordem,
          descricao: e.descricao,
          peso_ton: e.peso_ton.toString(),
          valor_total: e.valor_total.toString(),
          observacoes: e.observacoes,
        })),
      })),
    },
    error: null,
  })
}
