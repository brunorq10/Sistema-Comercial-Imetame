'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, IntegerInput, CurrencyInput } from '@/components/ui/Input'
import { cn, formatDate } from '@/lib/utils'
import { AcaoButton, ACAO_ICONS } from '@/components/acordos/AcaoButton'
import { useFilterOptions, HhFilters as Filters, applyFilters, type FilterState } from '@/components/acordos/HhFilters'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const fmtHh = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const fmtPeso = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

function barColors(pct: number) {
  if (pct > 100) return { text: '#DC2626', bg: '#EF4444' }
  if (pct >= 90) return { text: '#CA8A04', bg: '#EAB308' }
  return { text: '#16A34A', bg: '#22C55E' }
}

// ── Tipos vindos da API ─────────────────────────────────────────────────────
interface MesPlano { mes: number; ano: number; hh_orcado: number | null; hh_previsto: number | null; peso_previsto: number | null }
interface MesReal  { mes: number; ano: number; hh_realizado: number | null; peso_realizado: number | null }
interface ItemFab {
  id: number
  descricao: string
  peso_total: number | null
  data_inicio: string
  data_fim: string
  ordem: number
  meses: MesPlano[]
  realizados: MesReal[]
}
export interface ContratoFab {
  id: number
  indice: string
  num_os: string | null
  ano_referencia?: number | null
  cliente: { id: number; nome: string; ramo_atuacao?: string | null }
  cliente_final: { id: number; nome: string } | null
  responsavel: { id: number; nome: string } | null
  cidade: string | null
  estado: string | null
  classificacao: string | null
  descricao: string | null
  data_inicio: string | null
  data_fim: string | null
  tem_itens: boolean
  hh_orcado: number | null
  hh_previsto: number | null
  hh_realizado: number | null
  peso_total: number | null
  peso_previsto: number | null
  peso_realizado: number | null
  itens: ItemFab[]
}

// Lista de meses (mes,ano) entre duas datas YYYY-MM-DD (inclusive)
function mesesEntre(inicio: string, fim: string): { mes: number; ano: number }[] {
  if (!inicio || !fim) return []
  const a = new Date(inicio), b = new Date(fim)
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return []
  const out: { mes: number; ano: number }[] = []
  let y = a.getUTCFullYear(), m = a.getUTCMonth()
  const yE = b.getUTCFullYear(), mE = b.getUTCMonth()
  let guard = 0
  while ((y < yE || (y === yE && m <= mE)) && guard < 240) {
    out.push({ mes: m, ano: y }); m++; if (m > 11) { m = 0; y++ }; guard++
  }
  return out
}
const key = (ano: number, mes: number) => `${ano}-${mes}`

// Somas de peso por item e % de avanço (= peso realizado / peso previsto)
const pesoPrevItem = (it: ItemFab) => it.meses.reduce((a, m) => a + (m.peso_previsto ?? 0), 0)
const pesoRealItem = (it: ItemFab) => it.realizados.reduce((a, r) => a + (r.peso_realizado ?? 0), 0)
const pctAvanco = (prev: number, real: number) => (prev > 0 ? (real / prev) * 100 : 0)

