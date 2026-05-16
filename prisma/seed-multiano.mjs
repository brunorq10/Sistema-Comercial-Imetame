// Seed de exemplo: contrato multi-ano (2026 e 2027)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const clientes = await prisma.cliente.findMany({ take: 6, orderBy: { id: 'asc' } })
  const users = await prisma.user.findMany({
    where: { ativo: true, perfil: { in: ['ACORDOS', 'GESTAO_ACORDOS', 'ADM_GERAL', 'ADM_COMERCIAL'] } },
    take: 1,
  })

  if (!clientes.length || !users.length) {
    console.error('Nenhum cliente ou usuário encontrado.')
    process.exit(1)
  }

  const admin  = users[0]
  const cliente = clientes[4] ?? clientes[0]

  // Índice sequencial
  const count = await prisma.contrato.count()
  const indice = `CT-${String(count + 1).padStart(3, '0')}`

  console.log(`Criando ${indice} — multi-ano 2026/2027 — cliente: ${cliente.nome}`)

  // ── Contrato principal ───────────────────────────────────────────────────────
  const ct = await prisma.contrato.create({
    data: {
      indice,
      ano_referencia: 2026,
      status: 'PARCIAL',
      cliente_id: cliente.id,
      num_os: 'OS-00712',
      num_acordo: 'AC-2026-099',
      num_proposta: 'PROP-1042',
      responsavel_id: admin.id,
      data_inicio: new Date('2026-09-01'),
      data_fim: new Date('2027-06-30'),
      descricao: 'Modernização de sistemas rotativos — Complexo Industrial Norte',
      created_by: admin.id,
      subindices: {
        create: [
          // ── Evento 1 — porção 2026 ───────────────────────────────────────
          {
            ordem: 1,
            descricao: 'Engenharia e mobilização',
            valor_total: 280000,
            data_inicio: new Date('2026-09-01'),
            data_fim:    new Date('2026-12-31'),
            set: 70000,
            out: 80000,
            nov: 80000,
            dez: 50000,
            created_by: admin.id,
          },
          // ── Evento 1 — porção 2027 ───────────────────────────────────────
          {
            ordem: 2,
            descricao: 'Engenharia e mobilização',
            valor_total: 120000,
            data_inicio: new Date('2027-01-01'),
            data_fim:    new Date('2027-03-31'),
            jan: 40000,
            fev: 40000,
            mar: 40000,
            created_by: admin.id,
          },
          // ── Evento 2 — porção 2026 ───────────────────────────────────────
          {
            ordem: 3,
            descricao: 'Execução mecânica e elétrica',
            valor_total: 560000,
            data_inicio: new Date('2026-10-01'),
            data_fim:    new Date('2026-12-31'),
            out: 180000,
            nov: 200000,
            dez: 180000,
            created_by: admin.id,
          },
          // ── Evento 2 — porção 2027 ───────────────────────────────────────
          {
            ordem: 4,
            descricao: 'Execução mecânica e elétrica',
            valor_total: 440000,
            data_inicio: new Date('2027-01-01'),
            data_fim:    new Date('2027-06-30'),
            jan: 100000,
            fev: 100000,
            mar: 100000,
            abr:  80000,
            mai:  60000,
            created_by: admin.id,
          },
          // ── Evento 3 — apenas 2027 ───────────────────────────────────────
          {
            ordem: 5,
            descricao: 'Comissionamento e desmobilização',
            valor_total: 95000,
            data_inicio: new Date('2027-05-01'),
            data_fim:    new Date('2027-06-30'),
            mai: 50000,
            jun: 45000,
            created_by: admin.id,
          },
        ],
      },
    },
    include: { subindices: { orderBy: { ordem: 'asc' } } },
  })

  console.log(`${indice} criado com ${ct.subindices.length} sub-índices.`)

  // ── NFs parciais na porção 2026 ──────────────────────────────────────────────
  const sub2026_ev1 = ct.subindices[0]  // Engenharia 2026
  const sub2026_ev2 = ct.subindices[2]  // Execução   2026

  await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: sub2026_ev1.id,
      numero_nf: 'NF-005100',
      valor_total_nf: 150000,
      percentual: 100,
      valor_atribuido: 150000,
      data_emissao:    new Date('2026-10-31'),
      data_vencimento: new Date('2026-11-30'),
      created_by: admin.id,
    },
  })

  await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: sub2026_ev2.id,
      numero_nf: 'NF-005210',
      valor_total_nf: 380000,
      percentual: 100,
      valor_atribuido: 380000,
      data_emissao:    new Date('2026-12-15'),
      data_vencimento: new Date('2027-01-14'),
      created_by: admin.id,
    },
  })

  // ── NF na porção 2027 ────────────────────────────────────────────────────────
  const sub2027_ev1 = ct.subindices[1]  // Engenharia 2027

  await prisma.notaFiscalContrato.create({
    data: {
      subindice_id: sub2027_ev1.id,
      numero_nf: 'NF-005301',
      valor_total_nf: 80000,
      percentual: 100,
      valor_atribuido: 80000,
      data_emissao:    new Date('2027-02-28'),
      data_vencimento: new Date('2027-03-30'),
      created_by: admin.id,
    },
  })

  console.log('NFs lançadas.')
  console.log(`\n✓ Seed multi-ano concluído!`)
  console.log(`  ${indice} — 2026/2027`)
  console.log('  Evento 1 (Engenharia): set-dez/2026 + jan-mar/2027')
  console.log('  Evento 2 (Execução): out-dez/2026 + jan-mai/2027')
  console.log('  Evento 3 (Comissionamento): mai-jun/2027 apenas')
  console.log('  NF-005100 emitida out/2026 — NF-005210 emitida dez/2026 — NF-005301 emitida fev/2027')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
