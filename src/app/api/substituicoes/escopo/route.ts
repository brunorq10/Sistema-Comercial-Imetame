import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'

const STATUS_SOLICITACAO_ENCERRADOS = ['CONTRATO_GANHO', 'RECUSADA', 'CANCELADA'] as const

// GET /api/substituicoes/escopo?usuarioId=123
// Devolve as Solicitações (orcamentista) e Contratos (responsável) de um
// usuário, para a etapa de seleção de itens de uma transferência/troca.
export async function GET(req: NextRequest) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  if (!pode(usuario, 'cadastro.substituicao.gerenciar')) return respostaSemPermissao()

  const usuarioId = Number(req.nextUrl.searchParams.get('usuarioId'))
  if (!usuarioId) return NextResponse.json({ data: null, error: 'usuarioId inválido' }, { status: 400 })

  const hoje = new Date()
  const substituicaoVigenteRow = await prisma.substituicaoTemporaria.findFirst({
    where: { titular_id: usuarioId, encerrada_em: null, data_inicio: { lte: hoje }, data_fim: { gte: hoje } },
    select: { data_fim: true, substituto: { select: { nome: true } } },
  })

  const [solicitacoes, contratos] = await Promise.all([
    prisma.solicitacao.findMany({
      where: { orcamentista_id: usuarioId },
      select: {
        id: true, numero: true, status: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { id: 'desc' },
    }),
    prisma.contrato.findMany({
      where: { responsavel_id: usuarioId },
      select: {
        id: true, indice: true, cancelled_at: true, status: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { id: 'desc' },
    }),
  ])

  const solicitacaoIds = solicitacoes.map((s) => s.id)
  const contratoIds = contratos.map((c) => c.id)

  // Pendências abertas — apenas para avisar o gestor, não bloqueia a seleção.
  const [subindicesDosContratos, pendenciasPrevisao, pendenciasNf] = contratoIds.length
    ? await Promise.all([
        prisma.subIndiceFaturamento.findMany({ where: { contrato_id: { in: contratoIds } }, select: { id: true, contrato_id: true } }),
        prisma.previsaoAlteracao.findMany({ where: { status: 'PENDENTE', subindice: { contrato_id: { in: contratoIds } } }, select: { subindice: { select: { contrato_id: true } } } }),
        prisma.notaFiscalAlteracao.findMany({ where: { status: 'PENDENTE', nf: { subindice: { contrato_id: { in: contratoIds } } } }, select: { nf: { select: { subindice: { select: { contrato_id: true } } } } } }),
      ])
    : [[], [], []]

  const contratosComPendencia = new Set<number>()
  pendenciasPrevisao.forEach((p) => contratosComPendencia.add(p.subindice.contrato_id))
  pendenciasNf.forEach((p) => contratosComPendencia.add(p.nf.subindice.contrato_id))
  void subindicesDosContratos

  const data = {
    substituicaoVigente: substituicaoVigenteRow
      ? { substitutoNome: substituicaoVigenteRow.substituto.nome, ate: substituicaoVigenteRow.data_fim }
      : null,
    solicitacoes: solicitacoes.map((s) => ({
      id: s.id,
      numero: s.numero,
      cliente: s.cliente.nome,
      status: s.status,
      ativo: !STATUS_SOLICITACAO_ENCERRADOS.includes(s.status as typeof STATUS_SOLICITACAO_ENCERRADOS[number]),
      temPendencia: false,
    })),
    contratos: contratos.map((c) => ({
      id: c.id,
      indice: c.indice,
      cliente: c.cliente.nome,
      status: c.status,
      ativo: !c.cancelled_at,
      temPendencia: contratosComPendencia.has(c.id),
    })),
  }

  return NextResponse.json({ data, error: null })
}
