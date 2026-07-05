// ─────────────────────────────────────────────────────────────────────────────
// Catálogo declarativo do Construtor de Relatório.
//
// PRINCÍPIO DE SEGURANÇA: o frontend NUNCA envia SQL nem nomes de coluna. Ele
// envia apenas a "chave" semântica de cada campo (ex.: "valor_proposta"). Este
// catálogo é a única fonte que traduz chave → expressão SQL. Qualquer chave que
// não exista aqui é rejeitada com 400 na API. Assim não há superfície para SQL
// injection via nome de campo e a auditoria fica trivial.
//
// Banco: PostgreSQL → agrupamento de datas usa DATE_TRUNC.
// ─────────────────────────────────────────────────────────────────────────────

export type Modulo = 'comercial' | 'acordos' | 'ocorrencias'
export type Granularidade = 'dia' | 'mes' | 'trimestre' | 'ano'
export type Agregacao = 'soma' | 'media' | 'contagem'
export type TipoCampo = 'dim' | 'data' | 'met' | 'calc'
export type Formato = 'texto' | 'moeda' | 'numero' | 'decimal' | 'percent' | 'data'

export interface CampoBase {
  key: string
  label: string
  modulo: Modulo
  grupo: string          // rótulo do grupo exibido no painel lateral
  tipo: TipoCampo
}

export interface CampoDim extends CampoBase {
  tipo: 'dim'
  sql: string            // expressão de coluna (relativa aos alias da base)
}

export interface CampoData extends CampoBase {
  tipo: 'data'
  dateCol: string        // coluna de data bruta (para DATE_TRUNC e para o filtro)
}

export interface CampoMet extends CampoBase {
  tipo: 'met'
  sql: string            // expressão numérica agregável (ex.: pc.valor_total)
  aggs: Agregacao[]      // agregações permitidas
  aggPadrao: Agregacao
  count?: boolean        // true → COUNT(*) (ignora sql), p/ "quantidade de registros"
  formato: Formato
}

export interface CampoCalc extends CampoBase {
  tipo: 'calc'
  num: string            // numerador (será envolvido por SUM)
  den: string            // denominador (será envolvido por SUM + NULLIF 0)
  percent?: boolean      // multiplica por 100
  formato: Formato
}

export type Campo = CampoDim | CampoData | CampoMet | CampoCalc

// ── Configuração de cada base (uma por módulo) ───────────────────────────────
// LATERAL pega a última versão da proposta por solicitação, evitando contagem
// duplicada entre versões. As métricas derivadas de Acordos usam subqueries
// escalares por contrato (uma linha por contrato → SUM no grupo é correto).

export interface BaseConfig {
  from: string
  where: string          // filtro base (soft-delete)
  dataPadrao: string     // coluna de data usada no filtro quando não há campo de data nas zonas
  dataPadraoLabel: string
  clienteCol: string
  responsavelCol: string
}

// Chave de base: os módulos + "combinada" (Comercial × Acordos no grão do contrato).
export type BaseKey = Modulo | 'combinada'

// Join de Paradas (config + HH real total calculado como no /api/acordos/hh):
// base_real = SUM(hh_real) de todos os dias; pico_real = MAX(efetivo_real) na etapa
// PARADA; hh_real_total = base_real + adicionais (mob/desmob/integ/folga × 8.8).
const PRD_JOIN = `LEFT JOIN parada_hh_config phc ON phc.contrato_id = c.id
      LEFT JOIN LATERAL (
        SELECT br.base_real,
          br.base_real + (
            CASE WHEN phc.mob_ativo    AND phc.mob_dias_real    IS NOT NULL THEN br.pico_real * phc.mob_dias_real    * 8.8 ELSE 0 END
          + CASE WHEN phc.desmob_ativo AND phc.desmob_dias_real IS NOT NULL THEN br.pico_real * phc.desmob_dias_real * 8.8 ELSE 0 END
          + CASE WHEN phc.integ_ativo  AND phc.integ_dias_real  IS NOT NULL THEN br.pico_real * phc.integ_dias_real  * 8.8 ELSE 0 END
          + CASE WHEN phc.folga_ativo  AND phc.folga_pessoas_real IS NOT NULL AND phc.folga_dias_real IS NOT NULL THEN phc.folga_pessoas_real * phc.folga_dias_real * 8.8 ELSE 0 END
          ) AS hh_real_total
        FROM (
          SELECT COALESCE((SELECT SUM(d.hh_real) FROM parada_hh_dia d WHERE d.config_id = phc.id), 0) AS base_real,
                 COALESCE((SELECT MAX(d.efetivo_real) FROM parada_hh_dia d WHERE d.config_id = phc.id AND d.etapa = 'PARADA'), 0) AS pico_real
        ) br
      ) prd ON true`

