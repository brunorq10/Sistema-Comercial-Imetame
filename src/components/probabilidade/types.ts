import type { Classificacao, Interesse, Segmento, NivelProbabilidade } from '@/types'

export interface ProbabilidadeItem {
  solicitacao_id: number
  numero: string
  classificacao: Classificacao | null
  cliente: { id: number; nome: string }
  cidade: string | null
  estado: string | null
  escopo: string | null
  orcamentista: { id: number; nome: string } | null
  interesse: Interesse | null
  segmento: Segmento | null
  valor_total: number | null
  data_envio: string | null
  nivel: NivelProbabilidade | null
  revisado_em: string | null
  revisado_por: string | null
}
