import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaSemPermissao } from '@/lib/permissaoApi'

// GET /api/usuarios/:id/historico — auditoria de alterações de cadastro
// (perfil, ativo, e-mail, nome, redefinição de senha). Restrito a quem
// gerencia usuários (ADM Geral) — mesma permissão da tela de Cadastros.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!pode(usuarioDaSessao(session), 'cadastro.usuario.gerenciar')) return respostaSemPermissao()

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const historico = await prisma.usuarioHistorico.findMany({
    where: { user_id: id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, campo: true, valor_de: true, valor_para: true, created_at: true,
      autor: { select: { nome: true } },
    },
  })

  const data = historico.map((h) => ({
    id: h.id,
    campo: h.campo,
    valor_de: h.valor_de,
    valor_para: h.valor_para,
    alterado_em: h.created_at.toISOString(),
    alterado_por: h.autor.nome,
  }))

  return NextResponse.json({ data, error: null })
}
