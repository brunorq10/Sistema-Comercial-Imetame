'use client'

import { useSession } from 'next-auth/react'
import type { Perfil } from '@/types'

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

  // ADM_GERAL is sovereign — unrestricted access to everything
  const isAdmGeral = is('ADM_GERAL')
  const can = (check: boolean) => isAdmGeral || check

  return {
    perfil,
    userId: session?.user?.id ? Number(session.user.id) : null,
    userName: session?.user?.nome ?? '',
    isAnalistaCritico,
    isLoading: status === 'loading',

    // Solicitações
    canCreateSolicitacao: can(is('ADM_COMERCIAL')),
    canEditSolicitacao: can(inGroup('comercial') || isAnalistaCritico),
    canCancelSolicitacao: can(is('ADM_COMERCIAL', 'ADM_GERAL') || isAnalistaCritico),
    canAtribuirOrcamentista: can(isAnalistaCritico),
    canRecusarSolicitacao: can(isAnalistaCritico),
    canVerTodasSolicitacoes: can(is('ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ADM_GERAL') || isAnalistaCritico),
    canCriarRevisao: can(is('ADM_COMERCIAL')),
    canTransferirOrcamentista: can(is('ADM_COMERCIAL')),
    canAnalisarSolicitacao: can(isAnalistaCritico),

    // Propostas
    canRegistrarTecnica: can(is('ORCAMENTISTA', 'ADM_COMERCIAL', 'GESTAO_COMERCIAL')),
    canRegistrarComercial: can(is('ORCAMENTISTA', 'ADM_COMERCIAL', 'GESTAO_COMERCIAL')),

    // Acordos
    canGerirAcordos: can(inGroup('acordos')),
    canLancarNF: can(is('ACORDOS', 'GESTAO_ACORDOS', 'ADM_COMERCIAL')),

    // Admin
    isAdmin: inGroup('admin'),
    isGestor: inGroup('gestores'),
  }
}
