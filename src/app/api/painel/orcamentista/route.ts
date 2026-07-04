import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const data_de = searchParams.get('data_de') ?? undefined
  const data_ate = searchParams.get('data_ate') ?? undefined
  const classificacao = searchParams.get('classificacao') ?? undefined
  const interesse = searchParams.get('interesse') ?? undefined
  // Permite visualizar o painel de outro orçamentista (default: o próprio usuário)
  const orcParam = searchParams.get('orcamentista_id')
  const orcamentistaId = orcParam ? Number(orcParam) : Number(session.user.id)

  const items = await prisma.solicitacao.findMany({
    where: {
      orcamentista_id: orcamentistaId,
      cancelled_at: null,
      status: { in: ['AGUARDANDO_ANALISE', 'EM_ELABORACAO', 'PROPOSTA_ENVIADA'] },
      ...(classificacao && { classificacao: classificacao as never }),
      ...(interesse && { interesse: interesse as never }),
      // Período de ATRIBUIÇÃO = data em que o analista aprovou (data_atribuicao).
      // Registros antigos sem data_atribuicao usam created_at como fallback.
      ...(data_de || data_ate
        ? {
            OR: [
              {
                data_atribuicao: {
                  ...(data_de && { gte: new Date(data_de) }),
                  ...(data_ate && { lte: new Date(data_ate + 'T23:59:59') }),
                },
              },
              {
                data_atribuicao: null,
                created_at: {
                  ...(data_de && { gte: new Date(data_de) }),
                  ...(data_ate && { lte: new Date(data_ate + 'T23:59:59') }),
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    include: {
      cliente:       { select: { nome: true } },
      cliente_final: { select: { nome: true } },
      propostas_tecnicas:   { orderBy: { versao: 'desc' } },
      propostas_comerciais: { orderBy: { versao: 'desc' } },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1 },
    },
  })

  // Compara datas-calendário: "hoje" como meia-noite UTC da data local atual,
  // pois os prazos são gravados como meia-noite UTC. Evita marcar como atrasado
  // um prazo que é exatamente hoje (off-by-one de fuso).
  const agora = new Date()
  const hoje = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()))

  const data = items.map((s) => {
    // Effective revision: max of revisao_esperada and last submitted técnica versao
    const maxVersaoTecnica = s.propostas_tecnicas[0]?.versao ?? 0
    const revisaoEsperada = Math.max(s.revisao_esperada, maxVersaoTecnica)

    // Find proposals for the current revision
    const tecnicaAtual = s.propostas_tecnicas.find((pt) => pt.versao === revisaoEsperada) ?? null
    const comercialAtual = s.propostas_comerciais.find((pc) => pc.versao === revisaoEsperada) ?? null
    const ultimaFabricacao = s.propostas_fabricacao[0] ?? null

    const tecnicaEnviada = tecnicaAtual !== null
    const comercialEnviada = comercialAtual !== null
    const fabricacaoEnviada = ultimaFabricacao !== null

    const prazoTec = s.prazo_tecnica ? new Date(s.prazo_tecnica) : null
    const prazoComercial = s.prazo_comercial ? new Date(s.prazo_comercial) : null
    const prazoTec_passed = prazoTec ? prazoTec < hoje : false
    const prazoCom_passed = prazoComercial ? prazoComercial < hoje : false

    const tecnicaAtrasada = !tecnicaEnviada && prazoTec_passed
    const comercialAtrasada = tecnicaEnviada && !comercialEnviada && prazoCom_passed

    return {
      id: s.id,
      numero: s.numero,
      created_at: s.created_at.toISOString(),
      data_atribuicao: s.data_atribuicao?.toISOString() ?? null,
      data_recebimento: s.data_recebimento?.toISOString() ?? null,
      cliente: s.cliente.nome,
      cliente_final: s.cliente_final?.nome ?? null,
      cidade: s.cidade,
      estado: s.estado,
      escopo: s.escopo,
      classificacao: s.classificacao,
      interesse: s.interesse,
      prazo_tecnica: s.prazo_tecnica?.toISOString() ?? null,
      prazo_comercial: s.prazo_comercial?.toISOString() ?? null,
      visita_tecnica: s.visita_tecnica,
      data_visita: s.data_visita?.toISOString() ?? null,
      is_portal: s.is_portal,
      portal_hora: s.portal_hora,

      versao_atual: revisaoEsperada,
      tecnica_enviada: tecnicaEnviada,
      tecnica_nao_aplicavel: tecnicaAtual?.nao_aplicavel ?? false,
      data_envio_tecnica: tecnicaAtual?.data_envio?.toISOString() ?? null,
      comercial_enviada: comercialEnviada,
      comercial_nao_aplicavel: comercialAtual?.nao_aplicavel ?? false,
      data_envio_comercial: comercialAtual?.data_envio?.toISOString() ?? null,
      tecnica_atrasada: tecnicaAtrasada,
      comercial_atrasada: comercialAtrasada,
      fabricacao_enviada: fabricacaoEnviada,

      propostas_tecnicas: s.propostas_tecnicas.map((pt) => ({
        id: pt.id,
        versao: pt.versao,
        hh_direto: pt.hh_direto,
        hh_indireto: pt.hh_indireto,
        hh_total: pt.hh_total,
        peso_montagem: pt.peso_montagem?.toString() ?? null,
        efetivo_pico: pt.efetivo_pico,
        dias_parada: pt.dias_parada,
        turno: pt.turno,
        finais_de_semana: pt.finais_de_semana,
        nao_aplicavel: pt.nao_aplicavel,
        data_envio: pt.data_envio?.toISOString() ?? null,
      })),
      propostas_comerciais: s.propostas_comerciais.map((pc) => ({
        id: pc.id,
        versao: pc.versao,
        valor_total: pc.valor_total?.toString() ?? null,
        valor_terceiros: pc.valor_terceiros?.toString() ?? null,
        nao_aplicavel: pc.nao_aplicavel,
        data_envio: pc.data_envio?.toISOString() ?? null,
        resultado: pc.resultado,
        proposta_tecnica_id: pc.proposta_tecnica_id,
      })),
    }
  })

  return NextResponse.json({ data, error: null })
}
