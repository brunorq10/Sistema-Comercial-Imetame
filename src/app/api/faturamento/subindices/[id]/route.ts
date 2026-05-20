import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const

const CAMPO_LABELS: Record<string, string> = {
  descricao: 'Descrição', valor_total: 'Valor Total', data_inicio: 'Data Início',
  data_fim: 'Data Fim', comentarios: 'Comentários',
  jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril',
  mai: 'Maio', jun: 'Junho', jul: 'Julho', ago: 'Agosto',
  set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro',
}

function formatVal(campo: string, val: unknown): string {
  if (val == null) return '—'
  if (MESES.includes(campo as never) || campo === 'valor_total')
    return formatCurrency(Number(val))
  if (campo === 'data_inicio' || campo === 'data_fim')
    return formatDate(val instanceof Date ? val.toISOString() : String(val)) ?? '—'
  return String(val)
}

const schema = z.object({
  descricao: z.string().min(1).optional(),
  valor_total: z.number().nonnegative().optional(),
  data_inicio: z.string().optional().nullable(),
  data_fim: z.string().optional().nullable(),
  comentarios: z.string().optional().nullable(),
  jan: z.number().nonnegative().optional().nullable(),
  fev: z.number().nonnegative().optional().nullable(),
  mar: z.number().nonnegative().optional().nullable(),
  abr: z.number().nonnegative().optional().nullable(),
  mai: z.number().nonnegative().optional().nullable(),
  jun: z.number().nonnegative().optional().nullable(),
  jul: z.number().nonnegative().optional().nullable(),
  ago: z.number().nonnegative().optional().nullable(),
  set: z.number().nonnegative().optional().nullable(),
  out: z.number().nonnegative().optional().nullable(),
  nov: z.number().nonnegative().optional().nullable(),
  dez: z.number().nonnegative().optional().nullable(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  // Busca valores atuais para comparar
  const atual = await prisma.subIndiceFaturamento.findUnique({ where: { id } })
  if (!atual) return NextResponse.json({ data: null, error: 'Não encontrado' }, { status: 404 })

  const { set: set_val, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (set_val !== undefined) data.set = set_val
  if (rest.data_inicio !== undefined) data.data_inicio = rest.data_inicio ? new Date(rest.data_inicio) : null
  if (rest.data_fim !== undefined) data.data_fim = rest.data_fim ? new Date(rest.data_fim) : null
  if (rest.comentarios !== undefined) {
    data.comentario_updated_at = new Date()
    data.comentario_updated_by = Number(session.user.id)
  }

  const subindice = await prisma.subIndiceFaturamento.update({
    where: { id },
    data,
    include: { notas_fiscais: true },
  })

  // Registra cada campo alterado no histórico
  const historico: { subindice_id: number; campo: string; valor_de: string | null; valor_para: string | null; created_by: number }[] = []
  const camposVerificar = ['descricao', 'valor_total', 'data_inicio', 'data_fim', 'comentarios', ...MESES] as const

  for (const campo of camposVerificar) {
    const rawKey = campo === 'set' ? 'set' : campo
    const antigo = (atual as Record<string, unknown>)[rawKey]
    const novo   = (subindice as Record<string, unknown>)[rawKey]
    const antigoStr = antigo == null ? null : String(antigo)
    const novoStr   = novo   == null ? null : String(novo)
    if (antigoStr !== novoStr) {
      historico.push({
        subindice_id: id,
        campo: CAMPO_LABELS[campo] ?? campo,
        valor_de:   formatVal(campo, antigo),
        valor_para: formatVal(campo, novo),
        created_by: Number(session.user.id),
      })
    }
  }

  if (historico.length > 0) {
    await prisma.historicoSubIndice.createMany({ data: historico })
  }

  return NextResponse.json({ data: subindice, error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  await prisma.subIndiceFaturamento.delete({ where: { id } })
  return NextResponse.json({ data: null, error: null })
}
