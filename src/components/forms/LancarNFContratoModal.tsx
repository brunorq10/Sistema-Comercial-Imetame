'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, CurrencyInput } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SubIndiceItem, ContratoItem, NFContratoItem } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  contrato: ContratoItem
  subindice: SubIndiceItem
  approvalFlow?: boolean   // responsável: lançamento vai para aprovação da coordenação
}

type Aba = 'lancar' | 'historico'

export function LancarNFContratoModal({ open, onClose, onSuccess, contrato, subindice, approvalFlow }: Props) {
  const [aba, setAba] = useState<Aba>('lancar')
  const [tipoDocumento, setTipoDocumento] = useState<'NF' | 'Recibo' | 'Outros'>('NF')
  const [numeroNF, setNumeroNF] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [percentual, setPercentual] = useState('100')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [enviadoAprovacao, setEnviadoAprovacao] = useState(false)
  const [nfAlocado, setNfAlocado] = useState<number | null>(null)

  const valorAtribuido = valorTotal && percentual
    ? (Number(valorTotal) * Number(percentual)) / 100
    : 0

  useEffect(() => {
    if (open) {
      setAba('lancar')
      setTipoDocumento('NF')
      setNumeroNF(''); setDataEmissao(''); setDataVencimento('')
      setValorTotal(''); setPercentual('100'); setError(null); setWarning(null); setNfAlocado(null); setEnviadoAprovacao(false)
    }
  }, [open])

  const handleNumeroNFBlur = async () => {
    if (!numeroNF.trim()) { setNfAlocado(null); return }
    try {
      const res = await fetch(`/api/faturamento/nfs/percentual-total?numero_nf=${encodeURIComponent(numeroNF.trim())}`)
      if (res.ok) {
        const json = await res.json()
        const total = Number(json.data?.total ?? 0)
        setNfAlocado(total)
        if (total > 0) {
          const restante = 100 - total
          setPercentual(restante > 0 ? String(restante) : '0')
        }
      }
    } catch { /* silencia — não bloqueia o lançamento */ }
  }

  const handleSubmit = async () => {
    if (!numeroNF.trim()) { setError('Número da NF obrigatório'); return }
    if (!dataEmissao) { setError('Data de emissão obrigatória'); return }
    if (!dataVencimento) { setError('Data de vencimento obrigatória'); return }
    if (!valorTotal || Number(valorTotal) <= 0) { setError('Valor total inválido'); return }
    if (!percentual || Number(percentual) <= 0 || Number(percentual) > 100) { setError('Percentual deve estar entre 0,01 e 100'); return }

    setLoading(true); setError(null); setWarning(null)
    try {
      const res = await fetch(`/api/faturamento/subindices/${subindice.id}/nfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_nf: numeroNF,
          valor_total_nf: Number(valorTotal),
          percentual: Number(percentual),
          data_emissao: dataEmissao,
          data_vencimento: dataVencimento,
          tipo_documento: tipoDocumento,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao lançar faturamento'); return }
      // Responsável: lançamento enviado para aprovação da coordenação
      if (json.pendente) { setEnviadoAprovacao(true); onSuccess(); return }
      // RN-CF-16: alerta informativo (não bloqueia)
      if (json.warning) { setWarning(json.warning); onSuccess(); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  const indiceSubindice = `${contrato.indice}.${subindice.ordem}`
  const nfsAtivas = subindice.notas_fiscais.filter((nf) => nf.ativa)
  const nfsInativas = subindice.notas_fiscais.filter((nf) => !nf.ativa)

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={`NF — ${indiceSubindice} · ${subindice.descricao}`}
      wide
      footer={
        enviadoAprovacao ? (
          <ModalCancelButton label="Fechar" />
        ) : aba === 'lancar' ? (
          <>
            <ModalCancelButton disabled={loading} />
            <Button onClick={handleSubmit} disabled={loading}>
              {loading
                ? (approvalFlow ? 'Enviando...' : 'Lançando...')
                : (approvalFlow ? 'Enviar para Aprovação' : 'Lançar Faturamento')}
            </Button>
          </>
        ) : (
          <ModalCancelButton label="Fechar" />
        )
      }
    >
      {/* ── Abas ── */}
      <div className="flex border-b border-gray-200 mb-4 -mt-1">
        <button
          onClick={() => setAba('lancar')}
          className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors ${
            aba === 'lancar'
              ? 'border-green-primary text-green-primary'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Lançar Faturamento
        </button>
        <button
          onClick={() => setAba('historico')}
          className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            aba === 'historico'
              ? 'border-green-primary text-green-primary'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          NFs lançadas
          {subindice.notas_fiscais.length > 0 && (
            <span className="bg-gray-200 text-gray-600 rounded-full text-[10px] px-1.5 py-0.5 leading-none">
              {subindice.notas_fiscais.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Lançamento enviado para aprovação ── */}
      {enviadoAprovacao && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center my-2">
          <p className="text-[28px] mb-1">✅</p>
          <p className="text-[13px] font-semibold text-green-800">Lançamento enviado para aprovação</p>
          <p className="text-[11px] text-green-700 mt-1">
            O faturamento foi registrado e está aguardando aprovação da coordenação de Acordos.
            Ele <strong>só entrará no faturamento após a aprovação</strong>.
          </p>
        </div>
      )}

      {/* ── Aba: Lançar Faturamento ── */}
      {!enviadoAprovacao && aba === 'lancar' && (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
          )}
          {warning && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs px-3 py-2 rounded mb-4 flex gap-2 items-start">
              <span className="text-sm">⚠</span>
              <span>{warning} O lançamento foi registrado normalmente.</span>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Índice</p>
              <p className="text-[12px] font-bold text-green-dark">{indiceSubindice}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Cliente</p>
              <p className="text-[12px] font-medium">{contrato.cliente.nome}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Nº OS</p>
              <p className="text-[12px]">{subindice.num_os ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Evento de medição</p>
              <p className="text-[12px]">{subindice.descricao}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Valor do evento</p>
              <p className="text-[12px] font-semibold">{formatCurrency(subindice.valor_total)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Já faturado</p>
              <p className="text-[12px] font-semibold text-auto-value">{formatCurrency(subindice.total_faturado)}</p>
            </div>
          </div>

          <ModalSection>Dados do documento fiscal</ModalSection>

          <div className="mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de documento *</p>
            <div className="flex gap-3">
              {(['NF', 'Recibo', 'Outros'] as const).map((tipo) => (
                <label key={tipo} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo_documento"
                    value={tipo}
                    checked={tipoDocumento === tipo}
                    onChange={() => setTipoDocumento(tipo)}
                    className="accent-green-primary"
                  />
                  <span className="text-[12px] font-medium text-gray-700">{tipo}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="Número da NF *" className="col-span-2">
              <Input
                placeholder="Ex: 000123"
                value={numeroNF}
                onChange={(e) => { setNumeroNF(e.target.value); setNfAlocado(null) }}
                onBlur={handleNumeroNFBlur}
              />
              {nfAlocado !== null && nfAlocado > 0 && (
                <p className={`text-[10px] mt-1 ${nfAlocado >= 100 ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
                  {nfAlocado >= 100
                    ? `NF ${numeroNF} já tem 100% alocados — não é possível adicionar novos lançamentos.`
                    : `NF ${numeroNF} já possui ${nfAlocado.toFixed(2)}% alocados. Disponível: ${(100 - nfAlocado).toFixed(2)}%`}
                </p>
              )}
            </Field>
            <Field label="Data de emissão *">
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </Field>
            <Field label="Data de vencimento *">
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            </Field>
            <Field label="Valor total da NF (R$) *">
              <CurrencyInput
                value={valorTotal}
                onChange={setValorTotal}
              />
            </Field>
            <Field label="% referente a este item">
              <Input
                type="number" min="0.01" max="100" step="0.01" placeholder="100"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
              />
            </Field>
          </div>

          <div className="bg-auto-bg border border-auto-value/30 rounded-md p-3 mb-2">
            <p className="text-[10px] text-auto-value font-semibold uppercase tracking-wide mb-0.5">
              Valor atribuído a este item
            </p>
            <p className="text-[18px] font-bold text-auto-value">{formatCurrency(valorAtribuido)}</p>
          </div>

          {Number(percentual) < 100 && Number(percentual) > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded">
              ⚠ O percentual restante ({(100 - Number(percentual)).toFixed(2)}%) deve ser lançado em outro item.
            </div>
          )}
        </>
      )}

      {/* ── Aba: Histórico de NFs ── */}
      {aba === 'historico' && (
        <NFHistoricoTab nfs={subindice.notas_fiscais} valorEvento={subindice.valor_total} />
      )}
    </Modal>
  )
}

