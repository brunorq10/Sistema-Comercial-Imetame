'use client'

import { useCallback, useEffect, useState } from 'react'
import { PainelAcordosTable, type PainelContratoRow } from '@/components/tables/PainelAcordosTable'
import { Select } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Indicadores {
  previsto_mes_atual:    number
  faturado_mes_atual:    number
  a_faturar_mes_atual:   number
  faturado_ultimo_mes:   number
  a_faturar_proximo_mes: number
  previsto_proximo_mes:  number
}

export default function PainelAcordosPage() {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(String(anoAtual))

  const [indicadores, setIndicadores] = useState<Indicadores | null>(null)
  const [contratos,   setContratos]   = useState<PainelContratoRow[]>([])
  const [mesAtual,    setMesAtual]    = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (ano) params.set('ano', ano)
      const res  = await fetch(`/api/painel/faturamento?${params.toString()}`)
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      setIndicadores(json.data.indicadores)
      setContratos(json.data.contratos)
      setMesAtual(json.data.mes_atual)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [ano])

  useEffect(() => { fetchData() }, [fetchData])

  const mesAnteriorLabel = MESES_LABELS[mesAtual === 0 ? 11 : mesAtual - 1]
  const mesAtualLabel    = MESES_LABELS[mesAtual]
  const mesProximoLabel  = MESES_LABELS[mesAtual === 11 ? 0 : mesAtual + 1]

  return (
    <div className="p-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">Meu Painel — Acordos</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Ano referência:</span>
          <Select value={ano} onChange={(e) => setAno(e.target.value)} className="text-[11px] py-[3px]">
            {Array.from({ length: 8 }, (_, i) => anoAtual - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        Indicadores e controle mensal dos contratos atribuídos a você.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
      )}

      {/* ── Cards de indicadores ──────────────────────────────────────────────── */}
      {!loading && indicadores && (
        <div className="grid grid-cols-5 gap-2.5 mb-5">
          <MonetarioCard
            label={`Previsto — ${mesAtualLabel}`}
            valor={indicadores.previsto_mes_atual}
            sub="mês atual"
            variant="blue"
          />
          <MonetarioCard
            label={`Faturado — ${mesAtualLabel}`}
            valor={indicadores.faturado_mes_atual}
            sub="mês atual"
            variant="green"
          />
          <MonetarioCard
            label={`A faturar — ${mesAtualLabel}`}
            valor={indicadores.a_faturar_mes_atual}
            sub="mês atual"
            variant={indicadores.a_faturar_mes_atual > 0 ? 'amber' : 'green'}
            sinal={indicadores.a_faturar_mes_atual < 0 ? 'negativo' : undefined}
          />
          <MonetarioCard
            label={`Faturado — ${mesAnteriorLabel}`}
            valor={indicadores.faturado_ultimo_mes}
            sub="último mês"
            variant="blue"
          />
          <MonetarioCard
            label={`A faturar — ${mesProximoLabel}`}
            valor={indicadores.a_faturar_proximo_mes}
            sub={`previsto: ${formatCurrency(indicadores.previsto_proximo_mes)}`}
            variant="amber"
          />
        </div>
      )}

      {/* ── Skeleton cards enquanto carrega ──────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-5 gap-2.5 mb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-md h-[80px] animate-pulse border border-gray-200" />
          ))}
        </div>
      )}

      {/* ── Separador e título da tabela ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-semibold text-gray-700">
          Controle mensal por contrato
          {!loading && ` · ${contratos.length} contrato${contratos.length !== 1 ? 's' : ''}`}
        </p>
        {!loading && (
          <p className="text-[10px] text-gray-400">
            Mês atual destacado com <strong>●</strong>. P = previsto · F = faturado
          </p>
        )}
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : (
        <PainelAcordosTable contratos={contratos} mesAtual={mesAtual} />
      )}
    </div>
  )
}

// ─── Card de indicador monetário ─────────────────────────────────────────────

interface MonetarioCardProps {
  label: string
  valor: number
  sub: string
  variant: 'green' | 'blue' | 'amber' | 'red'
  sinal?: 'negativo'
}

function MonetarioCard({ label, valor, sub, variant, sinal }: MonetarioCardProps) {
  const borderColor = {
    green: 'border-l-green-primary',
    blue:  'border-l-[#1565C0]',
    amber: 'border-l-[#FB8C00]',
    red:   'border-l-[#C62828]',
  }[variant]

  const valorColor = {
    green: 'text-green-dark',
    blue:  'text-[#1565C0]',
    amber: 'text-[#E65100]',
    red:   'text-[#C62828]',
  }[variant]

  const displayValor = sinal === 'negativo'
    ? `(${formatCurrency(Math.abs(valor))})`
    : formatCurrency(valor)

  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-md p-3 border-l-[3px] select-none',
      borderColor,
    )}>
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.04em] mb-1 leading-tight">{label}</p>
      <p className={cn('text-[17px] font-bold leading-tight', valorColor)}>{displayValor}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
