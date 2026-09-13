import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'

// GET /api/substituicoes/status?usuarioId=123
// Devolve, para o usuário informado (ou o próprio, se omitido): de quem ele é
// substituto agora (para Meu Painel / listagens) e quem o substitui agora (para
// o banner "Você está sendo substituído" e para a ficha do usuário em Cadastros).
// Consultar o PRÓPRIO status é liberado a qualquer usuário autenticado; consultar
// o de outra pessoa exige a mesma permissão de gerir Substituições.
export async function GET(req: NextRequest) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()

  const usuarioIdParam = req.nextUrl.searchParams.get('usuarioId')
  const usuarioId = usuarioIdParam ? Number(usuarioIdParam) : usuario.id
  if (usuarioId !== usuario.id && !pode(usuario, 'cadastro.substituicao.gerenciar')) {
    return respostaSemPermissao()
  }

  const hoje = new Date()
  const [substituindo, sendoSubstituidoPor] = await Promise.all([
    prisma.substituicaoTemporaria.findMany({
      where: { substituto_id: usuarioId, encerrada_em: null, data_inicio: { lte: hoje }, data_fim: { gte: hoje } },
      select: { id: true, data_fim: true, titular: { select: { id: true, nome: true } } },
    }),
    prisma.substituicaoTemporaria.findMany({
      where: { titular_id: usuarioId, encerrada_em: null, data_inicio: { lte: hoje }, data_fim: { gte: hoje } },
      select: { id: true, data_fim: true, substituto: { select: { id: true, nome: true } } },
    }),
  ])

  return NextResponse.json({
    data: {
      substituindo: substituindo.map((s) => ({ id: s.id, titular: s.titular, ate: s.data_fim })),
      sendoSubstituidoPor: sendoSubstituidoPor.map((s) => ({ id: s.id, substituto: s.substituto, ate: s.data_fim })),
    },
    error: null,
  })
}
