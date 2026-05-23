'use client'

import { useSession } from 'next-auth/react'
import type { Perfil } from '@/types'

const GRUPOS = {
  gestores: ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ADM_GERAL'] as Perfil[],
  comercial: ['ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ORCAMENTISTA'] as Perfil[],
  acordos: ['ADM_COMERCIAL', 'GESTAO_ACORDOS', 'ACORDOS', 'ADM_GERAL'] as Perfil[],
  admin: ['ADM_COMERCIAL', 'ADM_GERAL'] as Perfil[],
}

export function usePermissions() {
  const { data: session } = useSession()
  const perfil = session?.user?.perfil
  const isAnalistaCritico = session?.user?.is_analista_critico ?? false

  const is = (...perfis: Perfil[]) => !!perfil && perfis.includes(perfil)
  const inGroup = (grupo: keyof typeof GRUPOS) => !!perfil && GRUPOS[grupo].includes(perfil)

  return {
    perfil,
    userId: session?.user?.id ? Number(session.user.id) : null,
    userName: session?.user?.nome ?? '',
    isAnalistaCritico,

    // Solicitações
    canCreateSolicitacao: is('ADM_COMERCIAL'),
    canEditSolicitacao: inGroup('comercial') || isAnalistaCritico,
    canCancelSolicitacao: is('ADM_COMERCIAL', 'ADM_GERAL') || isAnalistaCritico,
    canAtribuirOrcamentista: isAnalistaCritico,
    canRecusarSolicitacao: isAnalistaCritico,
    canVerTodasSolicitacoes: is('ADM_COMERCIAL', 'GESTAO_COMERCIAL', 'ADM_GERAL') || isAnalistaCritico,
    canCriarRevisao: is('ADM_COMERCIAL'),
    canTransferirOrcamentista: is('ADM_COMERCIAL'),
    canAnalisarSolicitacao: isAnalistaCritico,

    // Propostas
    canRegistrarTecnica: is('ORCAMENTISTA', 'ADM_COMERCIAL', 'GESTAO_COMERCIAL'),
    canRegistrarComercial: is('ORCAMENTISTA', 'ADM_COMERCIAL', 'GESTAO_COMERCIAL'),

    // Acordos
    canGerirAcordos: inGroup('acordos'),
    canLancarNF: is('ACORDOS', 'GESTAO_ACORDOS', 'ADM_COMERCIAL'),

    // Admin
    isAdmin: inGroup('admin'),
    isGestor: inGroup('gestores'),
  }
}
