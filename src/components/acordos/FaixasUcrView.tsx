'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn, formatDateTime } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { UCR_FAIXAS, UCR_REGIOES, type UcrCampo, type UcrRegiao } from '@/lib/ucr'

interface FaixaApi {
  regiao: UcrRegiao
  ucr_nao_suficiente: number
  ucr_a_evoluir: number
  ucr_bom: number
  ucr_otimo: number
  ucr_esplendido: number
  updated_at: string
  updated_by_nome: string | null
}

interface HistoricoApi {
  id: number
  regiao: UcrRegiao
  campo: string
  valor_de: number | null
  valor_para: number
  created_at: string
  usuario_nome: string
}

type EditState = Record<UcrRegiao, Record<UcrCampo, string>>

const fmtBr = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parseBr = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const campoLabel = (campo: string) => UCR_FAIXAS.find((f) => f.campo === campo)?.label ?? campo

export function FaixasUcrView() {
  const { pode } = usePermissions()
  const canEditar = pode('acordos.paradas.ucr.editar')

  const [faixas, setFaixas] = useState<FaixaApi[]>([])
  const [historico, setHistorico] = useState<HistoricoApi[]>([])
  const [edit, setEdit] = useState<EditState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/acordos/hh/paradas/ucr-faixas')
      .then((r) => r.json())
      .then((j) => {
        const data: FaixaApi[] = j.data?.faixas ?? []
        setFaixas(data)
        setHistorico(j.data?.historico ?? [])
        setEdit(Object.fromEntries(
          data.map((f) => [f.regiao, Object.fromEntries(
            UCR_FAIXAS.map((c) => [c.campo, fmtBr(f[c.campo])]),
          ) as Record<UcrCampo, string>]),
        ) as EditState)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const dirty = useMemo(() => {
    if (!edit) return false
    return faixas.some((f) => UCR_FAIXAS.some((c) => parseBr(edit[f.regiao]?.[c.campo] ?? '') !== f[c.campo]))
  }, [edit, faixas])

  const handleSave = async () => {
    if (!edit) return
    setSaving(true); setError(null)
    try {
      const alterados = UCR_REGIOES.filter(({ regiao }) =>
        faixas.some((f) => f.regiao === regiao) &&
        UCR_FAIXAS.some((c) => parseBr(edit[regiao][c.campo]) !== faixas.find((f) => f.regiao === regiao)![c.campo]))
      for (const { regiao } of alterados) {
        const body = Object.fromEntries(UCR_FAIXAS.map((c) => [c.campo, parseBr(edit[regiao][c.campo])]))
        const res = await fetch('/api/acordos/hh/paradas/ucr-faixas', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regiao, ...body }),
        })
        const json = await res.json()
        if (!res.ok || json.error) { setError(json.error ?? `Erro ao salvar ${regiao}`); return }
      }
      fetchData()
    } finally { setSaving(false) }
  }

  if (loading || !edit) {
    return <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Faixas de UCR por Região</h3>
            <p className="text-[11px] text-white/70">Limites de R$/HH aplicados automaticamente conforme o Estado do contrato.</p>
          </div>
          {canEditar && (
            <button onClick={handleSave} disabled={!dirty || saving}
              className="bg-white text-green-700 text-[11px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
        </div>

        {error && <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded-md">{error}</div>}

        <div className="overflow-x-auto p-4">
          <table className="border-collapse w-full" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600" style={{ width: 160 }}>Faixa</th>
                {UCR_REGIOES.map(({ regiao, label, exemplos }) => (
                  <th key={regiao} className="border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                    <div className="font-bold text-gray-700">{label}</div>
                    <div className="text-[9px] font-normal text-gray-400 mt-0.5 whitespace-normal leading-tight">{exemplos}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UCR_FAIXAS.map(({ campo, label, cor, bg }) => (
                <tr key={campo}>
                  <td className="border border-gray-200 px-3 py-2 font-semibold" style={{ background: bg, color: cor }}>{label}</td>
                  {UCR_REGIOES.map(({ regiao }) => (
                    <td key={regiao} className="border border-gray-200 px-2 py-1.5 text-center">
                      {canEditar ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-gray-400">R$</span>
                          <input value={edit[regiao]?.[campo] ?? ''}
                            onChange={(e) => setEdit((p) => p && ({ ...p, [regiao]: { ...p[regiao], [campo]: e.target.value } }))}
                            onBlur={(e) => setEdit((p) => p && ({ ...p, [regiao]: { ...p[regiao], [campo]: fmtBr(parseBr(e.target.value)) } }))}
                            className="w-20 border border-gray-300 rounded px-1.5 py-1 text-center focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
                        </div>
                      ) : (
                        <span className="text-gray-700">R$ {edit[regiao]?.[campo] ?? '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <button onClick={() => setMostrarHistorico((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-lg">
          <span>Histórico de alterações</span>
          <span className="text-gray-400 text-[10px]">{mostrarHistorico ? '▲ ocultar' : '▼ exibir'}</span>
        </button>
        {mostrarHistorico && (
          historico.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-[11px] border-t">Nenhuma alteração registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="border-collapse w-full" style={{ fontSize: '11px' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Data/Hora</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Usuário</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Região</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Faixa</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold text-gray-500">De</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold text-gray-500">Para</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h, i) => (
                    <tr key={h.id} className={cn('border-b border-gray-100', i % 2 === 1 && 'bg-gray-50/50')}>
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatDateTime(h.created_at)}</td>
                      <td className="px-3 py-1.5 text-gray-700">{h.usuario_nome}</td>
                      <td className="px-3 py-1.5 text-gray-700">{h.regiao}</td>
                      <td className="px-3 py-1.5 text-gray-700">{campoLabel(h.campo)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-400">{h.valor_de != null ? `R$ ${fmtBr(h.valor_de)}` : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-green-700">R$ {fmtBr(h.valor_para)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
