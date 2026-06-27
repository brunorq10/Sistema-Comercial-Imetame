import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TIPOS = ['MULTA', 'GLOSAS', 'REEMBOLSOS', 'OUTROS']
const TIPO_LABELS: Record<string, string> = { MULTA: 'Multa', GLOSAS: 'Glosas', REEMBOLSOS: 'Reembolsos', OUTROS: 'Outros' }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// GET — lista global de multas/penalidades com filtros (Registro de Multas).
// Query: ?de=&ate=&tipo=&status=&q=
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const de = sp.get('de') ?? ''
  const ate = sp.get('ate') ?? ''
  const tipo = sp.get('tipo') ?? ''
  const status = sp.get('status') ?? '' // ''=todas | ativas | inativas
  const q = (sp.get('q') ?? '').trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (tipo && TIPOS.includes(tipo)) where.tipo = tipo
  if (status === 'ativas') where.ativa = true
  if (status === 'inativas') where.ativa = false
  if (de || ate) {
    where.data_ocorrencia = {}
    if (de) where.data_ocorrencia.gte = new Date(de)
    if (ate) where.data_ocorrencia.lte = new Date(`${ate}T23:59:59`)
  }
  if (q) {
    const nq = norm(q)
    const tiposMatch = TIPOS.filter((t) => norm(TIPO_LABELS[t]).includes(nq))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [
      { descricao: { contains: q, mode: 'insensitive' } },
      { contrato: { indice: { contains: q, mode: 'insensitive' } } },
      { contrato: { cliente: { nome: { contains: q, mode: 'insensitive' } } } },
    ]
    if (tiposMatch.length) or.push({ tipo: { in: tiposMatch } })
    where.AND = [{ OR: or }]
  }

  const multas = await prisma.multaPenalidade.findMany({
    where,
    orderBy: [{ data_ocorrencia: 'desc' }, { created_at: 'desc' }],
    include: {
      criador: { select: { nome: true } },
      contrato: { select: { id: true, indice: true, cliente: { select: { nome: true } } } },
    },
  })

  return NextResponse.json({
    data: multas.map((m) => ({
      id: m.id,
      contrato_id: m.contrato_id,
      contrato_indice: m.contrato.indice,
      cliente_nome: m.contrato.cliente.nome,
      tipo: m.tipo,
      descricao: m.descricao,
      data_ocorrencia: m.data_ocorrencia.toISOString(),
      data_notificacao_cliente: m.data_notificacao_cliente?.toISOString() ?? null,
      data_desconto: m.data_desconto?.toISOString() ?? null,
      valor_total: Number(m.valor_total),
      ativa: m.ativa,
      motivo_inativacao: m.motivo_inativacao,
      autor: m.criador.nome,
    })),
    error: null,
  })
}
