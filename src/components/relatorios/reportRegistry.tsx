import type { ComponentType } from 'react'
import { Com01Funil, Com02Atrasadas, Com03Motivos, Com04Orcamentistas, Com05Pipeline, Com06Ciclo } from './reports/ComercialReports'
import { Cli01CurvaAbc, Cli02Ficha, Cli03Ranking, Cli04Recorrentes } from './reports/ClientesReports'
import { Fat01Mensal, Fat02Saldo, Fat03Evolucao, Fat04PorClassificacao, Fat05Aderencia, Fat06Pendencias } from './reports/FaturamentoReports'
import { Ctr01Carteira, Ctr02Hh, Ctr03Fabricacao, Ctr04Ucr, Ctr05Encerrando } from './reports/ContratosReports'
import { Ocm01Ocorrencias, Ocm02Multas, Ocm03Reincidencia } from './reports/OcorrenciasReports'
import { Crz01OrcadoExecutado, Crz02Rentabilidade, Crz03Timeline } from './reports/CruzamentoReports'
import { Gst01Carga, Gst02Projecao } from './reports/GestaoReports'

// Mapeia o código do relatório (URL /relatorios/[codigo]) para o componente
// que efetivamente busca os dados e renderiza a tabela.
export const REPORT_REGISTRY: Record<string, ComponentType> = {
  'com-01': Com01Funil,
  'com-02': Com02Atrasadas,
  'com-03': Com03Motivos,
  'com-04': Com04Orcamentistas,
  'com-05': Com05Pipeline,
  'com-06': Com06Ciclo,

  'cli-01': Cli01CurvaAbc,
  'cli-02': Cli02Ficha,
  'cli-03': Cli03Ranking,
  'cli-04': Cli04Recorrentes,

  'fat-01': Fat01Mensal,
  'fat-02': Fat02Saldo,
  'fat-03': Fat03Evolucao,
  'fat-04': Fat04PorClassificacao,
  'fat-05': Fat05Aderencia,
  'fat-06': Fat06Pendencias,

  'ctr-01': Ctr01Carteira,
  'ctr-02': Ctr02Hh,
  'ctr-03': Ctr03Fabricacao,
  'ctr-04': Ctr04Ucr,
  'ctr-05': Ctr05Encerrando,

  'ocm-01': Ocm01Ocorrencias,
  'ocm-02': Ocm02Multas,
  'ocm-03': Ocm03Reincidencia,

  'crz-01': Crz01OrcadoExecutado,
  'crz-02': Crz02Rentabilidade,
  'crz-03': Crz03Timeline,

  'gst-01': Gst01Carga,
  'gst-02': Gst02Projecao,
}