function NFHistoricoTab({ nfs, valorEvento }: { nfs: NFContratoItem[]; valorEvento: number }) {
  if (nfs.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-[12px]">
        Nenhuma NF lançada para este item ainda.
      </div>
    )
  }

  const ativas    = nfs.filter((nf) => nf.ativa)
  const pendentes = nfs.filter((nf) => !nf.ativa && nf.status_aprovacao === 'PENDENTE')
  const inativas  = nfs.filter((nf) => !nf.ativa && nf.status_aprovacao !== 'PENDENTE')
  const totalAtribuido = ativas.reduce((a, nf) => a + nf.valor_atribuido, 0)

  return (
    <div>
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5">
          <p className="text-[9px] text-gray-400 uppercase mb-0.5">Total faturado (ativas)</p>
          <p className="text-[14px] font-bold text-auto-value">{formatCurrency(totalAtribuido)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5">
          <p className="text-[9px] text-gray-400 uppercase mb-0.5">Valor do evento</p>
          <p className="text-[14px] font-bold text-green-dark">{formatCurrency(valorEvento)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5">
          <p className="text-[9px] text-gray-400 uppercase mb-0.5">A faturar</p>
          <p className={`text-[14px] font-bold ${valorEvento - totalAtribuido > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {formatCurrency(Math.max(0, valorEvento - totalAtribuido))}
          </p>
        </div>
      </div>

      {/* Tabela NFs ativas */}
      {ativas.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Notas fiscais ativas</p>
          <NFTable nfs={ativas} />
        </>
      )}

      {/* Tabela NFs em aprovação */}
      {pendentes.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1.5">⏳ Em aprovação (aguardando a coordenação — ainda não entram no faturamento)</p>
          <NFTable nfs={pendentes} inativa />
        </div>
      )}

      {/* Tabela NFs inativas */}
      {inativas.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Notas inativas (não entram no faturamento)</p>
          <NFTable nfs={inativas} inativa />
        </div>
      )}
    </div>
  )
}

function NFTable({ nfs, inativa }: { nfs: NFContratoItem[]; inativa?: boolean }) {
  const thCls = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50'
  const tdCls = `px-3 py-2 text-[11px] whitespace-nowrap border-b border-gray-100 ${inativa ? 'text-gray-400' : 'text-gray-700'}`

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={thCls}>Tipo</th>
            <th className={thCls}>Nº Doc.</th>
            <th className={thCls}>Dt. Emissão</th>
            <th className={thCls}>Dt. Vencimento</th>
            <th className={thCls}>Vlr. Total</th>
            <th className={thCls}>% Item</th>
            <th className={thCls}>% Lançado</th>
            <th className={thCls}>Vlr. Atribuído</th>
            {inativa && <th className={thCls}>Motivo</th>}
          </tr>
        </thead>
        <tbody>
          {nfs.map((nf) => (
            <tr key={nf.id} className={inativa ? 'bg-gray-50/50' : 'hover:bg-gray-50'}>
              <td className={tdCls}>
                <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1 py-0.5">{nf.tipo_documento ?? 'NF'}</span>
              </td>
              <td className={tdCls}>
                <span className={`font-semibold ${inativa ? 'line-through text-gray-400' : 'text-green-dark'}`}>
                  {nf.numero_nf}
                </span>
              </td>
              <td className={tdCls}>{formatDate(nf.data_emissao)}</td>
              <td className={tdCls}>{formatDate(nf.data_vencimento)}</td>
              <td className={tdCls}>{formatCurrency(nf.valor_total_nf)}</td>
              <td className={tdCls}>{Number(nf.percentual).toFixed(2)}%</td>
              <td className={tdCls}>
                {(() => {
                  const total = Number(nf.percentual_total)
                  const fmt = total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                  if (total >= 100) return <span className="font-semibold text-green-700">{fmt}%</span>
                  if (total > 0)    return <span className="font-semibold text-orange-500">{fmt}%</span>
                  return <span className="text-gray-300">0%</span>
                })()}
              </td>
              <td className={tdCls}>
                <span className={inativa ? '' : 'font-semibold text-auto-value'}>
                  {formatCurrency(nf.valor_atribuido)}
                </span>
              </td>
              {inativa && (
                <td className={tdCls}>
                  <span className="text-gray-400 italic text-[10px]">{nf.motivo_inativacao ?? '—'}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

