'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

type Severidade = 'critica' | 'atencao' | 'informativa'
type Modulo = 'comercial' | 'acordos'

interface ExcecaoItem {
  chave: string
  tipo: string
  modulo: Modulo
  titulo: string
  detalhe: string
  severidade: Severidade
  dias: number | null
  link: string
}

const SEVERIDADE_META: Record<Severidade, { label: string; badge: 'red' | 'amber' | 'blue'; borda: string }> = {
  critica: { label: 'Crítica', badge: 'red', borda: 'border-l-[#C62828]' },
  atencao: { label: 'Atenção', badge: 'amber', borda: 'border-l-[#FB8C00]' },
  informativa: { label: 'Informativa', badge: 'blue', borda: 'border-l-[#1565C0]' },
}

const MODULO_LABEL: Record<Modulo, string> = { comercial: 'Comercial', acordos: 'Acordos' }

export default function ExcecoesPage() {
  const [itens, setItens] = useState<ExcecaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [severidadeFiltro, setSeveridadeFiltro] = useState<Severidade | ''>('')
  const [moduloFiltro, setModuloFiltro] = useState<Modulo | ''>('')

  useEffect(() => {
    fetch('/api/excecoes')
      .then((r) => r.json())
      .then((j) => setItens(j.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const contagens = useMemo(() => ({
    critica: itens.filter((i) => i.severidade === 'critica').length,
    atencao: itens.filter((i) => i.severidade === 'atencao').length,
    informativa: itens.filter((i) => i.severidade === 'informativa').length,
  }), [itens])

  const filtrados = useMemo(() => itens.filter((i) =>
    (!severidadeFiltro || i.severidade === severidadeFiltro) &&
    (!moduloFiltro || i.modulo === moduloFiltro),
  ), [itens, severidadeFiltro, moduloFiltro])

  return (
    <div className="h-full overflow-y-auto p-4">
      <PageHeader
        title="Painel de Exceções"
        subtitle="Pendências que o sistema já identificou sozinho. Cada item fica na lista enquanto a condição continuar verdadeira e some quando for resolvido — não precisa marcar como lido."
      />

      {/* Indicadores clicáveis — filtro por severidade */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
        {(['critica', 'atencao', 'informativa'] as Severidade[]).map((sev) => {
          const meta = SEVERIDADE_META[sev]
          const active = severidadeFiltro === sev
          return (
            <button
              key={sev}
              onClick={() => setSeveridadeFiltro(active ? '' : sev)}
              className={cn(
                'text-left bg-white border border-gray-200 rounded-md p-3 border-l-[3px] transition-all',
                meta.borda,
                active && 'shadow-[0_0_0_2px_rgba(0,0,0,0.06)] bg-gray-50',
              )}
            >
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.04em] mb-1">{meta.label}</p>
              <p className="text-[20px] font-bold text-gray-800">{contagens[sev]}</p>
            </button>
          )
        })}
      </div>

      {/* Filtro por módulo */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setModuloFiltro('')}
          className={cn('px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors',
            !moduloFiltro ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50')}
        >
          Todos os módulos
        </button>
        {(['comercial', 'acordos'] as Modulo[]).map((m) => (
          <button
            key={m}
            onClick={() => setModuloFiltro(moduloFiltro === m ? '' : m)}
            className={cn('px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors',
              moduloFiltro === m ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50')}
          >
            {MODULO_LABEL[m]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-center text-gray-400 py-14 text-sm">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-green-light flex items-center justify-center mb-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 11.5L9 16.5L18 6.5" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-gray-600">
            {itens.length === 0 ? 'Nenhuma pendência no momento' : 'Nenhuma exceção neste filtro'}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {itens.length === 0 ? 'Assim que algo precisar de atenção, aparece aqui.' : 'Limpe o filtro para ver as demais.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((item) => {
            const meta = SEVERIDADE_META[item.severidade]
            return (
              <Link
                key={item.chave}
                href={item.link}
                className={cn(
                  'block bg-white border border-gray-200 rounded-md p-3.5 border-l-[3px] hover:bg-gray-50 transition-colors',
                  meta.borda,
                )}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800">{item.titulo}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{item.detalhe}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="gray">{MODULO_LABEL[item.modulo]}</Badge>
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
