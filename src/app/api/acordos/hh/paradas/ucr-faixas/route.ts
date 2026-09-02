import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirPermissao, respostaNaoAutorizado } from '@/lib/permissaoApi'
import { UCR_CAMPOS, type UcrCampo } from '@/lib/ucr'

// GET — as 5 faixas de UCR por região + últimas alterações do histórico.
// Leitura liberada a qualquer usuário autenticado do módulo Acordos.
export async function GET() {
  const session = await auth()
  if (!session) return respostaNaoAutorizado()

  const [faixas, historico] = await Promise.all([
    prisma.ucrFaixaRegiao.findMany({
      include: { usuario: { select: { nome: true } } },
      orderBy: { regiao: 'asc' },
    }),
    prisma.ucrFaixaHistorico.findMany({
      include: { usuario: { select: { nome: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
  ])

  return NextResponse.json({
    data: {
      faixas: faixas.map((f) => ({
        regiao: f.regiao,
        ucr_nao_suficiente: Number(f.ucr_nao_suficiente),
        ucr_a_evoluir: Number(f.ucr_a_evoluir),
        ucr_bom: Number(f.ucr_bom),
        ucr_otimo: Number(f.ucr_otimo),
        ucr_esplendido: Number(f.ucr_esplendido),
        updated_at: f.updated_at.toISOString(),
        updated_by_nome: f.usuario?.nome ?? null,
      })),
      historico: historico.map((h) => ({
        id: h.id,
        regiao: h.regiao,
        campo: h.campo,
        valor_de: h.valor_de != null ? Number(h.valor_de) : null,
        valor_para: Number(h.valor_para),
        created_at: h.created_at.toISOString(),
        usuario_nome: h.usuario.nome,
      })),
    },
    error: null,
  })
}

const bodySchema = z.object({
  regiao: z.enum(['ES', 'MG', 'BAHIA', 'SP', 'OUTROS']),
  ucr_nao_suficiente: z.number(),
  ucr_a_evoluir: z.number(),
  ucr_bom: z.number(),
  ucr_otimo: z.number(),
  ucr_esplendido: z.number(),
})

// PUT — atualiza a faixa de UMA região. Só Gestão Acordos / ADM Geral.
// Grava histórico De/Para apenas dos campos que realmente mudaram.
export async function PUT(req: NextRequest) {
  const { erro, usuario } = await exigirPermissao('acordos.paradas.ucr.editar')
  if (erro) return erro

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ data: null, error: 'Dados inválidos' }, { status: 400 })
  const { regiao, ...valores } = parsed.data

  const atual = await prisma.ucrFaixaRegiao.findUnique({ where: { regiao } })

  const historicoParaCriar: { regiao: typeof regiao; campo: UcrCampo; valor_de: number | null; valor_para: number; created_by: number }[] = []
  for (const campo of UCR_CAMPOS) {
    const valorPara = valores[campo]
    const valorDe = atual ? Number(atual[campo]) : null
    if (valorDe !== valorPara) {
      historicoParaCriar.push({ regiao, campo, valor_de: valorDe, valor_para: valorPara, created_by: usuario.id })
    }
  }

  const [faixa] = await prisma.$transaction([
    prisma.ucrFaixaRegiao.upsert({
      where: { regiao },
      create: { regiao, ...valores, updated_by: usuario.id },
      update: { ...valores, updated_by: usuario.id },
    }),
    ...(historicoParaCriar.length > 0 ? [prisma.ucrFaixaHistorico.createMany({ data: historicoParaCriar })] : []),
  ])

  return NextResponse.json({ data: { faixa, alteracoes: historicoParaCriar.length }, error: null })
}
