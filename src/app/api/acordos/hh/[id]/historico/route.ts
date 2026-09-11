import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Evento {
  id: string
  campo: string
  valor_de: string | null
  valor_para: string | null
  alterado_em: string
  alterado_por: string
}

// GET — histórico consolidado do acompanhamento de HH de uma Obra: fechamento/
// reabertura, revisões de previsto/planejado (versões de HhLancamento) e
// lançamentos/edições do realizado diário (HhRealizadoDia.created_by/updated_by
// — mesmo padrão "menos preciso" documentado para Paradas: reflete quem criou/
// alterou por último cada dia, não um diff completo de cada edição).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const [fechamentos, lancamentos, dias] = await Promise.all([
    prisma.contratoHhFechamentoHistorico.findMany({
      where: { contrato_id: contratoId },
      orderBy: { created_at: 'desc' },
      select: { id: true, acao: true, motivo: true, created_at: true, usuario: { select: { nome: true } } },
    }),
    prisma.hhLancamento.findMany({
      where: { contrato_id: contratoId },
      orderBy: { versao: 'desc' },
      select: { id: true, versao: true, motivo: true, created_at: true, criador: { select: { nome: true } } },
    }),
    prisma.hhRealizadoDia.findMany({
      where: { contrato_id: contratoId },
      orderBy: { data: 'desc' },
      select: {
        id: true, data: true, efetivo_normal: true, efetivo_extra: true,
        created_at: true, updated_at: true, updated_by: true,
        criador: { select: { nome: true } },
      },
    }),
  ])

  const updatedByIds = Array.from(new Set(dias.map((d) => d.updated_by).filter((v): v is number => v != null)))
  const nomePorId = new Map<number, string>()
  if (updatedByIds.length > 0) {
    const usuarios = await prisma.user.findMany({ where: { id: { in: updatedByIds } }, select: { id: true, nome: true } })
    for (const u of usuarios) nomePorId.set(u.id, u.nome)
  }

  const eventos: Evento[] = []

  for (const f of fechamentos) {
    eventos.push({
      id: `fech-${f.id}`,
      campo: f.acao === 'FECHADA' ? 'Fechamento' : 'Reabertura',
      valor_de: null,
      valor_para: f.acao === 'REABERTA' ? (f.motivo ?? '—') : 'Obra fechada',
      alterado_em: f.created_at.toISOString(),
      alterado_por: f.usuario.nome,
    })
  }

  for (const l of lancamentos) {
    eventos.push({
      id: `lanc-${l.id}`,
      campo: `Previsto/Planejado — versão ${l.versao}`,
      valor_de: null,
      valor_para: l.motivo ?? '—',
      alterado_em: l.created_at.toISOString(),
      alterado_por: l.criador.nome,
    })
  }

  for (const d of dias) {
    const dataFmt = d.data.toISOString().slice(0, 10).split('-').reverse().join('/')
    const resumo = `Efetivo normal: ${d.efetivo_normal ?? '—'} · Efetivo extra: ${d.efetivo_extra ?? '—'}`
    eventos.push({
      id: `dia-${d.id}-criado`,
      campo: `Lançamento realizado — ${dataFmt}`,
      valor_de: null,
      valor_para: resumo,
      alterado_em: d.created_at.toISOString(),
      alterado_por: d.criador.nome,
    })
    if (d.updated_by != null && d.updated_at.getTime() !== d.created_at.getTime()) {
      eventos.push({
        id: `dia-${d.id}-editado`,
        campo: `Edição do lançamento — ${dataFmt}`,
        valor_de: null,
        valor_para: resumo,
        alterado_em: d.updated_at.toISOString(),
        alterado_por: nomePorId.get(d.updated_by) ?? '—',
      })
    }
  }

  eventos.sort((a, b) => b.alterado_em.localeCompare(a.alterado_em))

  return NextResponse.json({ data: eventos, error: null })
}