// Joins da parte COMERCIAL (proposta de origem) usados na base combinada.
const COM_PROP_JOIN = `LEFT JOIN solicitacoes s ON s.id = c.solicitacao_id
      LEFT JOIN users orc ON orc.id = s.orcamentista_id
      LEFT JOIN LATERAL (
        SELECT pc.valor_total, pc.valor_montagem_mecanica, pc.valor_fabricacao, pc.valor_terceiros, pc.resultado, pc.motivo_perda
        FROM propostas_comerciais pc WHERE pc.solicitacao_id = s.id ORDER BY pc.versao DESC LIMIT 1
      ) pc ON true
      LEFT JOIN LATERAL (
        SELECT pt.hh_direto, pt.hh_indireto, pt.hh_total, pt.efetivo_pico, pt.dias_parada, pt.turno,
               pt.peso_montagem, pt.peso_equipamentos, pt.peso_tubulacoes, pt.peso_suportes, pt.peso_estruturas
        FROM propostas_tecnicas pt WHERE pt.solicitacao_id = s.id ORDER BY pt.versao DESC LIMIT 1
      ) pt ON true`

const ACO_FROM = `contratos c
      LEFT JOIN clientes cli ON cli.id = c.cliente_id
      LEFT JOIN clientes clf ON clf.id = c.cliente_final_id
      LEFT JOIN users resp ON resp.id = c.responsavel_id
      LEFT JOIN solicitacoes sol ON sol.id = c.solicitacao_id
      ${PRD_JOIN}`

export const BASES: Record<BaseKey, BaseConfig> = {
  comercial: {
    from: `solicitacoes s
      LEFT JOIN clientes cli ON cli.id = s.cliente_id
      LEFT JOIN clientes clf ON clf.id = s.cliente_final_id
      LEFT JOIN users orc ON orc.id = s.orcamentista_id
      LEFT JOIN LATERAL (
        SELECT pc.valor_total, pc.valor_montagem_mecanica, pc.valor_fabricacao, pc.valor_terceiros, pc.resultado, pc.motivo_perda
        FROM propostas_comerciais pc
        WHERE pc.solicitacao_id = s.id
        ORDER BY pc.versao DESC LIMIT 1
      ) pc ON true
      LEFT JOIN LATERAL (
        SELECT pt.hh_direto, pt.hh_indireto, pt.hh_total, pt.efetivo_pico, pt.dias_parada, pt.turno,
               pt.peso_montagem, pt.peso_equipamentos, pt.peso_tubulacoes, pt.peso_suportes, pt.peso_estruturas
        FROM propostas_tecnicas pt
        WHERE pt.solicitacao_id = s.id
        ORDER BY pt.versao DESC LIMIT 1
      ) pt ON true`,
    where: 's.cancelled_at IS NULL',
    dataPadrao: 'COALESCE(s.data_recebimento, s.created_at)',
    dataPadraoLabel: 'Data da solicitação',
    clienteCol: 's.cliente_id',
    responsavelCol: 's.orcamentista_id',
  },
  acordos: {
    // Grão do CONTRATO (uma linha por contrato). Métricas de faturamento, NFs,
    // multas, HH e ocorrências entram como SUBCONSULTAS ESCALARES (ver constantes
    // abaixo) — assim não há explosão por 1:N e os totais ficam corretos.
    from: ACO_FROM,
    where: 'c.cancelled_at IS NULL',
    dataPadrao: 'c.data_inicio',
    dataPadraoLabel: 'Data de início do contrato',
    clienteCol: 'c.cliente_id',
    responsavelCol: 'c.responsavel_id',
  },
  // Combinada: Comercial × Acordos no grão do CONTRATO. Traz a proposta de
  // origem (via c.solicitacao_id). Os valores de proposta são do contrato de
  // origem — se uma solicitação gerou vários contratos, o valor da proposta se
  // repete por contrato (grão do contrato). cli/clf = cliente do contrato.
  combinada: {
    from: `${ACO_FROM}
      ${COM_PROP_JOIN}`,
    where: 'c.cancelled_at IS NULL',
    dataPadrao: 'c.data_inicio',
    dataPadraoLabel: 'Data de início do contrato',
    clienteCol: 'c.cliente_id',
    responsavelCol: 'c.responsavel_id',
  },
  ocorrencias: {
    from: `ocorrencias_contratuais o
      LEFT JOIN contratos c ON c.id = o.contrato_id
      LEFT JOIN clientes cli ON cli.id = c.cliente_id
      LEFT JOIN users resp ON resp.id = c.responsavel_id`,
    where: 'c.cancelled_at IS NULL AND o.deleted_at IS NULL',
    dataPadrao: 'o.data',
    dataPadraoLabel: 'Data da ocorrência',
    clienteCol: 'c.cliente_id',
    responsavelCol: 'c.responsavel_id',
  },
}

