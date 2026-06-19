import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Busca o primeiro usuário ADM e primeiro cliente disponíveis
const user = await prisma.user.findFirst({ orderBy: { id: 'asc' } })
const cliente = await prisma.cliente.findFirst({ orderBy: { id: 'asc' } })

if (!user || !cliente) {
  console.error('Nenhum usuário ou cliente encontrado no banco.')
  process.exit(1)
}

console.log(`Usando usuário: ${user.nome} (id=${user.id})`)
console.log(`Usando cliente: ${cliente.nome} (id=${cliente.id})`)

// ── 1. Cria o contrato de Parada ────────────────────────────────────────────
const contrato = await prisma.contrato.upsert({
  where: { indice: 'IME-P-0042/25' },
  create: {
    indice:         'IME-P-0042/25',
    ano_referencia: 2025,
    status:         'A_FATURAR',
    cliente_id:     cliente.id,
    num_os:         'OS-4200',
    num_acordo:     'ACO-2025-042',
    cidade:         'Limeira',
    estado:         'SP',
    descricao:      'Parada Geral de Manutenção — Linha de Celulose',
    classificacao:  'PARADAS',
    data_inicio:    new Date('2025-06-02'),
    data_fim:       new Date('2025-06-30'),
    created_by:     user.id,
    rascunho:       false,
  },
  update: {
    classificacao: 'PARADAS',
  },
})
console.log(`Contrato: ${contrato.indice} (id=${contrato.id})`)

// ── 2. Sub-índice de faturamento (para valor orçado) ────────────────────────
await prisma.subIndiceFaturamento.upsert({
  where: { id: 99901 },
  create: {
    id:          99901,
    contrato_id: contrato.id,
    ordem:       1,
    descricao:   'Execução da Parada',
    valor_total: 1_850_000,
    data_inicio: new Date('2025-06-02'),
    data_fim:    new Date('2025-06-30'),
    jun:         1_850_000,
    created_by:  user.id,
  },
  update: { valor_total: 1_850_000, jun: 1_850_000 },
})

// ── 3. HhLancamento (necessário para aparecer na listagem) ──────────────────
const lancamento = await prisma.hhLancamento.upsert({
  where: { contrato_id_versao: { contrato_id: contrato.id, versao: 1 } },
  create: {
    contrato_id: contrato.id,
    versao:      1,
    data_inicio: new Date('2025-06-01'),
    data_fim:    new Date('2025-06-30'),
    motivo:      'Lançamento inicial — Parada Geral Suzano',
    created_by:  user.id,
  },
  update: {},
})

// Meses do lançamento
await prisma.hhLancamentoMes.upsert({
  where: { lancamento_id_mes_ano: { lancamento_id: lancamento.id, mes: 6, ano: 2025 } },
  create: { lancamento_id: lancamento.id, mes: 6, ano: 2025, hh_previsto: 12840, hh_planejado: 11200 },
  update: { hh_previsto: 12840, hh_planejado: 11200 },
})

// ── 4. ParadaHhConfig ───────────────────────────────────────────────────────
const config = await prisma.paradaHhConfig.upsert({
  where: { contrato_id: contrato.id },
  create: {
    contrato_id:   contrato.id,
    // Etapa Preparativo: 02/06 – 04/06
    prep_inicio:   new Date('2025-06-02'),
    prep_fim:      new Date('2025-06-04'),
    // Etapa Parada: 05/06 – 20/06
    parada_inicio: new Date('2025-06-05'),
    parada_fim:    new Date('2025-06-20'),
    // Etapa Acomp. e Desmob.: 21/06 – 28/06
    acomp_inicio:  new Date('2025-06-21'),
    acomp_fim:     new Date('2025-06-28'),

    // Mobilização
    mob_ativo:         true,
    mob_dias:          2,
    mob_pico_efetivo:  80,

    // Desmobilização
    desmob_ativo:        true,
    desmob_dias:         2,
    desmob_pico_efetivo: 80,

    // Integração
    integ_ativo:         true,
    integ_dias:          1,
    integ_pico_efetivo:  120,

    // Folga
    folga_ativo:    true,
    folga_dias:     2,
    folga_pessoas:  25,

    // Análise financeira - previsto
    fin_prev_mob:    95000,
    fin_prev_integ:  42000,
    fin_prev_prep:   180000,
    fin_prev_parada: 1100000,
    fin_prev_acomp:  280000,
    fin_prev_desmob: 95000,
    fin_prev_folga:  58000,

    // Análise financeira - real (NFs emitidas)
    fin_real_mob:    90000,
    fin_real_integ:  40000,
    fin_real_prep:   172000,
    fin_real_parada: 1050000,
    fin_real_acomp:  0,
    fin_real_desmob: 0,
    fin_real_folga:  0,

    // UCR limits
    ucr_f1: 0.85,
    ucr_f2: 0.93,
    ucr_f3: 1.00,
    ucr_f4: 1.07,
  },
  update: {
    prep_inicio:   new Date('2025-06-02'),
    prep_fim:      new Date('2025-06-04'),
    parada_inicio: new Date('2025-06-05'),
    parada_fim:    new Date('2025-06-20'),
    acomp_inicio:  new Date('2025-06-21'),
    acomp_fim:     new Date('2025-06-28'),
    mob_ativo: true, mob_dias: 2, mob_pico_efetivo: 80,
    desmob_ativo: true, desmob_dias: 2, desmob_pico_efetivo: 80,
    integ_ativo: true, integ_dias: 1, integ_pico_efetivo: 120,
    folga_ativo: true, folga_dias: 2, folga_pessoas: 25,
    fin_prev_mob: 95000, fin_prev_integ: 42000, fin_prev_prep: 180000,
    fin_prev_parada: 1100000, fin_prev_acomp: 280000, fin_prev_desmob: 95000, fin_prev_folga: 58000,
    fin_real_mob: 90000, fin_real_integ: 40000, fin_real_prep: 172000,
    fin_real_parada: 1050000, fin_real_acomp: 0, fin_real_desmob: 0, fin_real_folga: 0,
  },
})
console.log(`ParadaHhConfig id=${config.id}`)

