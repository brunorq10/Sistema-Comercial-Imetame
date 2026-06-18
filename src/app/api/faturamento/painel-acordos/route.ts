import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

// GET /api/faturamento/painel-acordos?responsavel_id=X
// Para GESTAO_ACORDOS: ?todos=1 retorna todos os contratos com responsável
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const responsavelIdParam = searchParams.get('responsavel_id')
  const todos = searchParams.get('todos') === '1'
  const perfil = session.user.perfil
  const isGestao = perfil === 'GESTAO_ACORDOS'
  const userId = Number(session.user.id)

  // Determina qual responsavel_id filtrar
  let responsavelId: number | undefined
  if (todos && isGestao) {
    responsavelId = undefined // busca todos
  } else if (responsavelIdParam) {
    // GESTAO_ACORDOS pode ver qualquer um; outros só podem ver a si mesmos
    if (!isGestao && Number(responsavelIdParam) !== userId) {
      return NextResponse.json({ data: null, error: 'Sem permissão para ver contratos de outro responsável' }, { status: 403 })
    }
    responsavelId = Number(responsavelIdParam)
  } else {
    // Default: o próprio usuário
    responsavelId = userId
  }

  try {
    const whereResponsavel = responsavelId !== undefined
      ? { responsavel_id: responsavelId }
      : { responsavel_id: { not: null } }

    const contratos = await prisma.contrato.findMany({
      where: {
        cancelled_at: null,
        ...whereResponsavel,
      },
      orderBy: [{ indice: 'asc' }],
      include: {
        cliente: { select: { id: true, nome: true, ramo_atuacao: true } },
        cliente_final: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        subindices: {
          orderBy: { ordem: 'asc' },
          include: {
            notas_fiscais: true,
            alteracoes: {
              where: { status: 'PENDENTE' },
              orderBy: { created_at: 'desc' },
              take: 1,
              include: {
                responsavel: { select: { id: true, nome: true } },
                revisor: { select: { id: true, nome: true } },
              },
            },
          },
        },
      },
    })

    const data = contratos.map((c) => {
      const subindices = c.subindices.map((s) => {
        const nfsAtivas = s.notas_fiscais.filter((nf) => nf.ativa)
        const totalFaturado = nfsAtivas.reduce((acc, nf) => acc + Number(nf.valor_atribuido), 0)
        const statusFaturamento: 'A_FATURAR' | 'FATURADO' | 'PARCIAL' =
          totalFaturado === 0 ? 'A_FATURAR'
          : totalFaturado >= Number(s.valor_total) ? 'FATURADO'
          : 'PARCIAL'

        const alteracaoPendente = s.alteracoes[0] ?? null

        return {
          id: s.id,
          contrato_id: s.contrato_id,
          ordem: s.ordem,
          descricao: s.descricao,
          num_os: s.num_os ?? null,
          valor_total: Number(s.valor_total),
          data_inicio: s.data_inicio?.toISOString() ?? null,
          data_fim: s.data_fim?.toISOString() ?? null,
          comentarios: s.comentarios ?? null,
          jan: s.jan ? Number(s.jan) : null,
          fev: s.fev ? Number(s.fev) : null,
          mar: s.mar ? Number(s.mar) : null,
          abr: s.abr ? Number(s.abr) : null,
          mai: s.mai ? Number(s.mai) : null,
          jun: s.jun ? Number(s.jun) : null,
          jul: s.jul ? Number(s.jul) : null,
          ago: s.ago ? Number(s.ago) : null,
          set: s.set ? Number(s.set) : null,
          out: s.out ? Number(s.out) : null,
          nov: s.nov ? Number(s.nov) : null,
          dez: s.dez ? Number(s.dez) : null,
          total_faturado: totalFaturado,
          status_faturamento: statusFaturamento,
          prev_anos_seguintes: 0,
          notas_fiscais: nfsAtivas.map((nf) => ({
            id: nf.id,
            numero_nf: nf.numero_nf,
            valor_total_nf: Number(nf.valor_total_nf),
            percentual: Number(nf.percentual),
            percentual_total: Number(nf.percentual),
            valor_atribuido: Number(nf.valor_atribuido),
            data_emissao: nf.data_emissao.toISOString(),
            data_vencimento: nf.data_vencimento.toISOString(),
            ativa: nf.ativa,
            motivo_inativacao: nf.motivo_inativacao,
          })),
          alteracao_pendente: alteracaoPendente ? serializeAlteracao(alteracaoPendente) : null,
        }
      })

      return {
        id: c.id,
        indice: c.indice,
        ano_referencia: c.ano_referencia,
        status: c.status,
        cliente: c.cliente,
        cliente_final: (c as any).cliente_final ?? null,
        cidade: c.cidade ?? null,
        estado: c.estado ?? null,
        responsavel: c.responsavel,
        num_os: c.num_os,
        num_acordo: c.num_acordo,
        num_proposta: c.num_proposta,
        data_inicio: c.data_inicio?.toISOString() ?? null,
        data_fim: c.data_fim?.toISOString() ?? null,
        descricao: c.descricao,
        classificacao: c.classificacao ?? null,
        valor_contrato: c.valor_contrato ? Number(c.valor_contrato) : null,
        cancelled_at: c.cancelled_at?.toISOString() ?? null,
        prev_anos_seguintes: 0,
        subindices,
      }
    })

    return NextResponse.json({ data, error: null })
  } catch (err) {
    logger.error('[GET /api/faturamento/painel-acordos]', err)
    return NextResponse.json({ data: null, error: 'Erro interno do servidor. Por favor, tente novamente.' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeAlteracao(a: any) {
  return {
    id: a.id,
    subindice_id: a.subindice_id,
    responsavel_id: a.responsavel_id,
    status: a.status,
    motivo_recusa: a.motivo_recusa,
    revisor_id: a.revisor_id,
    reviewed_at: a.reviewed_at?.toISOString() ?? null,
    created_at: a.created_at.toISOString(),
    updated_at: a.updated_at.toISOString(),
    created_by: a.created_by,
    ...Object.fromEntries(MESES.map((m) => [`${m}_de`, a[`${m}_de`] ? Number(a[`${m}_de`]) : null])),
    ...Object.fromEntries(MESES.map((m) => [`${m}_para`, a[`${m}_para`] ? Number(a[`${m}_para`]) : null])),
    responsavel: a.responsavel,
    revisor: a.revisor,
  }
}
