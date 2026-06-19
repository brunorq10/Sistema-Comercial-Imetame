'use client'

import { useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, AutoInput, CurrencyInput } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'

interface Equipamento {
  descricao: string
  peso_ton: string
  valor_total: string
  observacoes: string
}

const equipamentoVazio = (): Equipamento => ({
  descricao: '',
  peso_ton: '',
  valor_total: '',
  observacoes: '',
})

function rskg(valor: number, pesoTon: number): string {
  if (pesoTon <= 0 || valor <= 0) return '—'
  return formatCurrency(valor / (pesoTon * 1000)) + '/kg'
}

function formatTon(ton: number): string {
  return ton.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
  classificacao: string
}

export function RegistrarFabricacaoModal({
  open, onClose, onSuccess, solicitacaoId, numero, classificacao,
}: Props) {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([equipamentoVazio()])
  const [possuiTestes, setPossuiTestes] = useState(false)
  const [descricaoTestes, setDescricaoTestes] = useState('')
  const [valorTestes, setValorTestes] = useState('')
  const [possuiMontagem, setPossuiMontagem] = useState(false)
  const [valorMontagem, setValorMontagem] = useState('')
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split('T')[0])
  const [dataBase, setDataBase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateEquipamento = (idx: number, field: keyof Equipamento, value: string) => {
    setEquipamentos((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEquipamento = () => setEquipamentos((prev) => [...prev, equipamentoVazio()])
  const removeEquipamento = (idx: number) => setEquipamentos((prev) => prev.filter((_, i) => i !== idx))

  // Cálculos por equipamento
  const rows = equipamentos.map((e) => ({
    peso: Number(e.peso_ton) || 0,
    valor: Number(e.valor_total) || 0,
  }))

  // Subtotal
  const pesoTotalEquip = rows.reduce((a, r) => a + r.peso, 0)
  const valorTotalEquip = rows.reduce((a, r) => a + r.valor, 0)

  // Testes
  const numTestes = possuiTestes ? (Number(valorTestes) || 0) : 0

  // Montagem
  const numMontagem = possuiMontagem ? (Number(valorMontagem) || 0) : 0

  // Total geral
  const valorTotalGeral = valorTotalEquip + numTestes + numMontagem

  const resetForm = () => {
    setEquipamentos([equipamentoVazio()])
    setPossuiTestes(false)
    setDescricaoTestes('')
    setValorTestes('')
    setPossuiMontagem(false)
    setValorMontagem('')
    setDataEnvio(new Date().toISOString().split('T')[0])
    setDataBase('')
    setError(null)
  }

  const handleSubmit = async () => {
    const equipsValidos = equipamentos.filter((e) => e.descricao.trim() && Number(e.peso_ton) > 0)
    if (equipsValidos.length === 0) { setError('Adicione ao menos um equipamento com descrição e peso'); return }
    if (!dataBase) { setError('Informe a Data base do contrato'); return }
    if (!dataEnvio) { setError('Data de envio é obrigatória'); return }

    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        equipamentos: equipsValidos.map((e) => ({
          descricao: e.descricao.trim(),
          peso_ton: Number(e.peso_ton),
          valor_total: Number(e.valor_total),
          ...(e.observacoes.trim() ? { observacoes: e.observacoes.trim() } : {}),
        })),
        possui_testes: possuiTestes,
        possui_montagem: possuiMontagem,
        data_base: dataBase,
        data_envio: dataEnvio,
      }
      if (possuiTestes) {
        if (descricaoTestes.trim()) body.descricao_testes = descricaoTestes.trim()
        if (numTestes > 0) body.valor_testes = numTestes
      }
      if (possuiMontagem && numMontagem > 0) body.valor_montagem = numMontagem

      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-fabricacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }

      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const tipoLabel = classificacao === 'FABRICACOES' ? 'Fabricações' : 'Óleo e Gás'

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={`Registrar Proposta · ${numero} · ${tipoLabel}`}
      extraWide
      footer={
        <>
          <ModalCancelButton disabled={loading} />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar envio'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* ── Seção 1: Equipamentos ─────────────────────────────────── */}
      <ModalSection>1. Equipamentos a fabricar</ModalSection>

      <div className="flex flex-col gap-3 mb-3">
        {equipamentos.map((eq, idx) => {
          const pesoNum = Number(eq.peso_ton) || 0
          const valorNum = Number(eq.valor_total) || 0
          return (
            <div key={idx} className="border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Equipamento {idx + 1}
                </span>
                {equipamentos.length > 1 && (
                  <button
                    onClick={() => removeEquipamento(idx)}
                    className="text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-0.5"
                  >
                    ✕ Remover
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-2">
                <Field label="Descrição" className="col-span-1">
                  <Input
                    placeholder="Ex: Vaso de pressão V-101"
                    value={eq.descricao}
                    onChange={(e) => updateEquipamento(idx, 'descricao', e.target.value)}
                  />
                </Field>
                <Field label="Peso (ton)">
                  <CurrencyInput
                    value={eq.peso_ton}
                    onChange={(v) => updateEquipamento(idx, 'peso_ton', v)}
                  />
                </Field>
                <Field label="Valor Total (R$)">
                  <CurrencyInput
                    value={eq.valor_total}
                    onChange={(v) => updateEquipamento(idx, 'valor_total', v)}
                  />
                </Field>
              </div>

              {/* R$/kg calculado */}
              {pesoNum > 0 && valorNum > 0 && (
                <div className="mb-2">
                  <p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/kg</p>
                  <p className="text-[11px] font-bold text-auto-value">{rskg(valorNum, pesoNum)}</p>
                </div>
              )}

              <Field label="Observações">
                <Input
                  placeholder="Opcional..."
                  value={eq.observacoes}
                  onChange={(e) => updateEquipamento(idx, 'observacoes', e.target.value)}
                />
              </Field>
            </div>
          )
        })}
      </div>

      <button
        onClick={addEquipamento}
        className="text-[11px] text-green-primary border border-green-primary/40 rounded px-3 py-1.5 hover:bg-green-light transition-colors mb-4"
      >
        + Adicionar equipamento
      </button>

      {/* ── Seção 2: Subtotal ─────────────────────────────────────── */}
      {equipamentos.length > 0 && (pesoTotalEquip > 0 || valorTotalEquip > 0) && (
        <>
          <ModalSection>2. Subtotal — Equipamentos</ModalSection>
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-bold">Peso Total (ton)</p>
              <p className="text-[13px] font-bold text-gray-700">{formatTon(pesoTotalEquip)} ton</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-bold">Valor Equipamentos</p>
              <p className="text-[13px] font-bold text-gray-700">{formatCurrency(valorTotalEquip)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-bold">R$/kg médio</p>
              <p className="text-[13px] font-bold text-auto-value">{rskg(valorTotalEquip, pesoTotalEquip)}</p>
            </div>
          </div>
        </>
      )}

      {/* ── Seção 3: Testes ───────────────────────────────────────── */}
      <ModalSection>3. Testes</ModalSection>

      <div className="flex gap-3 mb-3">
        <button
          onClick={() => setPossuiTestes(false)}
          className={`text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${
            !possuiTestes
              ? 'bg-green-primary text-white border-green-primary'
              : 'bg-white text-gray-500 border-gray-300'
          }`}
        >
          Não
        </button>
        <button
          onClick={() => setPossuiTestes(true)}
          className={`text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${
            possuiTestes
              ? 'bg-green-primary text-white border-green-primary'
              : 'bg-white text-gray-500 border-gray-300'
          }`}
        >
          Sim — será necessário realizar testes
        </button>
      </div>

      {possuiTestes && (
        <div className="pl-4 border-l-2 border-green-primary/30 mb-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Descrição dos testes">
              <Input
                placeholder="Ex: Teste hidrostático, inspeção por ultrassom..."
                value={descricaoTestes}
                onChange={(e) => setDescricaoTestes(e.target.value)}
              />
            </Field>
            <Field label="Valor dos testes (R$)">
              <CurrencyInput value={valorTestes} onChange={setValorTestes} />
            </Field>
          </div>
        </div>
      )}

      {/* ── Seção 4: Montagem ─────────────────────────────────────── */}
      <ModalSection>4. Montagem</ModalSection>
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => setPossuiMontagem(false)}
          className={`text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${
            !possuiMontagem
              ? 'bg-green-primary text-white border-green-primary'
              : 'bg-white text-gray-500 border-gray-300'
          }`}
        >
          Não
        </button>
        <button
          onClick={() => setPossuiMontagem(true)}
          className={`text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${
            possuiMontagem
              ? 'bg-green-primary text-white border-green-primary'
              : 'bg-white text-gray-500 border-gray-300'
          }`}
        >
          Sim — haverá montagem
        </button>
      </div>
      {possuiMontagem && (
        <div className="pl-4 border-l-2 border-green-primary/30 mb-4">
          <Field label="Valor da Montagem (R$)">
            <CurrencyInput value={valorMontagem} onChange={setValorMontagem} />
          </Field>
        </div>
      )}

      {/* ── Seção 5: Total Geral ──────────────────────────────────── */}
      {valorTotalGeral > 0 && (
        <>
          <ModalSection>5. Total Geral</ModalSection>
          <div className="bg-[#EEF7EE] border border-[#C8E6C9] rounded p-3 mb-4">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-bold">Peso Total (ton)</p>
                <p className="text-[15px] font-bold text-gray-700">{formatTon(pesoTotalEquip)} ton</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-bold">Valor Total</p>
                <p className="text-[15px] font-bold text-auto-value">{formatCurrency(valorTotalGeral)}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-bold">R$/kg final</p>
                <p className="text-[15px] font-bold text-auto-value">{rskg(valorTotalGeral, pesoTotalEquip)}</p>
              </div>
            </div>
            {(numTestes > 0 || numMontagem > 0) && (
              <div className="text-[10px] text-gray-500 flex gap-4 pt-2 border-t border-[#C8E6C9]">
                <span>Equipamentos: {formatCurrency(valorTotalEquip)}</span>
                {numTestes > 0 && <span>Testes: {formatCurrency(numTestes)}</span>}
                {numMontagem > 0 && <span>Montagem: {formatCurrency(numMontagem)}</span>}
              </div>
            )}
          </div>
        </>
      )}

      <Field label="Data base do contrato *" className="mb-4 max-w-[200px]">
        <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
      </Field>

      {/* ── Seção 6: Data de envio ────────────────────────────────── */}
      <ModalSection>6. Data de envio</ModalSection>
      <Field label="Data de envio da proposta">
        <Input
          type="date"
          value={dataEnvio}
          onChange={(e) => setDataEnvio(e.target.value)}
          className="max-w-[200px]"
        />
      </Field>
    </Modal>
  )
}

