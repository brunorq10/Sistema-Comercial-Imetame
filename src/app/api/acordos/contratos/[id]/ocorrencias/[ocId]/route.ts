import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'

// DELETE /api/acordos/contratos/:id/ocorrencias/:ocId
// Exclui uma ocorrência. Permitido ao autor ou à supervisão
// (Gestão Acordos / ADM Geral). Verificação no backend, não só na UI.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; ocId: string } }) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()

  const contratoId = Number(params.id)
  const ocId = Number(params.ocId)
  if (isNaN(contratoId) || isNaN(ocId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const oc = await prisma.ocorrenciaContratual.findFirst({
    where: { id: ocId, contrato_id: contratoId },
    select: { id: true, created_by: true },
  })
  if (!oc) return NextResponse.json({ data: null, error: 'Ocorrência não encontrada' }, { status: 404 })

  const ehAutor = oc.created_by === usuario.id
  const ehSupervisao = pode(usuario, 'acordos.ocorrencia.excluir')
  if (!ehAutor && !ehSupervisao) return respostaSemPermissao()

  // Lixeira: soft-delete recuperável por 15 dias (não apaga o registro)
  await prisma.ocorrenciaContratual.update({
    where: { id: ocId },
    data: { deleted_at: new Date(), deleted_by: usuario.id },
  })

  return NextResponse.json({ data: { ok: true }, error: null })
}
