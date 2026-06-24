'use client'

import { useSession } from 'next-auth/react'
import type { Perfil } from '@/types'
import { pode as podeLib, ehDono as ehDonoLib, type Permissao, type Usuario, type TipoRegistro } from '@/lib/permissoes'

const GRUPOS = {
  gestores: ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ADM_GERAL'] as Perfil[],
  comercial: ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ORCAMENTISTA', 'ADM_GERAL'] as Perfil[],
  acordos: ['ADM_COMERCIAL', 'GESTAO_ACORDOS', 'ACORDOS', 'ADM_GERAL'] as Perfil[],
  admin: ['ADM_COMERCIAL', 'ADM_GERAL'] as Perfil[],
}

export function usePermissions() {
  const { data: session, status } = useSession()
  const perfil = session?.user?.perfil
  const isAnalistaCritico = session?.user?.is_analista_critico ?? false

  const is = (...perfis: Perfil[]) => !!perfil && perfis.includes(perfil)
  const inGroup = (grupo: keyof typeof GRUPOS) => !!perfil && GRUPOS[grupo].includes(perfil)

  // ── Novo controle de acesso (matriz da planilha) ──────────────────────────
  const usuario: Usuario | null = perfil
    ? { id: session?.user?.id ? Number(session.user.id) : 0, perfil: perfil as Usuario['perfil'], is_analista_critico: isAnalistaCritico }
    : null
  const pode = (permissao: Permissao, opts?: { ehDono?: boolean }) => podeLib(usuario, permissao, opts)
  const ehDono = (registro: { orcamentista_id?: number | null; responsavel_id?: number | null; created_by?: number | null } | null | undefined, tipo: TipoRegistro) =>
    ehDonoLib(usuario, registro, tipo)

  // ADM_GERAL is sovereign — unrestricted access to everything
  const isAdmGeral = is('ADM_GERAL')
  const can = (check: boolean) => isAdmGeral || check

  return {
    perfil,
    userId: session?.user?.id ? Number(session.user.id) : null,
    userName: session?.user?.nome ?? '',
    isAnalistaCritico,
    isLoading: status === 'loading',

    // Verificação por permissão (matriz). pode('chave', { ehDono }) e ehDono(registro, tipo).
    pode,
    ehDono,

    // Solicitações (matriz: criar/editar/revisão/cancelar = ADM_COMERCIAL + Analista)
    canCreateSolicitacao: pode('orc.solicitacao.criar'),
    canEditSolicitacao: pode('orc.solicitacao.editar'),
    canCancelSolicitacao: pode('orc.solicitacao.cancelar'),
    canAtribuirOrcamentista: pode('orc.analise.decidir'),
    canRecusarSolicitacao: pode('orc.analise.decidir'),
    canVerTodasSolicitacoes: pode('orc.analise.ver'),
    canCriarRevisao: pode('orc.solicitacao.revisao'),
    canTransferirOrcamentista: pode('orc.solicitacao.editar'),
    canAnalisarSolicitacao: pode('orc.analise.decidir'),

    // Propostas (matriz: enviar/editar = Orçamentista no próprio registro)
    canRegistrarTecnica: pode('orc.proposta.enviar', { ehDono: true }),
    canRegistrarComercial: pode('orc.proposta.enviar', { ehDono: true }),

    // Acordos
    canGerirAcordos: can(inGroup('acordos')),
    canLancarNF: pode('acordos.faturamento.lancar', { ehDono: true }),

    // Admin
    isAdmin: inGroup('admin'),
    isGestor: inGroup('gestores'),
  }
}
