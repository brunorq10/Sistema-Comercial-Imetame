import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/lib/apiHandler'

// Usa auth()/headers() e searchParams — sempre dinâmica (nunca pré-renderizar)
export const dynamic = 'force-dynamic'

// GET /api/faturamento/nfs/aprovacoes
// Lança­mentos de faturamento (NFs) pendentes de aprovação da coordenação.
// ?history=true → APROVADO + REPROVADO (que passaram pelo fluxo de aprovação)
export const GET = withApi(async (req: NextRequest) => {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const history = searchParams.get('history') === 'true'
  const perfil = session.user.perfil
  const isCoord = perfil === 'GESTAO_ACORDOS' || perfil === 'ADM_GERAL'
  const userId = Number(session.user.id)

  const where = history
    ? { status_aprovacao: { in: ['APROVADO', 'REPROVADO'] }, solicitado_por: { not: null } }
    : { status_aprovacao: 'PENDENTE' }

  const nfs = await prisma.notaFiscalContrato.findMany({
    where: {
      deleted_at: null,
      ...where,
      ...(isCoord ? {} : { solicitado_por: userId }),
    },
    orderBy: { created_at: 'desc' },
    include: {
      subindice: {
        select: {
          id: true, ordem: true, descricao: true, valor_total: true,
          contrato: { select: { id: true, indice: true, descricao: true, cliente: { select: { nome: true } } } },
        },
      },
    },
  })

  // Nomes de solicitante/revisor (scalars) em um único lookup
  const userIds = Array.from(new Set(nfs.flatMap((n) => [n.solicitado_por, n.revisado_por]).filter((x): x is number => x != null)))
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true } })
    : []
  const nomePorId = new Map(users.map((u) => [u.id, u.nome]))

  const data = nfs.map((n) => ({
    id: n.id,
    numero_nf: n.numero_nf,
    tipo_documento: n.tipo_documento ?? 'NF',
    valor_total_nf: Number(n.valor_total_nf),
    percentual: Number(n.percentual),
    valor_atribuido: Number(n.valor_atribuido),
    data_emissao: n.data_emissao.toISOString(),
    data_vencimento: n.data_vencimento.toISOString(),
    status_aprovacao: n.status_aprovacao,
    motivo_recusa: n.motivo_recusa,
    created_at: n.created_at.toISOString(),
    revisado_em: n.revisado_em?.toISOString() ?? null,
    solicitante: n.solicitado_por != null ? (nomePorId.get(n.solicitado_por) ?? '—') : '—',
    revisor: n.revisado_por != null ? (nomePorId.get(n.revisado_por) ?? null) : null,
    subindice: { id: n.subindice.id, ordem: n.subindice.ordem, descricao: n.subindice.descricao, valor_total: Number(n.subindice.valor_total) },
    contrato: n.subindice.contrato
      ? { id: n.subindice.contrato.id, indice: n.subindice.contrato.indice, descricao: n.subindice.contrato.descricao, cliente_nome: n.subindice.contrato.cliente.nome }
      : null,
  }))

  return NextResponse.json({ data, error: null })
})