// ── 5. Dados diários ────────────────────────────────────────────────────────

// Preparativo: 02/06 – 04/06 (3 dias, seg–qua)
const diasPrep = [
  { data: '2025-06-02', efetivo_plan: 75, hh_plan: 660, efetivo_real: 78, hh_real: 686.4 },
  { data: '2025-06-03', efetivo_plan: 80, hh_plan: 704, efetivo_real: 80, hh_real: 704 },
  { data: '2025-06-04', efetivo_plan: 80, hh_plan: 704, efetivo_real: 76, hh_real: 668.8 },
]

// Parada: 05/06 – 20/06 (inclui fins de semana — 7,8,14,15)
const diasParada = [
  { data: '2025-06-05', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 125, hh_real: 1100 },
  { data: '2025-06-06', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 122, hh_real: 1073.6 },
  { data: '2025-06-07', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 118, hh_real: 1038.4 },
  { data: '2025-06-08', efetivo_plan: 60,  hh_plan: 528,  efetivo_real: 58,  hh_real: 510.4 },  // dom
  { data: '2025-06-09', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 120, hh_real: 1056 },
  { data: '2025-06-10', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 115, hh_real: 1012 },
  { data: '2025-06-11', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 124, hh_real: 1091.2 },
  { data: '2025-06-12', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 123, hh_real: 1082.4 },
  { data: '2025-06-13', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 120, hh_real: 1056 },
  { data: '2025-06-14', efetivo_plan: 60,  hh_plan: 528,  efetivo_real: 55,  hh_real: 484 },   // sáb
  { data: '2025-06-15', efetivo_plan: 60,  hh_plan: 528,  efetivo_real: 52,  hh_real: 457.6 }, // dom
  { data: '2025-06-16', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 118, hh_real: 1038.4 },
  { data: '2025-06-17', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 122, hh_real: 1073.6 },
  { data: '2025-06-18', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 119, hh_real: 1047.2 },
  { data: '2025-06-19', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 125, hh_real: 1100 },
  { data: '2025-06-20', efetivo_plan: 120, hh_plan: 1056, efetivo_real: 123, hh_real: 1082.4 },
]

// Acomp. e Desmob.: 21/06 – 28/06
const diasAcomp = [
  { data: '2025-06-21', efetivo_plan: 85, hh_plan: 748, efetivo_real: 88, hh_real: 774.4 },
  { data: '2025-06-22', efetivo_plan: 85, hh_plan: 748, efetivo_real: 85, hh_real: 748 },
  { data: '2025-06-23', efetivo_plan: 80, hh_plan: 704, efetivo_real: 82, hh_real: 721.6 },
  { data: '2025-06-24', efetivo_plan: 80, hh_plan: 704, efetivo_real: 0,  hh_real: 0 },
  { data: '2025-06-25', efetivo_plan: 75, hh_plan: 660, efetivo_real: 0,  hh_real: 0 },
  { data: '2025-06-26', efetivo_plan: 75, hh_plan: 660, efetivo_real: 0,  hh_real: 0 },
  { data: '2025-06-27', efetivo_plan: 70, hh_plan: 616, efetivo_real: 0,  hh_real: 0 },
  { data: '2025-06-28', efetivo_plan: 65, hh_plan: 572, efetivo_real: 0,  hh_real: 0 },
]

const allDias = [
  ...diasPrep.map(d => ({ ...d, etapa: 'PREPARATIVO' })),
  ...diasParada.map(d => ({ ...d, etapa: 'PARADA' })),
  ...diasAcomp.map(d => ({ ...d, etapa: 'ACOMP_DESMOB' })),
]

for (const d of allDias) {
  await prisma.paradaHhDia.upsert({
    where: {
      config_id_etapa_data: {
        config_id: config.id,
        etapa: d.etapa,
        data: new Date(d.data + 'T12:00:00'),
      },
    },
    create: {
      config_id:    config.id,
      etapa:        d.etapa,
      data:         new Date(d.data + 'T12:00:00'),
      efetivo_plan: d.efetivo_plan,
      hh_plan:      d.hh_plan,
      efetivo_real: d.efetivo_real || null,
      hh_real:      d.hh_real || null,
    },
    update: {
      efetivo_plan: d.efetivo_plan,
      hh_plan:      d.hh_plan,
      efetivo_real: d.efetivo_real || null,
      hh_real:      d.hh_real || null,
    },
  })
}

console.log(`${allDias.length} dias lançados.`)
console.log('\n✅  Seed completo! Contrato IME-P-0042/25 pronto para demonstração.')
await prisma.$disconnect()
