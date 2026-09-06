import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Usa auth()/headers() e searchParams — sempre dinâmica (nunca pré-renderizar)
export const dynamic = 'force-dynamic'

// GET /api/faturamento/nfs/alteracoes
// Edições pendentes de NFs já ativas/aprovadas — aguardando aprovação da
// coordenação. Os dados atuais da NF (ativa) não são afetados até a decisão.
// ?history=true → APROVADO + REPROVADO
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const history = searchParams.get('history') === 'true'
  const perfil = session.user.perfil
  const isCoord = perfil === 'GESTAO_ACORDOS' || perfil === 'ADM_GERAL'
  const userId = Number(session.user.id)

  const where = history
    ? { status: { in: ['APROVADO', 'REPROVADO'] as ['APROVADO', 'REPROVADO'] } }
    : { status: 'PENDENTE' as const }

  const alteracoes = await prisma.notaFiscalAlteracao.findMany({
    where: {
      ...where,
      ...(isCoord ? {} : { responsavel_id: userId }),
    },
    orderBy: { created_at: 'desc' },
    include: {
      nf: {
        select: {
          id: true,
          tipo_documento: true,
          subindice: {
            select: {
              id: true, ordem: true, descricao: true, valor_total: true,
              contrato: { select: { id: true, indice: true, descricao: true, cliente: { select: { nome: true } } } },
            },
          },
        },
      },
    },
  })

  const userIds = Array.from(new Set(alteracoes.flatMap((a) => [a.responsavel_id, a.revisor_id]).filter((x): x is number => x != null)))
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true } })
    : []
  const nomePorId = new Map(users.map((u) => [u.id, u.nome]))

  const data = alteracoes.map((a) => ({
    id: a.id,
    nf_id: a.nf_id,
    status: a.status,
    motivo_recusa: a.motivo_recusa,
    created_at: a.created_at.toISOString(),
    reviewed_at: a.reviewed_at?.toISOString() ?? null,
    solicitante: nomePorId.get(a.responsavel_id) ?? '—',
    revisor: a.revisor_id != null ? (nomePorId.get(a.revisor_id) ?? null) : null,
    numero_nf_de: a.numero_nf_de,
    numero_nf_para: a.numero_nf_para,
    valor_total_nf_de: Number(a.valor_total_nf_de),
    valor_total_nf_para: Number(a.valor_total_nf_para),
    percentual_de: Number(a.percentual_de),
    percentual_para: Number(a.percentual_para),
    data_emissao_de: a.data_emissao_de.toISOString(),
    data_emissao_para: a.data_emissao_para.toISOString(),
    data_vencimento_de: a.data_vencimento_de.toISOString(),
    data_vencimento_para: a.data_vencimento_para.toISOString(),
    subindice_id_de: a.subindice_id_de,
    subindice_id_para: a.subindice_id_para,
    tipo_documento: a.nf.tipo_documento ?? 'NF',
    subindice: {
      id: a.nf.subindice.id, ordem: a.nf.subindice.ordem, descricao: a.nf.subindice.descricao,
      valor_total: Number(a.nf.subindice.valor_total),
    },
    contrato: a.nf.subindice.contrato
      ? { id: a.nf.subindice.contrato.id, indice: a.nf.subindice.contrato.indice, descricao: a.nf.subindice.contrato.descricao, cliente_nome: a.nf.subindice.contrato.cliente.nome }
      : null,
  }))

  return NextResponse.json({ data, error: null })
}
