import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'

// GET /api/solicitacoes/:id/informacoes/:infoId — detalhe completo + anexos.
export async function GET(_req: NextRequest, { params }: { params: { infoId: string } }) {
  const session = await auth()
  if (!session) return respostaNaoAutorizado()

  const infoId = Number(params.infoId)
  if (isNaN(infoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const info = await prisma.solicitacaoInfo.findUnique({
    where: { id: infoId },
    include: { criador: { select: { nome: true } }, anexos: { orderBy: { id: 'asc' } } },
  })
  if (!info) return NextResponse.json({ data: null, error: 'Informação não encontrada' }, { status: 404 })

  return NextResponse.json({
    data: {
      id: info.id,
      codigo: info.codigo,
      tipo: info.tipo,
      data: info.data.toISOString(),
      comentario: info.comentario,
      created_at: info.created_at.toISOString(),
      created_by: info.created_by,
      autor: info.criador.nome,
      anexos: info.anexos.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, url: a.url, tamanho: a.tamanho })),
    },
    error: null,
  })
}

// DELETE /api/solicitacoes/:id/informacoes/:infoId
// Exclui uma informação. Permitido ao autor que a criou ou à supervisão
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

  // Lixeira: soft-delete recuperável por 15 dias (não apaga o registro)
  await prisma.solicitacaoInfo.update({
    where: { id: infoId },
    data: { deleted_at: new Date(), deleted_by: usuario.id },
  })

  return NextResponse.json({ data: { ok: true }, error: null })
}
