import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao, exigirTitularNfContrato } from '@/lib/permissaoApi'

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

  // Editar exige titularidade do contrato; inativar/reativar é exclusivo da gestão.
  { const _n = await exigirTitularNfContrato(session, id, 'acordos.nf.editar'); if (_n) return _n }
  if (d.ativa !== undefined) {
    const { erro } = await exigirPermissao('acordos.nf.inativar'); if (erro) return erro
  }

  // Busca NF atual para recalcular valor_atribuido se necessário
  const nfAtual = await prisma.notaFiscalContrato.findUnique({ where: { id } })
  if (!nfAtual) return NextResponse.json({ data: null, error: 'NF não encontrada' }, { status: 404 })

  const novoValorTotal  = d.valor_total_nf  ?? Number(nfAtual.valor_total_nf)
  const novoPercentual  = d.percentual      ?? Number(nfAtual.percentual)
  const valorAtribuido  = (novoValorTotal * novoPercentual) / 100

  // A4: validar que o novo percentual não ultrapassa 100% para esta NF (excluindo o registro atual)
  const numeroNf = d.numero_nf ?? nfAtual.numero_nf
  if (d.percentual !== undefined || d.numero_nf !== undefined) {
    const totalOutros = await prisma.notaFiscalContrato.aggregate({
      where: { numero_nf: numeroNf, ativa: true, id: { not: id } },
      _sum: { percentual: true },
    })
    const totalAlocadoOutros = Number(totalOutros._sum.percentual ?? 0)
    if (totalAlocadoOutros + novoPercentual > 100 + 0.001) {
      const restante = 100 - totalAlocadoOutros
      return NextResponse.json(
        { data: null, error: `A NF ${numeroNf} já possui ${totalAlocadoOutros.toFixed(2)}% alocados em outros lançamentos. Restam ${restante.toFixed(2)}% disponíveis para este lançamento.` },
        { status: 422 },
      )
    }
  }

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
  { const { erro } = await exigirPermissao('acordos.nf.excluir'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  await prisma.notaFiscalContrato.delete({ where: { id } })

  return NextResponse.json({ data: { id }, error: null })
}
