import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato } from '@/lib/permissaoApi'
import { regiaoPorEstado, resolverVigencia } from '@/lib/ucr'

// POST — fecha a Parada (consolida os lançamentos; nada mais pode ser
// ajustado até reabrir). Bloqueado se não houver faixa de UCR vigente
// cobrindo a data de início da Parada (mesma permissão de editar a Parada).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.paradas.controlehh.editar'); if (_n) return _n }

  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { estado: true, data_inicio: true, parada_hh_config: { select: { id: true, fechada_em: true, parada_inicio: true } } },
  })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })
  if (!contrato.parada_hh_config) return NextResponse.json({ data: null, error: 'Nenhum acompanhamento de HH lançado para este contrato ainda' }, { status: 400 })
  if (contrato.parada_hh_config.fechada_em) return NextResponse.json({ data: null, error: 'Esta Parada já está fechada' }, { status: 409 })

  const dataReferencia = contrato.parada_hh_config.parada_inicio ?? contrato.data_inicio
  if (!dataReferencia) {
    return NextResponse.json({ data: null, error: 'Informe a data de início da Parada antes de fechar (necessária para localizar a faixa de UCR vigente).' }, { status: 400 })
  }

  const regiao = regiaoPorEstado(contrato.estado)
  const vigencias = await prisma.ucrFaixaVigencia.findMany({ where: { regiao } })
  const vigenciasSerializadas = vigencias.map((v) => ({ ...v, vigencia_inicio: v.vigencia_inicio.toISOString(), vigencia_fim: v.vigencia_fim.toISOString() }))
  const vigenciaAplicavel = resolverVigencia(vigenciasSerializadas, regiao, dataReferencia)
  if (!vigenciaAplicavel) {
    return NextResponse.json({
      data: null,
      error: 'Não há faixa de UCR vigente cobrindo a data de início desta Parada. Cadastre uma faixa em "Faixas de UCR" antes de fechar.',
    }, { status: 422 })
  }

  const userId = Number(session.user.id)
  await prisma.$transaction([
    prisma.paradaHhConfig.update({
      where: { id: contrato.parada_hh_config.id },
      data: { fechada_em: new Date(), fechada_por: userId },
    }),
    prisma.paradaFechamentoHistorico.create({
      data: { config_id: contrato.parada_hh_config.id, acao: 'FECHADA', created_by: userId },
    }),
  ])

  return NextResponse.json({ data: { ok: true }, error: null })
}
