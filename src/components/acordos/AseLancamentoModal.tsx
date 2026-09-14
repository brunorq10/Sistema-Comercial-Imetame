'use client'

import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { todayInput, formatDate } from '@/lib/utils'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AseItem {
  id: number
  data_servico: string
  data_aprovacao: string
  descricao: string
  volume_horas: number
  criador: string
}

interface Props {
  open: boolean
  onClose: () => void
  contratoId: number
  /** Chamado após criar/editar/excluir, para o pai re-buscar os totais (card Horas ASE). */
  onSalvo: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parser pt-BR ("16,5" / "16.5" / "16") → string numérica plana. */
function parsePtBrHoras(input: string): string {
  const s = input.trim().replace(/\s/g, '')
  if (!s) return ''
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? '' : String(n)
  }
  const n = parseFloat(s)
  return isNaN(n) ? '' : String(n)
}

const locHoras = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const FORM_VAZIO = { dataServico: todayInput(), dataAprovacao: todayInput(), descricao: '', volumeHoras: '' }

// ─── Componente ──────────────────────────────────────────────────────────────

export function AseLancamentoModal({ open, onClose, contratoId, onSalvo }: Props) {
  const [view, setView] = useState<'lista' | 'form'>('lista')
  const [itens, setItens] = useState<AseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)

  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [excluindoLoading, setExcluindoLoading] = useState(false)
  const [excluindoErro, setExcluindoErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErroLista(null)
    try {
      const res = await fetch(`/api/acordos/hh/${contratoId}/ase`)
      const json = await res.json()
      if (!res.ok || json.error) { setErroLista(json.error ?? 'Erro ao carregar lançamentos'); return }
      setItens(json.data ?? [])
    } catch { setErroLista('Erro ao carregar lançamentos') } finally { setLoading(false) }
  }, [contratoId])

  useEffect(() => {
    if (open) { setView('lista'); carregar() }
  }, [open, carregar])

  function abrirNovo() {
    setEditingId(null)
    setForm(FORM_VAZIO)
    setErroForm(null)
    setView('form')
  }

  function abrirEdicao(item: AseItem) {
    setEditingId(item.id)
    setForm({
      dataServico: item.data_servico,
      dataAprovacao: item.data_aprovacao,
      descricao: item.descricao,
      volumeHoras: String(item.volume_horas).replace('.', ','),
    })
    setErroForm(null)
    setView('form')
  }

  async function salvar() {
    if (!form.dataServico) { setErroForm('Informe a data do serviço'); return }
    if (!form.dataAprovacao) { setErroForm('Informe a data de aprovação'); return }
    if (form.dataAprovacao < form.dataServico) { setErroForm('A data de aprovação não pode ser anterior à data do serviço.'); return }
    if (!form.descricao.trim()) { setErroForm('Informe a descrição do serviço'); return }
    const volume = Number(parsePtBrHoras(form.volumeHoras))
    if (!volume || volume <= 0) { setErroForm('Informe o volume de horas'); return }

    setSalvando(true); setErroForm(null)
    try {
      const payload = {
        data_servico: form.dataServico,
        data_aprovacao: form.dataAprovacao,
        descricao: form.descricao.trim(),
        volume_horas: volume,
      }
      const url = editingId
        ? `/api/acordos/hh/${contratoId}/ase/${editingId}`
        : `/api/acordos/hh/${contratoId}/ase`
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErroForm(json.error ?? 'Erro ao salvar'); return }
      await carregar()
      onSalvo()
      setView('lista')
    } finally { setSalvando(false) }
  }

  async function confirmarExclusao() {
    if (excluindoId == null) return
    setExcluindoLoading(true); setExcluindoErro(null)
    try {
      const res = await fetch(`/api/acordos/hh/${contratoId}/ase/${excluindoId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) { setExcluindoErro(json.error ?? 'Erro ao excluir'); return }
      setExcluindoId(null)
      await carregar()
      onSalvo()
    } finally { setExcluindoLoading(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Horas ASE — Serviços Extra Escopo"
      subtitle="Registro informativo — o volume aqui já está contido no HH Realizado, não soma a mais."
      wide
      footer={
        view === 'form' ? (
          <>
            <Button variant="outline" onClick={() => setView('lista')} disabled={salvando}>Voltar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        )
      }
    >
      {view === 'lista' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={abrirNovo}>+ Novo lançamento</Button>
          </div>

          {erroLista && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">{erroLista}</div>}

          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
          ) : itens.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">Nenhum lançamento de ASE registrado.</p>
              <p className="text-gray-300 text-xs mt-1">Use "+ Novo lançamento" para registrar o primeiro serviço extra escopo.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px] border border-gray-100 rounded-md">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="text-left text-[10px] text-gray-500 uppercase border-b border-gray-200 sticky top-0 bg-white">
                    <th className="py-2 px-3 font-semibold">Data do Serviço</th>
                    <th className="py-2 px-3 font-semibold">Data de Aprovação</th>
                    <th className="py-2 px-3 font-semibold">Descrição</th>
                    <th className="py-2 px-3 font-semibold text-right">Volume (h)</th>
                    <th className="py-2 px-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-slate-50/60">
                      <td className="py-2 px-3 whitespace-nowrap text-gray-600">{formatDate(item.data_servico)}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-gray-600">{formatDate(item.data_aprovacao)}</td>
                      <td className="py-2 px-3 max-w-[280px] truncate" title={item.descricao}>{item.descricao}</td>
                      <td className="py-2 px-3 text-right font-semibold text-[#7C3AED] whitespace-nowrap">{locHoras(item.volume_horas)}h</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button onClick={() => abrirEdicao(item)} className="text-[#185FA5] hover:underline text-[11px] font-medium mr-3">Editar</button>
                        <button onClick={() => { setExcluindoId(item.id); setExcluindoErro(null) }} className="text-red-600 hover:underline text-[11px] font-medium">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {erroForm && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">{erroForm}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data do Serviço *">
              <Input type="date" value={form.dataServico} onChange={(e) => setForm((f) => ({ ...f, dataServico: e.target.value }))} />
            </Field>
            <Field label="Data de Aprovação *">
              <Input type="date" value={form.dataAprovacao} onChange={(e) => setForm((f) => ({ ...f, dataAprovacao: e.target.value }))} />
            </Field>
          </div>
          <Field label="Descrição do Serviço *">
            <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o serviço extra escopo realizado..." />
          </Field>
          <Field label="Volume de Horas *" className="max-w-[200px]">
            <input
              type="text" inputMode="decimal"
              value={form.volumeHoras}
              onChange={(e) => setForm((f) => ({ ...f, volumeHoras: e.target.value }))}
              onBlur={(e) => setForm((f) => ({ ...f, volumeHoras: parsePtBrHoras(e.target.value).replace('.', ',') }))}
              placeholder="0,0"
              className="w-full px-2.5 py-[7px] border border-gray-300 rounded text-xs text-gray-900 bg-white outline-none focus:border-green-primary transition-colors"
            />
          </Field>
        </div>
      )}

      <ConfirmDialog
        open={excluindoId != null}
        title="Excluir lançamento ASE"
        message="Este lançamento será removido. A exclusão fica registrada no histórico do acordo."
        variant="danger"
        confirmLabel="Excluir"
        loading={excluindoLoading}
        error={excluindoErro}
        onConfirm={confirmarExclusao}
        onClose={() => setExcluindoId(null)}
      />
    </Modal>
  )
}