// ════════════════════════════════════════════════════════════════════════════
export function FabricacoesView() {
  const [contratos, setContratos] = useState<ContratoFab[]>([])
  const [loading, setLoading] = useState(true)
  const [visao, setVisao] = useState<'contratos' | 'resumo'>('contratos')

  const [picker, setPicker] = useState(false)
  const [cadastro, setCadastro] = useState<ContratoFab | null>(null)
  const [lancamento, setLancamento] = useState<ContratoFab | null>(null)
  const [historico, setHistorico] = useState<ContratoFab | null>(null)
  const [excluir, setExcluir] = useState<ContratoFab | null>(null)

  const [filters, setFilters] = useState<FilterState>({})
  const setFilter = (k: string, v: string[]) => setFilters((p) => ({ ...p, [k]: v }))
  const opts = useFilterOptions(contratos)
  const filtradas = applyFilters(contratos, filters)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acordos/hh/fabricacoes')
      const json = await res.json()
      setContratos(json.data ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2 flex-wrap">
        <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5">
          {([['contratos', 'Contratos'], ['resumo', 'Resumo']] as ['contratos' | 'resumo', string][]).map(([k, l]) => (
            <button key={k} onClick={() => setVisao(k)}
              className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-full transition-colors',
                visao === k ? 'bg-green-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {l}
            </button>
          ))}
        </div>
        {visao === 'contratos' && (
          <Button onClick={() => setPicker(true)}>+ Novo cadastro</Button>
        )}
      </div>

      {!loading && contratos.length > 0 && (
        <Filters opts={opts} filters={filters} onChange={setFilter} />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : visao === 'resumo' ? (
        <ResumoFab contratos={filtradas} />
      ) : (
        <ContratosFab
          contratos={filtradas}
          onEditar={(c) => setCadastro(c)}
          onLancar={(c) => setLancamento(c)}
          onHistorico={(c) => setHistorico(c)}
          onExcluir={(c) => setExcluir(c)}
        />
      )}

      {picker && (
        <PickerModal
          onClose={() => setPicker(false)}
          onSelect={(c) => { setPicker(false); setCadastro(c) }}
        />
      )}
      {cadastro && (
        <CadastroModal
          contrato={cadastro}
          onClose={() => setCadastro(null)}
          onSuccess={() => { setCadastro(null); fetchData() }}
        />
      )}
      {lancamento && (
        <LancamentoModal
          contrato={lancamento}
          onClose={() => setLancamento(null)}
          onSuccess={() => { setLancamento(null); fetchData() }}
        />
      )}
      {historico && (
        <HistoricoFabModal contrato={historico} onClose={() => setHistorico(null)} />
      )}
      {excluir && (
        <ExcluirLancamentosModal
          contrato={excluir}
          onClose={() => setExcluir(null)}
          onSuccess={() => { setExcluir(null); fetchData() }}
        />
      )}
    </div>
  )
}

// ── Excluir lançamentos do contrato (com motivo obrigatório) ──────────────────
function ExcluirLancamentosModal({ contrato, onClose, onSuccess }: {
  contrato: ContratoFab; onClose: () => void; onSuccess: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!motivo.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/acordos/hh/fabricacoes/realizado', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contrato.id, motivo: motivo.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao excluir'); return }
      onSuccess()
    } finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Excluir lançamentos — ${contrato.indice}`}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button variant="danger" onClick={handleDelete} disabled={!motivo.trim() || loading}>
            {loading ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </>
      }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>}
      <p className="text-[12px] text-gray-600 mb-3">
        Esta ação remove <strong>todos os lançamentos de realizado</strong> (HH e peso) dos itens deste contrato. O cadastro dos itens é mantido. Informe o motivo:
      </p>
      <textarea
        value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
        placeholder="Motivo (obrigatório)"
        className="w-full text-[12px] border border-gray-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-green-primary"
      />
    </Modal>
  )
}

// ── Tabela de contratos cadastrados ─────────────────────────────────────────
function ContratosFab({ contratos, onEditar, onLancar, onHistorico, onExcluir }: {
  contratos: ContratoFab[]
  onEditar: (c: ContratoFab) => void
  onLancar: (c: ContratoFab) => void
  onHistorico: (c: ContratoFab) => void
  onExcluir: (c: ContratoFab) => void
}) {
  if (contratos.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhum contrato corresponde aos filtros. Use “+ Novo cadastro” para incluir.</p>
  }
  return (
    <div className="overflow-auto border border-gray-200 rounded-md bg-white">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-green-primary text-white text-[10px] uppercase tracking-wide">
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Índice</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Cliente</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Cliente final</th>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Descrição</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">Itens</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Orçado</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Previsto</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Realizado</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Previsto (t)</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Realizado (t)</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">% Avanço acum.</th>
            <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c, i) => {
            const pPrev = c.itens.reduce((a, it) => a + pesoPrevItem(it), 0)
            const pReal = c.itens.reduce((a, it) => a + pesoRealItem(it), 0)
            return (
              <tr key={c.id} className={cn('border-b border-gray-100', i % 2 ? 'bg-gray-50' : 'bg-white')}>
                <td className="px-2 py-1.5 font-bold text-green-dark whitespace-nowrap">{c.indice}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{c.cliente.nome}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{c.cliente_final?.nome ?? '—'}</td>
                <td className="px-2 py-1.5 max-w-[220px] truncate" title={c.descricao ?? ''}>{c.descricao ?? '—'}</td>
                <td className="px-2 py-1.5 text-center">{c.itens.length}</td>
                <td className="px-2 py-1.5 text-right">{c.hh_orcado != null ? fmtHh(c.hh_orcado) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{c.hh_previsto != null ? fmtHh(c.hh_previsto) : '—'}</td>
                <td className="px-2 py-1.5 text-right">{c.hh_realizado != null ? fmtHh(c.hh_realizado) : '—'}</td>
                <td className="px-2 py-1.5 text-right text-[#185FA5]">{pPrev > 0 ? fmtPeso(pPrev) : '—'}</td>
                <td className="px-2 py-1.5 text-right text-green-dark">{pReal > 0 ? fmtPeso(pReal) : '—'}</td>
                <td className="px-2 py-1.5 text-right font-semibold text-[#1565C0]">{fmtPct(pctAvanco(pPrev, pReal))}</td>
                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-center">
                    <AcaoButton onClick={() => onEditar(c)} title="Editar itens" color="green">{ACAO_ICONS.editar}</AcaoButton>
                    <AcaoButton onClick={() => onLancar(c)} title="Lançar realizado" color="gray">{ACAO_ICONS.lancar}</AcaoButton>
                    <AcaoButton onClick={() => onHistorico(c)} title="Histórico de alterações" color="gray">{ACAO_ICONS.historico}</AcaoButton>
                    <AcaoButton onClick={() => onExcluir(c)} title="Excluir lançamentos" color="red">{ACAO_ICONS.excluir}</AcaoButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Picker: escolher contrato (só Fabricação/Óleo-Gás sem itens) ─────────────
function PickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (c: ContratoFab) => void }) {
  const [lista, setLista] = useState<ContratoFab[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/acordos/hh/fabricacoes?disponivel=1')
      .then((r) => r.json()).then((j) => setLista(j.data ?? []))
      .finally(() => setLoading(false))
  }, [])
  const filtrada = lista.filter((c) =>
    `${c.indice} ${c.cliente.nome} ${c.descricao ?? ''}`.toLowerCase().includes(busca.toLowerCase()))
  return (
    <Modal open onClose={onClose} title="Novo cadastro — escolher contrato" wide
      footer={<ModalCancelButton label="Fechar" />}>
      <Field label="Buscar">
        <Input placeholder="Índice, cliente ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </Field>
      <div className="mt-3 max-h-[50vh] overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Carregando...</p>
        ) : filtrada.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Todos os contratos de Fabricação/Óleo e Gás já possuem itens cadastrados.</p>
        ) : filtrada.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)}
            className="w-full text-left px-3 py-2 hover:bg-green-light transition-colors">
            <p className="text-[12px] font-semibold text-green-dark">{c.indice} — {c.cliente.nome}</p>
            <p className="text-[10px] text-gray-500 truncate">{c.descricao ?? 'Sem descrição'} · {[c.cidade, c.estado].filter(Boolean).join('/')}</p>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ── Cadastro de itens: descrição/peso/datas + HH orçado/previsto + peso previsto/mês ──
interface ItemForm {
  id: number | null
  descricao: string
  peso_total: string
  data_inicio: string
  data_fim: string
  // chave `${ano}-${mes}` → { orcado, previsto, pesoPrev }
  meses: Record<string, { orcado: string; previsto: string; pesoPrev: string }>
}

function CadastroModal({ contrato, onClose, onSuccess }: {
  contrato: ContratoFab; onClose: () => void; onSuccess: () => void
}) {
  const init: ItemForm[] = contrato.itens.length > 0
    ? contrato.itens.map((it) => ({
        id: it.id,
        descricao: it.descricao,
        peso_total: it.peso_total != null ? String(it.peso_total).replace('.', ',') : '',
        data_inicio: it.data_inicio.slice(0, 10),
        data_fim: it.data_fim.slice(0, 10),
        meses: Object.fromEntries(it.meses.map((m) => [key(m.ano, m.mes), {
          orcado: m.hh_orcado != null ? String(m.hh_orcado) : '',
          previsto: m.hh_previsto != null ? String(m.hh_previsto) : '',
          pesoPrev: m.peso_previsto != null ? String(m.peso_previsto).replace('.', ',') : '',
        }])),
      }))
    : [{ id: null, descricao: '', peso_total: '', data_inicio: '', data_fim: '', meses: {} }]

  const [itens, setItens] = useState<ItemForm[]>(init)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsePeso = (v: string) => v ? Number(v.replace(/\./g, '').replace(',', '.')) : null

  const upd = (i: number, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  const updMes = (i: number, k: string, campo: 'orcado' | 'previsto' | 'pesoPrev', v: string) =>
    setItens((prev) => prev.map((it, idx) => {
      if (idx !== i) return it
      const cur = it.meses[k] ?? { orcado: '', previsto: '', pesoPrev: '' }
      return { ...it, meses: { ...it.meses, [k]: { ...cur, [campo]: v } } }
    }))
  const addItem = () => setItens((p) => [...p, { id: null, descricao: '', peso_total: '', data_inicio: '', data_fim: '', meses: {} }])
  const rmItem = (i: number) => setItens((p) => p.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      if (!it.descricao.trim()) { setError(`Item ${i + 1}: descrição obrigatória`); return }
      if (!it.data_inicio || !it.data_fim) { setError(`Item ${i + 1}: datas obrigatórias`); return }
      if (it.data_inicio > it.data_fim) { setError(`Item ${i + 1}: data final antes da inicial`); return }
    }
    setLoading(true); setError(null)
    try {
      const payload = {
        contrato_id: contrato.id,
        itens: itens.map((it) => ({
          id: it.id,
          descricao: it.descricao.trim(),
          peso_total: parsePeso(it.peso_total),
          data_inicio: it.data_inicio,
          data_fim: it.data_fim,
          meses: mesesEntre(it.data_inicio, it.data_fim).map(({ mes, ano }) => {
            const cell = it.meses[key(ano, mes)] ?? { orcado: '', previsto: '', pesoPrev: '' }
            return {
              mes, ano,
              hh_orcado: cell.orcado ? Number(cell.orcado) : null,
              hh_previsto: cell.previsto ? Number(cell.previsto) : null,
              peso_previsto: parsePeso(cell.pesoPrev),
            }
          }),
        })),
      }
      const res = await fetch('/api/acordos/hh/fabricacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} extraWide
      hasChanges
      title={`Itens de Fabricação — ${contrato.indice} · ${contrato.cliente.nome}`}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar itens'}</Button>
        </>
      }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>}

      <div className="space-y-4">
        {itens.map((it, i) => {
          const meses = mesesEntre(it.data_inicio, it.data_fim)
          return (
            <div key={i} className="border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-600">Item {i + 1}</span>
                {itens.length > 1 && (
                  <button onClick={() => rmItem(i)} className="text-red-400 hover:text-red-600 text-sm">remover ×</button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-2">
                <Field label="Descrição *" className="sm:col-span-2">
                  <Input value={it.descricao} onChange={(e) => upd(i, { descricao: e.target.value })} placeholder="Ex: Skid de tubulação" />
                </Field>
                <Field label="Peso total (t)">
                  <CurrencyInput value={it.peso_total} onChange={(v) => upd(i, { peso_total: v })} placeholder="Ex: 12,50" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Início *">
                    <Input type="date" value={it.data_inicio} onChange={(e) => upd(i, { data_inicio: e.target.value })} />
                  </Field>
                  <Field label="Fim *">
                    <Input type="date" value={it.data_fim} onChange={(e) => upd(i, { data_fim: e.target.value })} />
                  </Field>
                </div>
              </div>

              {meses.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">Informe início e fim para habilitar o lançamento por mês.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded">
                  <table className="text-[10px] border-collapse min-w-max">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50">Mês</th>
                        {meses.map(({ mes, ano }) => (
                          <th key={key(ano, mes)} className="px-2 py-1 text-center font-semibold text-gray-500 whitespace-nowrap">{MESES_LABELS[mes]}/{String(ano).slice(2)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100">
                        <td className="px-2 py-1 font-semibold text-gray-500 sticky left-0 bg-white whitespace-nowrap">HH Orçado</td>
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          return <td key={k} className="px-1 py-1"><IntegerInput value={it.meses[k]?.orcado ?? ''} onChange={(v) => updMes(i, k, 'orcado', v)} placeholder="0" /></td>
                        })}
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="px-2 py-1 font-semibold text-gray-500 sticky left-0 bg-white whitespace-nowrap">HH Previsto</td>
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          return <td key={k} className="px-1 py-1"><IntegerInput value={it.meses[k]?.previsto ?? ''} onChange={(v) => updMes(i, k, 'previsto', v)} placeholder="0" /></td>
                        })}
                      </tr>
                      <tr className="border-t border-gray-100 bg-[#E3F2FD]">
                        <td className="px-2 py-1 font-semibold text-[#185FA5] sticky left-0 bg-[#E3F2FD] whitespace-nowrap">Peso Previsto (t)</td>
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          return <td key={k} className="px-1 py-1"><CurrencyInput value={it.meses[k]?.pesoPrev ?? ''} onChange={(v) => updMes(i, k, 'pesoPrev', v)} placeholder="0,00" /></td>
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={addItem}
        className="mt-3 w-full border border-dashed border-green-primary text-green-primary text-[12px] py-2 rounded hover:bg-green-light transition-colors">
        + Adicionar item
      </button>
    </Modal>
  )
}

// ── Lançamento do realizado (HH + peso realizado) por item/mês ────────────────
function LancamentoModal({ contrato, onClose, onSuccess }: {
  contrato: ContratoFab; onClose: () => void; onSuccess: () => void
}) {
  // estado: itemId → mesKey → { hh, pesoReal }
  const initial: Record<number, Record<string, { hh: string; pesoReal: string }>> = {}
  for (const it of contrato.itens) {
    initial[it.id] = {}
    for (const r of it.realizados) {
      initial[it.id][key(r.ano, r.mes)] = {
        hh: r.hh_realizado != null ? String(r.hh_realizado) : '',
        pesoReal: r.peso_realizado != null ? String(r.peso_realizado).replace('.', ',') : '',
      }
    }
  }
  const [dados, setDados] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsePeso = (v: string) => v ? Number(v.replace(/\./g, '').replace(',', '.')) : null

  const set = (itemId: number, k: string, campo: 'hh' | 'pesoReal', v: string) =>
    setDados((prev) => {
      const it = { ...(prev[itemId] ?? {}) }
      const cur = it[k] ?? { hh: '', pesoReal: '' }
      it[k] = { ...cur, [campo]: v }
      return { ...prev, [itemId]: it }
    })

  const handleSave = async () => {
    const lancamentos: { item_id: number; mes: number; ano: number; hh_realizado: number | null; peso_realizado: number | null }[] = []
    for (const it of contrato.itens) {
      for (const { mes, ano } of mesesEntre(it.data_inicio.slice(0, 10), it.data_fim.slice(0, 10))) {
        const k = key(ano, mes)
        const cell = dados[it.id]?.[k]
        if (!cell) continue
        lancamentos.push({
          item_id: it.id, mes, ano,
          hh_realizado: cell.hh ? Number(cell.hh) : null,
          peso_realizado: parsePeso(cell.pesoReal),
        })
      }
    }
    if (lancamentos.length === 0) { onClose(); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/acordos/hh/fabricacoes/realizado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lancamentos }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao lançar'); return }
      onSuccess()
    } finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} extraWide hasChanges
      title={`Lançar realizado — ${contrato.indice} · ${contrato.cliente.nome}`}
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar lançamentos'}</Button>
        </>
      }>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>}
      <p className="text-[11px] text-gray-500 mb-3">
        O <strong>% de avanço</strong> de cada mês é calculado = <strong>peso realizado ÷ peso previsto</strong>. Todos os lançamentos são a nível de mês.
      </p>

      <div className="space-y-4">
        {contrato.itens.map((it) => {
          const meses = mesesEntre(it.data_inicio.slice(0, 10), it.data_fim.slice(0, 10))
          const planMap = new Map(it.meses.map((m) => [key(m.ano, m.mes), m]))
          // acumulado = soma(peso realizado informado) / soma(peso previsto do plano)
          let somaReal = 0
          for (const k of Object.keys(dados[it.id] ?? {})) somaReal += parsePeso(dados[it.id]?.[k]?.pesoReal ?? '') ?? 0
          const acum = pctAvanco(pesoPrevItem(it), somaReal)
          return (
            <div key={it.id} className="border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <span className="text-[11px] font-bold text-gray-700">{it.descricao}</span>
                <span className="text-[10px] text-gray-400">Peso total: {it.peso_total != null ? `${fmtPeso(it.peso_total)} t` : '—'}</span>
              </div>
              <div className="overflow-x-auto border border-gray-100 rounded">
                <table className="text-[10px] border-collapse min-w-max">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-1 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50">Indicador</th>
                      {meses.map(({ mes, ano }) => (
                        <th key={key(ano, mes)} className="px-2 py-1 text-center font-semibold text-gray-500 whitespace-nowrap">{MESES_LABELS[mes]}/{String(ano).slice(2)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      <td className="px-2 py-1 text-gray-500 sticky left-0 bg-white whitespace-nowrap">HH Previsto</td>
                      {meses.map(({ mes, ano }) => <td key={key(ano, mes)} className="px-2 py-1 text-center text-gray-500">{planMap.get(key(ano, mes))?.hh_previsto ?? '—'}</td>)}
                    </tr>
                    <tr className="border-t border-gray-100 bg-[#F1F8E9]">
                      <td className="px-2 py-1 font-semibold text-green-dark sticky left-0 bg-[#F1F8E9] whitespace-nowrap">HH Realizado</td>
                      {meses.map(({ mes, ano }) => {
                        const k = key(ano, mes)
                        return <td key={k} className="px-1 py-1"><IntegerInput value={dados[it.id]?.[k]?.hh ?? ''} onChange={(v) => set(it.id, k, 'hh', v)} placeholder="0" /></td>
                      })}
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-2 py-1 text-[#185FA5] sticky left-0 bg-white whitespace-nowrap">Peso Previsto (t)</td>
                      {meses.map(({ mes, ano }) => {
                        const p = planMap.get(key(ano, mes))?.peso_previsto
                        return <td key={key(ano, mes)} className="px-2 py-1 text-center text-[#185FA5]">{p != null ? fmtPeso(p) : '—'}</td>
                      })}
                    </tr>
                    <tr className="border-t border-gray-100 bg-[#E8F5E9]">
                      <td className="px-2 py-1 font-semibold text-green-dark sticky left-0 bg-[#E8F5E9] whitespace-nowrap">Peso Realizado (t)</td>
                      {meses.map(({ mes, ano }) => {
                        const k = key(ano, mes)
                        return <td key={k} className="px-1 py-1"><CurrencyInput value={dados[it.id]?.[k]?.pesoReal ?? ''} onChange={(v) => set(it.id, k, 'pesoReal', v)} placeholder="0,00" /></td>
                      })}
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-2 py-1 font-semibold text-[#1565C0] sticky left-0 bg-white whitespace-nowrap">% Avanço (mês)</td>
                      {meses.map(({ mes, ano }) => {
                        const k = key(ano, mes)
                        const pr = parsePeso(dados[it.id]?.[k]?.pesoReal ?? '') ?? 0
                        const pp = planMap.get(k)?.peso_previsto ?? 0
                        return <td key={k} className="px-2 py-1 text-center text-[#1565C0]">{pr > 0 && pp > 0 ? fmtPct((pr / pp) * 100) : '—'}</td>
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Avanço acumulado: <strong className="text-[#1565C0]">{fmtPct(acum)}</strong></p>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Histórico de alterações do contrato (todos os itens) ─────────────────────
interface HistEntry { id: number; item: string; campo: string; valor_de: string | null; valor_para: string | null; alterado_em: string; alterado_por: string }
function HistoricoFabModal({ contrato, onClose }: { contrato: ContratoFab; onClose: () => void }) {
  const [hist, setHist] = useState<HistEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/acordos/hh/fabricacoes/historico?contrato_id=${contrato.id}`)
      .then((r) => r.json()).then((j) => setHist(j.data ?? []))
      .finally(() => setLoading(false))
  }, [contrato.id])
  return (
    <Modal open onClose={onClose} wide title={`Histórico de Alterações — ${contrato.indice} · ${contrato.cliente.nome}`}
      footer={<ModalCancelButton label="Fechar" />}>
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando histórico...</p>
      ) : hist.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400 text-sm">Nenhuma alteração registrada.</p>
          <p className="text-gray-300 text-xs mt-1">Alterações futuras nos itens aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-green-primary text-white text-[10px] uppercase tracking-wide">
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Data / Hora</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Item</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Campo</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">De</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Para</th>
                <th className="px-3 py-[7px] text-left font-semibold whitespace-nowrap">Alterado por</th>
              </tr>
            </thead>
            <tbody>
              {hist.map((h, idx) => {
                const dt = new Date(h.alterado_em)
                const dataHora = `${formatDate(h.alterado_em) ?? '—'} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                return (
                  <tr key={h.id} className={cn('border-b border-gray-100', idx % 2 ? 'bg-gray-50' : 'bg-white')}>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-500">{dataHora}</td>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-700">{h.item}</td>
                    <td className="px-3 py-[6px] whitespace-nowrap font-semibold text-gray-700">{h.campo}</td>
                    <td className="px-3 py-[6px]"><span className="text-red-500 bg-red-50 rounded px-1.5 py-0.5 whitespace-nowrap">{h.valor_de ?? '—'}</span></td>
                    <td className="px-3 py-[6px]"><span className="text-green-700 bg-green-50 rounded px-1.5 py-0.5 whitespace-nowrap">{h.valor_para ?? '—'}</span></td>
                    <td className="px-3 py-[6px] whitespace-nowrap text-gray-600">{h.alterado_por}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

// ── Resumo: KPIs + cards de avanço (estilo Obras) + gráficos + tabela ────────
const COR = { orcado: '#BA7517', previsto: '#185FA5', realizado: '#16A34A' }

const chartOptsFactory = (fmt: (v: number) => string) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index' as const, intersect: false,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
          ctx.parsed.y == null ? '' : `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { ticks: { font: { size: 10 }, callback: (v: string | number) => typeof v === 'number' ? fmt(v) : v }, grid: { color: '#f0f0f0' } },
  },
})

