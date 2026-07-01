import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardRelatorios } from '@/lib/relatorios/guard'
import { camposPublicos } from '@/lib/relatorios/catalog'

// Campos disponíveis + opções para os selects de filtro (clientes e usuários).
export async function GET() {
  const guard = await guardRelatorios()
  if (!guard.ok) return guard.res

  const [clientes, responsaveis] = await Promise.all([
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.user.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])

  return NextResponse.json({ data: { campos: camposPublicos(), clientes, responsaveis }, error: null })
}
