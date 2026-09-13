import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'
import { createNotificacao } from '@/lib/notifications'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  titular_id: z.number().int().positive(),
  substituto_id: z.number().int().positive(),
  data_inicio: z.string().min(1),
  data_fim: z.string().min(1),
  motivo_tipo: z.enum(['FERIAS', 'AFASTAMENTO', 'LICENCA', 'OUTRO']),
  motivo_detalhe: z.string().optional(),
})

const SELECT = {
  id: true,
  titular_id: true,
  substituto_id: true,
  data_inicio: true,
  data_fim: true,
  motivo_tipo: true,
  motivo_detalhe: true,
  encerrada_em: true,
  encerrada_por: true,
  encerrada_motivo: true,
  created_at: true,
  created_by: true,
  titular: { select: { id: true, nome: true, perfil: true } },
  substituto: { select: { id: true, nome: true, perfil: true } },
} as const

// GET /api/substituicoes/temporarias — lista para a tela de Cadastros
export async function GET() {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  if (!pode(usuario, 'cadastro.substituicao.gerenciar')) return respostaSemPermissao()

  const lista = await prisma.substituicaoTemporaria.findMany({
    orderBy: { data_inicio: 'desc' },
    select: SELECT,
  })
  return NextResponse.json({ data: lista, error: null })
}

// POST /api/substituicoes/temporarias — cria uma substituição temporária (Tipo 1)
export async function POST(req: NextRequest) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  if (!pode(usuario, 'cadastro.substituicao.gerenciar')) return respostaSemPermissao()

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { titular_id, substituto_id, motivo_tipo, motivo_detalhe } = parsed.data
  const dataInicio = new Date(parsed.data.data_inicio)
  const dataFim = new Date(parsed.data.data_fim)

  if (titular_id === substituto_id) {
    return NextResponse.json({ data: null, error: 'O substituto não pode ser a mesma pessoa que o titular' }, { status: 400 })
  }
  if (dataFim < dataInicio) {
    return NextResponse.json({ data: null, error: 'A data de fim não pode ser anterior à data de início' }, { status: 400 })
  }

  const [titular, substituto] = await Promise.all([
    prisma.user.findUnique({ where: { id: titular_id }, select: { id: true, nome: true, perfil: true, ativo: true } }),
    prisma.user.findUnique({ where: { id: substituto_id }, select: { id: true, nome: true, perfil: true, ativo: true } }),
  ])
  if (!titular || !titular.ativo) return NextResponse.json({ data: null, error: 'Titular não encontrado ou inativo' }, { status: 404 })
  if (!substituto || !substituto.ativo) return NextResponse.json({ data: null, error: 'Substituto não encontrado ou inativo' }, { status: 404 })
  if (substituto.perfil !== titular.perfil) {
    return NextResponse.json(
      { data: null, error: `O substituto precisa ter o mesmo perfil do titular (${titular.perfil}) para atuar nos mesmos módulos.` },
      { status: 400 },
    )
  }

  // Não permite duas substituições vigentes sobrepostas para o mesmo titular
  const sobreposta = await prisma.substituicaoTemporaria.findFirst({
    where: {
      titular_id,
      encerrada_em: null,
      data_inicio: { lte: dataFim },
      data_fim: { gte: dataInicio },
    },
  })
  if (sobreposta) {
    return NextResponse.json(
      { data: null, error: `Já existe uma substituição vigente para este titular entre ${formatDate(sobreposta.data_inicio)} e ${formatDate(sobreposta.data_fim)}.` },
      { status: 409 },
    )
  }

  const criada = await prisma.substituicaoTemporaria.create({
    data: {
      titular_id,
      substituto_id,
      data_inicio: dataInicio,
      data_fim: dataFim,
      motivo_tipo,
      motivo_detalhe: motivo_detalhe || null,
      created_by: usuario.id,
    },
    select: SELECT,
  })

  const periodo = `${formatDate(dataInicio)} a ${formatDate(dataFim)}`
  createNotificacao(
    substituto_id,
    'Você foi designado substituto',
    `Você foi designado substituto de ${titular.nome} de ${periodo}. Durante esse período você terá acesso aos itens dele(a).`,
  )
  createNotificacao(
    titular_id,
    'Substituto designado',
    `${substituto.nome} foi designado seu substituto de ${periodo}.`,
  )

  return NextResponse.json({ data: criada, error: null }, { status: 201 })
}
