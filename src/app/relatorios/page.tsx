'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { CATALOGO, TERRITORIOS } from '@/lib/relatoriosCatalogo'

// Biblioteca de relatórios pré-definidos: uma lista, agrupada por tema, para
// encontrar rápido e abrir. Sem cards, sem gráficos — isso é dashboard, não
// é o que esta tela é.
export default function RelatoriosPage() {
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return CATALOGO
    return CATALOGO.filter((r) => r.titulo.toLowerCase().includes(q) || r.descricao.toLowerCase().includes(q))
  }, [busca])

  const porTerritorio = TERRITORIOS.map((t) => ({
    ...t,
    itens: filtrados.filter((r) => r.territorio === t.key),
  })).filter((t) => t.itens.length > 0)

  return (
    <div className="p-4 h-full overflow-y-auto">
      <PageHeader
        title="Relatórios"
        subtitle="Biblioteca de relatórios pré-definidos — Comercial e Acordos. Escolha um relatório, filtre e exporte."
        actions={
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar relatório por nome..."
            className="w-72"
          />
        }
      />

      {porTerritorio.length === 0 ? (
        <p className="text-center text-gray-400 py-14 text-sm">Nenhum relatório encontrado para &quot;{busca}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-5 mt-2">
          {porTerritorio.map((t) => (
            <div key={t.key}>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{t.label}</h2>
              <div className="bg-white border border-gray-200 rounded-md divide-y divide-gray-100">
                {t.itens.map((r) => (
                  <Link
                    key={r.codigo}
                    href={`/relatorios/${r.codigo}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-green-light/40 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-gray-800 group-hover:text-green-dark">{r.titulo}</p>
                      <p className="text-[11px] text-gray-500 truncate">{r.descricao}</p>
                    </div>
                    <span className="text-[11px] text-green-primary font-semibold whitespace-nowrap flex items-center gap-1">
                      Abrir
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 1.5L7 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
