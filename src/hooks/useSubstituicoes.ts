'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

interface SubstituindoItem { id: number; titular: { id: number; nome: string }; ate: string }
interface SendoSubstituidoItem { id: number; substituto: { id: number; nome: string }; ate: string }

interface StatusSubstituicao {
  substituindo: SubstituindoItem[]
  sendoSubstituidoPor: SendoSubstituidoItem[]
}

const VAZIO: StatusSubstituicao = { substituindo: [], sendoSubstituidoPor: [] }

// Busca uma vez (por sessão de página) a situação de substituição temporária
// vigente do usuário logado: de quem ele é substituto agora (para banners,
// filtros "De: {titular}" e para incluir os itens do titular nas listagens de
// Meu Painel) e quem o substitui agora (para o banner "você está sendo
// substituído"). Só se aplica ao Tipo 1 (substituição temporária) — transferência
// e troca definitivas não geram estado nenhum aqui, pois a titularidade já muda
// de fato no registro.
export function useSubstituicoes() {
  const { status } = useSession()
  const [dados, setDados] = useState<StatusSubstituicao>(VAZIO)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'authenticated') return
    let ativo = true
    fetch('/api/substituicoes/status')
      .then((r) => r.json())
      .then((json) => { if (ativo && !json.error) setDados(json.data ?? VAZIO) })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [status])

  // Memoizado: `.map()` cria um array novo a cada chamada, e páginas que usam
  // `titularIds` como dependência de useCallback/useEffect (ex.: Meu Painel de
  // Acordos) entravam em loop de re-fetch infinito — a referência mudava a
  // cada render mesmo sem `dados` ter mudado, causando piscar contínuo da tela.
  const titularIds = useMemo(() => dados.substituindo.map((s) => s.titular.id), [dados])

  return {
    loading,
    /** Titulares que o usuário substitui agora (normalmente 0 ou 1). */
    substituindo: dados.substituindo,
    /** Quem substitui o usuário agora (normalmente 0 ou 1). */
    sendoSubstituidoPor: dados.sendoSubstituidoPor,
    /** IDs dos titulares substituídos — usar para incluir os itens deles nas listagens. */
    titularIds,
  }
}
