'use client'

import { useState } from 'react'
import { Modal, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, IntegerInput, CurrencyInput } from '@/components/ui/Input'
import {
  MESES_LABELS, mesesEntre, key, pesoPrevItem, pctAvanco, fmtPeso, fmtPct,
  type ContratoFab,
} from '@/lib/fabricacoes'

// ── Cadastro de itens: descrição/peso/datas + HH orçado/previsto + peso previsto/mês ──
interface ItemForm {
  _key: string
  id: number | null
  descricao: string
  peso_total: string
  data_inicio: string
  data_fim: string
  // chave `${ano}-${mes}` → { orcado, previsto, pesoPrev }
  meses: Record<string, { orcado: string; previsto: string; pesoPrev: string }>
}

const parsePeso = (v: string) => v ? Number(v.replace(/\./g, '').replace(',', '.')) : null

// Soma/subtrai um mês de uma data YYYY-MM-DD, sempre retornando o dia 01 do mês
// alvo (mesesEntre só compara ano/mês, o dia não afeta quais meses aparecem).
function ajustarUmMes(dataRef: string, direcao: 1 | -1): string {
  const d = new Date(dataRef + 'T00:00:00')
  let mes = d.getUTCMonth() + direcao
  let ano = d.getUTCFullYear()
  if (mes > 11) { mes = 0; ano++ }
  if (mes < 0) { mes = 11; ano-- }
  return `${ano}-${String(mes + 1).padStart(2, '0')}-01`
}

