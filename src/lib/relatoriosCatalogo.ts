// Catálogo estático dos relatórios pré-definidos — só metadados (nome,
// descrição, território) para a biblioteca e a busca. A implementação de
// cada relatório (colunas, filtros, dados) vive em
// src/components/relatorios/*Reports.tsx.

export interface RelatorioMeta {
  codigo: string
  titulo: string
  descricao: string
  territorio: string
}

export const TERRITORIOS: { key: string; label: string }[] = [
  { key: 'comercial', label: 'Comercial' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'contratos', label: 'Contratos e Execução' },
  { key: 'ocorrencias', label: 'Eventos Contratuais' },
  { key: 'cruzamento', label: 'Análises Cruzadas (Comercial × Acordos)' },
  { key: 'gestao', label: 'Gestão e Capacidade' },
]

export const CATALOGO: RelatorioMeta[] = [
  // ── Comercial ──────────────────────────────────────────────────────────────
  { codigo: 'com-01', titulo: 'Funil de Solicitações', descricao: 'Quantas solicitações estão em cada etapa, e onde elas estão empacando.', territorio: 'comercial' },
  { codigo: 'com-02', titulo: 'Propostas Paradas e Atrasadas', descricao: 'Propostas sem envio, vencidas ou perto de vencer, por orçamentista.', territorio: 'comercial' },
  { codigo: 'com-03', titulo: 'Motivos de Perda e Recusa', descricao: 'Por que estamos perdendo negócio — reprovação e perda, lado a lado.', territorio: 'comercial' },
  { codigo: 'com-04', titulo: 'Desempenho por Orçamentista', descricao: 'Carteira, prazo, propostas ganhas e valor ganho, por pessoa.', territorio: 'comercial' },
  { codigo: 'com-05', titulo: 'Pipeline em Valor', descricao: 'Quanto vale, em R$, tudo que ainda está em negociação.', territorio: 'comercial' },
  { codigo: 'com-06', titulo: 'Ciclo Comercial', descricao: 'Tempo médio do recebimento até o envio da proposta comercial.', territorio: 'comercial' },

  // ── Clientes ───────────────────────────────────────────────────────────────
  { codigo: 'cli-01', titulo: 'Concentração de Carteira', descricao: 'Curva ABC de clientes por faturamento, com % acumulado.', territorio: 'clientes' },
  { codigo: 'cli-02', titulo: 'Ficha do Cliente', descricao: 'Histórico completo de um cliente — solicitações, contratos, faturamento, ocorrências e multas.', territorio: 'clientes' },
  { codigo: 'cli-03', titulo: 'Ranking por Segmento e Ramo', descricao: 'Faturamento por ramo de atuação e solicitações por segmento.', territorio: 'clientes' },
  { codigo: 'cli-04', titulo: 'Clientes Recorrentes x Novos', descricao: 'Quantos clientes são novos no período e quanto de receita vem de cada grupo.', territorio: 'clientes' },

  // ── Faturamento ────────────────────────────────────────────────────────────
  { codigo: 'fat-01', titulo: 'Previsto x Realizado do Ano', descricao: 'Faturamento previsto e realizado, mês a mês, com percentual de atingimento.', territorio: 'faturamento' },
  { codigo: 'fat-02', titulo: 'Saldo a Faturar', descricao: 'Cada contrato ativo, valor total, faturado e saldo pendente.', territorio: 'faturamento' },
  { codigo: 'fat-03', titulo: 'Evolução Multi-Ano', descricao: 'Faturamento mês a mês comparado entre os últimos anos.', territorio: 'faturamento' },
  { codigo: 'fat-04', titulo: 'Faturamento por Classificação', descricao: 'De onde vem o faturamento — Obras, Paradas, Fabricação ou Óleo e Gás.', territorio: 'faturamento' },
  { codigo: 'fat-05', titulo: 'Aderência da Previsão', descricao: 'Previsto x faturado de um mês específico, contrato a contrato.', territorio: 'faturamento' },
  { codigo: 'fat-06', titulo: 'NFs Pendentes de Aprovação', descricao: 'Lançamentos e edições de NF esperando aprovação, com dias em espera.', territorio: 'faturamento' },

  // ── Contratos e Execução ───────────────────────────────────────────────────
  { codigo: 'ctr-01', titulo: 'Carteira Ativa de Contratos', descricao: 'Todos os contratos ativos, com valor, classificação e responsável.', territorio: 'contratos' },
  { codigo: 'ctr-02', titulo: 'Aderência de HH', descricao: 'Homem-hora previsto x realizado, por contrato de Obras e Paradas.', territorio: 'contratos' },
  { codigo: 'ctr-03', titulo: 'Avanço de Fabricação', descricao: 'Peso e HH previsto x realizado, por item de fabricação.', territorio: 'contratos' },
  { codigo: 'ctr-04', titulo: 'R$/HH por Contrato (UCR)', descricao: 'Rentabilidade operacional dos contratos de Parada e a faixa UCR de cada um.', territorio: 'contratos' },
  { codigo: 'ctr-05', titulo: 'Contratos Encerrando', descricao: 'Contratos com data de fim próxima, cruzado com propostas em andamento do mesmo cliente.', territorio: 'contratos' },

  // ── Eventos Contratuais ────────────────────────────────────────────────────
  { codigo: 'ocm-01', titulo: 'Ocorrências Contratuais', descricao: 'Lista de ocorrências por contrato, tipo e responsabilidade.', territorio: 'ocorrencias' },
  { codigo: 'ocm-02', titulo: 'Multas e Penalidades', descricao: 'Lista de multas, glosas e reembolsos lançados, com valor.', territorio: 'ocorrencias' },
  { codigo: 'ocm-03', titulo: 'Reincidência por Cliente', descricao: 'Ocorrências e multas por cliente, normalizado pelo nº de contratos ativos.', territorio: 'ocorrencias' },

  // ── Análises Cruzadas ──────────────────────────────────────────────────────
  { codigo: 'crz-01', titulo: 'Orçado x Executado', descricao: 'HH orçado na proposta comparado ao HH realizado na execução, por contrato.', territorio: 'cruzamento' },
  { codigo: 'crz-02', titulo: 'Rentabilidade Real', descricao: 'R$/HH vendido na proposta x R$/HH realizado na execução.', territorio: 'cruzamento' },
  { codigo: 'crz-03', titulo: 'Ciclo de Vida do Negócio', descricao: 'Linha do tempo de um contrato, da solicitação de origem ao encerramento.', territorio: 'cruzamento' },

  // ── Gestão e Capacidade ────────────────────────────────────────────────────
  { codigo: 'gst-01', titulo: 'Carga de Trabalho', descricao: 'Solicitações e contratos ativos sob responsabilidade de cada pessoa.', territorio: 'gestao' },
  { codigo: 'gst-02', titulo: 'Projeção de Faturamento Futuro', descricao: 'Valor já garantido para os próximos anos e pipeline ainda em negociação.', territorio: 'gestao' },
]
