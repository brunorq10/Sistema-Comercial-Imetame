import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional(),
  funcao: z.string().nullable().optional(),
  perfil: z.enum(['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ORCAMENTISTA', 'GESTAO_ACORDOS', 'ACORDOS', 'ADM_GERAL']).optional(),
  ativo: z.boolean().optional(),
  nova_senha: z.string().min(6).optional(),
  is_analista_critico: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  // CRÍTICO-3: apenas admins podem modificar usuários
  const ADMIN_PERFIS = ['ADM_COMERCIAL', 'ADM_GERAL']
  if (!ADMIN_PERFIS.includes(session.user.perfil as string)) {
    return NextResponse.json({ data: null, error: 'Apenas administradores podem modificar usuários' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { nova_senha, is_analista_critico, ...rest } = parsed.data

  // RN-04: Bloquear desativação de Orçamentista com solicitações ativas
  if (rest.ativo === false || rest.perfil) {
    const usuario = await prisma.user.findUnique({ where: { id }, select: { perfil: true } })
    if (usuario?.perfil === 'ORCAMENTISTA') {
      const solicitacoesAtivas = await prisma.solicitacao.count({
        where: {
          orcamentista_id: id,
          cancelled_at: null,
          status: { notIn: ['CANCELADA', 'CONTRATO_GANHO', 'RECUSADA'] },
        },
      })
      if (solicitacoesAtivas > 0) {
        return NextResponse.json(
          {
            data: null,
            error: `Não é possível desativar o Orçamentista — possui ${solicitacoesAtivas} solicitação(ões) ativa(s). Transfira-as antes de continuar.`,
          },
          { status: 409 },
        )
      }
    }
  }

  // RN-02: Bloquear remoção de Analista Crítico sem substituição
  if (is_analista_critico === false) {
    const usuario = await prisma.user.findUnique({
      where: { id },
      select: { is_analista_critico: true },
    })
    if (usuario?.is_analista_critico) {
      return NextResponse.json(
        {
          data: null,
          error: 'Para remover a atribuição de Analista Crítico, defina primeiro outro usuário como substituto.',
        },
        { status: 409 },
      )
    }
  }

  // Busca estado atual antes de alterar (para log de histórico M11)
  const usuarioAtual = await prisma.user.findUnique({
    where: { id },
    select: { is_analista_critico: true },
  })

  // Se definido como analista crítico, remover flag dos demais e registrar remoção no histórico
  if (is_analista_critico === true) {
    const anteriores = await prisma.user.findMany({
      where: { id: { not: id }, is_analista_critico: true },
      select: { id: true },
    })
    await prisma.user.updateMany({
      where: { id: { not: id } },
      data: { is_analista_critico: false },
    })
    // M11: registrar remoção dos anteriores
    if (anteriores.length > 0) {
      await prisma.analistaCriticoHistorico.createMany({
        data: anteriores.map(u => ({ user_id: u.id, acao: 'REMOVIDO', realizado_por: Number(session.user.id) })),
      })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (rest.nome !== undefined) updateData.nome = rest.nome
  if (rest.email !== undefined) updateData.email = rest.email
  if (rest.funcao !== undefined) updateData.funcao = rest.funcao
  if (rest.perfil !== undefined) updateData.perfil = rest.perfil
  if (rest.ativo !== undefined) updateData.ativo = rest.ativo
  if (is_analista_critico !== undefined) updateData.is_analista_critico = is_analista_critico
  if (nova_senha) updateData.password_hash = await bcrypt.hash(nova_senha, 12)

  const usuario = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, nome: true, email: true, funcao: true, perfil: true, ativo: true, is_analista_critico: true, created_at: true },
  })

  // M11: registrar atribuição ou remoção direta do usuário editado
  if (is_analista_critico !== undefined && is_analista_critico !== usuarioAtual?.is_analista_critico) {
    await prisma.analistaCriticoHistorico.create({
      data: {
        user_id: id,
        acao: is_analista_critico ? 'ATRIBUIDO' : 'REMOVIDO',
        realizado_por: Number(session.user.id),
      },
    })
  }

  return NextResponse.json({ data: usuario, error: null })
}
