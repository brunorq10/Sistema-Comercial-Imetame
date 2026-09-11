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

const ETAPA_LABEL: Record<string, string> = { PREPARATIVO: 'Preparativo', PARADA: 'Parada', ACOMP_DESMOB: 'Pós Parada' }

// ── GET: histórico consolidado da Parada de um contrato — alterações do
// previsto/planejado (ParadaHhConfigHistorico), fechamento/reabertura
// (ParadaFechamentoHistorico) e lançamentos/edições da grade diária
// (ParadaHhDia.created_by/updated_by — mesmo padrão "menos preciso" usado
// para Obras: reflete quem criou/alterou por último cada dia, não um diff
// completo de cada edição).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const config = await prisma.paradaHhConfig.findUnique({ where: { contrato_id: contratoId }, select: { id: true } })
  if (!config) return NextResponse.json({ data: [], error: null })

  const [historico, fechamentos, dias] = await Promise.all([
    prisma.paradaHhConfigHistorico.findMany({
      where: { config_id: config.id },
      orderBy: { created_at: 'desc' },
      select: { id: true, campo: true, valor_de: true, valor_para: true, created_at: true, usuario: { select: { nome: true } } },
    }),
    prisma.paradaFechamentoHistorico.findMany({
      where: { config_id: config.id },
      orderBy: { created_at: 'desc' },
      select: { id: true, acao: true, motivo: true, created_at: true, usuario: { select: { nome: true } } },
    }),
    prisma.paradaHhDia.findMany({
      where: { config_id: config.id },
      orderBy: { data: 'desc' },
      select: { id: true, etapa: true, data: true, efetivo_real: true, created_at: true, created_by: true, updated_at: true, updated_by: true },
    }),
  ])

  const userIds = Array.from(new Set([
    ...dias.map((d) => d.created_by).filter((v): v is number => v != null),
    ...dias.map((d) => d.updated_by).filter((v): v is number => v != null),
  ]))
  const nomePorId = new Map<number, string>()
  if (userIds.length > 0) {
    const usuarios = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true } })
    for (const u of usuarios) nomePorId.set(u.id, u.nome)
  }

  const eventos: Evento[] = []

  for (const h of historico) {
    eventos.push({
      id: `cfg-${h.id}`,
      campo: h.campo,
      valor_de: h.valor_de,
      valor_para: h.valor_para,
      alterado_em: h.created_at.toISOString(),
      alterado_por: h.usuario.nome,
    })
  }

  for (const f of fechamentos) {
    eventos.push({
      id: `fech-${f.id}`,
      campo: f.acao === 'FECHADA' ? 'Fechamento' : 'Reabertura',
      valor_de: null,
      valor_para: f.acao === 'REABERTA' ? (f.motivo ?? '—') : 'Parada fechada',
      alterado_em: f.created_at.toISOString(),
      alterado_por: f.usuario.nome,
    })
  }

  for (const d of dias) {
    // Só o realizado é "lançamento" no sentido operacional pedido pelo usuário
    // (efetivo_real preenchido) — dias só com previsto não geram evento aqui.
    if (d.efetivo_real == null && d.created_by == null) continue
    const dataFmt = d.data.toISOString().slice(0, 10).split('-').reverse().join('/')
    const etapaLbl = ETAPA_LABEL[d.etapa] ?? d.etapa
    const resumo = `Efetivo realizado: ${d.efetivo_real ?? '—'}`
    if (d.created_by != null) {
      eventos.push({
        id: `dia-${d.id}-criado`,
        campo: `Lançamento realizado — ${etapaLbl} ${dataFmt}`,
        valor_de: null,
        valor_para: resumo,
        alterado_em: d.created_at.toISOString(),
        alterado_por: nomePorId.get(d.created_by) ?? '—',
      })
    }
    if (d.updated_by != null && d.updated_at.getTime() !== d.created_at.getTime()) {
      eventos.push({
        id: `dia-${d.id}-editado`,
        campo: `Edição do lançamento — ${etapaLbl} ${dataFmt}`,
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
