import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato, usuarioDaSessao, resolverAutoria } from '@/lib/permissaoApi'

function resumoAse(d: { descricao: string; volume_horas: number; data_servico: string }): string {
  return `${d.descricao} — ${d.volume_horas.toLocaleString('pt-BR')}h em ${d.data_servico.split('-').reverse().join('/')}`
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

// PUT — edita um lançamento de ASE existente, gravando um diff por campo alterado.
export async function PUT(req: NextRequest, { params }: { params: { id: string; aseId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  const aseId = Number(params.aseId)
  if (isNaN(contratoId) || isNaN(aseId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.obras.hh.lancar'); if (_n) return _n }

  const contratoCheck = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { hh_fechada_em: true, responsavel_id: true } })
  if (!contratoCheck) return NextResponse.json({ data: null, error: 'Acordo não encontrado' }, { status: 404 })
  if (contratoCheck.hh_fechada_em) return NextResponse.json({ data: null, error: 'Esta Obra está fechada — reabra antes de editar.' }, { status: 403 })

  const atual = await prisma.hhAseLancamento.findUnique({ where: { id: aseId } })
  if (!atual || atual.contrato_id !== contratoId) return NextResponse.json({ data: null, error: 'Lançamento não encontrado' }, { status: 404 })

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

  const dataServicoAntesFmt = atual.data_servico.toISOString().slice(0, 10).split('-').reverse().join('/')
  const dataAprovacaoAntesFmt = atual.data_aprovacao.toISOString().slice(0, 10).split('-').reverse().join('/')
  const dataServicoNovaFmt = d.data_servico.split('-').reverse().join('/')
  const dataAprovacaoNovaFmt = d.data_aprovacao.split('-').reverse().join('/')
  const volumeAntes = Number(atual.volume_horas)

  const camposDiff: [string, string, string][] = []
  if (dataServicoAntesFmt !== dataServicoNovaFmt) camposDiff.push(['Data do Serviço', dataServicoAntesFmt, dataServicoNovaFmt])
  if (dataAprovacaoAntesFmt !== dataAprovacaoNovaFmt) camposDiff.push(['Data de Aprovação', dataAprovacaoAntesFmt, dataAprovacaoNovaFmt])
  if (atual.descricao !== d.descricao) camposDiff.push(['Descrição', atual.descricao, d.descricao])
  if (volumeAntes !== d.volume_horas) camposDiff.push(['Volume de Horas', `${volumeAntes.toLocaleString('pt-BR')}h`, `${d.volume_horas.toLocaleString('pt-BR')}h`])

  await prisma.$transaction(async (tx) => {
    await tx.hhAseLancamento.update({
      where: { id: aseId },
      data: {
        data_servico: dataServico,
        data_aprovacao: dataAprovacao,
        descricao: d.descricao,
        volume_horas: d.volume_horas,
        substituto_de_id: autoria.substituto_de_id,
      },
    })
    if (camposDiff.length > 0) {
      await tx.hhAseLancamentoHistorico.createMany({
        data: camposDiff.map(([campo, valor_de, valor_para]) => ({
          contrato_id: contratoId, campo, valor_de, valor_para, created_by: autoria.created_by,
        })),
      })
    }
  })

  return NextResponse.json({
    data: { id: aseId, data_servico: d.data_servico, data_aprovacao: d.data_aprovacao, descricao: d.descricao, volume_horas: d.volume_horas },
    error: null,
  })
}

// DELETE — remove um lançamento de ASE (hard delete), registrando o estado
// anterior no histórico antes de apagar.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; aseId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  const aseId = Number(params.aseId)
  if (isNaN(contratoId) || isNaN(aseId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.obras.hh.lancar'); if (_n) return _n }

  const contratoCheck = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { hh_fechada_em: true, responsavel_id: true } })
  if (!contratoCheck) return NextResponse.json({ data: null, error: 'Acordo não encontrado' }, { status: 404 })
  if (contratoCheck.hh_fechada_em) return NextResponse.json({ data: null, error: 'Esta Obra está fechada — reabra antes de editar.' }, { status: 403 })

  const atual = await prisma.hhAseLancamento.findUnique({ where: { id: aseId } })
  if (!atual || atual.contrato_id !== contratoId) return NextResponse.json({ data: null, error: 'Lançamento não encontrado' }, { status: 404 })

  const usuario = usuarioDaSessao(session)!
  const autoria = resolverAutoria(usuario, contratoCheck, 'contrato')

  await prisma.$transaction(async (tx) => {
    await tx.hhAseLancamentoHistorico.create({
      data: {
        contrato_id: contratoId,
        campo: 'Lançamento ASE removido',
        valor_de: resumoAse({
          descricao: atual.descricao,
          volume_horas: Number(atual.volume_horas),
          data_servico: atual.data_servico.toISOString().slice(0, 10),
        }),
        valor_para: null,
        created_by: autoria.created_by,
      },
    })
    await tx.hhAseLancamento.delete({ where: { id: aseId } })
  })

  return NextResponse.json({ data: { ok: true }, error: null })
}
