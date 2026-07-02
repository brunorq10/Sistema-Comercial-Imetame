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

export type Modulo = 'comercial' | 'acordos' | 'ocorrencias' | 'hh'
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

export const BASES: Record<Modulo, BaseConfig> = {
  comercial: {
    from: `solicitacoes s
      LEFT JOIN clientes cli ON cli.id = s.cliente_id
      LEFT JOIN users orc ON orc.id = s.orcamentista_id
      LEFT JOIN LATERAL (
        SELECT pc.valor_total, pc.resultado, pc.motivo_perda, pc.data_envio
        FROM propostas_comerciais pc
        WHERE pc.solicitacao_id = s.id
        ORDER BY pc.versao DESC LIMIT 1
      ) pc ON true
      LEFT JOIN LATERAL (
        SELECT pt.hh_total, pt.peso_montagem
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
    // Inclui a proposta de ORIGEM (via solicitação) — grão do contrato, uma
    // proposta por contrato, sem duplicação. Permite cruzar faturado × proposta.
    from: `contratos c
      LEFT JOIN clientes cli ON cli.id = c.cliente_id
      LEFT JOIN users resp ON resp.id = c.responsavel_id
      LEFT JOIN LATERAL (
        SELECT pc.valor_total FROM propostas_comerciais pc
        WHERE pc.solicitacao_id = c.solicitacao_id ORDER BY pc.versao DESC LIMIT 1
      ) pcorig ON true
      LEFT JOIN LATERAL (
        SELECT pt.hh_total FROM propostas_tecnicas pt
        WHERE pt.solicitacao_id = c.solicitacao_id ORDER BY pt.versao DESC LIMIT 1
      ) ptorig ON true`,
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
    where: 'c.cancelled_at IS NULL',
    dataPadrao: 'o.data',
    dataPadraoLabel: 'Data da ocorrência',
    clienteCol: 'c.cliente_id',
    responsavelCol: 'c.responsavel_id',
  },
  // HH (Obras): UNION de previsto/planejado (última versão do lançamento) +
  // realizado, no grão (contrato, ano, mês). SUM não duplica pois cada fonte
  // preenche só as suas colunas. Paradas/Fabricações têm modelos próprios e
  // NÃO entram aqui (documentado).
  hh: {
    from: `(
        SELECT hl.contrato_id AS contrato_id, hm.ano AS ano, hm.mes AS mes,
               COALESCE(hm.hh_previsto, 0) AS hh_previsto, COALESCE(hm.hh_planejado, 0) AS hh_planejado, 0 AS hh_realizado
        FROM hh_lancamento_mes hm
        JOIN hh_lancamentos hl ON hl.id = hm.lancamento_id
        JOIN (SELECT contrato_id, MAX(versao) AS v FROM hh_lancamentos GROUP BY contrato_id) ult
          ON ult.contrato_id = hl.contrato_id AND ult.v = hl.versao
        UNION ALL
        SELECT hr.contrato_id, hr.ano, hr.mes, 0, 0, COALESCE(hr.hh_realizado, 0)
        FROM hh_realizado hr
      ) hh
      JOIN contratos c ON c.id = hh.contrato_id
      LEFT JOIN clientes cli ON cli.id = c.cliente_id
      LEFT JOIN users resp ON resp.id = c.responsavel_id`,
    where: 'c.cancelled_at IS NULL AND c.hh_cancelado_at IS NULL',
    dataPadrao: 'make_date(hh.ano, hh.mes, 1)',
    dataPadraoLabel: 'Mês/Ano (HH)',
    clienteCol: 'c.cliente_id',
    responsavelCol: 'c.responsavel_id',
  },
}

// Subqueries escalares reutilizadas nas métricas derivadas de Acordos.
const FATURADO = `(SELECT COALESCE(SUM(nf.valor_atribuido), 0)
  FROM notas_fiscais_contratos nf
  JOIN subindices_faturamento si ON si.id = nf.subindice_id
  WHERE si.contrato_id = c.id AND nf.ativa = true AND nf.status_aprovacao = 'APROVADO')`
const MULTAS = `(SELECT COALESCE(SUM(m.valor_total), 0)
  FROM multas_penalidades m WHERE m.contrato_id = c.id AND m.ativa = true)`
const QTD_OCORRENCIAS = `(SELECT COUNT(*) FROM ocorrencias_contratuais o WHERE o.contrato_id = c.id)`

// ── Catálogo de campos ───────────────────────────────────────────────────────

export const CAMPOS: Campo[] = [
  // ══ COMERCIAL — dimensões ══
  { key: 'com_cliente',        label: 'Cliente',            modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'cli.nome' },
  { key: 'com_classificacao',  label: 'Classificação',      modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.classificacao::text' },
  { key: 'com_segmento',       label: 'Mercado (segmento)', modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.segmento::text' },
  { key: 'com_resultado',      label: 'Resultado',          modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'pc.resultado' },
  { key: 'com_motivo_perda',   label: 'Motivo de perda',    modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'pc.motivo_perda::text' },
  { key: 'com_orcamentista',   label: 'Orçamentista',       modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'orc.nome' },
  { key: 'com_interesse',      label: 'Nível de interesse', modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.interesse::text' },
  { key: 'com_status',         label: 'Status',             modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 's.status::text' },
  { key: 'com_estado',         label: 'Estado (UF)',        modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'COALESCE(s.estado, cli.estado)' },
  { key: 'com_ramo',           label: 'Ramo do cliente',    modulo: 'comercial', grupo: 'Comercial', tipo: 'dim', sql: 'cli.ramo_atuacao::text' },
  // COMERCIAL — datas
  { key: 'com_data_solic',     label: 'Mês/Ano da solicitação', modulo: 'comercial', grupo: 'Comercial', tipo: 'data', dateCol: 'COALESCE(s.data_recebimento, s.created_at)' },
  { key: 'com_data_envio',     label: 'Mês/Ano do envio',       modulo: 'comercial', grupo: 'Comercial', tipo: 'data', dateCol: 'pc.data_envio' },
  // COMERCIAL — métricas
  { key: 'com_qtd',            label: 'Qtde de solicitações', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: '1', count: true, aggs: ['contagem'], aggPadrao: 'contagem', formato: 'numero' },
  { key: 'com_valor',          label: 'Valor da proposta (R$)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pc.valor_total', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'com_hh',             label: 'HH previsto',        modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.hh_total', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'com_peso',           label: 'Peso de montagem (ton)', modulo: 'comercial', grupo: 'Comercial', tipo: 'met', sql: 'pt.peso_montagem', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'decimal' },
  // COMERCIAL — calculados
  { key: 'com_rs_hh',          label: 'R$/HH',  modulo: 'comercial', grupo: 'Comercial', tipo: 'calc', num: 'pc.valor_total', den: 'pt.hh_total', formato: 'moeda' },
  { key: 'com_rs_ton',         label: 'R$/ton', modulo: 'comercial', grupo: 'Comercial', tipo: 'calc', num: 'pc.valor_total', den: 'pt.peso_montagem', formato: 'moeda' },

  // ══ ACORDOS (Controle de Faturamento) — dimensões ══
  { key: 'aco_contrato',       label: 'Nº Contrato',        modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.indice' },
  { key: 'aco_cliente',        label: 'Cliente',            modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'cli.nome' },
  { key: 'aco_responsavel',    label: 'Responsável',        modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'resp.nome' },
  { key: 'aco_status',         label: 'Status faturamento', modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.status::text' },
  { key: 'aco_classificacao',  label: 'Classificação',      modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.classificacao::text' },
  { key: 'aco_estado',         label: 'Estado (UF)',        modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.estado' },
  { key: 'aco_ramo',           label: 'Ramo do cliente',    modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'cli.ramo_atuacao::text' },
  { key: 'aco_ano_ref',        label: 'Ano de referência',  modulo: 'acordos', grupo: 'Acordos', tipo: 'dim', sql: 'c.ano_referencia::text' },
  // ACORDOS — datas
  { key: 'aco_data_inicio',    label: 'Mês/Ano de início',  modulo: 'acordos', grupo: 'Acordos', tipo: 'data', dateCol: 'c.data_inicio' },
  // ACORDOS — métricas
  { key: 'aco_qtd',            label: 'Qtde de contratos',  modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: '1', count: true, aggs: ['contagem'], aggPadrao: 'contagem', formato: 'numero' },
  { key: 'aco_valor_contrato', label: 'Valor contratado (R$)', modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: 'c.valor_contrato', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_faturado',       label: 'Total faturado (R$)',   modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: FATURADO, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_saldo',          label: 'Saldo a faturar (R$)',  modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: `(COALESCE(c.valor_contrato, 0) - ${FATURADO})`, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_multas',         label: 'Total de multas (R$)',  modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: MULTAS, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_qtd_ocorr',      label: 'Qtde de ocorrências',   modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: QTD_OCORRENCIAS, aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  // ACORDOS — proposta de origem (inter-módulos, grão do contrato)
  { key: 'aco_valor_proposta', label: 'Valor da proposta de origem (R$)', modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: 'pcorig.valor_total', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'moeda' },
  { key: 'aco_hh_proposta',    label: 'HH previsto (proposta)', modulo: 'acordos', grupo: 'Acordos', tipo: 'met', sql: 'ptorig.hh_total', aggs: ['soma', 'media'], aggPadrao: 'soma', formato: 'numero' },
  // ACORDOS — calculados
  { key: 'aco_pct_faturado',   label: '% faturado', modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: FATURADO, den: 'c.valor_contrato', percent: true, formato: 'percent' },
  { key: 'aco_fat_vs_prop',    label: '% faturado sobre a proposta', modulo: 'acordos', grupo: 'Acordos', tipo: 'calc', num: FATURADO, den: 'pcorig.valor_total', percent: true, formato: 'percent' },

  // ══ OCORRÊNCIAS — dimensões ══
  { key: 'oco_tipo',            label: 'Tipo de ocorrência', modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'o.tipo' },
  { key: 'oco_responsabilidade', label: 'Responsabilidade', modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'o.responsabilidade' },
  { key: 'oco_cliente',        label: 'Cliente',            modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'cli.nome' },
  { key: 'oco_responsavel',    label: 'Responsável',        modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'resp.nome' },
  { key: 'oco_contrato',       label: 'Nº Contrato',        modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'c.indice' },
  { key: 'oco_classificacao',  label: 'Classificação',      modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'c.classificacao::text' },
  { key: 'oco_estado',         label: 'Estado (UF)',        modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'dim', sql: 'c.estado' },
  // OCORRÊNCIAS — data
  { key: 'oco_data',           label: 'Mês/Ano da ocorrência', modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'data', dateCol: 'o.data' },
  // OCORRÊNCIAS — métricas
  { key: 'oco_qtd',            label: 'Qtde de ocorrências', modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'met', sql: '1', count: true, aggs: ['contagem'], aggPadrao: 'contagem', formato: 'numero' },
  { key: 'oco_dias_notif',     label: 'Dias até notificação', modulo: 'ocorrencias', grupo: 'Ocorrências', tipo: 'met', sql: 'EXTRACT(EPOCH FROM (o.data_notificacao_cliente - o.data)) / 86400.0', aggs: ['media', 'soma'], aggPadrao: 'media', formato: 'decimal' },

  // ══ CONTROLE DE HH (Obras) — dimensões ══
  { key: 'hh_tipo',            label: 'Tipo de HH',      modulo: 'hh', grupo: 'Controle de HH', tipo: 'dim', sql: 'c.classificacao::text' },
  { key: 'hh_cliente',         label: 'Cliente',         modulo: 'hh', grupo: 'Controle de HH', tipo: 'dim', sql: 'cli.nome' },
  { key: 'hh_responsavel',     label: 'Responsável',     modulo: 'hh', grupo: 'Controle de HH', tipo: 'dim', sql: 'resp.nome' },
  { key: 'hh_contrato',        label: 'Nº Contrato',     modulo: 'hh', grupo: 'Controle de HH', tipo: 'dim', sql: 'c.indice' },
  { key: 'hh_estado',          label: 'Estado (UF)',     modulo: 'hh', grupo: 'Controle de HH', tipo: 'dim', sql: 'c.estado' },
  { key: 'hh_ano',             label: 'Ano (HH)',        modulo: 'hh', grupo: 'Controle de HH', tipo: 'dim', sql: 'hh.ano::text' },
  // HH — data
  { key: 'hh_data',            label: 'Mês/Ano (HH)',    modulo: 'hh', grupo: 'Controle de HH', tipo: 'data', dateCol: 'make_date(hh.ano, hh.mes, 1)' },
  // HH — métricas
  { key: 'hh_previsto',        label: 'HH previsto',     modulo: 'hh', grupo: 'Controle de HH', tipo: 'met', sql: 'hh.hh_previsto', aggs: ['soma'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'hh_planejado',       label: 'HH planejado',    modulo: 'hh', grupo: 'Controle de HH', tipo: 'met', sql: 'hh.hh_planejado', aggs: ['soma'], aggPadrao: 'soma', formato: 'numero' },
  { key: 'hh_realizado',       label: 'HH realizado',    modulo: 'hh', grupo: 'Controle de HH', tipo: 'met', sql: 'hh.hh_realizado', aggs: ['soma'], aggPadrao: 'soma', formato: 'numero' },
  // HH — calculado
  { key: 'hh_desvio',          label: 'Desvio de HH (%)', modulo: 'hh', grupo: 'Controle de HH', tipo: 'calc', num: '(hh.hh_realizado - hh.hh_planejado)', den: 'hh.hh_planejado', percent: true, formato: 'percent' },
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
