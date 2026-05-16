// Seed de dados fictícios para o módulo Controle de Faturamento
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar clientes e usuários existentes
  const clientes = await prisma.cliente.findMany({ take: 6, orderBy: { id: 'asc' } })
  const users = await prisma.user.findMany({
    where: { ativo: true, perfil: { in: ['ACORDOS', 'GESTAO_ACORDOS', 'ADM_GERAL', 'ADM_COMERCIAL'] } },
    take: 3,
  })

  if (clientes.length === 0) {
    console.error('Nenhum cliente encontrado. Crie clientes antes de rodar este seed.')
    process.exit(1)
  }
  if (users.length === 0) {
    console.error('Nenhum usuário com perfil de acordos encontrado.')
    process.exit(1)
  }

  const adminUser = users[0]
  const c1 = clientes[0]
  const c2 = clientes[1] ?? clientes[0]
  const c3 = clientes[2] ?? clientes[0]
  const c4 = clientes[3] ?? clientes[0]

  console.log(`Usando admin: ${adminUser.nome} (id=${adminUser.id})`)
  console.log(`Clientes: ${[c1, c2, c3, c4].map(c => c.nome).join(', ')}`)

  // Limpar contratos existentes (seed idempotente)
  await prisma.notaFiscalContrato.deleteMany()
  await prisma.subIndiceFaturamento.deleteMany()
  await prisma.contrato.deleteMany()
  console.log('Contratos anteriores removidos.')

  // ── CT-001 ─────────────────────────────────────────────────────────────────
  const ct1 = await prisma.contrato.create({
    data: {
      indice: 'CT-001',
      ano_referencia: 2026,
      status: 'PARCIAL',
      cliente_id: c1.id,
      num_os: 'OS-00443',
      num_acordo: 'AC-2026-017',
      num_proposta: 'PROP-0821',
      responsavel_id: adminUser.id,
      data_inicio: new Date('2026-03-01'),
      data_fim: new Date('2026-11-30'),
      descricao: 'Manutenção mecânica e caldeiraria — Parada programada P-25',
      created_by: adminUser.id,
      subindices: {
        create: [
          {
            ordem: 1,
            descricao: 'Mobilização',
            valor_total: 120000,
            data_inicio: new Date('2026-03-01'),
            data_fim: new Date('2026-03-31'),
            mar: 120000,
            created_by: adminUser.id,
          },
          {
            ordem: 2,
            descricao: 'Execução — Fase 1 Caldeiraria',
            valor_total: 850000,
            data_inicio: new Date('2026-04-01'),
            data_fim: new Date('2026-07-31'),
            abr: 200000,
            mai: 250000,
            jun: 220000,
            jul: 180000,
            created_by: adminUser.id,
          },
          {
            ordem: 3,
            descricao: 'Execução — Fase 2 Mecânica',
            valor_total: 620000,
            data_inicio: new Date('2026-08-01'),
            data_fim: new Date('2026-10-31'),
            ago: 210000,
            set: 210000,
            out: 200000,
            created_by: adminUser.id,
          },
          {
            ordem: 4,
            descricao: 'Desmobilização',
            valor_total: 80000,
            data_inicio: new Date('2026-11-01'),
            data_fim: new Date('2026-11-30'),
            nov: 80000,
            created_by: adminUser.id,
          },
        ],
      },
    },
    include: { subindices: { orderBy: { ordem: 'asc' } } },
  })
  console.log('CT-001 criado.')

  // Lançar NFs em CT-001
  const sub1 = ct1.subindices[0] // Mobilização
  const sub2 = ct1.subindices[1] // Fase 1
  await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: sub1.id,
      numero_nf: 'NF-004521',
      valor_total_nf: 120000,
      percentual: 100,
      valor_atribuido: 120000,
      data_emissao: new Date('2026-03-28'),
      data_vencimento: new Date('2026-04-27'),
      created_by: adminUser.id,
    },
  })
  await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: sub2.id,
      numero_nf: 'NF-004678',
      valor_total_nf: 450000,
      percentual: 100,
      valor_atribuido: 450000,
      data_emissao: new Date('2026-05-30'),
      data_vencimento: new Date('2026-06-29'),
      created_by: adminUser.id,
    },
  })
  await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: sub2.id,
      numero_nf: 'NF-004812',
      valor_total_nf: 400000,
      percentual: 100,
      valor_atribuido: 400000,
      data_emissao: new Date('2026-07-31'),
      data_vencimento: new Date('2026-08-30'),
      created_by: adminUser.id,
    },
  })
  console.log('NFs de CT-001 lançadas.')

  // ── CT-002 ─────────────────────────────────────────────────────────────────
  await prisma.contrato.create({
    data: {
      indice: 'CT-002',
      ano_referencia: 2026,
      status: 'A_FATURAR',
      cliente_id: c2.id,
      num_os: 'OS-00512',
      num_acordo: 'AC-2026-031',
      responsavel_id: adminUser.id,
      data_inicio: new Date('2026-06-01'),
      data_fim: new Date('2026-03-31'),
      descricao: 'Fabricação e montagem de estruturas metálicas — Expansão Área 4',
      created_by: adminUser.id,
      subindices: {
        create: [
          {
            ordem: 1,
            descricao: 'Engenharia e Projeto',
            valor_total: 95000,
            data_inicio: new Date('2026-06-01'),
            data_fim: new Date('2026-08-31'),
            jun: 30000,
            jul: 35000,
            ago: 30000,
            created_by: adminUser.id,
          },
          {
            ordem: 2,
            descricao: 'Fabricação de estruturas',
            valor_total: 480000,
            data_inicio: new Date('2026-09-01'),
            data_fim: new Date('2026-12-31'),
            set: 100000,
            out: 140000,
            nov: 140000,
            dez: 100000,
            created_by: adminUser.id,
          },
          {
            ordem: 3,
            descricao: 'Montagem e comissionamento',
            valor_total: 320000,
            data_inicio: new Date('2026-01-01'),
            data_fim: new Date('2026-03-31'),
            jan: 110000,
            fev: 110000,
            mar: 100000,
            comentarios: 'Valor parcial — ano seguinte',
            created_by: adminUser.id,
          },
        ],
      },
    },
  })
  console.log('CT-002 criado.')

  // ── CT-003 ─────────────────────────────────────────────────────────────────
  const ct3 = await prisma.contrato.create({
    data: {
      indice: 'CT-003',
      ano_referencia: 2026,
      status: 'FATURADO',
      cliente_id: c3.id,
      num_os: 'OS-00389',
      num_acordo: 'AC-2025-088',
      num_proposta: 'PROP-0755',
      responsavel_id: adminUser.id,
      data_inicio: new Date('2026-01-15'),
      data_fim: new Date('2026-04-30'),
      descricao: 'Serviços de pintura e tratamento superficial — Tanques TQ-01 a TQ-06',
      created_by: adminUser.id,
      subindices: {
        create: [
          {
            ordem: 1,
            descricao: 'Jateamento e preparo de superfície',
            valor_total: 210000,
            data_inicio: new Date('2026-01-15'),
            data_fim: new Date('2026-02-28'),
            jan: 100000,
            fev: 110000,
            created_by: adminUser.id,
          },
          {
            ordem: 2,
            descricao: 'Aplicação de pintura — 3 demãos',
            valor_total: 340000,
            data_inicio: new Date('2026-03-01'),
            data_fim: new Date('2026-04-30'),
            mar: 170000,
            abr: 170000,
            created_by: adminUser.id,
          },
        ],
      },
    },
    include: { subindices: { orderBy: { ordem: 'asc' } } },
  })
  console.log('CT-003 criado.')

  // NFs completas em CT-003 (status FATURADO)
  for (const sub of ct3.subindices) {
    await prisma.notaFiscalContrato.create({
      data: {
        subindice_id: sub.id,
        numero_nf: sub.ordem === 1 ? 'NF-003901' : 'NF-004102',
        valor_total_nf: Number(sub.valor_total),
        percentual: 100,
        valor_atribuido: Number(sub.valor_total),
        data_emissao: sub.ordem === 1 ? new Date('2026-02-28') : new Date('2026-04-30'),
        data_vencimento: sub.ordem === 1 ? new Date('2026-03-30') : new Date('2026-05-30'),
        created_by: adminUser.id,
      },
    })
  }
  console.log('NFs de CT-003 lançadas.')

  // ── CT-004 ─────────────────────────────────────────────────────────────────
  await prisma.contrato.create({
    data: {
      indice: 'CT-004',
      ano_referencia: 2026,
      status: 'A_FATURAR',
      cliente_id: c4.id,
      num_os: 'OS-00601',
      num_proposta: 'PROP-0934',
      responsavel_id: adminUser.id,
      data_inicio: new Date('2026-10-01'),
      data_fim: new Date('2026-12-31'),
      descricao: 'Manutenção preventiva de equipamentos rotativos',
      created_by: adminUser.id,
      subindices: {
        create: [
          {
            ordem: 1,
            descricao: 'Inspeção e diagnóstico',
            valor_total: 55000,
            data_inicio: new Date('2026-10-01'),
            data_fim: new Date('2026-10-31'),
            out: 55000,
            created_by: adminUser.id,
          },
          {
            ordem: 2,
            descricao: 'Manutenção bombas centrífugas',
            valor_total: 180000,
            data_inicio: new Date('2026-11-01'),
            data_fim: new Date('2026-12-31'),
            nov: 90000,
            dez: 90000,
            created_by: adminUser.id,
          },
          {
            ordem: 3,
            descricao: 'Alinhamento e balanceamento',
            valor_total: 75000,
            data_inicio: new Date('2026-12-01'),
            data_fim: new Date('2026-12-31'),
            dez: 75000,
            comentarios: 'Após conclusão da fase 2',
            created_by: adminUser.id,
          },
        ],
      },
    },
  })
  console.log('CT-004 criado.')

  console.log('\n✓ Seed concluído com sucesso!')
  console.log('  CT-001 — Parcial  (3 NFs lançadas)')
  console.log('  CT-002 — A faturar (contrato multi-ano, prev. 2026)')
  console.log('  CT-003 — Faturado  (NFs completas)')
  console.log('  CT-004 — A faturar (novos serviços)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