// Subqueries escalares por CONTRATO (grão do contrato → SUM não duplica).
const FATURADO = `(SELECT COALESCE(SUM(nf.valor_atribuido), 0)
  FROM notas_fiscais_contratos nf JOIN subindices_faturamento si ON si.id = nf.subindice_id
  WHERE si.contrato_id = c.id AND nf.ativa = true AND nf.status_aprovacao = 'APROVADO' AND nf.deleted_at IS NULL AND si.deleted_at IS NULL)`
const MULTAS_VAL = `(SELECT COALESCE(SUM(m.valor_total), 0) FROM multas_penalidades m WHERE m.contrato_id = c.id AND m.ativa = true AND m.deleted_at IS NULL)`
const MULTAS_QTD = `(SELECT COUNT(*) FROM multas_penalidades m WHERE m.contrato_id = c.id AND m.ativa = true AND m.deleted_at IS NULL)`
const NF_VAL = `(SELECT COALESCE(SUM(nf.valor_atribuido), 0)
  FROM notas_fiscais_contratos nf JOIN subindices_faturamento si ON si.id = nf.subindice_id
  WHERE si.contrato_id = c.id AND nf.ativa = true AND nf.deleted_at IS NULL AND si.deleted_at IS NULL)`
const NF_QTD = `(SELECT COUNT(*)
  FROM notas_fiscais_contratos nf JOIN subindices_faturamento si ON si.id = nf.subindice_id
  WHERE si.contrato_id = c.id AND nf.ativa = true AND nf.deleted_at IS NULL AND si.deleted_at IS NULL)`
const QTD_OCORRENCIAS = `(SELECT COUNT(*) FROM ocorrencias_contratuais o WHERE o.contrato_id = c.id AND o.deleted_at IS NULL)`
// HH por contrato: previsto/planejado da última versão do lançamento; realizado somado.
const HH_PREV = `(SELECT COALESCE(SUM(hm.hh_previsto), 0) FROM hh_lancamento_mes hm
  JOIN hh_lancamentos hl ON hl.id = hm.lancamento_id
  WHERE hl.contrato_id = c.id AND hl.versao = (SELECT MAX(versao) FROM hh_lancamentos WHERE contrato_id = c.id))`
const HH_PLAN = `(SELECT COALESCE(SUM(hm.hh_planejado), 0) FROM hh_lancamento_mes hm
  JOIN hh_lancamentos hl ON hl.id = hm.lancamento_id
  WHERE hl.contrato_id = c.id AND hl.versao = (SELECT MAX(versao) FROM hh_lancamentos WHERE contrato_id = c.id))`
