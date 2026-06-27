import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 1) Migra valores de tipo para a nova nomenclatura
const mapa = {
  DECISAO_INTERNA: 'DEFINICAO_INTERNA',
  ALTERACAO_INFORMAL: 'DEFINICAO_ESCOPO',
  COMPROMISSO_ASSUMIDO: 'OUTROS',
}
for (const [de, para] of Object.entries(mapa)) {
  const r = await prisma.solicitacaoInfo.updateMany({ where: { tipo: de }, data: { tipo: para } })
  console.log(`tipo ${de} → ${para}: ${r.count} registro(s)`)
}

// 2) Backfill de código sequencial por solicitação (apenas informações do
//    usuário, que têm tipo; registros automáticos ficam sem código)
const infos = await prisma.solicitacaoInfo.findMany({
  where: { tipo: { not: null }, codigo: null },
  orderBy: [{ solicitacao_id: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
  select: { id: true, solicitacao_id: true },
})

// Considera códigos já existentes por solicitação (idempotência)
const contadores = new Map()
const existentes = await prisma.solicitacaoInfo.findMany({
  where: { codigo: { not: null } },
  select: { solicitacao_id: true, codigo: true },
})
for (const e of existentes) {
  const n = parseInt(String(e.codigo).replace(/\D/g, ''), 10)
  contadores.set(e.solicitacao_id, Math.max(contadores.get(e.solicitacao_id) ?? 0, n))
}

let total = 0
for (const info of infos) {
  const prox = (contadores.get(info.solicitacao_id) ?? 0) + 1
  contadores.set(info.solicitacao_id, prox)
  const codigo = `INF-${String(prox).padStart(4, '0')}`
  await prisma.solicitacaoInfo.update({ where: { id: info.id }, data: { codigo } })
  total++
}
console.log(`\n✓ Backfill de código: ${total} informação(ões) atualizada(s).`)

await prisma.$disconnect()