function Legenda({ series }: { series: [string, string, 'solid' | 'dashed'][] }) {
  return (
    <div className="flex items-center gap-5 mb-3 flex-wrap">
      {series.map(([c, l, style]) => (
        <span key={l} className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-block w-5 h-0.5" style={{
            background: style === 'solid' ? c
              : `repeating-linear-gradient(90deg,${c} 0,${c} 4px,transparent 4px,transparent 8px)`,
          }} />
          {l}
        </span>
      ))}
    </div>
  )
}

// Card estilo Obras com barras de progresso
function AvancoCard({ label, value, color, bgIcon, sub, bars }: {
  label: string; value: string; color: string; bgIcon: string; sub: string
  bars?: { titulo: string; pct: number }[]
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex gap-4">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bgIcon }}>
        <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-normal text-gray-500 mb-1">{label}</p>
        <p className="text-[30px] font-bold leading-none tracking-tight" style={{ color }}>{value}</p>
        <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>
        {bars && bars.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
            {bars.map((b) => (
              <div key={b.titulo}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{b.titulo}</span>
                  <span className="text-[11px] font-bold" style={{ color: barColors(b.pct).text }}>{b.pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, backgroundColor: barColors(b.pct).bg }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResumoFab({ contratos }: { contratos: ContratoFab[] }) {
  const [expandido, setExpandido] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setExpandido((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const itens = useMemo(
    () => contratos.flatMap((c) => c.itens.map((it) => ({ ...it, contrato: c.indice }))),
    [contratos],
  )

  const totals = useMemo(() => {
    let orc = 0, prev = 0, real = 0, pesoPrev = 0, pesoReal = 0
    for (const it of itens) {
      orc += it.meses.reduce((a, m) => a + (m.hh_orcado ?? 0), 0)
      prev += it.meses.reduce((a, m) => a + (m.hh_previsto ?? 0), 0)
      real += it.realizados.reduce((a, r) => a + (r.hh_realizado ?? 0), 0)
      pesoPrev += pesoPrevItem(it)
      pesoReal += pesoRealItem(it)
    }
    return { orc, prev, real, pesoPrev, pesoReal }
  }, [itens])

  // Série mensal agregada (ordenada por ano/mês)
  const serie = useMemo(() => {
    const map = new Map<string, { ano: number; mes: number; orc: number; prev: number; real: number; pesoPrev: number; pesoReal: number }>()
    const get = (ano: number, mes: number) => {
      const k = key(ano, mes)
      if (!map.has(k)) map.set(k, { ano, mes, orc: 0, prev: 0, real: 0, pesoPrev: 0, pesoReal: 0 })
      return map.get(k)!
    }
    for (const it of itens) {
      for (const m of it.meses) { const e = get(m.ano, m.mes); e.orc += m.hh_orcado ?? 0; e.prev += m.hh_previsto ?? 0; e.pesoPrev += m.peso_previsto ?? 0 }
      for (const r of it.realizados) { const e = get(r.ano, r.mes); e.real += r.hh_realizado ?? 0; e.pesoReal += r.peso_realizado ?? 0 }
    }
    return Array.from(map.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes)
  }, [itens])

  if (itens.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Sem itens cadastrados para resumir.</p>
  }

  const pctHhOrc = pctAvanco(totals.orc, totals.real)
  const pctHhPrev = pctAvanco(totals.prev, totals.real)
  const pctPrevOrc = pctAvanco(totals.orc, totals.prev)
  const pctPeso = pctAvanco(totals.pesoPrev, totals.pesoReal)

  const labels = serie.map((s) => `${MESES_LABELS[s.mes]}/${String(s.ano).slice(2)}`)
  const acumular = (arr: number[]) => arr.reduce<number[]>((acc, v) => { const l = acc.length ? acc[acc.length - 1] : 0; return [...acc, l + v] }, [])
  const orcArr = serie.map((s) => s.orc)
  const prevArr = serie.map((s) => s.prev)
  const realArr = serie.map((s) => s.real)
  const pesoPrevArr = serie.map((s) => s.pesoPrev)
  const pesoRealArr = serie.map((s) => s.pesoReal)

  const lineDS = (label: string, data: number[], color: string, dashed: boolean) => ({
    label, data, borderColor: color, backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: dashed ? [6, 3] : [], tension: 0.4,
    pointRadius: 2.5, pointBackgroundColor: color, spanGaps: true,
  })

  const hhMensal = { labels, datasets: [lineDS('Orçado', orcArr, COR.orcado, true), lineDS('Previsto', prevArr, COR.previsto, true), lineDS('Realizado', realArr, COR.realizado, false)] }
  const hhAcum = { labels, datasets: [lineDS('Orçado', acumular(orcArr), COR.orcado, true), lineDS('Previsto', acumular(prevArr), COR.previsto, true), lineDS('Realizado', acumular(realArr), COR.realizado, false)] }
  const pesoMensal = { labels, datasets: [lineDS('Previsto', pesoPrevArr, COR.previsto, true), lineDS('Realizado', pesoRealArr, COR.realizado, false)] }
  const pesoAcum = { labels, datasets: [lineDS('Previsto', acumular(pesoPrevArr), COR.previsto, true), lineDS('Realizado', acumular(pesoRealArr), COR.realizado, false)] }

  const optsHh = chartOptsFactory(fmtHh)
  const optsPeso = chartOptsFactory(fmtPeso)
  const legHh: [string, string, 'solid' | 'dashed'][] = [[COR.orcado, 'Orçado', 'dashed'], [COR.previsto, 'Previsto', 'dashed'], [COR.realizado, 'Realizado', 'solid']]
  const legPeso: [string, string, 'solid' | 'dashed'][] = [[COR.previsto, 'Previsto', 'dashed'], [COR.realizado, 'Realizado', 'solid']]

  return (
    <div className="space-y-4">
      {/* Cards de avanço — estilo Obras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AvancoCard label="HH Orçado" value={fmtHh(totals.orc)} color={COR.orcado} bgIcon="#FEF3C7" sub="total orçado dos itens" />
        <AvancoCard label="HH Previsto" value={fmtHh(totals.prev)} color={COR.previsto} bgIcon="#DBEAFE" sub="distribuído nos meses"
          bars={[{ titulo: '% do Orçado', pct: pctPrevOrc }]} />
        <AvancoCard label="HH Realizado" value={fmtHh(totals.real)} color={COR.realizado} bgIcon="#DCFCE7" sub="acumulado lançado"
          bars={[{ titulo: '% do Orçado', pct: pctHhOrc }, { titulo: '% do Previsto', pct: pctHhPrev }]} />
      </div>

      {/* KPIs de peso e avanço */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <KpiCard label="Peso Previsto (t)" value={fmtPeso(totals.pesoPrev)} color="text-[#185FA5]" />
        <KpiCard label="Peso Realizado (t)" value={fmtPeso(totals.pesoReal)} color="text-green-dark" />
        <KpiCard label="% Avanço (peso)" value={fmtPct(pctPeso)} color="text-[#1565C0]" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Mensal</p>
          <p className="text-[11px] text-gray-400 mb-3">Comparativo mês a mês — Orçado, Previsto e Realizado</p>
          <Legenda series={legHh} />
          <div style={{ height: 230 }}><Line data={hhMensal} options={optsHh} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">HH Acumulado</p>
          <p className="text-[11px] text-gray-400 mb-3">Progressão acumulada dos três indicadores</p>
          <Legenda series={legHh} />
          <div style={{ height: 230 }}><Line data={hhAcum} options={optsHh} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">Peso Mensal (t)</p>
          <p className="text-[11px] text-gray-400 mb-3">Previsto x Realizado mês a mês</p>
          <Legenda series={legPeso} />
          <div style={{ height: 230 }}><Line data={pesoMensal} options={optsPeso} /></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-[13px] font-bold text-gray-700 mb-0.5">Peso Acumulado (t)</p>
          <p className="text-[11px] text-gray-400 mb-3">Progressão acumulada Previsto x Realizado</p>
          <Legenda series={legPeso} />
          <div style={{ height: 230 }}><Line data={pesoAcum} options={optsPeso} /></div>
        </div>
      </div>

      {/* Tabela por item (clique para ver mês a mês) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-green-primary text-white text-[10px] uppercase tracking-wide">
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap w-6"></th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Contrato</th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Item</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Orçado</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Previsto</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">HH Realizado</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Prev. (t)</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Peso Real. (t)</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">% Avanço</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => {
              const orc = it.meses.reduce((a, m) => a + (m.hh_orcado ?? 0), 0)
              const prev = it.meses.reduce((a, m) => a + (m.hh_previsto ?? 0), 0)
              const real = it.realizados.reduce((a, r) => a + (r.hh_realizado ?? 0), 0)
              const pPrev = pesoPrevItem(it)
              const pReal = pesoRealItem(it)
              const aberto = expandido.has(it.id)
              const planMap = new Map(it.meses.map((m) => [key(m.ano, m.mes), m]))
              const realMap = new Map(it.realizados.map((r) => [key(r.ano, r.mes), r]))
              const meses = mesesEntre(it.data_inicio.slice(0, 10), it.data_fim.slice(0, 10))
              return (
                <Fragment key={it.id}>
                  <tr onClick={() => toggle(it.id)}
                    className={cn('border-b border-gray-100 cursor-pointer hover:bg-green-light/40', i % 2 ? 'bg-gray-50' : 'bg-white')}>
                    <td className="px-2 py-1.5 text-center text-gray-400 select-none">{aberto ? '▾' : '▸'}</td>
                    <td className="px-2 py-1.5 font-semibold text-green-dark whitespace-nowrap">{it.contrato}</td>
                    <td className="px-2 py-1.5">{it.descricao}</td>
                    <td className="px-2 py-1.5 text-right">{fmtHh(orc)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtHh(prev)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtHh(real)}</td>
                    <td className="px-2 py-1.5 text-right text-[#185FA5]">{fmtPeso(pPrev)}</td>
                    <td className="px-2 py-1.5 text-right text-green-dark">{fmtPeso(pReal)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-[#1565C0]">{fmtPct(pctAvanco(pPrev, pReal))}</td>
                  </tr>
                  {aberto && meses.map(({ mes, ano }) => {
                    const k = key(ano, mes)
                    const mPlan = planMap.get(k)
                    const mReal = realMap.get(k)
                    const pp = mPlan?.peso_previsto ?? 0
                    const pr = mReal?.peso_realizado ?? 0
                    return (
                      <tr key={`${it.id}-${k}`} className="bg-slate-50/70 border-b border-gray-100 text-[10px] text-gray-600">
                        <td className="bg-slate-50/70"></td>
                        <td colSpan={2} className="px-2 py-1 pl-8 text-gray-500 whitespace-nowrap">{MESES_LABELS[mes]}/{String(ano).slice(2)}</td>
                        <td className="px-2 py-1 text-right">{fmtNumOrDash(mPlan?.hh_orcado)}</td>
                        <td className="px-2 py-1 text-right">{fmtNumOrDash(mPlan?.hh_previsto)}</td>
                        <td className="px-2 py-1 text-right">{fmtNumOrDash(mReal?.hh_realizado)}</td>
                        <td className="px-2 py-1 text-right text-[#185FA5]">{fmtPesoOrDash(mPlan?.peso_previsto)}</td>
                        <td className="px-2 py-1 text-right text-green-dark">{fmtPesoOrDash(mReal?.peso_realizado)}</td>
                        <td className="px-2 py-1 text-right text-[#1565C0]">{pp > 0 && pr > 0 ? fmtPct((pr / pp) * 100) : '—'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const fmtNumOrDash = (v: number | null | undefined) => (v == null ? '—' : fmtHh(v))
const fmtPesoOrDash = (v: number | null | undefined) => (v == null ? '—' : fmtPeso(v))

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-[20px] font-bold', color)}>{value}</p>
    </div>
  )
}
