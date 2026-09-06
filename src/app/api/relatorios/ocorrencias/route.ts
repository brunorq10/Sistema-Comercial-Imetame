import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const TIPO_OCORRENCIA_LABELS: Record<string, string> = {
  FALTA_ENERGIA: 'Falta de Energia', CHUVA: 'Chuva', ENTREGA_MATERIAL: 'Entrega de Material',
  PARALISACAO_TERCEIROS: 'Paralisação por Terceiros', INDISPONIBILIDADE_LOCAL: 'Indisponibilidade do Local', OUTROS: 'Outros',
}
const RESP_LABELS: Record<string, string> = {
  CLIENTE: 'Cliente', IMETAME: 'Imetame', TERCEIROS: 'Terceiros', FORCA_MAIOR: 'Força Maior', A_APURAR: 'A apurar',
}
const TIPO_MULTA_LABELS: Record<string, string> = { MULTA: 'Multa', GLOSAS: 'Glosas', REEMBOLSOS: 'Reembolsos', OUTROS: 'Outros' }

// GET /api/relatorios/ocorrencias — OCM-01..03
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('relatorios.ver'); if (erro) return erro }

  const { searchParams } = req.nextUrl
  const de  = searchParams.get('de')  ?? undefined
  const ate = searchParams.get('ate') ?? undefined

  const periodo = (de || ate) ? { gte: de ? new Date(de) : undefined, lte: ate ? new Date(`${ate}T23:59:59`) : undefined } : undefined

  const [ocorrencias, multas, contratosAtivosPorCliente] = await Promise.all([
    prisma.ocorrenciaContratual.findMany({
      where: { deleted_at: null, ...(periodo && { data: periodo }) },
      select: {
        id: true, tipo: true, responsabilidade: true, data: true,
        contrato: { select: { id: true, indice: true, cliente: { select: { id: true, nome: true } } } },
      },
    }),
    prisma.multaPenalidade.findMany({
      where: { deleted_at: null, ativa: true, ...(periodo && { data_ocorrencia: periodo }) },
      select: {
        id: true, tipo: true, valor_total: true, data_ocorrencia: true,
        contrato: { select: { id: true, indice: true, cliente: { select: { id: true, nome: true } } } },
      },
    }),
    prisma.contrato.groupBy({ by: ['cliente_id'], where: { cancelled_at: null }, _count: { _all: true } }),
  ])

  // ── OCM-01: ocorrências por tipo e responsabilidade ───────────────────────
  const porTipo: Record<string, number> = {}
  const porResponsabilidade: Record<string, number> = {}
  const porMes = new Array(12).fill(0)
  for (const o of ocorrencias) {
    porTipo[o.tipo] = (porTipo[o.tipo] ?? 0) + 1
    porResponsabilidade[o.responsabilidade] = (porResponsabilidade[o.responsabilidade] ?? 0) + 1
    porMes[o.data.getUTCMonth()]++
  }

  // ── OCM-02: impacto financeiro de multas ──────────────────────────────────
  const multasPorTipo: Record<string, number> = {}
  const multasPorMes = new Array(12).fill(0)
  const multasPorCliente = new Map<number, { nome: string; valor: number }>()
  let totalMultas = 0
  for (const m of multas) {
    const valor = Number(m.valor_total)
    totalMultas += valor
    multasPorTipo[m.tipo] = (multasPorTipo[m.tipo] ?? 0) + valor
    multasPorMes[m.data_ocorrencia.getUTCMonth()] += valor
    const cur = multasPorCliente.get(m.contrato.cliente.id) ?? { nome: m.contrato.cliente.nome, valor: 0 }
    cur.valor += valor
    multasPorCliente.set(m.contrato.cliente.id, cur)
  }

  // ── OCM-03: reincidência por cliente (normalizado por nº de contratos) ────
  const contratosPorCliente = new Map(contratosAtivosPorCliente.map((c) => [c.cliente_id, c._count._all]))
  const ocorrenciasPorCliente = new Map<number, { nome: string; ocorrencias: number }>()
  for (const o of ocorrencias) {
    const cur = ocorrenciasPorCliente.get(o.contrato.cliente.id) ?? { nome: o.contrato.cliente.nome, ocorrencias: 0 }
    cur.ocorrencias++
    ocorrenciasPorCliente.set(o.contrato.cliente.id, cur)
  }
  const clienteIds = new Set([...Array.from(ocorrenciasPorCliente.keys()), ...Array.from(multasPorCliente.keys())])
  const reincidencia = Array.from(clienteIds).map((id) => {
    const nOcorrencias = ocorrenciasPorCliente.get(id)?.ocorrencias ?? 0
    const valorMultas = multasPorCliente.get(id)?.valor ?? 0
    const nContratos = contratosPorCliente.get(id) ?? 1
    return {
      nome: ocorrenciasPorCliente.get(id)?.nome ?? multasPorCliente.get(id)?.nome ?? '—',
      ocorrencias: nOcorrencias, valor_multas: valorMultas, contratos_ativos: nContratos,
      ocorrencias_por_contrato: nContratos > 0 ? nOcorrencias / nContratos : nOcorrencias,
    }
  }).sort((a, b) => b.ocorrencias_por_contrato - a.ocorrencias_por_contrato)

  const data = {
    ocm01: {
      por_tipo: Object.entries(porTipo).map(([tipo, total]) => ({ tipo, label: TIPO_OCORRENCIA_LABELS[tipo] ?? tipo, total })).sort((a, b) => b.total - a.total),
      por_responsabilidade: Object.entries(porResponsabilidade).map(([resp, total]) => ({ responsabilidade: resp, label: RESP_LABELS[resp] ?? resp, total })).sort((a, b) => b.total - a.total),
      por_mes: porMes,
      total: ocorrencias.length,
    },
    ocm02: {
      total: totalMultas,
      por_tipo: Object.entries(multasPorTipo).map(([tipo, valor]) => ({ tipo, label: TIPO_MULTA_LABELS[tipo] ?? tipo, valor })).sort((a, b) => b.valor - a.valor),
      por_mes: multasPorMes,
      por_cliente: Array.from(multasPorCliente.values()).sort((a, b) => b.valor - a.valor).slice(0, 10),
    },
    ocm03: reincidencia.slice(0, 15),
  }

  return NextResponse.json({ data, error: null })
}
