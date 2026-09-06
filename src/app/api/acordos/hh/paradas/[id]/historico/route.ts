import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── GET: histórico de alterações do previsto/planejado da Parada de um contrato
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const historico = await prisma.paradaHhConfigHistorico.findMany({
    where: { config: { contrato_id: contratoId } },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      campo: true,
      valor_de: true,
      valor_para: true,
      created_at: true,
      usuario: { select: { nome: true } },
    },
  })

  const data = historico.map((h) => ({
    id: h.id,
    campo: h.campo,
    valor_de: h.valor_de,
    valor_para: h.valor_para,
    alterado_em: h.created_at.toISOString(),
    alterado_por: h.usuario.nome,
  }))

  return NextResponse.json({ data, error: null })
}
