import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLIENTE_ID   = 6   // CSN
const USER_ID      = 3   // Lucas Ferreira
const ANO_BASE     = 2025

// Meses do período: Jan/2025 → Dez/2025
function mesesPeriodo(inicio, fim) {
  const r = []
  const d = new Date(inicio + 'T00:00:00')
  const f = new Date(fim    + 'T00:00:00')
  while (d <= f) { r.push({ mes: d.getMonth() + 1, ano: d.getFullYear() }); d.setMonth(d.getMonth() + 1) }
  return r
}

async function main() {
  console.log('Inserindo contratos e lançamentos de HH...')

  // ── Criar 4 contratos de Obras ──────────────────────────────────────────────

  const contratos = await Promise.all([
    prisma.contrato.create({
      data: {
        indice: 'OBR-2025-001', ano_referencia: ANO_BASE,
        classificacao: 'OBRAS', status: 'A_FATURAR',
        cliente_id: CLIENTE_ID, responsavel_id: USER_ID,
        created_by: USER_ID,
        num_os: 'OS-9001', descricao: 'Montagem estrutura metálica — Área de produção A',
        data_inicio: new Date('2025-01-01'), data_fim: new Date('2025-08-31'),
        valor_contrato: 4500000,
      },
    }),
    prisma.contrato.create({
      data: {
        indice: 'OBR-2025-002', ano_referencia: ANO_BASE,
        classificacao: 'OBRAS', status: 'A_FATURAR',
        cliente_id: CLIENTE_ID, responsavel_id: USER_ID,
        created_by: USER_ID,
        num_os: 'OS-9002', descricao: 'Tubulações industriais — Unidade 3',
        data_inicio: new Date('2025-03-01'), data_fim: new Date('2025-10-31'),
        valor_contrato: 2800000,
      },
    }),
    prisma.contrato.create({
      data: {
        indice: 'OBR-2025-003', ano_referencia: ANO_BASE,
        classificacao: 'OBRAS', status: 'A_FATURAR',
        cliente_id: CLIENTE_ID, responsavel_id: USER_ID,
        created_by: USER_ID,
        num_os: 'OS-9003', descricao: 'Ampliação subestação elétrica',
        data_inicio: new Date('2025-02-01'), data_fim: new Date('2025-06-30'),
        valor_contrato: 1900000,
      },
    }),
    prisma.contrato.create({
      data: {
        indice: 'OBR-2025-004', ano_referencia: ANO_BASE,
        classificacao: 'OBRAS', status: 'A_FATURAR',
        cliente_id: CLIENTE_ID,
        created_by: USER_ID,
        descricao: 'Obras civis — fundações e estrutura',
        data_inicio: new Date('2025-04-01'), data_fim: new Date('2025-12-31'),
        valor_contrato: 3200000,
      },
    }),
  ])

  console.log(`Criados ${contratos.length} contratos.`)

  // ── Contrato 1: OBR-2025-001 (Jan-Ago 2025) ─────────────────────────────────
  // Revisão 01: lançamento inicial
  const lan1 = await prisma.hhLancamento.create({
    data: {
      contrato_id: contratos[0].id, versao: 1,
      data_inicio: new Date('2025-01-01'), data_fim: new Date('2025-08-31'),
      created_by: USER_ID,
      meses: {
        create: [
          // Jan → Ago 2025: HH crescente na mobilização, pico no meio e decaindo
          { mes: 1, ano: 2025, hh_previsto: 3200,  hh_planejado: 3200  },
          { mes: 2, ano: 2025, hh_previsto: 5800,  hh_planejado: 5600  },
          { mes: 3, ano: 2025, hh_previsto: 8200,  hh_planejado: 8400  },
          { mes: 4, ano: 2025, hh_previsto: 10500, hh_planejado: 10200 },
          { mes: 5, ano: 2025, hh_previsto: 11000, hh_planejado: 11200 },
          { mes: 6, ano: 2025, hh_previsto: 9800,  hh_planejado: 9600  },
          { mes: 7, ano: 2025, hh_previsto: 7200,  hh_planejado: 7400  },
          { mes: 8, ano: 2025, hh_previsto: 4300,  hh_planejado: 4400  },
        ],
      },
    },
  })

  // Revisão 02: replanejamento (aumento no pico)
  const lan1v2 = await prisma.hhLancamento.create({
    data: {
      contrato_id: contratos[0].id, versao: 2,
      data_inicio: new Date('2025-01-01'), data_fim: new Date('2025-08-31'),
      motivo: 'Aumento de escopo aprovado em ata 12/03/2025 — acréscimo de 8% no HH total',
      created_by: USER_ID,
      meses: {
        create: [
          { mes: 1, ano: 2025, hh_previsto: 3200,  hh_planejado: 3200  },
          { mes: 2, ano: 2025, hh_previsto: 5800,  hh_planejado: 5600  },
          { mes: 3, ano: 2025, hh_previsto: 9100,  hh_planejado: 9200  },
          { mes: 4, ano: 2025, hh_previsto: 11800, hh_planejado: 11500 },
          { mes: 5, ano: 2025, hh_previsto: 12200, hh_planejado: 12000 },
          { mes: 6, ano: 2025, hh_previsto: 10500, hh_planejado: 10800 },
          { mes: 7, ano: 2025, hh_previsto: 7800,  hh_planejado: 8000  },
          { mes: 8, ano: 2025, hh_previsto: 4400,  hh_planejado: 4700  },
        ],
      },
    },
  })

  // Realizados: Jan → Mai 2025 (variações realistas)
  await Promise.all([
    { mes: 1, real: 3150,  obs: 'Mobilização concluída dentro do esperado' },
    { mes: 2, real: 5920,  obs: null },
    { mes: 3, real: 9400,  obs: 'Hora extra autorizada — retrabalho em coluna B7' },
    { mes: 4, real: 11650, obs: null },
    { mes: 5, real: 11800, obs: 'Pico de efetivo atingido' },
  ].map(r => prisma.hhRealizado.create({
    data: { contrato_id: contratos[0].id, mes: r.mes, ano: 2025, hh_realizado: r.real, observacoes: r.obs, created_by: USER_ID },
  })))

  // ── Contrato 2: OBR-2025-002 (Mar-Out 2025) ─────────────────────────────────
  await prisma.hhLancamento.create({
    data: {
      contrato_id: contratos[1].id, versao: 1,
      data_inicio: new Date('2025-03-01'), data_fim: new Date('2025-10-31'),
      created_by: USER_ID,
      meses: {
        create: [
          { mes: 3,  ano: 2025, hh_previsto: 4000,  hh_planejado: 4000  },
          { mes: 4,  ano: 2025, hh_previsto: 7500,  hh_planejado: 7500  },
          { mes: 5,  ano: 2025, hh_previsto: 9200,  hh_planejado: 9000  },
          { mes: 6,  ano: 2025, hh_previsto: 10000, hh_planejado: 10200 },
          { mes: 7,  ano: 2025, hh_previsto: 9500,  hh_planejado: 9300  },
          { mes: 8,  ano: 2025, hh_previsto: 8000,  hh_planejado: 8200  },
          { mes: 9,  ano: 2025, hh_previsto: 5500,  hh_planejado: 5500  },
          { mes: 10, ano: 2025, hh_previsto: 2800,  hh_planejado: 2800  },
        ],
      },
    },
  })

  // Realizados: Mar → Mai 2025
  await Promise.all([
    { mes: 3, real: 3800  },
    { mes: 4, real: 7800  },
    { mes: 5, real: 8950  },
  ].map(r => prisma.hhRealizado.create({
    data: { contrato_id: contratos[1].id, mes: r.mes, ano: 2025, hh_realizado: r.real, created_by: USER_ID },
  })))

  // ── Contrato 3: OBR-2025-003 (Fev-Jun 2025) ─────────────────────────────────
  await prisma.hhLancamento.create({
    data: {
      contrato_id: contratos[2].id, versao: 1,
      data_inicio: new Date('2025-02-01'), data_fim: new Date('2025-06-30'),
      created_by: USER_ID,
      meses: {
        create: [
          { mes: 2, ano: 2025, hh_previsto: 2500, hh_planejado: 2500 },
          { mes: 3, ano: 2025, hh_previsto: 5000, hh_planejado: 5000 },
          { mes: 4, ano: 2025, hh_previsto: 6500, hh_planejado: 6200 },
          { mes: 5, ano: 2025, hh_previsto: 5500, hh_planejado: 5800 },
          { mes: 6, ano: 2025, hh_previsto: 2500, hh_planejado: 2500 },
        ],
      },
    },
  })

  // Realizados: Fev → Mai — contrato adiantado (realizado acima do planejado em alguns meses)
  await Promise.all([
    { mes: 2, real: 2650, obs: 'Início adiantado aprovado pelo cliente' },
    { mes: 3, real: 5400, obs: null },
    { mes: 4, real: 7200, obs: 'Reforço de equipe para compensar chuvas em Mar' },
    { mes: 5, real: 5100, obs: null },
  ].map(r => prisma.hhRealizado.create({
    data: { contrato_id: contratos[2].id, mes: r.mes, ano: 2025, hh_realizado: r.real, observacoes: r.obs, created_by: USER_ID },
  })))

  // ── Contrato 4: OBR-2025-004 — sem lançamento (para testar o filtro "sem lançamento") ──

  console.log('✓ Seed concluído!')
  console.log(`  Contrato 1 (${contratos[0].indice}): 2 revisões + 5 meses realizados`)
  console.log(`  Contrato 2 (${contratos[1].indice}): 1 revisão + 3 meses realizados`)
  console.log(`  Contrato 3 (${contratos[2].indice}): 1 revisão + 4 meses realizados`)
  console.log(`  Contrato 4 (${contratos[3].indice}): sem lançamento`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
