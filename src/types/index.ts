import type {
  Perfil,
  StatusSolicitacao,
  StatusAnalise,
  Classificacao,
  Interesse,
  Origem,
  MotivoPerda,
  Segmento,
  MotivoReprovacao,
} from '@prisma/client'

export type { Perfil, StatusSolicitacao, StatusAnalise, Classificacao, Interesse, Origem, MotivoPerda, Segmento, MotivoReprovacao }

// ─── Labels de exibição ───────────────────────────────────────────────────────

export const STATUS_ANALISE_LABELS: Record<StatusAnalise, string> = {
  AGUARDANDO: 'Em análise',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
}

export const STATUS_LABELS: Record<StatusSolicitacao, string> = {
  AGUARDANDO_ANALISE: 'Ag. análise',
  EM_ELABORACAO: 'Em elaboração',
  PROPOSTA_ENVIADA: 'Prop. enviada',
  CONTRATO_GANHO: 'Contrato ganho',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
}

export const CLASSIFICACAO_LABELS: Record<Classificacao, string> = {
  OBRAS: 'Obras',
  PARADAS: 'Paradas',
  OLEO_GAS: 'Óleo e Gás',
  FABRICACOES: 'Fabricações',
}

export const INTERESSE_LABELS: Record<Interesse, string> = {
  ALTO: 'Alto',
  MEDIO: 'Médio',
  BAIXO: 'Baixo',
}

export const ORIGEM_LABELS: Record<Origem, string> = {
  EMAIL: 'E-mail',
  TELEFONE: 'Telefone',
  VISITA: 'Visita',
  INDICACAO: 'Indicação',
  OUTRO: 'Outro',
}

export const MOTIVO_PERDA_LABELS: Record<MotivoPerda, string> = {
  PRECO: 'Preço',
  PRAZO: 'Prazo',
  ESCOPO: 'Escopo',
  CONCORRENCIA: 'Concorrência',
  CLIENTE_DESISTIU: 'Cliente desistiu',
  OUTRO: 'Outro',
}

export const SEGMENTO_LABELS: Record<Segmento, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose',
  SIDERURGIA: 'Siderurgia',
  OLEO_GAS: 'Óleo e Gás',
  OUTROS: 'Outros',
}

