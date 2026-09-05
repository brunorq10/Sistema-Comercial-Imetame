import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirTitularContrato } from '@/lib/permissaoApi'

const HORAS_NORMAL_DIA = 8.8

// GET — dias lançados de um mês/ano para o calendário de HH Realizado de Obras.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.obras.hh.lancar'); if (_n) return _n }

  const ano = Number(req.nextUrl.searchParams.get('ano'))
  const mes = Number(req.nextUrl.searchParams.get('mes'))
  if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ data: null, error: 'Parâmetros ano/mes inválidos' }, { status: 400 })
  }

  const inicio = new Date(Date.UTC(ano, mes - 1, 1))
  const fim = new Date(Date.UTC(ano, mes, 1))

  const dias = await prisma.hhRealizadoDia.findMany({
    where: { contrato_id: contratoId, data: { gte: inicio, lt: fim } },
    orderBy: { data: 'asc' },
  })

  return NextResponse.json({
    data: dias.map((d) => ({
      data: d.data.toISOString().slice(0, 10),
      efetivo_normal: d.efetivo_normal,
      horas_normais: d.horas_normais != null ? Number(d.horas_normais) : null,
      efetivo_extra: d.efetivo_extra,
      horas_extra_valor: d.horas_extra_valor != null ? Number(d.horas_extra_valor) : null,
      horas_extras: d.horas_extras != null ? Number(d.horas_extras) : null,
      hh_total: Number(d.hh_total),
    })),
    error: null,
  })
}

const schema = z.object({
  data: z.string().min(1),
  efetivo_normal: z.number().int().min(0).nullable().optional(),
  efetivo_extra: z.number().int().min(0).nullable().optional(),
  horas_extra_valor: z.number().min(0).nullable().optional(),
})

// POST — lança/atualiza (ou apaga, se vazio) o HH Realizado de UM dia, e
// mantém o total mensal em HhRealizado em sincronia (soma dos dias do mês).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = Number(params.id)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })
  { const _n = await exigirTitularContrato(session, contratoId, 'acordos.obras.hh.lancar'); if (_n) return _n }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const d = parsed.data
  const dataDia = new Date(d.data + 'T00:00:00.000Z')
  if (isNaN(dataDia.getTime())) {
    return NextResponse.json({ data: null, error: 'Data inválida' }, { status: 400 })
  }

  const userId = Number(session.user.id)
  const vazio = (d.efetivo_normal == null || d.efetivo_normal === 0) && (d.efetivo_extra == null || d.efetivo_extra === 0)

  // Recalcula sempre no servidor — nunca confia no HH vindo do cliente.
  const efetivoNormal = d.efetivo_normal ?? 0
  const efetivoExtra = d.efetivo_extra ?? 0
  const horasExtraValor = d.horas_extra_valor ?? 1
  const horasNormais = efetivoNormal * HORAS_NORMAL_DIA
  const horasExtras = efetivoExtra * horasExtraValor
  const hhTotal = horasNormais + horasExtras

  const ano = dataDia.getUTCFullYear()
  const mes = dataDia.getUTCMonth() + 1

  await prisma.$transaction(async (tx) => {
    if (vazio) {
      await tx.hhRealizadoDia.deleteMany({ where: { contrato_id: contratoId, data: dataDia } })
    } else {
      await tx.hhRealizadoDia.upsert({
        where: { contrato_id_data: { contrato_id: contratoId, data: dataDia } },
        create: {
          contrato_id: contratoId, data: dataDia,
          efetivo_normal: d.efetivo_normal ?? null,
          horas_normais: horasNormais,
          efetivo_extra: d.efetivo_extra ?? null,
          horas_extra_valor: horasExtraValor,
          horas_extras: horasExtras,
          hh_total: hhTotal,
          created_by: userId,
        },
        update: {
          efetivo_normal: d.efetivo_normal ?? null,
          horas_normais: horasNormais,
          efetivo_extra: d.efetivo_extra ?? null,
          horas_extra_valor: horasExtraValor,
          horas_extras: horasExtras,
          hh_total: hhTotal,
          updated_by: userId,
        },
      })
    }

    // Mantém HhRealizado (mensal) em sincronia — soma dos dias do mês,
    // arredondada à hora inteira (mesmo grão que a coluna sempre teve).
    const inicioMes = new Date(Date.UTC(ano, mes - 1, 1))
    const fimMes = new Date(Date.UTC(ano, mes, 1))
    const diasDoMes = await tx.hhRealizadoDia.findMany({
      where: { contrato_id: contratoId, data: { gte: inicioMes, lt: fimMes } },
      select: { hh_total: true },
    })

    if (diasDoMes.length === 0) {
      await tx.hhRealizado.deleteMany({ where: { contrato_id: contratoId, mes, ano } })
    } else {
      const somaMes = diasDoMes.reduce((acc, r) => acc + Number(r.hh_total), 0)
      await tx.hhRealizado.upsert({
        where: { contrato_id_mes_ano: { contrato_id: contratoId, mes, ano } },
        create: { contrato_id: contratoId, mes, ano, hh_realizado: Math.round(somaMes), created_by: userId },
        update: { hh_realizado: Math.round(somaMes) },
      })
    }
  })

  return NextResponse.json({
    data: vazio ? null : {
      data: d.data,
      efetivo_normal: d.efetivo_normal ?? null,
      horas_normais: horasNormais,
      efetivo_extra: d.efetivo_extra ?? null,
      horas_extra_valor: horasExtraValor,
      horas_extras: horasExtras,
      hh_total: hhTotal,
    },
    error: null,
  })
}
