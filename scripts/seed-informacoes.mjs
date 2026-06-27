import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const sol = await prisma.solicitacao.findFirst({ where: { cancelled_at: null }, orderBy: { id: 'asc' } })
const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, take: 3 })
if (!sol || users.length === 0) { console.error('Sem solicitação/usuário.'); process.exit(1) }
console.log(`Solicitação: ${sol.numero} (id=${sol.id})`)

const D = (s) => new Date(s + 'T12:00:00')
const u = (i) => users[i % users.length].id

// Limpa informações de demo anteriores (mantém os automáticos sem código)
await prisma.solicitacaoInfo.deleteMany({ where: { solicitacao_id: sol.id, tipo: { not: null } } })

const dados = [
  { tipo: 'REUNIAO_CALL',      data: '2026-06-05', autor: 0, desc: 'Call de alinhamento com engenharia do cliente. Confirmaram escopo técnico da Rev01 sem alterações. Bom sinal de avanço.' },
  { tipo: 'CONCORRENCIA',      data: '2026-06-10', autor: 0, desc: 'Cliente revelou informalmente que está comparando com a empresa "Montagens XYZ". Histórico mostra que costumam competir por prazo, não preço.' },
  { tipo: 'REUNIAO_CALL',      data: '2026-07-14', autor: 0, desc: 'Call de alinhamento técnico para revisar premissas de efetivo e turnos do Cenário 2.' },
  { tipo: 'DEFINICAO_INTERNA', data: '2026-07-14', autor: 1, desc: 'Decidido internamente: podemos reduzir até 15% do efetivo pico sem comprometer margem mínima. Autorizado elaborar Cenário 2 com equipe reduzida.' },
  { tipo: 'FEEDBACK_CLIENTE',  data: '2026-07-15', autor: 0, desc: 'Cliente mencionou em reunião que recebeu proposta concorrente ~12% abaixo do nosso Valor Global. Pediu revisão de equipe para reduzir HH.' },
  { tipo: 'DEFINICAO_ESCOPO',  data: '2026-07-17', autor: 0, desc: 'Cliente solicitou revisão do escopo do Cenário 2 com equipe ainda mais reduzida. Comprometemos retorno até 22/07/2026.' },
]

// Continua a sequência a partir do maior código existente
const ult = await prisma.solicitacaoInfo.findFirst({ where: { solicitacao_id: sol.id, codigo: { not: null } }, orderBy: { codigo: 'desc' }, select: { codigo: true } })
let n = ult?.codigo ? parseInt(ult.codigo.replace(/\D/g, ''), 10) : 0

for (const d of dados) {
  n++
  await prisma.solicitacaoInfo.create({
    data: {
      solicitacao_id: sol.id,
      codigo: `INF-${String(n).padStart(4, '0')}`,
      tipo: d.tipo,
      data: D(d.data),
      comentario: d.desc,
      created_by: u(d.autor),
    },
  })
  console.log(`  + INF-${String(n).padStart(4, '0')} (${d.tipo})`)
}
console.log(`\n✓ ${dados.length} informações criadas em ${sol.numero}.`)
await prisma.$disconnect()
