import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getFiltros() {
  const rows = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null,
      OR: [
        { propostas_tecnicas: { some: { data_envio: { not: null } } } },
        { propostas_comerciais: { some: { data_envio: { not: null } } } },
        { propostas_fabricacao: { some: { data_envio: { not: null } } } },
      ],
    },
    select: {
      numero:       true,
      cidade:       true,
      estado:       true,
      escopo:       true,
      cliente:      { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
    },
  })

  const clientesMap      = new Map<number, string>()
  const orcamentistasMap = new Map<number, string>()
  const numerosSet       = new Set<string>()
  const cidadesSet       = new Set<string>()
  const escoposSet       = new Set<string>()

  for (const s of rows) {
    clientesMap.set(s.cliente.id, s.cliente.nome)
    if (s.orcamentista) orcamentistasMap.set(s.orcamentista.id, s.orcamentista.nome)
    numerosSet.add(s.numero)
    if (s.cidade) {
      const label = s.estado ? `${s.cidade}/${s.estado}` : s.cidade
      cidadesSet.add(label)
    }
    if (s.escopo) escoposSet.add(s.escopo)
  }

  const sort = (m: Map<number, string>) =>
    Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))

  return NextResponse.json({
    data: {
      clientes:      sort(clientesMap),
      orcamentistas: sort(orcamentistasMap),
      numeros:       Array.from(numerosSet).sort(),
      cidades:       Array.from(cidadesSet).sort(),
      escopos:       Array.from(escoposSet).sort(),
    },
    error: null,
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = req.nextUrl

  if (searchParams.get('modo') === 'filtros') return getFiltros()

  const page  = Math.max(1, Number(searchParams.get('page')  ?? 1))
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 20))
  const skip  = (page - 1) * limit

  const classificacao = searchParams.get('classificacao') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const orcamentista_id = searchParams.get('orcamentista_id') ?? undefined
  const resultado = searchParams.get('resultado') ?? undefined
  const ano = searchParams.get('ano') ?? undefined
  const numero = searchParams.get('numero') ?? undefined
  const escopo = searchParams.get('escopo') ?? undefined
  const cliente_id = searchParams.get('cliente_id') ?? undefined
  const cidade = searchParams.get('cidade') ?? undefined

  const wherePropostas = {
    cancelled_at: null,
    OR: [
      { propostas_tecnicas: { some: { data_envio: { not: null } } } },
      { propostas_comerciais: { some: { data_envio: { not: null } } } },
      { propostas_fabricacao: { some: { data_envio: { not: null } } } },
    ],
    ...(classificacao && { classificacao: classificacao as never }),
    ...(status && { status: status as never }),
    ...(orcamentista_id && { orcamentista_id: Number(orcamentista_id) }),
    ...(cliente_id && { cliente_id: Number(cliente_id) }),
    ...(cidade && { cidade: { contains: cidade.split('/')[0].trim(), mode: 'insensitive' as const } }),
    ...(numero && { numero: { contains: numero, mode: 'insensitive' as const } }),
    ...(escopo && { escopo: { contains: escopo, mode: 'insensitive' as const } }),
    ...(resultado && { propostas_comerciais: { some: { resultado } } }),
    ...(ano && {
      propostas_tecnicas: {
        some: {
          data_envio: {
            gte: new Date(`${ano}-01-01`),
            lte: new Date(`${ano}-12-31T23:59:59`),
          },
        },
      },
    }),
  }

  const [items, total] = await Promise.all([
    prisma.solicitacao.findMany({
    where: wherePropostas,
    orderBy: { created_at: 'desc' },
    skip,
    take: limit,
    include: {
      cliente: { select: { id: true, nome: true } },
      cliente_final: { select: { id: true, nome: true } },
      orcamentista: { select: { id: true, nome: true } },
      propostas_tecnicas: { orderBy: { versao: 'desc' } },
      propostas_comerciais: { orderBy: { versao: 'desc' } },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, include: { equipamentos: { orderBy: { ordem: 'asc' } } } },
    },
  }),
  prisma.solicitacao.count({ where: wherePropostas }),
  ])

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const data = items.map((s) => {
    const ultimaTecnica = s.propostas_tecnicas[0] ?? null
    const ultimaComercial = s.propostas_comerciais[0] ?? null

    const tecnicaEnviada = ultimaTecnica !== null
    const comercialEnviada = ultimaComercial !== null

    const prazoTec = s.prazo_tecnica ? new Date(s.prazo_tecnica) : null
    const prazoCom = s.prazo_comercial ? new Date(s.prazo_comercial) : null

    const hhDireto = ultimaTecnica?.hh_direto ?? null
    const hhIndireto = ultimaTecnica?.hh_indireto ?? null
    const hhTotal = hhDireto !== null && hhIndireto !== null ? hhDireto + hhIndireto : null
    const percIndireto = hhTotal && hhIndireto ? (hhIndireto / hhTotal) * 100 : null

    return {
      id: s.id,
      numero: s.numero,
      created_at: s.created_at.toISOString(),
      cliente: {
        id: s.cliente.id,
        nome: s.cliente.nome,
      },
      cliente_final: s.cliente_final ? { id: s.cliente_final.id, nome: s.cliente_final.nome } : null,
      cidade: s.cidade ?? null,
      estado: s.estado ?? null,
      escopo: s.escopo ?? null,
      classificacao: s.classificacao,
      interesse: s.interesse,
      status: s.status,
      orcamentista: s.orcamentista,
      prazo_tecnica: s.prazo_tecnica?.toISOString() ?? null,
      prazo_comercial: s.prazo_comercial?.toISOString() ?? null,
      // Técnica mais recente (para header do card)
      versao_tecnica: ultimaTecnica?.versao ?? null,
      hh_direto: hhDireto,
      hh_indireto: hhIndireto,
      hh_total: hhTotal,
      perc_indireto: percIndireto !== null ? Number(percIndireto.toFixed(1)) : null,
      peso_montagem: ultimaTecnica?.peso_montagem?.toString() ?? null,
      data_envio_tecnica: ultimaTecnica?.data_envio?.toISOString() ?? null,
      tecnica_atrasada: !tecnicaEnviada && prazoTec ? prazoTec < hoje : false,
      // Comercial mais recente
      versao_comercial: ultimaComercial?.versao ?? null,
      valor_total: ultimaComercial?.valor_total?.toString() ?? null,
      data_envio_comercial: ultimaComercial?.data_envio?.toISOString() ?? null,
      resultado: ultimaComercial?.resultado ?? null,
      comercial_atrasada: tecnicaEnviada && !comercialEnviada && prazoCom ? prazoCom < hoje : false,
      // Histórico completo
      propostas_tecnicas: s.propostas_tecnicas.map((pt) => ({
        id: pt.id,
        versao: pt.versao,
        hh_direto: pt.hh_direto,
        hh_indireto: pt.hh_indireto,
        hh_total: pt.hh_total,
        peso_montagem: pt.peso_montagem?.toString() ?? null,
        peso_equipamentos: pt.peso_equipamentos?.toString() ?? null,
        peso_tubulacoes: pt.peso_tubulacoes?.toString() ?? null,
        peso_suportes: pt.peso_suportes?.toString() ?? null,
        peso_estruturas: pt.peso_estruturas?.toString() ?? null,
        efetivo_pico: pt.efetivo_pico,
        dias_parada: pt.dias_parada,
        turno: pt.turno,
        finais_de_semana: pt.finais_de_semana,
        data_envio: pt.data_envio?.toISOString() ?? null,
      })),
      propostas_comerciais: s.propostas_comerciais.map((pc) => ({
        id: pc.id,
        versao: pc.versao,
        valor_montagem_mecanica: pc.valor_montagem_mecanica?.toString() ?? null,
        possui_terceiros: pc.possui_terceiros,
        valor_eletrica: pc.valor_eletrica?.toString() ?? null,
        valor_isolamento: pc.valor_isolamento?.toString() ?? null,
        valor_civil: pc.valor_civil?.toString() ?? null,
        valor_hidraulica: pc.valor_hidraulica?.toString() ?? null,
        valor_fibra: pc.valor_fibra?.toString() ?? null,
        valor_tijolo_antiacido: pc.valor_tijolo_antiacido?.toString() ?? null,
        valor_outros_terceiros: pc.valor_outros_terceiros?.toString() ?? null,
        possui_fabricacao: pc.possui_fabricacao,
        valor_fabricacao: pc.valor_fabricacao?.toString() ?? null,
        valor_terceiros: pc.valor_terceiros?.toString() ?? null,
        valor_total: pc.valor_total?.toString() ?? null,
        data_envio: pc.data_envio?.toISOString() ?? null,
        resultado: pc.resultado,
        motivo_perda: pc.motivo_perda,
        proposta_tecnica_id: pc.proposta_tecnica_id,
      })),
      propostas_fabricacao: s.propostas_fabricacao.map((pf) => ({
        id: pf.id,
        versao: pf.versao,
        possui_testes: pf.possui_testes,
        descricao_testes: pf.descricao_testes,
        valor_testes: pf.valor_testes?.toString() ?? null,
        peso_total: pf.peso_total.toString(),
        valor_total: pf.valor_total.toString(),
        data_envio: pf.data_envio?.toISOString() ?? null,
        resultado: pf.resultado,
        motivo_perda: pf.motivo_perda,
        equipamentos: pf.equipamentos.map((e) => ({
          id: e.id,
          ordem: e.ordem,
          descricao: e.descricao,
          peso_ton: e.peso_ton.toString(),
          valor_total: e.valor_total.toString(),
          observacoes: e.observacoes,
        })),
      })),
    }
  })

  return NextResponse.json({ data, total, page, limit, pages: Math.ceil(total / limit), error: null })
}
