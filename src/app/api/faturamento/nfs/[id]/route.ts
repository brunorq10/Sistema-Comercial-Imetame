import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  // inativação / reativação
  ativa: z.boolean().optional(),
  motivo_inativacao: z.string().optional(),
  // edição completa
  numero_nf: z.string().min(1).optional(),
  valor_total_nf: z.number().positive().optional(),
  percentual: z.number().min(0.01).max(100).optional(),
  data_emissao: z.string().optional(),
  data_vencimento: z.string().optional(),
  subindice_id: z.number().int().positive().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const d = parsed.data

  // Busca NF atual para recalcular valor_atribuido se necessário
  const nfAtual = await prisma.notaFiscalContrato.findUnique({ where: { id } })
  if (!nfAtual) return NextResponse.json({ data: null, error: 'NF não encontrada' }, { status: 404 })

  const novoValorTotal  = d.valor_total_nf  ?? Number(nfAtual.valor_total_nf)
  const novoPercentual  = d.percentual      ?? Number(nfAtual.percentual)
  const valorAtribuido  = (novoValorTotal * novoPercentual) / 100

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (d.ativa !== undefined) {
    updateData.ativa = d.ativa
    updateData.motivo_inativacao = d.ativa ? null : (d.motivo_inativacao ?? null)
  }
  if (d.numero_nf        !== undefined) updateData.numero_nf        = d.numero_nf
  if (d.data_emissao     !== undefined) updateData.data_emissao     = new Date(d.data_emissao)
  if (d.data_vencimento  !== undefined) updateData.data_vencimento  = new Date(d.data_vencimento)
  if (d.subindice_id     !== undefined) updateData.subindice_id     = d.subindice_id
  if (d.valor_total_nf   !== undefined || d.percentual !== undefined || d.subindice_id !== undefined) {
    updateData.valor_total_nf  = novoValorTotal
    updateData.percentual      = novoPercentual
    updateData.valor_atribuido = valorAtribuido
  }

  const nf = await prisma.notaFiscalContrato.update({ where: { id }, data: updateData })

  return NextResponse.json({ data: { id: nf.id }, error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  await prisma.notaFiscalContrato.delete({ where: { id } })

  return NextResponse.json({ data: { id }, error: null })
}
