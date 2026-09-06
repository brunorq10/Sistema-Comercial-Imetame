import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

// GET /api/relatorios/gestao — GST-01, GST-02
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const anoAtual = new Date().getFullYear()

  const [solicitacoesAbertas, contratosAtivos, propostasAbertas] = await Promise.all([
    prisma.solicitacao.findMany({
      where: { cancelled_at: null, status: { in: ['AGUARDANDO_ANALISE', 'EM_ELABORACAO', 'PROPOSTA_ENVIADA'] } },
      select: { orcamentista: { select: { id: true, nome: true } } },
    }),
    prisma.contrato.findMany({
      where: { cancelled_at: null },
      select: {
        valor_contrato: true, responsavel: { select: { id: true, nome: true } },
        subindices: { where: { deleted_at: null }, select: { valor_total: true } },
      },
    }),
    prisma.solicitacao.findMany({
      where: { cancelled_at: null },
      select: {
        classificacao: true,
        propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1, select: { valor_total: true, data_envio: true, resultado: true } },
        propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1, select: { valor_total: true, data_envio: true, resultado: true } },
      },
    }),
  ])

  // ── GST-01: carga de trabalho ──────────────────────────────────────────────
  const orcMap = new Map<number, { nome: string; total: number }>()
  for (const s of solicitacoesAbertas) {
    if (!s.orcamentista) continue
    const e = orcMap.get(s.orcamentista.id) ?? { nome: s.orcamentista.nome, total: 0 }
    e.total++
    orcMap.set(s.orcamentista.id, e)
  }
  const respMap = new Map<number, { nome: string; contratos: number; valor: number }>()
  for (const c of contratosAtivos) {
    if (!c.responsavel) continue
    const valor = Number(c.valor_contrato ?? c.subindices.reduce((a, s) => a + Number(s.valor_total), 0))
    const e = respMap.get(c.responsavel.id) ?? { nome: c.responsavel.nome, contratos: 0, valor: 0 }
    e.contratos++; e.valor += valor
    respMap.set(c.responsavel.id, e)
  }

  // ── GST-02: projeção de faturamento futuro ────────────────────────────────
  const contratosComAnos = await prisma.contrato.findMany({
    where: { cancelled_at: null },
    select: { subindices: { where: { deleted_at: null }, select: { valor_total: true, data_inicio: true } } },
  })
  let garantidoProxAnos = 0
  for (const c of contratosComAnos) {
    for (const s of c.subindices) {
      const anoSub = s.data_inicio ? new Date(s.data_inicio).getUTCFullYear() : anoAtual
      if (anoSub > anoAtual) garantidoProxAnos += Number(s.valor_total)
    }
  }
  let pipelineAberto = 0
  for (const s of propostasAbertas) {
    const isFab = s.classificacao === 'FABRICACOES' || s.classificacao === 'OLEO_GAS'
    const com = s.propostas_comerciais[0] ?? null
    const fab = s.propostas_fabricacao[0] ?? null
    const dataEnvio = isFab ? fab?.data_envio : com?.data_envio
    const resultado = isFab ? fab?.resultado : com?.resultado
    const valor = isFab ? fab?.valor_total : com?.valor_total
    if (dataEnvio != null && (resultado === 'AGUARDANDO' || resultado == null) && valor != null) pipelineAberto += Number(valor)
  }

  const data = {
    gst01: {
      orcamentistas: Array.from(orcMap.values()).sort((a, b) => b.total - a.total),
      responsaveis_acordos: Array.from(respMap.values()).sort((a, b) => b.valor - a.valor),
    },
    gst02: {
      ano_atual: anoAtual,
      garantido_proximos_anos: garantidoProxAnos,
      pipeline_em_negociacao: pipelineAberto,
    },
  }

  return NextResponse.json({ data, error: null })
}
