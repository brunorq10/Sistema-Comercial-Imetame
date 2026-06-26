import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'

// DELETE /api/solicitacoes/:id/informacoes/:infoId
// Exclui uma interação. Permitido ao autor que a criou ou à supervisão
// (Gestão Comercial / ADM Geral). Não há edição.
export async function DELETE(_req: NextRequest, { params }: { params: { infoId: string } }) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()

  const infoId = Number(params.infoId)
  if (isNaN(infoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const info = await prisma.solicitacaoInfo.findUnique({
    where: { id: infoId },
    select: { id: true, created_by: true },
  })
  if (!info) return NextResponse.json({ data: null, error: 'Interação não encontrada' }, { status: 404 })

  const ehAutor = info.created_by === usuario.id
  const ehSupervisao = pode(usuario, 'orc.info.excluir')
  if (!ehAutor && !ehSupervisao) return respostaSemPermissao()

  await prisma.solicitacaoInfo.delete({ where: { id: infoId } })

  return NextResponse.json({ data: { ok: true }, error: null })
}
