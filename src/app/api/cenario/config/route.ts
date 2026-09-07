import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissaoApi'

const schema = z.object({
  capacidade_efetivo: z.number().int().min(0),
})

// PUT /api/cenario/config — atualiza a capacidade de efetivo (singleton, id=1)
export async function PUT(req: NextRequest) {
  const { erro, usuario } = await exigirPermissao('cenario.editar')
  if (erro) return erro

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const cfg = await prisma.cenarioConfig.upsert({
    where: { id: 1 },
    update: { capacidade_efetivo: parsed.data.capacidade_efetivo, updated_by: usuario.id },
    create: { id: 1, capacidade_efetivo: parsed.data.capacidade_efetivo, updated_by: usuario.id },
  })

  return NextResponse.json({ data: { capacidade_efetivo: cfg.capacidade_efetivo }, error: null })
}
