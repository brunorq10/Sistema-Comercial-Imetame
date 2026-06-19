'use client'

import { useEffect, useState } from 'react'

/**
 * Retorna true quando a media query casa. SSR-safe: começa em `false`
 * e sincroniza no cliente após a montagem.
 *
 * Ex.: const isDesktop = useMediaQuery('(min-width: 1024px)')  // lg+
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Atalho para o breakpoint `lg` do Tailwind (>= 1024px). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
