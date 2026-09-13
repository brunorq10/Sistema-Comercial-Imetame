import { prisma } from '@/lib/prisma'
import { createNotificacao } from '@/lib/notifications'

// Resolve nomes de titulares substituídos (substituto_de_id) para exibição nas
// telas de histórico — "alterado por X, em substituição a Y". Usado pelas rotas
// GET de histórico (Solicitação/Contrato/SubÍndice), que gravam só o id (coluna
// sem relation, mesmo padrão de solicitado_por/revisado_por já usado no schema).
export async function resolverNomesSubstituto(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const unicos = Array.from(new Set(ids.filter((id): id is number => id != null)))
  if (unicos.length === 0) return new Map()
  const usuarios = await prisma.user.findMany({ where: { id: { in: unicos } }, select: { id: true, nome: true } })
  return new Map(usuarios.map((u) => [u.id, u.nome]))
}

// Roda a troca de titularidade de fato: atualiza Solicitacao.orcamentista_id /
// Contrato.responsavel_id item a item, grava histórico (autor = quem efetuou a
// operação — "ações do passado nunca mudam de autor") e notifica os envolvidos.
// Chamado tanto no POST de criação (quando data_efetivacao <= hoje) quanto pelo
// cron diário (para operações agendadas cuja data chegou).
//
// Observação sobre substituições vigentes: nenhuma substituição temporária é
// alterada aqui de propósito — ela continua apontando para o titular_id
// original, e como a checagem de titularidade (ehDonoOuSubstituto) compara
// contra o campo orcamentista_id/responsavel_id ATUAL do registro, o substituto
// perde acesso automaticamente aos itens que mudaram de dono e mantém acesso
// normal aos que não mudaram — sem precisar de nenhuma migração manual.
export async function efetivarTransferencia(transferenciaId: number): Promise<void> {
  const transf = await prisma.transferenciaResponsabilidade.findUnique({
    where: { id: transferenciaId },
    include: {
      itens: true,
      origem: { select: { id: true, nome: true } },
      destino: { select: { id: true, nome: true } },
    },
  })
  if (!transf || transf.efetivada_em) return

  await prisma.$transaction(async (tx) => {
    for (const item of transf.itens) {
      if (item.tipo_item === 'SOLICITACAO') {
        await tx.solicitacao.update({ where: { id: item.item_id }, data: { orcamentista_id: item.responsavel_novo_id } })
        await tx.historicoSolicitacao.create({
          data: {
            solicitacao_id: item.item_id,
            campo: 'orcamentista',
            valor_de: String(item.responsavel_anterior_id),
            valor_para: String(item.responsavel_novo_id),
            created_by: transf.created_by,
          },
        })
      } else {
        await tx.contrato.update({ where: { id: item.item_id }, data: { responsavel_id: item.responsavel_novo_id } })
        await tx.historicoContrato.create({
          data: {
            contrato_id: item.item_id,
            campo: 'responsavel',
            valor_de: String(item.responsavel_anterior_id),
            valor_para: String(item.responsavel_novo_id),
            created_by: transf.created_by,
          },
        })
      }
    }
    await tx.transferenciaResponsabilidade.update({ where: { id: transferenciaId }, data: { efetivada_em: new Date() } })
  })

  const nSol = transf.itens.filter((i) => i.tipo_item === 'SOLICITACAO').length
  const nCt = transf.itens.filter((i) => i.tipo_item === 'CONTRATO').length
  const resumo = `${nSol} solicitação(ões) e ${nCt} contrato(s).`

  if (transf.tipo === 'TROCA') {
    createNotificacao(transf.origem_id, 'Troca de responsabilidade efetivada', `A troca de itens entre você e ${transf.destino.nome} foi efetivada. Resumo: ${resumo}`)
    createNotificacao(transf.destino_id, 'Troca de responsabilidade efetivada', `A troca de itens entre você e ${transf.origem.nome} foi efetivada. Resumo: ${resumo}`)
  } else {
    createNotificacao(transf.origem_id, 'Transferência efetivada', `Seus itens foram transferidos para ${transf.destino.nome}. Resumo: ${resumo}`)
    createNotificacao(transf.destino_id, 'Transferência efetivada', `Você recebeu itens de ${transf.origem.nome}. Resumo: ${resumo}`)
  }
}

// Roda todas as transferências/trocas com data_efetivacao já vencida e ainda
// não efetivadas — usado tanto pelo cron diário quanto, defensivamente, se
// alguém acessar a listagem antes do cron rodar num dia em que uma operação
// "agendada" já deveria ter virado "efetivada".
export async function efetivarTransferenciasVencidas(): Promise<number> {
  const hoje = new Date()
  const pendentes = await prisma.transferenciaResponsabilidade.findMany({
    where: { efetivada_em: null, data_efetivacao: { lte: hoje } },
    select: { id: true },
  })
  for (const p of pendentes) await efetivarTransferencia(p.id)
  return pendentes.length
}
