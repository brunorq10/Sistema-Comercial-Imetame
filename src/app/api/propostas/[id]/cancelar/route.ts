import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaSemPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  acao: z.enum(['cancelar', 'reativar']),
  motivo: z.string().trim().optional(),
})

// POST — cancela/reativa a PROPOSTA (aba Propostas). Reversível; não altera a
// solicitação (que só pode ser suspensa quando já há proposta enviada).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!pode(usuarioDaSessao(session), 'orc.solicitacao.cancelar')) return respostaSemPermissao()

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Dados inválidos' }, { status: 400 })
  const { acao, motivo } = parsed.data

  const sol = await prisma.solicitacao.findUnique({ where: { id }, select: { id: true, proposta_cancelada_at: true } })
  if (!sol) return NextResponse.json({ data: null, error: 'Não encontrada' }, { status: 404 })

  if (acao === 'cancelar') {
    if (!motivo || motivo.length < 5) {
      return NextResponse.json({ data: null, error: 'Justificativa obrigatória (mín. 5 caracteres)' }, { status: 400 })
    }
    await prisma.solicitacao.update({
      where: { id },
      data: { proposta_cancelada_at: new Date(), proposta_cancel_reason: motivo },
    })
    return NextResponse.json({ data: { id, cancelada: true }, error: null })
  }

  await prisma.solicitacao.update({
    where: { id },
    data: { proposta_cancelada_at: null, proposta_cancel_reason: null },
  })
  return NextResponse.json({ data: { id, cancelada: false }, error: null })
}
