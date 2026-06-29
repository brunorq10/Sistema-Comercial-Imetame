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
  const clienteId = sp.get('cliente_id') ?? ''
  const cidade = sp.get('cidade') ?? ''
  const responsavel = sp.get('responsavel') ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  // tipo aceita lista separada por vírgula (multi-seleção)
  const tiposSel = tipo.split(',').filter((t) => TIPOS.includes(t))
  if (tiposSel.length === 1) where.tipo = tiposSel[0]
  else if (tiposSel.length > 1) where.tipo = { in: tiposSel }
  if (status === 'ativas') where.ativa = true
  if (status === 'inativas') where.ativa = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contratoWhere: any = {}
  // Filtros multi-valor: lista separada por vírgula
  const clienteIds = clienteId ? clienteId.split(',').map(Number).filter((n) => !isNaN(n)) : []
  const cidades = cidade ? cidade.split(',').filter(Boolean) : []
  const responsaveis = responsavel ? responsavel.split(',').map(Number).filter((n) => !isNaN(n)) : []
  if (clienteIds.length) contratoWhere.cliente_id = { in: clienteIds }
  if (cidades.length) contratoWhere.cidade = { in: cidades }
  if (responsaveis.length) contratoWhere.responsavel_id = { in: responsaveis }
  if (Object.keys(contratoWhere).length) where.contrato = { is: contratoWhere }
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

  const [multas, opcoesRaw] = await Promise.all([
    prisma.multaPenalidade.findMany({
      where,
      orderBy: [{ data_ocorrencia: 'desc' }, { created_at: 'desc' }],
      include: {
        criador: { select: { nome: true } },
        contrato: { select: { id: true, indice: true, cidade: true, estado: true, cliente_id: true, cliente: { select: { nome: true } }, responsavel: { select: { id: true, nome: true } } } },
      },
    }),
    // Opções dos filtros (contratos que possuem multas)
    prisma.multaPenalidade.findMany({
      distinct: ['contrato_id'],
      select: { contrato: { select: { cliente_id: true, cidade: true, cliente: { select: { nome: true } }, responsavel: { select: { id: true, nome: true } } } } },
    }),
  ])

  const clientesMap = new Map<number, string>()
  const cidadesSet = new Set<string>()
  const respMap = new Map<number, string>()
  for (const o of opcoesRaw) {
    const c = o.contrato
    if (c.cliente_id) clientesMap.set(c.cliente_id, c.cliente.nome)
    if (c.cidade) cidadesSet.add(c.cidade)
    if (c.responsavel) respMap.set(c.responsavel.id, c.responsavel.nome)
  }

  return NextResponse.json({
    data: {
      opcoes: {
        clientes: Array.from(clientesMap, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
        cidades: Array.from(cidadesSet).sort(),
        responsaveis: Array.from(respMap, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
      },
      items: multas.map((m) => ({
        id: m.id,
        contrato_id: m.contrato_id,
        contrato_indice: m.contrato.indice,
        cliente_nome: m.contrato.cliente.nome,
        cidade: m.contrato.cidade,
        estado: m.contrato.estado,
        responsavel_nome: m.contrato.responsavel?.nome ?? '—',
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
    },
    error: null,
  })
}
