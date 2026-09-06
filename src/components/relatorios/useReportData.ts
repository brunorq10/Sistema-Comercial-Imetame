'use client'

import { useEffect, useState } from 'react'

// Busca os dados de um relatório, refazendo a chamada sempre que `params`
// mudar de identidade (ou seja: quando o botão "Aplicar" gera um novo objeto
// de filtros aplicados).
export function useReportData<T>(url: string, params: Record<string, string | undefined> = {}) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(params)

  useEffect(() => {
    setLoading(true)
    const entries = Object.entries(params).filter((e): e is [string, string] => !!e[1])
    const qs = new URLSearchParams(entries)
    const suffix = qs.toString() ? `?${qs}` : ''
    fetch(`${url}${suffix}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key])

  return { data, loading }
}
