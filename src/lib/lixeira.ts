// ─────────────────────────────────────────────────────────────────────────────
// Lixeira: itens excluídos ficam retidos por 15 dias (soft-delete) e podem ser
// restaurados. Após o prazo, são apagados definitivamente (expurgo "lazy",
// executado a cada acesso à lixeira — sem necessidade de cron).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export const LIXEIRA_RETENCAO_DIAS = 15

export type TipoLixeira = 'nf' | 'subindice' | 'multa' | 'ocorrencia' | 'informacao'

export const TIPO_LABELS: Record<TipoLixeira, string> = {
  nf: 'NF de contrato',
  subindice: 'Evento de medição',
  multa: 'Multa/Penalidade',
  ocorrencia: 'Ocorrência contratual',
  informacao: 'Informação da solicitação',
}

export function cutoffLixeira(): Date {
  return new Date(Date.now() - LIXEIRA_RETENCAO_DIAS * 86400000)
}

// Expurgo definitivo dos itens vencidos (best-effort; erros não bloqueiam).
export async function purgarVencidos(): Promise<void> {
  const cutoff = cutoffLixeira()
  const cond = { deleted_at: { not: null, lt: cutoff } }
  await Promise.allSettled([
    prisma.notaFiscalContrato.deleteMany({ where: cond }),
    // Sub-índices vencidos: apaga NFs filhas primeiro (cascade cobre, mas explícito)
    prisma.subIndiceFaturamento.deleteMany({ where: cond }),
    prisma.multaPenalidade.deleteMany({ where: cond }),
    prisma.ocorrenciaContratual.deleteMany({ where: cond }),
    prisma.solicitacaoInfo.deleteMany({ where: cond }),
  ])
}
