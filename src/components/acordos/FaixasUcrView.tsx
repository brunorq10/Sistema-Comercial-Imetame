'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { UCR_FAIXAS, UCR_REGIOES, type UcrCampo, type UcrRegiao, type UcrFaixaValores } from '@/lib/ucr'
import { UcrFaixasTabela } from '@/components/acordos/UcrFaixasTabela'

interface VigenciaApi extends UcrFaixaValores {
  id: number
  regiao: UcrRegiao
  vigencia_inicio: string
  vigencia_fim: string
  created_at: string
  criador_nome: string
  updated_at: string
  atualizador_nome: string | null
}

interface HistoricoApi {
  id: number
  regiao: UcrRegiao
  vigencia_id: number
  campo: string
  valor_de: string | null
  valor_para: string
  created_at: string
  usuario_nome: string
}

const fmtBr = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parseBr = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const campoLabel = (campo: string) =>
  campo === 'vigencia_inicio' ? 'Vigência (início)'
  : campo === 'vigencia_fim' ? 'Vigência (fim)'
  : UCR_FAIXAS.find((f) => f.campo === campo)?.label ?? campo
const regiaoLabel = (regiao: UcrRegiao) => UCR_REGIOES.find((r) => r.regiao === regiao)?.label ?? regiao

type ModalState = { modo: 'novo'; regiao?: UcrRegiao } | { modo: 'editar'; vigencia: VigenciaApi } | null

