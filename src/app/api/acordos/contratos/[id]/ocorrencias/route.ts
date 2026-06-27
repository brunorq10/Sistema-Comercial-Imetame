import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPOS_OCORRENCIA, RESPONSABILIDADES, IMPACTOS_OCORRENCIA } from '@/lib/ocorrencias'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function inicioPeriodo(periodo: string): Date | null {
  const hoje = new Date()
  if (periodo === '30d') return new Date(hoje.getTime() - 30 * 86400000)
  if (periodo === '90d') return new Date(hoje.getTime() - 90 * 86400000)
  if (periodo === 'mes_atual') return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return null
}

// GET — lista de ocorrências do contrato, com filtros server-side.
// Visível para qualquer usuário com acesso ao contrato (histórico coletivo).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const periodo = sp.get('periodo') ?? 'all'
  const responsavel = sp.get('responsavel') ?? ''
  const responsabilidade = sp.get('responsabilidade') ?? ''
  const tipo = sp.get('tipo') ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { contrato_id: contratoId }
  if (responsabilidade) where.responsabilidade = responsabilidade
  if (tipo) where.tipo = tipo
  if (responsavel && !isNaN(Number(responsavel))) where.created_by = Number(responsavel)
  const desde = inicioPeriodo(periodo)
  if (desde) where.data = { gte: desde }

  if (q) {
    const nq = norm(q)
    const tiposMatch = TIPOS_OCORRENCIA.filter((t) => norm(t.label).includes(nq)).map((t) => t.value)
    const respMatch = RESPONSABILIDADES.filter((r) => norm(r.label).includes(nq)).map((r) => r.value)
    const impMatch = IMPACTOS_OCORRENCIA.filter((i) => norm(i.label).includes(nq)).map((i) => i.value)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [
      { codigo: { contains: q, mode: 'insensitive' } },
      { descricao: { contains: q, mode: 'insensitive' } },
      { criador: { nome: { contains: q, mode: 'insensitive' } } },
    ]
    if (tiposMatch.length) or.push({ tipo: { in: tiposMatch } })
    if (respMatch.length) or.push({ responsabilidade: { in: respMatch } })
    if (impMatch.length) or.push({ impacto: { hasSome: impMatch } })
    where.AND = [{ OR: or }]
  }

  const [ocorrencias, responsaveisRaw] = await Promise.all([
    prisma.ocorrenciaContratual.findMany({
      where,
      orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
      include: {
        criador: { select: { nome: true } },
        anexos: { orderBy: { id: 'asc' } },
      },
    }),
    // Responsáveis (autores) de TODAS as ocorrências do contrato — para o select
    prisma.ocorrenciaContratual.findMany({
      where: { contrato_id: contratoId },
      distinct: ['created_by'],
      select: { created_by: true, criador: { select: { nome: true } } },
      orderBy: { criador: { nome: 'asc' } },
    }),
  ])

  return NextResponse.json({
    data: {
      total: ocorrencias.length,
      responsaveis: responsaveisRaw.map((r) => ({ id: r.created_by, nome: r.criador.nome })),
      items: ocorrencias.map((o) => ({
        id: o.id,
        codigo: o.codigo,
        tipo: o.tipo,
        data: o.data.toISOString(),
        responsabilidade: o.responsabilidade,
        impacto: o.impacto,
        descricao: o.descricao,
        data_notificacao_cliente: o.data_notificacao_cliente?.toISOString() ?? null,
        created_by: o.created_by,
        autor: o.criador.nome,
        created_at: o.created_at.toISOString(),
        anexos: o.anexos.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, url: a.url, tamanho: a.tamanho })),
      })),
    },
    error: null,
  })
}