export const MOTIVO_REPROVACAO_LABELS: Record<MotivoReprovacao, string> = {
  VOLUME_ADJUDICADO: 'Volume de Serviços Adjudicados Para o Período',
  FORA_LINHA_FORNECIMENTO: 'Não Faz Parte da Linha de Fornecimento',
  INDISPONIBILIDADE_MO: 'Indisponibilidade de MO',
  SEM_SERVICO_LOCAL: 'Não Temos Serviço no Local',
  LIMITACAO_EQUIPAMENTOS: 'Limitação de Equipamentos',
  DIFICULDADE_PARCERIA: 'Dificuldade de Parceria',
  OUTROS: 'Outros',
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SolicitacaoListItem {
  id: number
  numero: string
  created_at: string
  cliente: { id: number; nome: string }
  cliente_final: { id: number; nome: string } | null
  contato: string | null
  cidade: string | null
  estado: string | null
  segmento: Segmento | null
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  status: StatusSolicitacao
  status_analise: StatusAnalise
  orcamentista: { id: number; nome: string } | null
  prazo_tecnica: string | null
  prazo_tecnica_indeterminado: boolean
  prazo_comercial: string | null
  prazo_comercial_indeterminado: boolean
  visita_tecnica: boolean
  versao_atual: number
  cancelled_at: string | null
  motivo_reprovacao: MotivoReprovacao | null
  obs_reprovacao: string | null
}

export interface SolicitacaoDetalhe extends SolicitacaoListItem {
  origem: Origem | null
  data_recebimento: string | null
  referencia_cliente: string | null
  comprador: string | null
  telefone_comprador: string | null
  email_comprador: string | null
  data_visita: string | null
  motivo_recusa: string | null
  cancel_reason: string | null
  criador: { id: number; nome: string }
  propostas_tecnicas: PropostaTecnicaItem[]
  propostas_comerciais: PropostaComercialItem[]
}

export interface PropostaTecnicaItem {
  id: number
  versao: number
  hh_direto: number | null
  hh_indireto: number | null
  peso_montagem: string | null
  data_envio: string | null
  created_at: string
}

export interface PropostaComercialItem {
  id: number
  versao: number
  valor_total: string | null
  data_envio: string | null
  resultado: string | null
  motivo_perda: MotivoPerda | null
  proposta_tecnica_id: number
  created_at: string
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export interface FiltrosSolicitacao {
  cliente?: string
  classificacao?: Classificacao | ''
  interesse?: Interesse | ''
  status?: StatusSolicitacao | ''
  orcamentista_id?: string
  data_de?: string
  data_ate?: string
  busca?: string
}

export interface PropostasItem {
  id: number
  numero: string
  created_at: string
  cliente: { id: number; nome: string }
  cidade: string | null
  estado: string | null
  escopo: string | null
  classificacao: Classificacao | null
  interesse: Interesse | null
  status: StatusSolicitacao
  orcamentista: { id: number; nome: string } | null
  prazo_tecnica: string | null
  prazo_comercial: string | null
  // Técnica (versão mais recente)
  versao_tecnica: number | null
  hh_direto: number | null
  hh_indireto: number | null
  hh_total: number | null
  perc_indireto: number | null
  peso_montagem: string | null
  data_envio_tecnica: string | null
  tecnica_atrasada: boolean
  // Comercial (versão mais recente)
  versao_comercial: number | null
  valor_total: string | null
  data_envio_comercial: string | null
  resultado: string | null
  comercial_atrasada: boolean
  // Histórico completo
  propostas_tecnicas: {
    id: number
    versao: number
    hh_direto: number | null
    hh_indireto: number | null
    hh_total: number | null
    peso_montagem: string | null
    peso_equipamentos: string | null
    peso_tubulacoes: string | null
    peso_suportes: string | null
    peso_estruturas: string | null
    efetivo_pico: number | null
    dias_parada: number | null
    turno: string | null
    finais_de_semana: boolean | null
    data_envio: string | null
  }[]
  propostas_comerciais: {
    id: number
    versao: number
    valor_montagem_mecanica: string | null
    possui_terceiros: boolean
    valor_eletrica: string | null
    valor_isolamento: string | null
    valor_civil: string | null
    valor_hidraulica: string | null
    valor_fibra: string | null
    valor_tijolo_antiacido: string | null
    valor_outros_terceiros: string | null
    possui_fabricacao: boolean
    valor_fabricacao: string | null
    valor_terceiros: string | null
    valor_total: string | null
    data_envio: string | null
    resultado: string | null
    motivo_perda: MotivoPerda | null
    proposta_tecnica_id: number
  }[]
  propostas_fabricacao: {
    id: number
    versao: number
    possui_testes: boolean
    descricao_testes: string | null
    valor_testes: string | null
    peso_total: string
    valor_total: string
    data_envio: string | null
    resultado: string | null
    motivo_perda: MotivoPerda | null
    equipamentos: {
      id: number
      ordem: number
      descricao: string
      peso_ton: string
      valor_total: string
      observacoes: string | null
    }[]
  }[]
}

export const RESULTADO_LABELS: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  GANHOU: 'Ganhou',
  PERDEU: 'Perdeu',
}

export interface AcordoListItem {
  id: number
  numero: string
  created_at: string
  cliente: { id: number; nome: string }
  descricao: string | null
  valor_total: number
  ano: number
  valor_anos_seguintes: number | null
  status: 'ATIVO' | 'ENCERRADO' | 'CANCELADO'
  data_inicio: string | null
  data_fim: string | null
  // Calculados RN-12 (apenas NFs ativas)
  total_nfs: number
  perc_executado: number
  saldo: number
  qt_nfs: number
  qt_nfs_ativas: number
}

export interface NotaFiscalItem {
  id: number
  numero_nf: string
  valor: number
  data_emissao: string
  data_vencimento: string
  ativa: boolean
  motivo_inativacao: string | null
  created_at: string
}

export interface NFListItem {
  id: number
  numero_nf: string
  valor: number
  data_emissao: string
  data_vencimento: string
  ativa: boolean
  motivo_inativacao: string | null
  created_at: string
  acordo_id: number
  acordo: {
    id: number
    numero: string
    ano: number
  }
  cliente: {
    id: number
    nome: string
  }
}

export type RamoAtuacao = 'PAPEL_CELULOSE' | 'SIDERURGIA' | 'MINERACAO' | 'OLEO_GAS' | 'OUTROS'

export const RAMO_ATUACAO_LABELS: Record<RamoAtuacao, string> = {
  PAPEL_CELULOSE: 'Papel e Celulose',
  SIDERURGIA: 'Siderurgia',
  MINERACAO: 'Mineração',
  OLEO_GAS: 'Óleo e Gás',
  OUTROS: 'Outros',
}

export const PERFIL_LABELS: Record<Perfil, string> = {
  ADM_COMERCIAL: 'ADM Comercial',
  GESTAO_COMERCIAL: 'Gestão Comercial',
  ORCAMENTISTA: 'Orçamentista',
  GESTAO_ACORDOS: 'Gestão Acordos',
  ACORDOS: 'Acordos',
  ADM_GERAL: 'ADM Geral',
}

export interface ClienteListItem {
  id: number
  nome: string
  cnpj: string | null
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
  cidade: string | null
  estado: string | null
  ramo_atuacao: RamoAtuacao | null
  ativo: boolean
  created_at: string
}

export interface UsuarioListItem {
  id: number
  nome: string
  email: string
  funcao: string | null
  perfil: Perfil
  ativo: boolean
  is_analista_critico: boolean
  created_at: string
}

export interface NotificacaoItem {
  id: number
  titulo: string
  mensagem: string
  lida: boolean
  link: string | null
  created_at: string
}

// ─── Controle de Faturamento ──────────────────────────────────────────────────

export type StatusFaturamento = 'A_FATURAR' | 'FATURADO' | 'PARCIAL' | 'CANCELADO'

export interface NFContratoItem {
  id: number
  numero_nf: string
  valor_total_nf: number
  percentual: number
  valor_atribuido: number
  data_emissao: string
  data_vencimento: string
  ativa: boolean
  motivo_inativacao: string | null
}

export interface SubIndiceItem {
  id: number
  contrato_id: number
  ordem: number
  descricao: string
  valor_total: number
  data_inicio: string | null
  data_fim: string | null
  comentarios: string | null
  jan: number | null
  fev: number | null
  mar: number | null
  abr: number | null
  mai: number | null
  jun: number | null
  jul: number | null
  ago: number | null
  set: number | null
  out: number | null
  nov: number | null
  dez: number | null
  total_faturado: number
  status_faturamento: 'A_FATURAR' | 'FATURADO' | 'PARCIAL'
  prev_anos_seguintes: number
  notas_fiscais: NFContratoItem[]
}

export interface ContratoItem {
  id: number
  indice: string
  ano_referencia: number
  status: StatusFaturamento
  cliente: { id: number; nome: string; ramo_atuacao?: string | null }
  responsavel: { id: number; nome: string } | null
  num_os: string | null
  num_acordo: string | null
  num_proposta: string | null
  data_inicio: string | null
  data_fim: string | null
  descricao: string | null
  classificacao: Classificacao | null
  valor_contrato: number | null
  cancelled_at: string | null
  prev_anos_seguintes: number
  subindices: SubIndiceItem[]
}

export interface NFContratoListItem {
  id: number
  numero_nf: string
  valor_total_nf: number
  percentual: number
  valor_atribuido: number
  data_emissao: string
  data_vencimento: string
  ativa: boolean
  motivo_inativacao: string | null
  created_at: string
  subindice: { id: number; ordem: number; descricao: string }
  contrato: { id: number; indice: string; num_acordo: string | null; num_proposta: string | null }
  cliente: { id: number; nome: string }
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  error: string | null
}