export function FaixasUcrView() {
  const { pode } = usePermissions()
  const canEditar = pode('acordos.paradas.ucr.editar')

  const [vigentes, setVigentes] = useState<VigenciaApi[]>([])
  const [historicoVersoes, setHistoricoVersoes] = useState<VigenciaApi[]>([])
  const [alertas, setAlertas] = useState<UcrRegiao[]>([])
  const [alteracoes, setAlteracoes] = useState<HistoricoApi[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarHistoricoVersoes, setMostrarHistoricoVersoes] = useState(false)
  const [mostrarAlteracoes, setMostrarAlteracoes] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/acordos/hh/paradas/ucr-faixas')
      .then((r) => r.json())
      .then((j) => {
        setVigentes(j.data?.vigentes ?? [])
        setHistoricoVersoes(j.data?.historico ?? [])
        setAlertas(j.data?.alertas ?? [])
        setAlteracoes(j.data?.alteracoes ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const valoresPorRegiao = useMemo(() =>
    Object.fromEntries(vigentes.map((v) => [v.regiao, v])) as Partial<Record<UcrRegiao, VigenciaApi>>,
    [vigentes])

  if (loading) {
    return <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-[12px] px-4 py-3 rounded-md flex items-center justify-between gap-3">
          <span>
            <strong>Faixa de UCR vencida ou não cadastrada</strong> para: {alertas.map(regiaoLabel).join(', ')}.
            {' '}Ajuste a vigência existente ou cadastre novas faixas para esse período.
          </span>
          {canEditar && (
            <button onClick={() => setModal({ modo: 'novo', regiao: alertas[0] })}
              className="flex-shrink-0 bg-amber-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors">
              Cadastrar faixa
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-green-700 px-4 py-2 rounded-t-lg flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Faixas de UCR vigentes</h3>
            <p className="text-[11px] text-white/70">Limites de R$/HH por região, aplicados conforme a data de início de cada Parada.</p>
          </div>
          {canEditar && (
            <button onClick={() => setModal({ modo: 'novo' })}
              className="bg-white text-green-700 text-[11px] font-semibold px-3 py-1.5 rounded-md hover:bg-green-50 transition-colors flex-shrink-0">
              + Cadastrar Novas Faixas
            </button>
          )}
        </div>

        {/* Período de vigência + ação de editar, por região */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 p-4 border-b border-gray-100">
          {UCR_REGIOES.map(({ regiao, label }) => {
            const v = valoresPorRegiao[regiao]
            return (
              <div key={regiao} className="border border-gray-200 rounded-md px-3 py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">{label}</p>
                  {v ? (
                    <p className="text-[11px] text-gray-700">{formatDate(v.vigencia_inicio)} a {formatDate(v.vigencia_fim)}</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 font-semibold">Sem vigência</p>
                  )}
                </div>
                {canEditar && v && (
                  <button onClick={() => setModal({ modo: 'editar', vigencia: v })}
                    className="text-[10px] font-semibold text-green-primary border border-green-primary/40 rounded px-2 py-1 hover:bg-green-light transition-colors flex-shrink-0">
                    Editar
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4">
          <UcrFaixasTabela valoresPorRegiao={valoresPorRegiao as Partial<Record<UcrRegiao, UcrFaixaValores | null>>} />
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <button onClick={() => setMostrarHistoricoVersoes((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-lg">
          <span>Histórico de versões (vigências encerradas)</span>
          <span className="text-gray-400 text-[10px]">{mostrarHistoricoVersoes ? '▲ ocultar' : '▼ exibir'}</span>
        </button>
        {mostrarHistoricoVersoes && (
          historicoVersoes.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-[11px] border-t">Nenhuma vigência encerrada ainda.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="border-collapse w-full" style={{ fontSize: '11px' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Região</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Período</th>
                    {UCR_FAIXAS.map((f) => (
                      <th key={f.campo} className="border-b border-gray-200 px-3 py-2 text-right font-semibold text-gray-500">{f.label}</th>
                    ))}
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Cadastrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoVersoes.map((v, i) => (
                    <tr key={v.id} className={cn('border-b border-gray-100', i % 2 === 1 && 'bg-gray-50/50')}>
                      <td className="px-3 py-1.5 text-gray-700 font-medium">{regiaoLabel(v.regiao)}</td>
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatDate(v.vigencia_inicio)} a {formatDate(v.vigencia_fim)}</td>
                      {UCR_FAIXAS.map((f) => (
                        <td key={f.campo} className="px-3 py-1.5 text-right text-gray-600">R$ {fmtBr(v[f.campo])}</td>
                      ))}
                      <td className="px-3 py-1.5 text-gray-500">{v.criador_nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <button onClick={() => setMostrarAlteracoes((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-lg">
          <span>Histórico de alterações</span>
          <span className="text-gray-400 text-[10px]">{mostrarAlteracoes ? '▲ ocultar' : '▼ exibir'}</span>
        </button>
        {mostrarAlteracoes && (
          alteracoes.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-[11px] border-t">Nenhuma alteração registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="border-collapse w-full" style={{ fontSize: '11px' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Data/Hora</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Usuário</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Região</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500">Campo</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold text-gray-500">De</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right font-semibold text-gray-500">Para</th>
                  </tr>
                </thead>
                <tbody>
                  {alteracoes.map((h, i) => {
                    const isData = h.campo === 'vigencia_inicio' || h.campo === 'vigencia_fim'
                    const fmt = (v: string | null) => v == null ? '—' : isData ? formatDate(v) : `R$ ${fmtBr(Number(v))}`
                    return (
                      <tr key={h.id} className={cn('border-b border-gray-100', i % 2 === 1 && 'bg-gray-50/50')}>
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatDateTime(h.created_at)}</td>
                        <td className="px-3 py-1.5 text-gray-700">{h.usuario_nome}</td>
                        <td className="px-3 py-1.5 text-gray-700">{regiaoLabel(h.regiao)}</td>
                        <td className="px-3 py-1.5 text-gray-700">{campoLabel(h.campo)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400">{fmt(h.valor_de)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-green-700">{fmt(h.valor_para)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {modal && <VigenciaModal state={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); fetchData() }} />}
    </div>
  )
}

// ── Modal de cadastro/edição de vigência ────────────────────────────────────
function VigenciaModal({ state, onClose, onSuccess }: { state: NonNullable<ModalState>; onClose: () => void; onSuccess: () => void }) {
  const editando = state.modo === 'editar' ? state.vigencia : null
  const [regiao, setRegiao] = useState<UcrRegiao>(editando?.regiao ?? (state.modo === 'novo' ? state.regiao : undefined) ?? 'ES')
  const [inicio, setInicio] = useState(editando?.vigencia_inicio ?? '')
  const [fim, setFim] = useState(editando?.vigencia_fim ?? '')
  const [valores, setValores] = useState<Record<UcrCampo, string>>(
    Object.fromEntries(UCR_FAIXAS.map((f) => [f.campo, editando ? fmtBr(editando[f.campo]) : ''])) as Record<UcrCampo, string>,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!inicio || !fim) { setError('Informe o período de vigência (início e fim)'); return }
    if (UCR_FAIXAS.some((f) => !valores[f.campo])) { setError('Preencha todas as 5 faixas'); return }
    setSaving(true); setError(null)
    try {
      const body = {
        ...(editando ? { id: editando.id } : { regiao }),
        vigencia_inicio: inicio, vigencia_fim: fim,
        ...Object.fromEntries(UCR_FAIXAS.map((f) => [f.campo, parseBr(valores[f.campo])])),
      }
      const res = await fetch('/api/acordos/hh/paradas/ucr-faixas', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="bg-[#1B5E20] text-white px-5 py-4 flex items-center justify-between">
          <h2 className="text-[14px] font-bold">{editando ? 'Editar Faixa de UCR' : 'Cadastrar Novas Faixas'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-[20px]">×</button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded-md">{error}</div>}
          <div>
            <label className="block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Região</label>
            <select value={regiao} onChange={(e) => setRegiao(e.target.value as UcrRegiao)} disabled={!!editando}
              className="w-full border border-gray-300 rounded-md px-2.5 py-[5px] text-[11px] disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-primary/30">
              {UCR_REGIOES.map((r) => <option key={r.regiao} value={r.regiao}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Vigência — início</label>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2.5 py-[5px] text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
            </div>
            <div>
              <label className="block mb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Vigência — fim</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2.5 py-[5px] text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            {UCR_FAIXAS.map(({ campo, label, cor, bg }) => (
              <div key={campo} className="flex items-center gap-3">
                <div className="w-[140px] rounded-md px-3 py-1.5 text-[11px] font-semibold flex-shrink-0" style={{ background: bg, color: cor }}>{label}</div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">até R$</span>
                <input value={valores[campo]} onChange={(e) => setValores((p) => ({ ...p, [campo]: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px] text-right focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="border border-gray-300 text-gray-600 rounded-md px-4 py-1.5 text-[11px] font-medium hover:bg-gray-100">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-green-primary text-white rounded-md px-4 py-1.5 text-[11px] font-semibold hover:bg-green-dark transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