const HH_REAL = `(SELECT COALESCE(SUM(hr.hh_realizado), 0) FROM hh_realizado hr WHERE hr.contrato_id = c.id)`
// Peso total (t) da proposta técnica (soma das categorias + montagem).
const PESO_TOTAL = `(COALESCE(pt.peso_montagem,0) + COALESCE(pt.peso_equipamentos,0) + COALESCE(pt.peso_tubulacoes,0) + COALESCE(pt.peso_suportes,0) + COALESCE(pt.peso_estruturas,0))`

// Classificação UCR (Paradas): faturado / HH real total, classificado pelas
// faixas do parada_hh_config — mesma regra do /api/acordos/hh. NULL fora de Paradas.
const UCR_RS_HH = `(${FATURADO} / NULLIF(prd.hh_real_total, 0))`
const UCR_SQL = `CASE
    WHEN phc.id IS NULL OR prd.hh_real_total <= 0 THEN NULL
    WHEN ${UCR_RS_HH} <= phc.ucr_nao_suficiente THEN 'Não Suficiente'
    WHEN ${UCR_RS_HH} <= phc.ucr_a_evoluir THEN 'A Evoluir'
    WHEN ${UCR_RS_HH} <= phc.ucr_bom THEN 'Bom'
    WHEN ${UCR_RS_HH} <= phc.ucr_otimo THEN 'Ótimo'
    ELSE 'Esplêndido' END`
// Serviço Extra — ASE (Sim/Não): há valor de ASE previsto no config da Parada.
const ASE_SQL = `CASE WHEN COALESCE(phc.fin_prev_ase, 0) > 0 THEN 'Sim' ELSE 'Não' END`

// ── Catálogo de campos ───────────────────────────────────────────────────────

