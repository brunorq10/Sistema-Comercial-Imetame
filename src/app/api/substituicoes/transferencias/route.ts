import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaNaoAutorizado, respostaSemPermissao } from '@/lib/permissaoApi'
import { efetivarTransferencia } from '@/lib/substituicoes'

const itemSchema = z.object({
  tipo_item: z.enum(['SOLICITACAO', 'CONTRATO']),
  item_id: z.number().int().positive(),
  direcao: z.enum(['A_PARA_B', 'B_PARA_A']).optional(),
})

const schema = z.object({
  tipo: z.enum(['TRANSFERENCIA', 'TROCA']),
  origem_id: z.number().int().positive(),
  destino_id: z.number().int().positive(),
  data_efetivacao: z.string().min(1),
  motivo: z.string().min(3, 'Informe o motivo'),
  itens: z.array(itemSchema).min(1, 'Selecione ao menos um item para transferir'),
})

const SELECT = {
  id: true, tipo: true, origem_id: true, destino_id: true, data_efetivacao: true,
  motivo: true, efetivada_em: true, created_at: true, created_by: true,
  origem: { select: { id: true, nome: true } },
  destino: { select: { id: true, nome: true } },
  itens: true,
} as const

// GET /api/substituicoes/transferencias — lista para a tela de Cadastros
export async function GET() {
  const session = await auth()
  const usuario = usuarioDaSessao(session)
  if (!usuario) return respostaNaoAutorizado()
  if (!pode(usuario, 'cadastro.substituicao.gerenciar')) return respostaSemPermissao()

  const lista = await prisma.transferenciaResponsabilidade.findMany({
    orderBy: { data_efetivacao: 'desc' },
    select: SELECT,
  })
  return NextResponse.json({ data: lista, error: null })
}

// POST /api/substituicoes/transferencias — cria uma transferência (Tipo 2) ou
// troca (Tipo 3) definitiva. Se data_efetivacao <= hoje, efetiva na hora;
// senão fica "agendada" (o cron diário efetiva quando a data chegar).
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
  const { tipo, origem_id, destino_id, motivo, itens } = parsed.data
  const dataEfetivacao = new Date(parsed.data.data_efetivacao)

  if (origem_id === destino_id) {
    return NextResponse.json({ data: null, error: 'Origem e destino não podem ser a mesma pessoa' }, { status: 400 })
  }
  if (tipo === 'TROCA' && itens.some((i) => !i.direcao)) {
    return NextResponse.json({ data: null, error: 'Cada item de uma troca precisa indicar o lado de origem (A ou B)' }, { status: 400 })
  }

  const [origem, destino] = await Promise.all([
    prisma.user.findUnique({ where: { id: origem_id }, select: { id: true, nome: true, perfil: true, ativo: true } }),
    prisma.user.findUnique({ where: { id: destino_id }, select: { id: true, nome: true, perfil: true, ativo: true } }),
  ])
  if (!origem || !origem.ativo) return NextResponse.json({ data: null, error: 'Responsável de origem não encontrado ou inativo' }, { status: 404 })
  if (!destino || !destino.ativo) return NextResponse.json({ data: null, error: 'Novo responsável não encontrado ou inativo' }, { status: 404 })

  const temSolicitacao = itens.some((i) => i.tipo_item === 'SOLICITACAO')
  const temContrato = itens.some((i) => i.tipo_item === 'CONTRATO')
  // Compatibilidade de perfil — mesma regra já usada em transferir-orcamentista
  // (src/app/api/solicitacoes/[id]/transferir-orcamentista/route.ts): não faz
  // sentido designar alguém sem acesso ao módulo correspondente.
  const precisaOrcamentista = (p: typeof origem) => temSolicitacao && p!.perfil !== 'ORCAMENTISTA'
  const precisaAcordos = (p: typeof origem) => temContrato && p!.perfil !== 'ACORDOS'
  if (precisaOrcamentista(destino)) {
    return NextResponse.json({ data: null, error: `${destino.nome} precisa ter o perfil Orçamentista para receber solicitações.` }, { status: 400 })
  }
  if (precisaAcordos(destino)) {
    return NextResponse.json({ data: null, error: `${destino.nome} precisa ter o perfil Acordos para receber acordos.` }, { status: 400 })
  }
  if (tipo === 'TROCA') {
    if (precisaOrcamentista(origem)) {
      return NextResponse.json({ data: null, error: `${origem.nome} precisa ter o perfil Orçamentista para receber solicitações.` }, { status: 400 })
    }
    if (precisaAcordos(origem)) {
      return NextResponse.json({ data: null, error: `${origem.nome} precisa ter o perfil Acordos para receber acordos.` }, { status: 400 })
    }
  }

  // Confere que os itens de fato pertencem a quem o front diz que pertencem.
  const solIds = itens.filter((i) => i.tipo_item === 'SOLICITACAO').map((i) => i.item_id)
  const ctIds = itens.filter((i) => i.tipo_item === 'CONTRATO').map((i) => i.item_id)
  const [sols, cts] = await Promise.all([
    solIds.length ? prisma.solicitacao.findMany({ where: { id: { in: solIds } }, select: { id: true, orcamentista_id: true } }) : [],
    ctIds.length ? prisma.contrato.findMany({ where: { id: { in: ctIds } }, select: { id: true, responsavel_id: true } }) : [],
  ])
  const solMap = new Map(sols.map((s) => [s.id, s.orcamentista_id]))
  const ctMap = new Map(cts.map((c) => [c.id, c.responsavel_id]))

  const itensParaCriar = itens.map((i) => {
    const donoAtual = i.tipo_item === 'SOLICITACAO' ? solMap.get(i.item_id) : ctMap.get(i.item_id)
    const novoDono = tipo === 'TROCA'
      ? (i.direcao === 'A_PARA_B' ? destino_id : origem_id)
      : destino_id
    return {
      tipo_item: i.tipo_item,
      item_id: i.item_id,
      direcao: tipo === 'TROCA' ? i.direcao! : null,
      responsavel_anterior_id: donoAtual ?? (tipo === 'TROCA' && i.direcao === 'B_PARA_A' ? destino_id : origem_id),
      responsavel_novo_id: novoDono,
    }
  })

  const criada = await prisma.transferenciaResponsabilidade.create({
    data: {
      tipo, origem_id, destino_id, data_efetivacao: dataEfetivacao, motivo,
      created_by: usuario.id,
      itens: { create: itensParaCriar },
    },
    select: SELECT,
  })

  if (dataEfetivacao <= new Date()) {
    await efetivarTransferencia(criada.id)
  }

  const atualizada = await prisma.transferenciaResponsabilidade.findUnique({ where: { id: criada.id }, select: SELECT })
  return NextResponse.json({ data: atualizada, error: null }, { status: 201 })
}
