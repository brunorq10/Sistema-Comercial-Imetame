import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ── Usuários ─────────────────────────────────────────────────────────────────
  const adminHash = await hash('imetame@2026', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@imetame.com.br' },
    update: {},
    create: { nome: 'Administrador', email: 'admin@imetame.com.br', password_hash: adminHash, perfil: 'ADM_COMERCIAL' },
  })

  const orcHash = await hash('imetame@2026', 10)
  const [orc1, orc2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'lucas.ferreira@imetame.com.br' },
      update: {},
      create: { nome: 'Lucas Ferreira', email: 'lucas.ferreira@imetame.com.br', password_hash: orcHash, perfil: 'ORCAMENTISTA', funcao: 'Orçamentista Sênior' },
    }),
    prisma.user.upsert({
      where: { email: 'ana.souza@imetame.com.br' },
      update: {},
      create: { nome: 'Ana Souza', email: 'ana.souza@imetame.com.br', password_hash: orcHash, perfil: 'ORCAMENTISTA', funcao: 'Orçamentista' },
    }),
  ])

  // ── Clientes ─────────────────────────────────────────────────────────────────
  const [petrobras, vale, gerdau, csn, arcelormittal, samarco, usiminas] = await Promise.all([
    prisma.cliente.upsert({ where: { id: 1 }, update: {}, create: { id: 1, nome: 'Petrobras', cnpj: '33.000.167/0001-01', cidade: 'Vitória', estado: 'ES', ramo_atuacao: 'OLEO_GAS', created_by: 1 } }),
    prisma.cliente.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nome: 'Vale S.A.', cnpj: '33.592.510/0001-54', cidade: 'Itabira', estado: 'MG', ramo_atuacao: 'MINERACAO', created_by: 1 } }),
    prisma.cliente.upsert({ where: { id: 3 }, update: {}, create: { id: 3, nome: 'Gerdau', cnpj: '92.690.783/0001-09', cidade: 'Ouro Branco', estado: 'MG', ramo_atuacao: 'SIDERURGIA', created_by: 1 } }),
    prisma.cliente.upsert({ where: { id: 4 }, update: {}, create: { id: 4, nome: 'CSN', cnpj: '33.042.730/0001-04', cidade: 'Volta Redonda', estado: 'RJ', ramo_atuacao: 'SIDERURGIA', created_by: 1 } }),
    prisma.cliente.upsert({ where: { id: 5 }, update: {}, create: { id: 5, nome: 'ArcelorMittal', cnpj: '60.543.816/0001-93', cidade: 'Serra', estado: 'ES', ramo_atuacao: 'SIDERURGIA', created_by: 1 } }),
    prisma.cliente.upsert({ where: { id: 6 }, update: {}, create: { id: 6, nome: 'Samarco Mineração', cnpj: '16.628.281/0001-06', cidade: 'Mariana', estado: 'MG', ramo_atuacao: 'MINERACAO', created_by: 1 } }),
    prisma.cliente.upsert({ where: { id: 7 }, update: {}, create: { id: 7, nome: 'Usiminas', cnpj: '60.894.730/0001-05', cidade: 'Ipatinga', estado: 'MG', ramo_atuacao: 'SIDERURGIA', created_by: 1 } }),
  ])

  // ── Solicitações ─────────────────────────────────────────────────────────────
  const solDefs = [
    { numero: 'SOL-0001', cliente_id: petrobras.id, contato: 'Roberto Alves', cidade: 'Vitória', estado: 'ES', origem: 'EMAIL' as const, escopo: 'Montagem de estruturas metálicas — módulo de compressão GLP', classificacao: 'OLEO_GAS' as const, interesse: 'ALTO' as const, status: 'CONTRATO_GANHO' as const, prazo_tecnica: new Date('2025-03-10'), prazo_comercial: new Date('2025-03-20'), orcamentista_id: orc1.id, visita_tecnica: true, data_visita: new Date('2025-02-28'), created_by: admin.id },
    { numero: 'SOL-0002', cliente_id: vale.id, contato: 'Marcos Lima', cidade: 'Itabira', estado: 'MG', origem: 'TELEFONE' as const, escopo: 'Parada de manutenção programada — linhas A, B e C — planta Itabira', classificacao: 'PARADAS' as const, interesse: 'ALTO' as const, status: 'RECUSADA' as const, prazo_tecnica: new Date('2025-04-05'), prazo_comercial: new Date('2025-04-15'), orcamentista_id: orc1.id, created_by: admin.id },
    { numero: 'SOL-0003', cliente_id: gerdau.id, contato: 'Fernanda Costa', cidade: 'Ouro Branco', estado: 'MG', origem: 'VISITA' as const, escopo: 'Fabricação e montagem de suportes e guias de tubulação — fase 2', classificacao: 'FABRICACOES' as const, interesse: 'MEDIO' as const, status: 'PROPOSTA_ENVIADA' as const, prazo_tecnica: new Date('2025-05-20'), prazo_comercial: new Date('2025-05-30'), orcamentista_id: orc2.id, created_by: admin.id },
    { numero: 'SOL-0004', cliente_id: csn.id, contato: 'Rodrigo Campos', cidade: 'Volta Redonda', estado: 'RJ', origem: 'EMAIL' as const, escopo: 'Obras civis e estruturais — expansão do galpão industrial setor 4', classificacao: 'OBRAS' as const, interesse: 'ALTO' as const, status: 'PROPOSTA_ENVIADA' as const, prazo_tecnica: new Date('2025-06-10'), prazo_comercial: new Date('2025-06-20'), orcamentista_id: orc2.id, created_by: admin.id },
    { numero: 'SOL-0005', cliente_id: arcelormittal.id, contato: 'Daniela Faria', cidade: 'Serra', estado: 'ES', origem: 'INDICACAO' as const, escopo: 'Montagem eletromecânica — nova linha de laminação a frio', classificacao: 'OBRAS' as const, interesse: 'ALTO' as const, status: 'EM_ELABORACAO' as const, prazo_tecnica: new Date('2026-06-01'), prazo_comercial: new Date('2026-06-15'), orcamentista_id: orc1.id, visita_tecnica: true, created_by: admin.id },
    { numero: 'SOL-0006', cliente_id: samarco.id, contato: 'João Prado', cidade: 'Mariana', estado: 'MG', origem: 'EMAIL' as const, escopo: 'Manutenção corretiva e preventiva — mineroduto trecho 3', classificacao: 'PARADAS' as const, interesse: 'MEDIO' as const, status: 'PROPOSTA_ENVIADA' as const, prazo_tecnica: new Date('2025-08-12'), prazo_comercial: new Date('2025-08-25'), orcamentista_id: orc2.id, created_by: admin.id },
    { numero: 'SOL-0007', cliente_id: usiminas.id, contato: 'Carla Mendes', cidade: 'Ipatinga', estado: 'MG', origem: 'VISITA' as const, escopo: 'Reforma geral — alto forno 2', classificacao: 'PARADAS' as const, interesse: 'ALTO' as const, status: 'EM_ELABORACAO' as const, prazo_tecnica: new Date('2026-07-10'), prazo_comercial: new Date('2026-07-25'), orcamentista_id: orc1.id, created_by: admin.id },
    // SOL-0008 atribuída ao admin — aparece no painel ao logar como admin
    { numero: 'SOL-0008', cliente_id: petrobras.id, contato: 'André Moraes', cidade: 'Macaé', estado: 'RJ', origem: 'EMAIL' as const, escopo: 'Revamp da unidade de tratamento de gás — fase 1 (montagem mecânica e elétrica)', classificacao: 'OLEO_GAS' as const, interesse: 'ALTO' as const, status: 'EM_ELABORACAO' as const, prazo_tecnica: new Date('2026-06-20'), prazo_comercial: new Date('2026-07-05'), orcamentista_id: admin.id, visita_tecnica: true, data_visita: new Date('2026-05-22'), created_by: admin.id },
    // SOL-0009 Fabricações atribuída ao admin para testar modal unificado
    { numero: 'SOL-0009', cliente_id: gerdau.id, contato: 'Felipe Andrade', cidade: 'Ouro Branco', estado: 'MG', origem: 'VISITA' as const, escopo: 'Fabricação de vasos de pressão e trocadores de calor — nova planta', classificacao: 'FABRICACOES' as const, interesse: 'ALTO' as const, status: 'EM_ELABORACAO' as const, prazo_tecnica: new Date('2026-07-01'), prazo_comercial: new Date('2026-07-15'), orcamentista_id: admin.id, visita_tecnica: true, data_visita: new Date('2026-06-10'), created_by: admin.id },
    // SOL-0010 Paradas atribuída ao admin — para testar modal e histórico de Paradas
    { numero: 'SOL-0010', cliente_id: usiminas.id, contato: 'Renata Pires', cidade: 'Ipatinga', estado: 'MG', origem: 'VISITA' as const, escopo: 'Parada geral — Alto Forno 3 — manutenção e inspeção estrutural', classificacao: 'PARADAS' as const, interesse: 'ALTO' as const, status: 'PROPOSTA_ENVIADA' as const, prazo_tecnica: new Date('2026-05-20'), prazo_comercial: new Date('2026-06-05'), orcamentista_id: admin.id, visita_tecnica: true, data_visita: new Date('2026-05-05'), created_by: admin.id },
    // SOL-0011 Obras atribuída ao admin — SEM proposta, para testar RegistrarObraModal do zero
    { numero: 'SOL-0011', cliente_id: vale.id, contato: 'Beatriz Santos', cidade: 'Itabira', estado: 'MG', origem: 'VISITA' as const, escopo: 'Montagem mecânica e civil — plataformas de acesso e structures de containment — planta de pelotização', classificacao: 'OBRAS' as const, interesse: 'ALTO' as const, status: 'EM_ELABORACAO' as const, prazo_tecnica: new Date('2026-06-15'), prazo_comercial: new Date('2026-06-30'), orcamentista_id: admin.id, visita_tecnica: true, data_visita: new Date('2026-05-20'), created_by: admin.id },
    // SOL-0012 Obras atribuída ao admin — COM proposta completa (pesos por categoria + terceiros)
    { numero: 'SOL-0012', cliente_id: samarco.id, contato: 'Heitor Mendes', cidade: 'Mariana', estado: 'MG', origem: 'EMAIL' as const, escopo: 'Obras estruturais e mecânicas — modernização da usina de pelotização — bloco D', classificacao: 'OBRAS' as const, interesse: 'ALTO' as const, status: 'PROPOSTA_ENVIADA' as const, prazo_tecnica: new Date('2026-05-15'), prazo_comercial: new Date('2026-05-25'), orcamentista_id: admin.id, created_by: admin.id },
  ]

  for (const sol of solDefs) {
    await prisma.solicitacao.upsert({ where: { numero: sol.numero }, update: {}, create: sol })
  }

  const sols = await prisma.solicitacao.findMany({
    where: { numero: { in: solDefs.map((s) => s.numero) } },
    select: { id: true, numero: true },
  })
  const solId = (n: string) => sols.find((s) => s.numero === n)!.id

  // ── Propostas Técnicas ────────────────────────────────────────────────────────
  type TecObrasData = {
    solicitacao_id: number; versao: number
    peso_equipamentos: number; peso_tubulacoes: number; peso_suportes: number; peso_estruturas: number
    hh_total: number; data: string; by: number
  }
  const mkTecObras = ({ solicitacao_id, versao, peso_equipamentos, peso_tubulacoes, peso_suportes, peso_estruturas, hh_total, data, by }: TecObrasData) => {
    const peso_montagem = peso_equipamentos + peso_tubulacoes + peso_suportes + peso_estruturas
    return prisma.propostaTecnica.upsert({
      where: { solicitacao_id_versao: { solicitacao_id, versao } },
      update: { hh_total, peso_montagem, peso_equipamentos, peso_tubulacoes, peso_suportes, peso_estruturas },
      create: { solicitacao_id, versao, hh_total, peso_montagem, peso_equipamentos, peso_tubulacoes, peso_suportes, peso_estruturas, data_envio: new Date(data), created_by: by },
    })
  }

  type TecData = {
    solicitacao_id: number; versao: number; hh_direto: number; hh_indireto: number
    peso?: number; data: string; by: number
    efetivo_pico?: number; dias_parada?: number; turno?: string; finais_de_semana?: boolean
  }
  const mkTec = ({ solicitacao_id, versao, hh_direto, hh_indireto, peso, data, by, efetivo_pico, dias_parada, turno, finais_de_semana }: TecData) => {
    const hh_total = hh_direto + hh_indireto
    const d = { solicitacao_id, versao, hh_direto, hh_indireto, hh_total, peso_montagem: peso ?? null, data_envio: new Date(data), created_by: by, efetivo_pico: efetivo_pico ?? null, dias_parada: dias_parada ?? null, turno: turno ?? null, finais_de_semana: finais_de_semana ?? null }
    return prisma.propostaTecnica.upsert({
      where: { solicitacao_id_versao: { solicitacao_id, versao } },
      update: { efetivo_pico: d.efetivo_pico, dias_parada: d.dias_parada, hh_total: d.hh_total, turno: d.turno, finais_de_semana: d.finais_de_semana },
      create: d,
    })
  }

  const [tec01v1, tec01v2, tec02v1, tec02v2, tec02v3, tec03v1, tec04v1, tec04v2, tec06v1, tec10v1, tec10v2, tec12v1] = await Promise.all([
    mkTec({ solicitacao_id: solId('SOL-0001'), versao: 1, hh_direto: 3200, hh_indireto: 640, peso: 48.5, data: '2025-03-08', by: orc1.id }),
    mkTec({ solicitacao_id: solId('SOL-0001'), versao: 2, hh_direto: 3050, hh_indireto: 610, peso: 47.2, data: '2025-03-12', by: orc1.id }),
    // SOL-0002 Paradas (Vale)
    mkTec({ solicitacao_id: solId('SOL-0002'), versao: 1, hh_direto: 5800, hh_indireto: 1160, data: '2025-04-02', by: orc1.id, efetivo_pico: 420, dias_parada: 28, turno: '12x36', finais_de_semana: true }),
    mkTec({ solicitacao_id: solId('SOL-0002'), versao: 2, hh_direto: 5600, hh_indireto: 1120, data: '2025-04-06', by: orc1.id, efetivo_pico: 400, dias_parada: 26, turno: '12x36', finais_de_semana: true }),
    mkTec({ solicitacao_id: solId('SOL-0002'), versao: 3, hh_direto: 5400, hh_indireto: 1080, data: '2025-04-10', by: orc1.id, efetivo_pico: 390, dias_parada: 25, turno: '8h', finais_de_semana: false }),
    mkTec({ solicitacao_id: solId('SOL-0003'), versao: 1, hh_direto: 1800, hh_indireto: 360, peso: 22.3, data: '2025-05-18', by: orc2.id }),
    mkTec({ solicitacao_id: solId('SOL-0004'), versao: 1, hh_direto: 7200, hh_indireto: 1440, peso: 130.0, data: '2025-06-08', by: orc2.id }),
    mkTec({ solicitacao_id: solId('SOL-0004'), versao: 2, hh_direto: 6900, hh_indireto: 1380, peso: 125.5, data: '2025-06-12', by: orc2.id }),
    // SOL-0006 Paradas (Samarco)
    mkTec({ solicitacao_id: solId('SOL-0006'), versao: 1, hh_direto: 2400, hh_indireto: 480, data: '2025-08-10', by: orc2.id, efetivo_pico: 180, dias_parada: 18, turno: '8h', finais_de_semana: false }),
    // SOL-0010 Paradas (Usiminas — admin) — 2 revisões
    mkTec({ solicitacao_id: solId('SOL-0010'), versao: 1, hh_direto: 8200, hh_indireto: 1640, data: '2026-05-15', by: admin.id, efetivo_pico: 520, dias_parada: 32, turno: '12x36', finais_de_semana: true }),
    mkTec({ solicitacao_id: solId('SOL-0010'), versao: 2, hh_direto: 7800, hh_indireto: 1560, data: '2026-05-19', by: admin.id, efetivo_pico: 490, dias_parada: 30, turno: '12x36', finais_de_semana: true }),
    // SOL-0012 Obras (Samarco — admin) — pesos por categoria
    mkTecObras({ solicitacao_id: solId('SOL-0012'), versao: 1, peso_equipamentos: 45.5, peso_tubulacoes: 28.3, peso_suportes: 12.8, peso_estruturas: 38.4, hh_total: 9500, data: '2026-05-12', by: admin.id }),
  ])

  // ── Propostas Comerciais ──────────────────────────────────────────────────────
  // Comercial padrão (breakdown montagem + terceiros)
  const com = (id: number, sol: string, tec: { id: number }, versao: number, data: string, resultado: string | null, by: number, opts: {
    montagem: number, terceiros?: { eletrica?: number, isolamento?: number, civil?: number, fibra?: number, outros?: number }, fabricacao?: number, motivo_perda?: string
  }) => {
    const t = opts.terceiros ?? {}
    const totalTerceiros = (t.eletrica ?? 0) + (t.isolamento ?? 0) + (t.civil ?? 0) + (t.fibra ?? 0) + (t.outros ?? 0)
    const possuiTerceiros = totalTerceiros > 0
    const possuiFabricacao = (opts.fabricacao ?? 0) > 0
    const valorTotal = opts.montagem + totalTerceiros + (opts.fabricacao ?? 0)
    return prisma.propostaComercial.upsert({
      where: { id },
      update: {
        valor_montagem_mecanica: opts.montagem, possui_terceiros: possuiTerceiros,
        valor_eletrica: t.eletrica ?? null, valor_isolamento: t.isolamento ?? null,
        valor_civil: t.civil ?? null, valor_fibra: t.fibra ?? null,
        valor_outros_terceiros: t.outros ?? null, possui_fabricacao: possuiFabricacao,
        valor_fabricacao: opts.fabricacao ?? null, valor_total: valorTotal,
        resultado, motivo_perda: (opts.motivo_perda as never) ?? null,
      },
      create: {
        id, solicitacao_id: solId(sol), proposta_tecnica_id: tec.id, versao,
        valor_montagem_mecanica: opts.montagem, possui_terceiros: possuiTerceiros,
        valor_eletrica: t.eletrica ?? null, valor_isolamento: t.isolamento ?? null,
        valor_civil: t.civil ?? null, valor_fibra: t.fibra ?? null,
        valor_outros_terceiros: t.outros ?? null, possui_fabricacao: possuiFabricacao,
        valor_fabricacao: opts.fabricacao ?? null, valor_total: valorTotal,
        data_envio: new Date(data), resultado, motivo_perda: (opts.motivo_perda as never) ?? null,
        created_by: by,
      },
    })
  }

  // Comercial Obras (pesos por categoria + terceiros com hidraulica/tijolo)
  const comObras = (id: number, sol: string, tec: { id: number }, versao: number, data: string, resultado: string | null, by: number, opts: {
    montagem: number, terceiros?: { eletrica?: number, isolamento?: number, civil?: number, hidraulica?: number, fibra?: number, tijolo?: number, outros?: number }, fabricacao?: number, motivo_perda?: string
  }) => {
    const t = opts.terceiros ?? {}
    const totalTerceiros = (t.eletrica ?? 0) + (t.isolamento ?? 0) + (t.civil ?? 0) + (t.hidraulica ?? 0) + (t.fibra ?? 0) + (t.tijolo ?? 0) + (t.outros ?? 0)
    const possuiTerceiros = totalTerceiros > 0
    const possuiFabricacao = (opts.fabricacao ?? 0) > 0
    const valorTotal = opts.montagem + totalTerceiros + (opts.fabricacao ?? 0)
    return prisma.propostaComercial.upsert({
      where: { id },
      update: {
        valor_montagem_mecanica: opts.montagem, possui_terceiros: possuiTerceiros,
        valor_eletrica: t.eletrica ?? null, valor_isolamento: t.isolamento ?? null,
        valor_civil: t.civil ?? null, valor_fibra: t.fibra ?? null,
        valor_hidraulica: t.hidraulica ?? null, valor_tijolo_antiacido: t.tijolo ?? null,
        valor_outros_terceiros: t.outros ?? null, possui_fabricacao: possuiFabricacao,
        valor_fabricacao: opts.fabricacao ?? null, valor_total: valorTotal,
        resultado, motivo_perda: (opts.motivo_perda as never) ?? null,
      },
      create: {
        id, solicitacao_id: solId(sol), proposta_tecnica_id: tec.id, versao,
        valor_montagem_mecanica: opts.montagem, possui_terceiros: possuiTerceiros,
        valor_eletrica: t.eletrica ?? null, valor_isolamento: t.isolamento ?? null,
        valor_civil: t.civil ?? null, valor_fibra: t.fibra ?? null,
        valor_hidraulica: t.hidraulica ?? null, valor_tijolo_antiacido: t.tijolo ?? null,
        valor_outros_terceiros: t.outros ?? null, possui_fabricacao: possuiFabricacao,
        valor_fabricacao: opts.fabricacao ?? null, valor_total: valorTotal,
        data_envio: new Date(data), resultado, motivo_perda: (opts.motivo_perda as never) ?? null,
        created_by: by,
      },
    })
  }

  // Comercial Paradas (valor total direto + terceiros opcional)
  const comParada = (id: number, sol: string, tec: { id: number }, versao: number, data: string, resultado: string | null, by: number, opts: {
    valor_total: number, valor_terceiros?: number, motivo_perda?: string
  }) =>
    prisma.propostaComercial.upsert({
      where: { id },
      update: { valor_total: opts.valor_total, valor_terceiros: opts.valor_terceiros ?? null, resultado, motivo_perda: (opts.motivo_perda as never) ?? null },
      create: {
        id, solicitacao_id: solId(sol), proposta_tecnica_id: tec.id, versao,
        valor_total: opts.valor_total, valor_terceiros: opts.valor_terceiros ?? null,
        data_envio: new Date(data), resultado, motivo_perda: (opts.motivo_perda as never) ?? null,
        created_by: by,
      },
    })

  await Promise.all([
    // SOL-0001 Rev00 → Rev01 GANHOU (Óleo e Gás)
    com(1, 'SOL-0001', tec01v1, 1, '2025-03-09', 'AGUARDANDO', orc1.id, {
      montagem: 1_200_000, terceiros: { eletrica: 300_000, civil: 200_000, outros: 150_000 },
    }),
    com(2, 'SOL-0001', tec01v2, 2, '2025-03-14', 'GANHOU', orc1.id, {
      montagem: 1_150_000, terceiros: { eletrica: 280_000, civil: 180_000, outros: 150_000 },
    }),

    // SOL-0002 Paradas (Vale) — 3 revisões
    comParada(3, 'SOL-0002', tec02v1, 1, '2025-04-03', 'AGUARDANDO', orc1.id, {
      valor_total: 3_200_000, valor_terceiros: 800_000,
    }),
    comParada(4, 'SOL-0002', tec02v2, 2, '2025-04-08', 'AGUARDANDO', orc1.id, {
      valor_total: 3_050_000, valor_terceiros: 750_000,
    }),
    comParada(5, 'SOL-0002', tec02v3, 3, '2025-04-12', 'PERDEU', orc1.id, {
      valor_total: 2_900_000, valor_terceiros: 680_000, motivo_perda: 'PRECO',
    }),

    // SOL-0003 Rev00 — com Fabricação (Obras)
    com(6, 'SOL-0003', tec03v1, 1, '2025-05-20', 'AGUARDANDO', orc2.id, {
      montagem: 750_000, fabricacao: 170_000,
    }),

    // SOL-0004 Obras
    com(7, 'SOL-0004', tec04v1, 1, '2025-06-09', 'AGUARDANDO', orc2.id, {
      montagem: 2_800_000, terceiros: { eletrica: 600_000, isolamento: 400_000, civil: 300_000 },
    }),
    com(8, 'SOL-0004', tec04v2, 2, '2025-06-14', 'AGUARDANDO', orc2.id, {
      montagem: 2_600_000, terceiros: { eletrica: 560_000, isolamento: 360_000, civil: 250_000 }, fabricacao: 180_000,
    }),

    // SOL-0006 Paradas (Samarco) — 1 revisão
    comParada(9, 'SOL-0006', tec06v1, 1, '2025-08-11', 'AGUARDANDO', orc2.id, {
      valor_total: 1_280_000, valor_terceiros: 330_000,
    }),

    // SOL-0010 Paradas (Usiminas — admin) — 2 revisões
    comParada(10, 'SOL-0010', tec10v1, 1, '2026-05-16', 'AGUARDANDO', admin.id, {
      valor_total: 5_800_000, valor_terceiros: 1_200_000,
    }),
    comParada(11, 'SOL-0010', tec10v2, 2, '2026-05-20', 'AGUARDANDO', admin.id, {
      valor_total: 5_400_000, valor_terceiros: 1_050_000,
    }),
    // SOL-0012 Obras (Samarco — admin) — proposta completa com pesos por categoria e terceiros
    comObras(12, 'SOL-0012', tec12v1, 1, '2026-05-13', 'AGUARDANDO', admin.id, {
      montagem: 3_800_000,
      terceiros: { eletrica: 480_000, isolamento: 320_000, hidraulica: 150_000, civil: 280_000, fibra: 95_000 },
      fabricacao: 350_000,
    }),
  ])

  // ── Propostas Fabricação (SOL-0003 Fabricações e SOL-0008 Óleo e Gás) ────────
  const sol03 = await prisma.solicitacao.findUnique({ where: { numero: 'SOL-0003' }, select: { id: true } })
  const sol08 = await prisma.solicitacao.findUnique({ where: { numero: 'SOL-0008' }, select: { id: true } })

  if (sol03) {
    // SOL-0003 Rev00 — Gerdau / Fabricações (2 equipamentos, sem testes)
    await prisma.propostaFabricacao.upsert({
      where: { solicitacao_id_versao: { solicitacao_id: sol03.id, versao: 1 } },
      update: {},
      create: {
        solicitacao_id: sol03.id, versao: 1,
        possui_testes: false,
        peso_total: 18.5, valor_total: 1_340_000,
        data_envio: new Date('2025-05-20'),
        created_by: orc2.id,
        equipamentos: {
          create: [
            { ordem: 1, descricao: 'Vaso de pressão V-101', peso_ton: 12.5, valor_total: 920_000, observacoes: 'Aço carbono ASTM A516 Gr.70' },
            { ordem: 2, descricao: 'Suportes e guias de tubulação (lote)', peso_ton: 6.0, valor_total: 420_000 },
          ],
        },
      },
    })
    // SOL-0003 Rev01 — revisão com reajuste e testes incluídos
    await prisma.propostaFabricacao.upsert({
      where: { solicitacao_id_versao: { solicitacao_id: sol03.id, versao: 2 } },
      update: {},
      create: {
        solicitacao_id: sol03.id, versao: 2,
        possui_testes: true, descricao_testes: 'Teste hidrostático e inspeção por ultrassom',
        valor_testes: 85_000,
        peso_total: 18.5, valor_total: 1_505_000,
        data_envio: new Date('2025-05-28'),
        resultado: 'AGUARDANDO',
        created_by: orc2.id,
        equipamentos: {
          create: [
            { ordem: 1, descricao: 'Vaso de pressão V-101', peso_ton: 12.5, valor_total: 980_000, observacoes: 'Aço carbono ASTM A516 Gr.70 — reajuste de material' },
            { ordem: 2, descricao: 'Suportes e guias de tubulação (lote)', peso_ton: 6.0, valor_total: 440_000 },
          ],
        },
      },
    })
  }

  if (sol08) {
    // SOL-0008 Rev00 — Petrobras / Óleo e Gás (3 equipamentos, com testes)
    await prisma.propostaFabricacao.upsert({
      where: { solicitacao_id_versao: { solicitacao_id: sol08.id, versao: 1 } },
      update: {},
      create: {
        solicitacao_id: sol08.id, versao: 1,
        possui_testes: true, descricao_testes: 'Teste hidrostático, radiografia e PMTA',
        valor_testes: 210_000,
        peso_total: 47.8, valor_total: 4_860_000,
        data_envio: new Date('2026-05-10'),
        resultado: 'AGUARDANDO',
        created_by: admin.id,
        equipamentos: {
          create: [
            { ordem: 1, descricao: 'Separador trifásico S-201', peso_ton: 22.0, valor_total: 2_100_000, observacoes: 'Aço inox 316L — serviço H₂S' },
            { ordem: 2, descricao: 'Vaso flash F-301', peso_ton: 14.3, valor_total: 1_380_000 },
            { ordem: 3, descricao: 'Trocador de calor E-401 (casco/tubo)', peso_ton: 11.5, valor_total: 1_170_000, observacoes: 'TEMA tipo AES' },
          ],
        },
      },
    })
  }

  console.log('\n✅ Seed concluído com sucesso!')
  console.log('────────────────────────────────────────────────────')
  console.log('Logins:')
  console.log('  admin@imetame.com.br              | imetame@2026  (ADM_COMERCIAL)')
  console.log('  lucas.ferreira@imetame.com.br     | imetame@2026  (ORCAMENTISTA)')
  console.log('  ana.souza@imetame.com.br           | imetame@2026  (ORCAMENTISTA)')
  console.log('────────────────────────────────────────────────────')
  console.log('Painel do admin: SOL-0008 (Petrobras / Macaé-RJ)   — Óleo e Gás, em elaboração')
  console.log('                 SOL-0009 (Gerdau / Ouro Branco-MG) — Fabricações, em elaboração')
  console.log('                 SOL-0011 (Vale / Itabira-MG)        — Obras, sem proposta → testar RegistrarObraModal')
  console.log('                 SOL-0012 (Samarco / Mariana-MG)     — Obras, proposta completa com pesos por categoria')
  console.log('Histórico com indicadores R$/HH: SOL-0001, 0002, 0003, 0004, 0006')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
