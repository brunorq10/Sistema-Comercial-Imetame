// ════════════════════════════════════════════════════════════════════════════
// Painel "Probabilidade de fechamento" (módulo Comercial, aba de Propostas) —
// helpers compartilhados entre as rotas de API. Uma "proposta comercial" pode
// viver em dois lugares diferentes conforme a classificação da solicitação:
// Obras/Paradas usam PropostaComercial; Fabricações/Óleo e Gás usam
// PropostaFabricacao (mesmo padrão já usado em /api/propostas e PropostasTable).
// ════════════════════════════════════════════════════════════════════════════

import type { Classificacao, NivelProbabilidade } from '@prisma/client'

export const NIVEL_LABEL: Record<NivelProbabilidade, string> = {
  ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa', BUDGET: 'Budget',
}

/** Fabricações/Óleo e Gás resolvem a proposta "comercial" a partir de PropostaFabricacao, não PropostaComercial. */
export function usaPropostaFabricacao(classificacao: Classificacao | null): boolean {
  return classificacao === 'FABRICACOES' || classificacao === 'OLEO_GAS'
}

// Formato mínimo necessário de uma Solicitacao (com a última versão de cada
// pipeline incluída, orderBy versao desc, take 1) para resolver a proposta atual.
export interface SolicitacaoComPropostas {
  classificacao: Classificacao | null
  propostas_comerciais: { data_envio: Date | null; resultado: string | null; valor_total: unknown }[]
  propostas_fabricacao: { data_envio: Date | null; resultado: string | null; valor_total: unknown }[]
}

export interface PropostaAtual {
  enviada: boolean
  aberta: boolean
  resultado: string | null
  valorTotal: number | null
  dataEnvio: Date | null
}

/** Resolve a proposta comercial "atual" (última versão) de uma solicitação, seja ela PropostaComercial ou PropostaFabricacao. */
export function resolverPropostaAtual(s: SolicitacaoComPropostas): PropostaAtual {
  const fonte = usaPropostaFabricacao(s.classificacao) ? s.propostas_fabricacao[0] : s.propostas_comerciais[0]
  const enviada = fonte?.data_envio != null
  const resultado = fonte?.resultado ?? null
  return {
    enviada,
    aberta: enviada && resultado == null,
    resultado,
    valorTotal: fonte?.valor_total != null ? Number(String(fonte.valor_total)) : null,
    dataEnvio: fonte?.data_envio ?? null,
  }
}
