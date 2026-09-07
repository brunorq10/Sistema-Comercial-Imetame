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
// OCM-01 e OCM-02 retornam a lista bruta de registros (é o que se consulta,
// filtra e exporta); os agregados por tipo/responsabilidade continuam junto
// para quem quiser o resumo, mas a tabela principal é sempre a lista.
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
        id: true, codigo: true, tipo: true, responsabilidade: true, data: true, descricao: true,
        contrato: { select: { id: true, indice: true, cidade: true, descricao: true, cliente: { select: { id: true, nome: true } } } },
      },
      orderBy: { data: 'desc' },
    }),
    prisma.multaPenalidade.findMany({
      where: { deleted_at: null, ativa: true, ...(periodo && { data_ocorrencia: periodo }) },
      select: {
        id: true, tipo: true, descricao: true, valor_total: true, data_ocorrencia: true,
        contrato: { select: { id: true, indice: true, cidade: true, descricao: true, cliente: { select: { id: true, nome: true } } } },
      },
      orderBy: { data_ocorrencia: 'desc' },
    }),
    prisma.contrato.groupBy({ by: ['cliente_id'], where: { cancelled_at: null }, _count: { _all: true } }),
  ])

  // ── OCM-01: lista de ocorrências + agregados ──────────────────────────────
  const porTipo: Record<string, number> = {}
  const porResponsabilidade: Record<string, number> = {}
  for (const o of ocorrencias) {
    porTipo[o.tipo] = (porTipo[o.tipo] ?? 0) + 1
    porResponsabilidade[o.responsabilidade] = (porResponsabilidade[o.responsabilidade] ?? 0) + 1
  }

  // ── OCM-02: lista de multas + agregados ────────────────────────────────────
  const multasPorTipo: Record<string, number> = {}
  const multasPorCliente = new Map<number, { nome: string; valor: number }>()
  let totalMultas = 0
  for (const m of multas) {
    const valor = Number(m.valor_total)
    totalMultas += valor
    multasPorTipo[m.tipo] = (multasPorTipo[m.tipo] ?? 0) + valor
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
    ocm01_lista: ocorrencias.map((o) => ({
      id: o.id, codigo: o.codigo, contrato: o.contrato.indice, escopo: o.contrato.descricao, cidade: o.contrato.cidade, cliente: o.contrato.cliente.nome,
      tipo: o.tipo, tipo_label: TIPO_OCORRENCIA_LABELS[o.tipo] ?? o.tipo,
      responsabilidade: o.responsabilidade, responsabilidade_label: RESP_LABELS[o.responsabilidade] ?? o.responsabilidade,
      data: o.data.toISOString(), descricao: o.descricao,
    })),
    ocm01_por_tipo: Object.entries(porTipo).map(([tipo, total]) => ({ tipo, label: TIPO_OCORRENCIA_LABELS[tipo] ?? tipo, total })).sort((a, b) => b.total - a.total),
    ocm01_por_responsabilidade: Object.entries(porResponsabilidade).map(([resp, total]) => ({ responsabilidade: resp, label: RESP_LABELS[resp] ?? resp, total })).sort((a, b) => b.total - a.total),

    ocm02_lista: multas.map((m) => ({
      id: m.id, contrato: m.contrato.indice, escopo: m.contrato.descricao, cidade: m.contrato.cidade, cliente: m.contrato.cliente.nome,
      tipo: m.tipo, tipo_label: TIPO_MULTA_LABELS[m.tipo] ?? m.tipo,
      descricao: m.descricao, data: m.data_ocorrencia.toISOString(), valor: Number(m.valor_total),
    })),
    ocm02_total: totalMultas,
    ocm02_por_tipo: Object.entries(multasPorTipo).map(([tipo, valor]) => ({ tipo, label: TIPO_MULTA_LABELS[tipo] ?? tipo, valor })).sort((a, b) => b.valor - a.valor),

    ocm03: reincidencia,
  }

  return NextResponse.json({ data, error: null })
}
