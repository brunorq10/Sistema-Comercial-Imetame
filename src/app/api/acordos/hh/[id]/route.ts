import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/lib/apiHandler'
import { exigirPermissao } from '@/lib/permissaoApi'

// DELETE — "Remover do acompanhamento" de HH (Obras/Paradas).
// RN-18: NÃO exclui os dados. Faz soft-cancel com justificativa obrigatória e histórico.
// O contrato deixa de aparecer na lista de HH, mas os lançamentos são preservados
// e podem ser reativados (basta salvar um novo lançamento para o contrato).
export const DELETE = withApi(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  { const { erro } = await exigirPermissao('acordos.obras.remover'); if (erro) return erro }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  // Justificativa obrigatória (RN-18)
  let motivo = ''
  try {
    const body = await req.json()
    motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  } catch { /* corpo ausente */ }
  if (motivo.length < 3) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da remoção (mínimo 3 caracteres).' }, { status: 400 })
  }

  const contrato = await prisma.contrato.findUnique({ where: { id }, select: { id: true } })
  if (!contrato) return NextResponse.json({ data: null, error: 'Contrato não encontrado' }, { status: 404 })

  const userId = Number(session.user.id)
  await prisma.$transaction([
    prisma.contrato.update({
      where: { id },
      data: { hh_cancelado_at: new Date(), hh_cancel_motivo: motivo, hh_cancelado_por: userId },
    }),
    prisma.hhAcompanhamentoHistorico.create({
      data: { contrato_id: id, acao: 'CANCELADO', motivo, created_by: userId },
    }),
  ])

  return NextResponse.json({ data: { ok: true }, error: null })
})
