'use client'

import { useEffect } from 'react'
import { Field, Input } from '@/components/ui/Input'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function mesesDoIntervalo(inicio: string, fim: string): { key: string; label: string }[] {
  if (!inicio || !fim || fim < inicio) return []
  const [anoIni, mesIni] = inicio.split('-').map(Number)
  const [anoFim, mesFim] = fim.split('-').map(Number)
  const out: { key: string; label: string }[] = []
  let ano = anoIni, mes = mesIni
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    out.push({ key: `${ano}-${String(mes).padStart(2, '0')}`, label: `${MESES_ABREV[mes - 1]}/${String(ano).slice(2)}` })
    mes++
    if (mes > 12) { mes = 1; ano++ }
  }
  return out
}

interface Props {
  dataInicio: string
  dataFim: string
  efetivoBase: number
  valores: Record<string, number>
  onChange: (valores: Record<string, number>) => void
}

/** Grade de efetivo editável mês a mês, dentro do período informado (Obras/Fabricações/Óleo e Gás). */
export function EfetivoMensalEditor({ dataInicio, dataFim, efetivoBase, valores, onChange }: Props) {
  const meses = mesesDoIntervalo(dataInicio, dataFim)

  // Preenche meses novos (período alterado) com o efetivo base, sem sobrescrever meses já editados.
  useEffect(() => {
    const chaves = new Set(meses.map((m) => m.key))
    const faltando = meses.some((m) => valores[m.key] == null)
    const sobrando = Object.keys(valores).some((k) => !chaves.has(k))
    if (!faltando && !sobrando) return
    const atualizado: Record<string, number> = {}
    for (const m of meses) atualizado[m.key] = valores[m.key] ?? efetivoBase
    onChange(atualizado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim])

  if (meses.length === 0) return null

  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-2">
        Ajuste o efetivo de cada mês do período — pode manter todos iguais ou variar livremente mês a mês.
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto pr-1">
        {meses.map((m) => (
          <Field key={m.key} label={m.label} className="mb-0">
            <Input
              type="number"
              min={0}
              value={valores[m.key] ?? efetivoBase}
              onChange={(e) => onChange({ ...valores, [m.key]: Number(e.target.value) })}
            />
          </Field>
        ))}
      </div>
    </div>
  )
}
