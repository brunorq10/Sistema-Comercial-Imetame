import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'
import { createNotificacao } from '@/lib/notifications'
import { formatDate } from '@/lib/utils'

const schemaEncerrar = z.object({
  acao: z.literal('encerrar'),
  motivo: z.string().min(3, 'Informe o motivo do encerramento antecipado'),
})
const schemaProrrogar = z.object({
  acao: z.literal('prorrogar'),
  nova_data_fim: z.string().min(1),
  motivo: z.string().min(3, 'Informe o motivo da prorrogação'),
})
const schema = z.union([schemaEncerrar, schemaProrrogar])

// PATCH /api/substituicoes/temporarias/:id — encerrar antecipadamente ou prorrogar
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  if (!pode(usuario, 'cadastro.substituicao.gerenciar')) return respostaSemPermissao()

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const subst = await prisma.substituicaoTemporaria.findUnique({
    where: { id },
    include: { titular: { select: { id: true, nome: true } }, substituto: { select: { id: true, nome: true } } },
  })
  if (!subst) return NextResponse.json({ data: null, error: 'Substituição não encontrada' }, { status: 404 })
  if (subst.encerrada_em) {
    return NextResponse.json({ data: null, error: 'Esta substituição já foi encerrada' }, { status: 409 })
  }

  if (parsed.data.acao === 'encerrar') {
    const atualizada = await prisma.substituicaoTemporaria.update({
      where: { id },
      data: { encerrada_em: new Date(), encerrada_por: usuario.id, encerrada_motivo: parsed.data.motivo },
    })
    createNotificacao(
      subst.substituto_id,
      'Substituição encerrada',
      `Sua substituição de ${subst.titular.nome} foi encerrada antecipadamente.`,
    )
    return NextResponse.json({ data: atualizada, error: null })
  }

  // prorrogar
  const novaDataFim = new Date(parsed.data.nova_data_fim)
  if (novaDataFim <= subst.data_fim) {
    return NextResponse.json({ data: null, error: 'A nova data de fim precisa ser posterior à data de fim atual' }, { status: 400 })
  }

  const [atualizada] = await prisma.$transaction([
    prisma.substituicaoTemporaria.update({ where: { id }, data: { data_fim: novaDataFim } }),
    prisma.substituicaoProrrogacao.create({
      data: {
        substituicao_id: id,
        data_fim_anterior: subst.data_fim,
        data_fim_nova: novaDataFim,
        motivo: parsed.data.motivo,
        created_by: usuario.id,
      },
    }),
  ])

  createNotificacao(
    subst.substituto_id,
    'Substituição prorrogada',
    `Sua substituição de ${subst.titular.nome} foi prorrogada até ${formatDate(novaDataFim)}.`,
  )

  return NextResponse.json({ data: atualizada, error: null })
}
