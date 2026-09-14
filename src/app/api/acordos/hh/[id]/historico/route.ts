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
// reabertura, revisões de previsto/planejado (versões de HhLancamento) e cada
// lançamento/edição do realizado diário (HhRealizadoDiaHistorico — diff
// completo, uma linha por alteração, não só o último valor de cada dia).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratoId = parseInt(params.id, 10)
  if (isNaN(contratoId)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const [fechamentos, lancamentos, diasHistorico, aseHistorico] = await Promise.all([
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
    prisma.hhRealizadoDiaHistorico.findMany({
      where: { contrato_id: contratoId },
      orderBy: { created_at: 'desc' },
      select: { id: true, campo: true, valor_de: true, valor_para: true, created_at: true, usuario: { select: { nome: true } } },
    }),
    prisma.hhAseLancamentoHistorico.findMany({
      where: { contrato_id: contratoId },
      orderBy: { created_at: 'desc' },
      select: { id: true, campo: true, valor_de: true, valor_para: true, created_at: true, usuario: { select: { nome: true } } },
    }),
  ])

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

  for (const a of aseHistorico) {
    eventos.push({
      id: `ase-${a.id}`,
      campo: a.campo,
      valor_de: a.valor_de,
      valor_para: a.valor_para,
      alterado_em: a.created_at.toISOString(),
      alterado_por: a.usuario.nome,
    })
  }

  eventos.sort((a, b) => b.alterado_em.localeCompare(a.alterado_em))

  return NextResponse.json({ data: eventos, error: null })
}
