import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const contratos = await prisma.contrato.findMany({
  where: { classificacao: 'PARADAS' },
  include: { cliente: true, hh_lancamentos: { take: 1 } },
  take: 10,
})

console.log(JSON.stringify(contratos.map(c => ({
  id: c.id,
  indice: c.indice,
  cliente: c.cliente?.nome,
  cidade: c.cidade,
  descricao: c.descricao,
  tem_lancamento_hh: c.hh_lancamentos.length > 0,
})), null, 2))

await prisma.$disconnect()
