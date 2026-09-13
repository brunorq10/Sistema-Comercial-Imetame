import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pode } from '@/lib/permissoes'
import { usuarioDaSessao, respostaSemPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  nome: z.string().min(2).optional(),
  cnpj: z.string().nullable().optional(),
  contato_nome: z.string().nullable().optional(),
  contato_email: z.string().email().nullable().optional().or(z.literal('')),
  contato_telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().max(2).nullable().optional(),
  ramo_atuacao: z.enum(['PAPEL_CELULOSE_OBRAS', 'PAPEL_CELULOSE_PARADAS', 'SIDERURGIA', 'OLEO_GAS', 'OLEO_GAS_PETRO', 'OUTROS']).nullable().optional(),
  segmento: z.enum(['PAPEL_CELULOSE', 'SIDERURGIA', 'OLEO_GAS', 'OUTROS']).optional(),
  ativo: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const cliente = await prisma.cliente.findUnique({ where: { id } })

  if (!cliente) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ data: cliente, error: null })
}

const CAMPO_LABELS: Record<string, string> = {
  nome: 'Nome', cnpj: 'CNPJ', contato_nome: 'Contato', contato_email: 'E-mail do contato',
  contato_telefone: 'Telefone do contato', cidade: 'Cidade', estado: 'Estado',
  ramo_atuacao: 'Ramo de atuação', segmento: 'Segmento', ativo: 'Status',
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
  if (!pode(usuarioDaSessao(session), 'cadastro.cliente.editar')) return respostaSemPermissao()

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

  const d = parsed.data
  const autorId = Number(session.user.id)

  const atual = await prisma.cliente.findUnique({ where: { id } })
  if (!atual) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  const data: Record<string, unknown> = {
    ...(d.nome !== undefined && { nome: d.nome }),
    ...(d.cnpj !== undefined && { cnpj: d.cnpj }),
    ...(d.contato_nome !== undefined && { contato_nome: d.contato_nome }),
    ...(d.contato_email !== undefined && { contato_email: d.contato_email || null }),
    ...(d.contato_telefone !== undefined && { contato_telefone: d.contato_telefone }),
    ...(d.cidade !== undefined && { cidade: d.cidade }),
    ...(d.estado !== undefined && { estado: d.estado }),
    ...(d.ramo_atuacao !== undefined && { ramo_atuacao: d.ramo_atuacao }),
    ...(d.segmento !== undefined && { segmento: d.segmento }),
    ...(d.ativo !== undefined && { ativo: d.ativo }),
    updated_by: autorId,
  }
  if (d.ativo === false) { data.deactivated_at = new Date(); data.deactivated_by = autorId }
  if (d.ativo === true) { data.deactivated_at = null; data.deactivated_by = null }

  const cliente = await prisma.cliente.update({ where: { id }, data })

  const hist: { cliente_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }[] = []
  for (const campo of Object.keys(CAMPO_LABELS)) {
    const antigo = (atual as Record<string, unknown>)[campo]
    const novo = (cliente as Record<string, unknown>)[campo]
    const antigoStr = antigo == null ? null : (typeof antigo === 'boolean' ? (antigo ? 'Ativo' : 'Inativo') : String(antigo))
    const novoStr = novo == null ? null : (typeof novo === 'boolean' ? (novo ? 'Ativo' : 'Inativo') : String(novo))
    if (antigoStr !== novoStr) {
      hist.push({ cliente_id: id, campo: CAMPO_LABELS[campo], valor_de: antigoStr, valor_para: novoStr, created_by: autorId })
    }
  }
  if (hist.length > 0) {
    await prisma.clienteHistorico.createMany({ data: hist })
  }

  return NextResponse.json({ data: cliente, error: null })
}
