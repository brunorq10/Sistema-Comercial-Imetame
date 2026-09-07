import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

// GET /api/relatorios/clientes/[id] — CLI-02: Ficha do Cliente (histórico completo)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true, nome: true, cnpj: true, cidade: true, estado: true, ramo_atuacao: true, segmento: true, ativo: true,
      solicitacoes: {
        select: {
          id: true, numero: true, status: true, escopo: true, classificacao: true, created_at: true, data_recebimento: true,
          propostas_comerciais: { select: { valor_total: true, resultado: true }, orderBy: { versao: 'desc' }, take: 1 },
          propostas_fabricacao: { select: { valor_total: true, resultado: true }, orderBy: { versao: 'desc' }, take: 1 },
        },
        orderBy: { created_at: 'desc' },
      },
      contratos: {
        where: { cancelled_at: null },
        select: {
          id: true, indice: true, status: true, classificacao: true, valor_contrato: true, data_inicio: true, data_fim: true, cidade: true, descricao: true,
          subindices: {
            where: { deleted_at: null },
            select: { notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { valor_atribuido: true, data_emissao: true } } },
          },
          ocorrencias: { where: { deleted_at: null }, select: { id: true, codigo: true, tipo: true, data: true, responsabilidade: true } },
          multas: { where: { deleted_at: null, ativa: true }, select: { id: true, tipo: true, valor_total: true, data_ocorrencia: true } },
        },
      },
    },
  })

  if (!cliente) return NextResponse.json({ data: null, error: 'Cliente não encontrado' }, { status: 404 })

  const solicitacoes = cliente.solicitacoes.map((s) => {
    const isFab = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'
    const com = s.propostas_comerciais[0] ?? null
    const fab = s.propostas_fabricacao[0] ?? null
    const valor = isFab ? (fab?.valor_total != null ? Number(fab.valor_total) : null) : (com?.valor_total != null ? Number(com.valor_total) : null)
    const resultado = isFab ? (fab?.resultado ?? null) : (com?.resultado ?? null)
    return {
      id: s.id, numero: s.numero, status: s.status, escopo: s.escopo, classificacao: s.classificacao,
      data: (s.data_recebimento ?? s.created_at).toISOString(),
      valor, resultado,
    }
  })

  let totalFaturado = 0
  let totalMultas = 0
  let totalOcorrencias = 0
  const contratos = cliente.contratos.map((c) => {
    const faturado = c.subindices.reduce((acc, sub) => acc + sub.notas_fiscais.reduce((a, nf) => a + Number(nf.valor_atribuido), 0), 0)
    totalFaturado += faturado
    totalMultas += c.multas.reduce((a, m) => a + Number(m.valor_total), 0)
    totalOcorrencias += c.ocorrencias.length
    return {
      id: c.id, indice: c.indice, escopo: c.descricao, cidade: c.cidade, status: c.status, classificacao: c.classificacao,
      valor_contrato: c.valor_contrato != null ? Number(c.valor_contrato) : null,
      data_inicio: c.data_inicio?.toISOString() ?? null, data_fim: c.data_fim?.toISOString() ?? null,
      faturado, nf_ocorrencias: c.ocorrencias.length, nf_multas: c.multas.length,
      valor_multas: c.multas.reduce((a, m) => a + Number(m.valor_total), 0),
    }
  })

  const totalNegocios = solicitacoes.length
  const enviadas = solicitacoes.filter((s) => s.resultado != null && s.resultado !== 'AGUARDANDO')
  const ganhas = enviadas.filter((s) => s.resultado === 'GANHOU')
  const taxaConversao = enviadas.length > 0 ? (ganhas.length / enviadas.length) * 100 : null

  const data = {
    cliente: {
      id: cliente.id, nome: cliente.nome, cnpj: cliente.cnpj, cidade: cliente.cidade, estado: cliente.estado,
      ramo_atuacao: cliente.ramo_atuacao, segmento: cliente.segmento, ativo: cliente.ativo,
    },
    resumo: {
      total_negocios: totalNegocios,
      taxa_conversao_historica: taxaConversao,
      total_faturado: totalFaturado,
      total_multas: totalMultas,
      total_ocorrencias: totalOcorrencias,
      contratos_ativos: contratos.filter((c) => c.status !== 'CANCELADO').length,
    },
    solicitacoes,
    contratos,
  }

  return NextResponse.json({ data, error: null })
}
