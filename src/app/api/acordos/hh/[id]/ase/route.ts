import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato, usuarioDaSessao, resolverAutoria } from '@/lib/permissaoApi'

// Serviços extra escopo (ASE) — Obras. Registro puramente informativo: o
// volume de horas aqui NUNCA soma ao HH realizado (que segue vindo só de
// HhRealizadoDia/HhRealizado) — serve apenas para segmentar quanto do
// realizado já lançado foi consumido em serviços fora do escopo original.

function resumoAse(d: { descricao: string; volume_horas: number; data_servico: string }): string {
  return `${d.descricao} — ${d.volume_horas.toLocaleString('pt-BR')}h em ${d.data_servico.split('-').reverse().join('/')}`
}

// GET — lista os lançamentos de ASE de um contrato (Obra).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.obras.hh.lancar'); if (_n) return _n }

  const lancamentos = await prisma.hhAseLancamento.findMany({
    where: { contrato_id: contratoId },
    orderBy: { data_servico: 'desc' },
    include: { criador: { select: { nome: true } } },
  })

  return NextResponse.json({
    data: lancamentos.map((l) => ({
      id: l.id,
      data_servico: l.data_servico.toISOString().slice(0, 10),
      data_aprovacao: l.data_aprovacao.toISOString().slice(0, 10),
      descricao: l.descricao,
      volume_horas: Number(l.volume_horas),
      criador: l.criador.nome,
      created_at: l.created_at.toISOString(),
    })),
    error: null,
  })
}

const schema = z.object({
  data_servico: z.string().min(1, 'Informe a data do serviço'),
  data_aprovacao: z.string().min(1, 'Informe a data de aprovação'),
  descricao: z.string().trim().min(3, 'Informe a descrição do serviço'),
  volume_horas: z.number().positive('Informe o volume de horas'),
}).refine((d) => d.data_aprovacao >= d.data_servico, {
  message: 'A data de aprovação não pode ser anterior à data do serviço.',
  path: ['data_aprovacao'],
})

// POST — cria um novo lançamento de ASE.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.obras.hh.lancar'); if (_n) return _n }

  const contratoCheck = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { hh_fechada_em: true, responsavel_id: true } })
  if (!contratoCheck) return NextResponse.json({ data: null, error: 'Acordo não encontrado' }, { status: 404 })
  if (contratoCheck.hh_fechada_em) return NextResponse.json({ data: null, error: 'Esta Obra está fechada — reabra antes de editar.' }, { status: 403 })

  const usuario = usuarioDaSessao(session)!
  const autoria = resolverAutoria(usuario, contratoCheck, 'contrato')

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data
  const dataServico = new Date(d.data_servico + 'T00:00:00.000Z')
  const dataAprovacao = new Date(d.data_aprovacao + 'T00:00:00.000Z')
  if (isNaN(dataServico.getTime()) || isNaN(dataAprovacao.getTime())) {
    return NextResponse.json({ data: null, error: 'Data inválida' }, { status: 400 })
  }

  const novo = await prisma.$transaction(async (tx) => {
    const criado = await tx.hhAseLancamento.create({
      data: {
        contrato_id: contratoId,
        data_servico: dataServico,
        data_aprovacao: dataAprovacao,
        descricao: d.descricao,
        volume_horas: d.volume_horas,
        created_by: autoria.created_by,
        substituto_de_id: autoria.substituto_de_id,
      },
    })
    await tx.hhAseLancamentoHistorico.create({
      data: {
        contrato_id: contratoId,
        campo: 'Lançamento ASE criado',
        valor_de: null,
        valor_para: resumoAse({ descricao: d.descricao, volume_horas: d.volume_horas, data_servico: d.data_servico }),
        created_by: autoria.created_by,
      },
    })
    return criado
  })

  return NextResponse.json({
    data: {
      id: novo.id,
      data_servico: d.data_servico,
      data_aprovacao: d.data_aprovacao,
      descricao: d.descricao,
      volume_horas: d.volume_horas,
    },
    error: null,
  })
}
