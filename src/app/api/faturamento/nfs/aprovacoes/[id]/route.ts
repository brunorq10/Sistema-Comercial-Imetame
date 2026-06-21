import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

const schema = z.object({
  acao: z.enum(['APROVAR', 'REPROVAR']),
  motivo: z.string().optional().nullable(),
})

// PATCH /api/faturamento/nfs/aprovacoes/[id] — aprova/reprova um lançamento de faturamento
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'GESTAO_ACORDOS' && perfil !== 'ADM_GERAL') {
    return NextResponse.json({ data: null, error: 'Apenas a coordenação de Acordos pode aprovar lançamentos.' }, { status: 403 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ data: null, error: 'ID inválido' }, { status: 400 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { acao, motivo } = parsed.data
  if (acao === 'REPROVAR' && !motivo?.trim()) {
    return NextResponse.json({ data: null, error: 'Informe o motivo da reprovação.' }, { status: 400 })
  }

  const nf = await prisma.notaFiscalContrato.findUnique({
    where: { id },
    include: { subindice: { select: { ordem: true, descricao: true, contrato: { select: { id: true, indice: true } } } } },
  })
  if (!nf) return NextResponse.json({ data: null, error: 'Lançamento não encontrado' }, { status: 404 })
  if (nf.status_aprovacao !== 'PENDENTE') {
    return NextResponse.json({ data: null, error: 'Este lançamento já foi revisado.' }, { status: 422 })
  }

  const userId = Number(session.user.id)
  const aprovado = acao === 'APROVAR'

  await prisma.notaFiscalContrato.update({
    where: { id },
    data: {
      status_aprovacao: aprovado ? 'APROVADO' : 'REPROVADO',
      ativa: aprovado,                       // só conta no faturamento após aprovação
      motivo_recusa: aprovado ? null : motivo!.trim(),
      revisado_por: userId,
      revisado_em: new Date(),
    },
  })

  // Notifica o solicitante sobre a decisão (não-bloqueante)
  if (nf.solicitado_por) {
    const ct = nf.subindice?.contrato
    const ref = `${ct?.indice ?? ''}.${nf.subindice?.ordem ?? ''} · ${nf.subindice?.descricao ?? ''} — NF ${nf.numero_nf}`
    createNotificacao(
      nf.solicitado_por,
      aprovado ? 'Lançamento de faturamento aprovado' : 'Lançamento de faturamento reprovado',
      aprovado ? `${ref} foi aprovado e já consta no faturamento.` : `${ref} foi reprovado. Motivo: ${motivo!.trim()}`,
      ct?.id ? `/acordos/faturamento/${ct.id}` : undefined,
    )
  }

  return NextResponse.json({ data: { ok: true }, error: null })
}
