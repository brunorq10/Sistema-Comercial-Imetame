import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/faturamento/filtros
// Retorna valores distintos dos contratos para popular os filtros da tela
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratos = await prisma.contrato.findMany({
    where: { cancelled_at: null },
    select: {
      num_os:       true,
      num_acordo:   true,
      num_proposta: true,
      cliente:      { select: { id: true, nome: true, ramo_atuacao: true } },
      responsavel:  { select: { id: true, nome: true } },
    },
  })

  // Distinct clientes
  const clientesMap = new Map<number, string>()
  // Distinct responsaveis
  const responsaveisMap = new Map<number, string>()
  // Distinct strings
  const osSet       = new Set<string>()
  const acordoSet   = new Set<string>()
  const propostaSet = new Set<string>()
  const mercadoSet  = new Set<string>()

  for (const c of contratos) {
    clientesMap.set(c.cliente.id, c.cliente.nome)
    if (c.responsavel) responsaveisMap.set(c.responsavel.id, c.responsavel.nome)
    if (c.num_os)            osSet.add(c.num_os)
    if (c.num_acordo)        acordoSet.add(c.num_acordo)
    if (c.num_proposta)      propostaSet.add(c.num_proposta)
    if (c.cliente.ramo_atuacao) mercadoSet.add(c.cliente.ramo_atuacao)
  }

  return NextResponse.json({
    data: {
      clientes:     Array.from(clientesMap.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
      responsaveis: Array.from(responsaveisMap.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
      num_os:       Array.from(osSet).sort(),
      num_acordos:  Array.from(acordoSet).sort(),
      num_propostas: Array.from(propostaSet).sort(),
      mercados:     Array.from(mercadoSet).sort(),
    },
    error: null,
  })
}
