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

// ── GET: histórico consolidado da Parada de um contrato — alterações do
// previsto/planejado (ParadaHhConfigHistorico), fechamento/reabertura
// (ParadaFechamentoHistorico) e cada lançamento/edição da grade diária
// (ParadaHhDiaHistorico — diff completo, uma linha por alteração).
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

  const [historico, fechamentos, diasHistorico] = await Promise.all([
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
    prisma.paradaHhDiaHistorico.findMany({
      where: { config_id: config.id },
      orderBy: { created_at: 'desc' },
      select: { id: true, campo: true, valor_de: true, valor_para: true, created_at: true, usuario: { select: { nome: true } } },
    }),
  ])

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

  for (const d of diasHistorico) {
    eventos.push({
      id: `dia-${d.id}`,
      campo: d.campo,
      valor_de: d.valor_de,
      valor_para: d.valor_para,
      alterado_em: d.created_at.toISOString(),
      alterado_por: d.usuario.nome,
    })
  }

  eventos.sort((a, b) => b.alterado_em.localeCompare(a.alterado_em))

  return NextResponse.json({ data: eventos, error: null })
}
