// seed-filiais.mjs — dados fictícios de filiais e segmentos para demo
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Busca os primeiros clientes para atribuir filiais e segmento
  const clientes = await prisma.cliente.findMany({ orderBy: { id: 'asc' }, take: 10 })

  if (clientes.length === 0) {
    console.log('Nenhum cliente encontrado — crie clientes primeiro.')
    return
  }

  // Admin para created_by
  const admin = await prisma.user.findFirst({ where: { ativo: true } })
  if (!admin) { console.log('Nenhum usuário encontrado.'); return }

  // Dados fictícios por cliente (baseado nos primeiros clientes cadastrados)
  const mockData = [
    {
      nome: 'Suzano S.A.',
      segmento: 'PAPEL_CELULOSE',
      filiais: [
        { nome: 'Filial Mucuri', cidade: 'Mucuri', estado: 'BA' },
        { nome: 'Filial Três Lagoas', cidade: 'Três Lagoas', estado: 'MS' },
        { nome: 'Filial Limeira', cidade: 'Limeira', estado: 'SP' },
        { nome: 'Filial Aracruz', cidade: 'Aracruz', estado: 'ES' },
        { nome: 'Filial Imperatriz', cidade: 'Imperatriz', estado: 'MA' },
      ],
    },
    {
      nome: 'ArcelorMittal Brasil',
      segmento: 'SIDERURGIA',
      filiais: [
        { nome: 'Usina Tubarão', cidade: 'Serra', estado: 'ES' },
        { nome: 'Filial Juiz de Fora', cidade: 'Juiz de Fora', estado: 'MG' },
        { nome: 'Filial Cariacica', cidade: 'Cariacica', estado: 'ES' },
      ],
    },
    {
      nome: 'Petrobras',
      segmento: 'OLEO_GAS',
      filiais: [
        { nome: 'REPLAN', cidade: 'Paulínia', estado: 'SP' },
        { nome: 'REDUC', cidade: 'Duque de Caxias', estado: 'RJ' },
        { nome: 'REGAP', cidade: 'Betim', estado: 'MG' },
        { nome: 'E&P Bacia de Campos', cidade: 'Macaé', estado: 'RJ' },
      ],
    },
    {
      nome: 'Vale S.A.',
      segmento: 'OUTROS',
      filiais: [
        { nome: 'Carajás', cidade: 'Parauapebas', estado: 'PA' },
        { nome: 'Itabira', cidade: 'Itabira', estado: 'MG' },
        { nome: 'Vitória', cidade: 'Vitória', estado: 'ES' },
        { nome: 'Tubarão', cidade: 'Vila Velha', estado: 'ES' },
      ],
    },
    {
      nome: 'Klabin S.A.',
      segmento: 'PAPEL_CELULOSE',
      filiais: [
        { nome: 'Unidade Ortigueira', cidade: 'Ortigueira', estado: 'PR' },
        { nome: 'Unidade Monte Alegre', cidade: 'Telêmaco Borba', estado: 'PR' },
        { nome: 'Unidade Angatuba', cidade: 'Angatuba', estado: 'SP' },
      ],
    },
  ]

  for (let i = 0; i < clientes.length && i < mockData.length; i++) {
    const cliente = clientes[i]
    const mock = mockData[i]

    // Atualiza segmento do cliente
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { segmento: mock.segmento },
    })

    // Remove filiais antigas (para idempotência)
    await prisma.filial.deleteMany({ where: { cliente_id: cliente.id } })

    // Insere filiais
    for (const f of mock.filiais) {
      await prisma.filial.create({
        data: {
          cliente_id: cliente.id,
          nome: f.nome,
          cidade: f.cidade,
          estado: f.estado,
          created_by: admin.id,
        },
      })
    }

    console.log(`✓ ${cliente.nome || mock.nome}: ${mock.filiais.length} filiais inseridas, segmento = ${mock.segmento}`)
  }

  console.log('\nSeed de filiais concluído.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
