import { NextResponse } from 'next/server'
import { Prisma, RamoAtuacao } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Classificações fixas do "Tipo de Lançamento" (ver LancarNFContratoModal.tsx).
// Qualquer valor fora dessa lista (dado legado, se houver) cai em "Outros".
const TIPOS = ['Normal', 'Bônus', 'Serviço Extra', 'Outros'] as const
type Tipo = typeof TIPOS[number]

// GET /api/acordos/dashboard/composicao
// Composição do faturamento por tipo de lançamento, por contrato — mesmos
// filtros padrão da tela de Indicadores Acordos (replica o whereContrato de
// /api/acordos/dashboard) + ano (mesmo critério: filtra as NFs por data de emissão).
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anoParam        = searchParams.get('ano')
  const clienteId       = searchParams.get('clienteId')
  const clienteFinalId  = searchParams.get('clienteFinalId')
  const ramoFiltro      = searchParams.get('ramo')
  const responsavelId   = searchParams.get('responsavelId')
  const cidadeFiltro    = searchParams.get('cidade')
  const escopoFiltro    = searchParams.get('escopo')

  const anoAtual = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear()

  const clienteIds      = clienteId      ? clienteId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const clienteFinalIds = clienteFinalId ? clienteFinalId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const ramos           = ramoFiltro     ? ramoFiltro.split(',').filter(Boolean) : []
  const responsavelIds  = responsavelId  ? responsavelId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const cidades         = cidadeFiltro   ? cidadeFiltro.split(',').filter(Boolean) : []

  const whereContrato: Prisma.ContratoWhereInput = { cancelled_at: null }
  if (clienteIds.length)      whereContrato.cliente_id       = { in: clienteIds }
  if (clienteFinalIds.length) whereContrato.cliente_final_id = { in: clienteFinalIds }
  if (ramos.length)           whereContrato.cliente          = { is: { ramo_atuacao: { in: ramos as RamoAtuacao[] } } }
  if (responsavelIds.length)  whereContrato.responsavel_id   = { in: responsavelIds }
  if (cidades.length)         whereContrato.cidade           = { in: cidades }
  if (escopoFiltro?.trim())   whereContrato.descricao        = { contains: escopoFiltro.trim(), mode: 'insensitive' }

  const contratos = await prisma.contrato.findMany({
    where: whereContrato,
    select: {
      id: true, indice: true, num_os: true, cidade: true, estado: true,
      cliente: { select: { id: true, nome: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      subindices: {
        where: { deleted_at: null },
        select: {
          notas_fiscais: {
            where: {
              ativa: true, deleted_at: null,
              data_emissao: { gte: new Date(`${anoAtual}-01-01`), lt: new Date(`${anoAtual + 1}-01-01`) },
            },
            select: { tipo_lancamento: true, valor_atribuido: true },
          },
        },
      },
    },
  })

  const totaisPorTipo: Record<Tipo, number> = { Normal: 0, 'Bônus': 0, 'Serviço Extra': 0, Outros: 0 }
  const linhas: Array<{
    id: number; indice: string; cliente: string; cliente_final: string | null
    cidade: string | null; estado: string | null; num_os: string | null; responsavel: string | null
    valores: Record<Tipo, number>; total: number
  }> = []

  for (const c of contratos) {
    const valores: Record<Tipo, number> = { Normal: 0, 'Bônus': 0, 'Serviço Extra': 0, Outros: 0 }
    for (const s of c.subindices) {
      for (const nf of s.notas_fiscais) {
        const tipo: Tipo = (TIPOS as readonly string[]).includes(nf.tipo_lancamento ?? '') ? (nf.tipo_lancamento as Tipo) : 'Outros'
        valores[tipo] += Number(nf.valor_atribuido)
      }
    }
    const total = TIPOS.reduce((s, t) => s + valores[t], 0)
    if (total <= 0) continue // sem faturamento no período/filtro — não polui a tabela

    for (const t of TIPOS) totaisPorTipo[t] += valores[t]
    linhas.push({
      id: c.id, indice: c.indice, cliente: c.cliente.nome, cliente_final: c.cliente_final?.nome ?? null,
      cidade: c.cidade, estado: c.estado, num_os: c.num_os, responsavel: c.responsavel?.nome ?? null,
      valores, total,
    })
  }

  linhas.sort((a, b) => b.total - a.total)

  return NextResponse.json({
    data: { anoAtual, totaisPorTipo, linhas },
    error: null,
  })
}