export function CadastroModal({ contrato, onClose, onSuccess }: {
  contrato: ContratoFab; onClose: () => void; onSuccess: () => void
}) {
  const init: ItemForm[] = contrato.itens.length > 0
    ? contrato.itens.map((it) => ({
        _key: String(it.id),
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
    : [{ _key: 'novo-0', id: null, descricao: '', peso_total: '', data_inicio: '', data_fim: '', meses: {} }]

  const [itens, setItens] = useState<ItemForm[]>(init)
  const [novoContador, setNovoContador] = useState(1)
  // Meses adicionados nesta sessão de edição (só para destaque visual, por item)
  const [mesesNovos, setMesesNovos] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upd = (i: number, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  const updMes = (i: number, k: string, campo: 'orcado' | 'previsto' | 'pesoPrev', v: string) =>
    setItens((prev) => prev.map((it, idx) => {
      if (idx !== i) return it
      const cur = it.meses[k] ?? { orcado: '', previsto: '', pesoPrev: '' }
      return { ...it, meses: { ...it.meses, [k]: { ...cur, [campo]: v } } }
    }))
  const addItem = () => {
    setItens((p) => [...p, { _key: `novo-${novoContador}`, id: null, descricao: '', peso_total: '', data_inicio: '', data_fim: '', meses: {} }])
    setNovoContador((n) => n + 1)
  }
  const rmItem = (i: number) => setItens((p) => p.filter((_, idx) => idx !== i))

  const addMes = (i: number) => {
    const it = itens[i]
    const meses = mesesEntre(it.data_inicio, it.data_fim)
    if (meses.length === 0) return
    const novaDataFim = ajustarUmMes(it.data_fim, 1)
    const [novoAno, novoMes] = novaDataFim.split('-').map(Number)
    const novaChave = key(novoAno, novoMes - 1)
    upd(i, { data_fim: novaDataFim })
    setMesesNovos((p) => {
      const s = new Set(p[it._key] ?? [])
      s.add(novaChave)
      return { ...p, [it._key]: s }
    })
  }
  const rmUltimoMes = (i: number) => {
    const it = itens[i]
    const meses = mesesEntre(it.data_inicio, it.data_fim)
    const ultimo = meses[meses.length - 1]
    if (!ultimo) return
    const k = key(ultimo.ano, ultimo.mes)
    upd(i, { data_fim: ajustarUmMes(it.data_fim, -1) })
    setMesesNovos((p) => {
      const s = new Set(p[it._key] ?? [])
      s.delete(k)
      return { ...p, [it._key]: s }
    })
  }

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
    <Modal open onClose={onClose} wide
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
          const novosDoItem = mesesNovos[it._key] ?? new Set<string>()
          const ultimaChave = meses.length > 0 ? key(meses[meses.length - 1].ano, meses[meses.length - 1].mes) : null
          return (
            <div key={it._key} className="border border-gray-200 rounded-md p-3">
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
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          const novo = novosDoItem.has(k)
                          return (
                            <th key={k} className={`px-1 py-1 text-center font-semibold whitespace-nowrap w-[84px] ${novo ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>
                              {MESES_LABELS[mes]}/{String(ano).slice(2)}
                              {novo && (
                                <span className="flex items-center justify-center gap-1 mt-0.5">
                                  <span className="text-[8px] font-bold uppercase">novo</span>
                                  {k === ultimaChave && (
                                    <button onClick={() => rmUltimoMes(i)} title="Remover este mês" className="text-red-400 hover:text-red-600 leading-none">×</button>
                                  )}
                                </span>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100">
                        <td className="px-2 py-1 font-semibold text-gray-500 sticky left-0 bg-white whitespace-nowrap">HH Orçado</td>
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          return <td key={k} className={`px-1 py-1 w-[84px] ${novosDoItem.has(k) ? 'bg-green-50' : ''}`}><IntegerInput value={it.meses[k]?.orcado ?? ''} onChange={(v) => updMes(i, k, 'orcado', v)} placeholder="0" className="h-7 text-center" /></td>
                        })}
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="px-2 py-1 font-semibold text-gray-500 sticky left-0 bg-white whitespace-nowrap">HH Previsto</td>
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          return <td key={k} className={`px-1 py-1 w-[84px] ${novosDoItem.has(k) ? 'bg-green-50' : ''}`}><IntegerInput value={it.meses[k]?.previsto ?? ''} onChange={(v) => updMes(i, k, 'previsto', v)} placeholder="0" className="h-7 text-center" /></td>
                        })}
                      </tr>
                      <tr className="border-t border-gray-100 bg-[#E3F2FD]">
                        <td className="px-2 py-1 font-semibold text-[#185FA5] sticky left-0 bg-[#E3F2FD] whitespace-nowrap">Peso Previsto (t)</td>
                        {meses.map(({ mes, ano }) => {
                          const k = key(ano, mes)
                          return <td key={k} className={`px-1 py-1 w-[84px] ${novosDoItem.has(k) ? 'bg-green-50' : ''}`}><CurrencyInput value={it.meses[k]?.pesoPrev ?? ''} onChange={(v) => updMes(i, k, 'pesoPrev', v)} placeholder="0,00" className="h-7 text-center" /></td>
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {it.data_inicio && it.data_fim && (
                <button onClick={() => addMes(i)}
                  className="mt-2 text-[10px] font-semibold text-green-primary border border-dashed border-green-primary rounded px-2 py-1 hover:bg-green-light transition-colors">
                  + Adicionar mês
                </button>
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
export function LancamentoModal({ contrato, onClose, onSuccess }: {
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
    <Modal open onClose={onClose} wide hasChanges
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
                        <th key={key(ano, mes)} className="px-1 py-1 text-center font-semibold text-gray-500 whitespace-nowrap w-[84px]">{MESES_LABELS[mes]}/{String(ano).slice(2)}</th>
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
                        return <td key={k} className="px-1 py-1 w-[84px]"><IntegerInput value={dados[it.id]?.[k]?.hh ?? ''} onChange={(v) => set(it.id, k, 'hh', v)} placeholder="0" className="h-7 text-center" /></td>
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
                        return <td key={k} className="px-1 py-1 w-[84px]"><CurrencyInput value={dados[it.id]?.[k]?.pesoReal ?? ''} onChange={(v) => set(it.id, k, 'pesoReal', v)} placeholder="0,00" className="h-7 text-center" /></td>
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