export const CAMPOS: Campo[] = [
  // ════════════════ MÓDULO COMERCIAL (grão: solicitação + última proposta) ════
  // Dimensões
  { key: 'com_num_solic',      label: 'Nº Solicitação',      modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.numero' },
  { key: 'com_data_solic',     label: 'Mês/Ano da Solicitação', modulo: 'comercial', grupo: 'Comercial', tipo: 'data', dateCol: 'COALESCE(s.data_recebimento, s.created_at)' },
  { key: 'com_status',         label: 'Status da Solicitação', modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.status::text' },
  { key: 'com_resultado',      label: 'Resultado',           modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'pc.resultado' },
  { key: 'com_motivo_perda',   label: 'Motivo de Perda',     modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'pc.motivo_perda::text' },
  { key: 'com_motivo_recusa',  label: 'Motivo de Recusa',    modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.motivo_recusa' },
  { key: 'com_cliente',        label: 'Cliente',             modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'cli.nome' },
  { key: 'com_cliente_final',  label: 'Cliente Final',       modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'clf.nome' },
  { key: 'com_cidade',         label: 'Cidade/UF',           modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: "NULLIF(CONCAT_WS('/', s.cidade, s.estado), '')" },
  { key: 'com_escopo',         label: 'Escopo',              modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.escopo' },
  { key: 'com_classificacao',  label: 'Classificação',       modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.classificacao::text' },
  { key: 'com_interesse',      label: 'Interesse',           modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.interesse::text' },
  { key: 'com_ramo',           label: 'Ramo do cliente',     modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'cli.ramo_atuacao::text' },
  { key: 'com_orcamentista',   label: 'Orçamentista',        modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'orc.nome' },
  { key: 'com_turno',          label: 'Turno',               modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'pt.turno' },
  // Métricas (colunas do banco)
  { key: 'com_hh_direto',      label: 'HH Direto',           modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.hh_direto', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'com_hh_indireto',    label: 'HH Indireto',         modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.hh_indireto', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'com_hh_total',       label: 'HH Total Previsto',   modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.hh_total', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'com_efetivo_pico',   label: 'Efetivo Pico',        modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.efetivo_pico', aggs: ['soma', 'media'], aggPadrao: 'media', formato: 'numero' },
  { key: 'com_dias_parada',    label: 'Dias de Parada',      modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.dias_parada', aggs: ['soma', 'media'], aggPadrao: 'media', formato: 'numero' },
  { key: 'com_peso_equip',     label: 'Peso Equipamentos (t)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.peso_equipamentos', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'decimal' },
  { key: 'com_peso_tub',       label: 'Peso Tubulações (t)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.peso_tubulacoes', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'decimal' },
  { key: 'com_peso_sup',       label: 'Peso Suportes (t)',   modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.peso_suportes', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'decimal' },
  { key: 'com_peso_estr',      label: 'Peso Estruturas (t)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.peso_estruturas', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'decimal' },
  { key: 'com_peso_total',     label: 'Peso Total (t)',      modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: PESO_TOTAL, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'decimal' },
  { key: 'com_valor_montagem', label: 'Valor Montagem (R$)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pc.valor_montagem_mecanica', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'com_valor_fab',      label: 'Fabricações (R$)',    modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pc.valor_fabricacao', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'com_valor_terc',     label: 'Terceiros (R$)',      modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pc.valor_terceiros', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'com_valor_total',    label: 'Valor Total da Proposta (R$)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pc.valor_total', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  // Calculados
  { key: 'com_rs_hh',          label: 'R$/HH',               modulo: 'comercial', grupo: 'Comercial', tipo: 'calc', num: 'pc.valor_total', den: 'pt.hh_total', formato: 'moeda' },
  { key: 'com_hh_ton',         label: 'HH/Ton',              modulo: 'comercial', grupo: 'Comercial', tipo: 'calc', num: 'pt.hh_total', den: PESO_TOTAL, formato: 'decimal' },
  { key: 'com_rs_kg',          label: 'R$/kg s/ Fab+Terc',   modulo: 'comercial', grupo: 'Comercial', tipo: 'calc', num: 'pc.valor_montagem_mecanica', den: `${PESO_TOTAL} * 1000`, formato: 'moeda' },

  // ════════════════ MÓDULO ACORDOS (grão: contrato) ═══════════════════════════
  // Dimensões
  { key: 'aco_contrato',       label: 'Nº Contrato',         modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.indice' },
  { key: 'aco_num_solic',      label: 'Nº Solicitação',      modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'sol.numero' },
  { key: 'aco_num_proposta',   label: 'Nº Proposta',         modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.num_proposta' },
  { key: 'aco_data_solic',     label: 'Mês/Ano da Solicitação', modulo: 'acordos', grupo: 'Acordos', tipo: 'data', dateCol: 'COALESCE(sol.data_recebimento, sol.created_at)' },
  { key: 'aco_cliente',        label: 'Cliente',             modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'cli.nome' },
  { key: 'aco_cliente_final',  label: 'Cliente Final',       modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'clf.nome' },
  { key: 'aco_cidade',         label: 'Cidade/UF',           modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: "NULLIF(CONCAT_WS('/', c.cidade, c.estado), '')" },
  { key: 'aco_escopo',         label: 'Escopo',              modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.descricao' },
  { key: 'aco_num_os',         label: 'Nº OS',               modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.num_os' },
  { key: 'aco_num_acordo',     label: 'Nº Acordo',           modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.num_acordo' },
  { key: 'aco_dt_inicio',      label: 'Dt. Início',          modulo: 'acordos', grupo: 'Acordos', tipo: 'data', dateCol: 'c.data_inicio' },
  { key: 'aco_dt_fim',         label: 'Dt. Fim',             modulo: 'acordos', grupo: 'Acordos', tipo: 'data', dateCol: 'c.data_fim' },
  { key: 'aco_responsavel',    label: 'Responsável',         modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'resp.nome' },
  { key: 'aco_ucr',            label: 'Classificação UCR',   modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: UCR_SQL },
  { key: 'aco_ase',            label: 'Serviço Extra — ASE', modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: ASE_SQL },
  // Métricas (colunas + subconsultas escalares por contrato)
  { key: 'aco_valor_contrato', label: 'Valor Total Contratado (R$)', modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: 'c.valor_contrato', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_faturado',       label: 'Valor Total Faturado (R$)',   modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: FATURADO, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_saldo',          label: 'Saldo a Faturar (R$)',        modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: `(COALESCE(c.valor_contrato, 0) - ${FATURADO})`, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_multas_qtd',     label: 'Multas/Penalidade (Qtde)',    modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: MULTAS_QTD, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'aco_multas_val',     label: 'Multas/Penalidade (R$)',      modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: MULTAS_VAL, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_nf_qtd',         label: 'NFs Lançadas (Qtde)',         modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: NF_QTD, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'aco_nf_val',         label: 'NFs Lançadas (R$)',           modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: NF_VAL, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_hh_prev',        label: 'HH Previsto (Orçamento)',     modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: HH_PREV, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'aco_hh_plan',        label: 'HH Plan (Planejado)',         modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: HH_PLAN, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'aco_hh_real',        label: 'HH Real (Realizado)',         modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: HH_REAL, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'aco_qtd_ocorr',      label: 'Qtde de Ocorrências',         modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: QTD_OCORRENCIAS, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  // Calculados
  { key: 'aco_pct_faturado',   label: '% do Total Faturado',         modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: FATURADO, den: 'c.valor_contrato', percent: true, formato: 'percent' },
  { key: 'aco_pct_r_prev',     label: '%R/Prev (Real vs Orçado)',    modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: HH_REAL, den: HH_PREV, percent: true, formato: 'percent' },
  { key: 'aco_pct_r_plan',     label: '%R/Plan (Real vs Planejado)', modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: HH_REAL, den: HH_PLAN, percent: true, formato: 'percent' },
  { key: 'aco_rs_hh_orc',      label: 'R$/HH Orç.',                  modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: 'c.valor_contrato', den: HH_PREV, formato: 'moeda' },
  { key: 'aco_rs_hh_prev',     label: 'R$/HH Prev.',                 modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: 'c.valor_contrato', den: HH_PLAN, formato: 'moeda' },
  { key: 'aco_rs_hh_real',     label: 'R$/HH Real',                  modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: FATURADO, den: HH_REAL, formato: 'moeda' },

  // ── Ocorrências (grão próprio; exibidas sob o grupo Acordos) ──
  { key: 'oco_tipo',            label: 'Tipos de Ocorrência', modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'dim', sql: 'o.tipo' },
  { key: 'oco_responsabilidade', label: 'Responsabilidade',   modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'dim', sql: 'o.responsabilidade' },
  { key: 'oco_data',           label: 'Mês/Ano da Ocorrência', modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'data', dateCol: 'o.data' },
  { key: 'oco_cliente',        label: 'Cliente (ocorrência)', modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'dim', sql: 'cli.nome' },
  { key: 'oco_contrato',       label: 'Nº Contrato (ocorrência)', modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'dim', sql: 'c.indice' },
  { key: 'oco_qtd',            label: 'Contagem de ocorrências', modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'met', sql: '1', count: true, aggs: ['contagem'], aggPadrao: 'contagem', formato: 'numero' },
  { key: 'oco_dias_notif',     label: 'Dias até notificação', modulo: 'ocorrencias', grupo: 'Acordos', tipo: 'met', sql: 'EXTRACT(EPOCH FROM (o.data_notificacao_cliente - o.data)) / 86400.0', aggs: ['media', 'soma'], aggPadrao: 'media', formato: 'decimal' },
]

const CAMPO_MAP = new Map(CAMPOS.map((c) => [c.key, c]))
export function getCampo(key: string): Campo | undefined { return CAMPO_MAP.get(key) }
export function moduloDoCampo(key: string): Modulo | undefined { return CAMPO_MAP.get(key)?.modulo }

// Versão pública (sem SQL) enviada ao frontend para montar o painel lateral.
export interface CampoPublico {
  key: string
  label: string
  modulo: Modulo
  grupo: string
  tipo: TipoCampo
  aggs?: Agregacao[]
  aggPadrao?: Agregacao
  formato?: Formato
  count?: boolean
}

export function camposPublicos(): CampoPublico[] {
  return CAMPOS.map((c) => ({
    key: c.key,
    label: c.label,
    modulo: c.modulo,
    grupo: c.grupo,
    tipo: c.tipo,
    ...(c.tipo === 'met' ? { aggs: c.aggs, aggPadrao: c.aggPadrao, formato: c.formato, count: c.count } : {}),
    ...(c.tipo === 'calc' ? { formato: c.formato } : {}),
  }))
}
