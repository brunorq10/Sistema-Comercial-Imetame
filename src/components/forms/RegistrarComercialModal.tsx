'use client'

import { useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, AutoInput, CurrencyInput } from '@/components/ui/Input'
import { formatDate, formatCurrency } from '@/lib/utils'

interface PropostaTecnica {
  id: number
  versao: number
  hh_direto: number | null
  hh_indireto: number | null
  peso_montagem: string | null
  data_envio: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
  propostasTecnicas: PropostaTecnica[]
}

export function RegistrarComercialModal({
  open, onClose, onSuccess, solicitacaoId, numero, propostasTecnicas,
}: Props) {
  // RN-36: pré-seleciona N/A quando não há técnica disponível
  const [naoAplicavel, setNaoAplicavel] = useState(() => propostasTecnicas.length === 0)
  const [tecnicaId, setTecnicaId] = useState('')
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split('T')[0])

  // Campos comerciais
  const [valorMontagem, setValorMontagem] = useState('')
  const [possuiTerceiros, setPossuiTerceiros] = useState(false)
  const [valEletrica, setValEletrica] = useState('')
  const [valIsolamento, setValIsolamento] = useState('')
  const [valCivil, setValCivil] = useState('')
  const [valFibra, setValFibra] = useState('')
  const [valOutros, setValOutros] = useState('')
  const [possuiFabricacao, setPossuiFabricacao] = useState(false)
  const [valorFabricacao, setValorFabricacao] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tecnicaSelecionada = propostasTecnicas.find((pt) => String(pt.id) === tecnicaId) ?? null

  const hhTotalTec =
    tecnicaSelecionada && tecnicaSelecionada.hh_direto !== null && tecnicaSelecionada.hh_indireto !== null
      ? tecnicaSelecionada.hh_direto + tecnicaSelecionada.hh_indireto
      : null
  const percIndireto =
    hhTotalTec && tecnicaSelecionada?.hh_indireto
      ? ((tecnicaSelecionada.hh_indireto / hhTotalTec) * 100).toFixed(1) + '%'
      : null

  // Cálculos automáticos
  const numMontagem = Number(valorMontagem) || 0
  const totalTerceiros = possuiTerceiros
    ? (Number(valEletrica) || 0) + (Number(valIsolamento) || 0) + (Number(valCivil) || 0) + (Number(valFibra) || 0) + (Number(valOutros) || 0)
    : 0
  const numFabricacao = possuiFabricacao ? (Number(valorFabricacao) || 0) : 0
  const totalGeral = numMontagem + totalTerceiros + numFabricacao
  const rshhMecanica = hhTotalTec && hhTotalTec > 0 && numMontagem > 0 ? numMontagem / hhTotalTec : null
  const rshhTotal = hhTotalTec && hhTotalTec > 0 && totalGeral > 0 ? totalGeral / hhTotalTec : null

  const resetForm = () => {
    setNaoAplicavel(propostasTecnicas.length === 0)
    setTecnicaId('')
    setDataEnvio(new Date().toISOString().split('T')[0])
    setValorMontagem('')
    setPossuiTerceiros(false)
    setValEletrica(''); setValIsolamento(''); setValCivil(''); setValFibra(''); setValOutros('')
    setPossuiFabricacao(false)
    setValorFabricacao('')
    setError(null)
  }

  const handleSubmit = async () => {
    if (naoAplicavel) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-comercial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nao_aplicavel: true, data_envio: dataEnvio }),
        })
        const json = await res.json()
        if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }
        resetForm(); onSuccess(); onClose()
      } finally { setLoading(false) }
      return
    }

    if (!tecnicaId) { setError('Selecione a revisão técnica de referência'); return }
    if (!valorMontagem || numMontagem <= 0) { setError('Informe o Valor Total da Montagem Mecânica'); return }

    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        proposta_tecnica_id: Number(tecnicaId),
        valor_montagem_mecanica: numMontagem,
        possui_terceiros: possuiTerceiros,
        possui_fabricacao: possuiFabricacao,
        data_envio: dataEnvio,
      }
      if (possuiTerceiros) {
        if (Number(valEletrica) > 0) body.valor_eletrica = Number(valEletrica)
        if (Number(valIsolamento) > 0) body.valor_isolamento = Number(valIsolamento)
        if (Number(valCivil) > 0) body.valor_civil = Number(valCivil)
        if (Number(valFibra) > 0) body.valor_fibra = Number(valFibra)
        if (Number(valOutros) > 0) body.valor_outros_terceiros = Number(valOutros)
      }
      if (possuiFabricacao && numFabricacao > 0) body.valor_fabricacao = numFabricacao

      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-comercial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }

      resetForm()
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar Envio — Proposta Comercial · ${numero}`}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* RN-36: toggle N/A — pré-selecionado quando sem técnica */}
      <div className={`flex items-center gap-2 mb-3 p-2.5 rounded border ${naoAplicavel ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
        <input
          id="nao-aplicavel-com"
          type="checkbox"
          checked={naoAplicavel}
          onChange={(e) => setNaoAplicavel(e.target.checked)}
          className="accent-amber-500"
        />
        <label htmlFor="nao-aplicavel-com" className="text-[12px] font-medium cursor-pointer">
          Proposta Comercial N/A
          {propostasTecnicas.length === 0 && (
            <span className="ml-1.5 text-[10px] text-amber-600 font-normal">(nenhuma técnica disponível)</span>
          )}
        </label>
      </div>

      {!naoAplicavel && (
      <>
      <ModalSection>1. Revisão técnica de referência</ModalSection>

      <Field label="Revisão técnica referente a esta comercial">
        <Select value={tecnicaId} onChange={(e) => setTecnicaId(e.target.value)}>
          <option value="">Selecione...</option>
          {propostasTecnicas.map((pt) => (
            <option key={pt.id} value={pt.id}>
              Rev{String(pt.versao - 1).padStart(2, '0')} — {pt.data_envio ? formatDate(pt.data_envio) : 'sem data'}
              {pt === propostasTecnicas[0] ? ' (mais recente)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      {tecnicaSelecionada && (
        <div className="bg-[#F9FBF9] border border-[#C8E6C9] rounded p-3 mt-2 mb-3">
          <p className="text-[11px] font-bold text-green-dark mb-2">Dados da revisão técnica</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[9px] text-gray-400 uppercase">HH Direto</p>
              <p className="text-[11px] font-semibold">{tecnicaSelecionada.hh_direto ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">HH Indireto</p>
              <p className="text-[11px] font-semibold">{tecnicaSelecionada.hh_indireto ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">HH Total</p>
              <p className="text-[11px] font-semibold text-auto-value">{hhTotalTec ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">% Indireto</p>
              <p className="text-[11px] font-semibold text-auto-value">{percIndireto ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Peso Mont. (t)</p>
              <p className="text-[11px] font-semibold">{tecnicaSelecionada.peso_montagem ?? '—'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Env. Técnica</p>
              <p className="text-[11px] font-semibold">{formatDate(tecnicaSelecionada.data_envio)}</p>
            </div>
          </div>
        </div>
      )}

      <ModalSection>2. Dados da proposta comercial</ModalSection>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Valor Total Montagem Mecânica (R$)">
          <CurrencyInput value={valorMontagem} onChange={setValorMontagem} />
        </Field>
        <Field label="Data de envio — comercial">
          <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
        </Field>
      </div>

      {/* Possui Terceiros */}
      <div className="flex items-center gap-2 mb-2">
        <input
          id="possui-terceiros"
          type="checkbox"
          checked={possuiTerceiros}
          onChange={(e) => setPossuiTerceiros(e.target.checked)}
          className="accent-green-primary"
        />
        <label htmlFor="possui-terceiros" className="text-[12px] font-medium cursor-pointer">
          Possui Terceiros?
        </label>
      </div>

      {possuiTerceiros && (
        <div className="grid grid-cols-3 gap-2.5 mb-2.5 pl-4 border-l-2 border-green-primary/30">
          {[
            { label: 'Elétrica (R$)', val: valEletrica, set: setValEletrica },
            { label: 'Isolamento (R$)', val: valIsolamento, set: setValIsolamento },
            { label: 'Civil (R$)', val: valCivil, set: setValCivil },
            { label: 'Fibra (R$)', val: valFibra, set: setValFibra },
            { label: 'Outros (R$)', val: valOutros, set: setValOutros },
          ].map(({ label, val, set }) => (
            <Field key={label} label={label}>
              <CurrencyInput value={val} onChange={set} />
            </Field>
          ))}
          <Field label="Total Terceiros (R$)">
            <AutoInput value={totalTerceiros > 0 ? formatCurrency(totalTerceiros) : '—'} />
          </Field>
        </div>
      )}

      {/* Possui Fabricação */}
      <div className="flex items-center gap-2 mb-2">
        <input
          id="possui-fabricacao"
          type="checkbox"
          checked={possuiFabricacao}
          onChange={(e) => setPossuiFabricacao(e.target.checked)}
          className="accent-green-primary"
        />
        <label htmlFor="possui-fabricacao" className="text-[12px] font-medium cursor-pointer">
          Possui Fabricação?
        </label>
      </div>

      {possuiFabricacao && (
        <div className="mb-2.5 pl-4 border-l-2 border-green-primary/30">
          <Field label="Valor Fabricação (R$)">
            <CurrencyInput value={valorFabricacao} onChange={setValorFabricacao} />
          </Field>
        </div>
      )}

      {/* Indicadores automáticos */}
      {totalGeral > 0 && (
        <div className="mt-3 bg-[#EEF7EE] border border-[#C8E6C9] rounded p-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">Total Geral</p>
            <p className="text-[13px] font-bold text-auto-value">{formatCurrency(totalGeral)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">R$/HH Mecânica</p>
            <p className="text-[13px] font-bold text-auto-value">
              {rshhMecanica ? formatCurrency(rshhMecanica) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">R$/HH Total</p>
            <p className="text-[13px] font-bold text-auto-value">
              {rshhTotal ? formatCurrency(rshhTotal) : '—'}
            </p>
          </div>
        </div>
      )}
      </>
      )}

      {naoAplicavel && (
        <Field label="Data de envio — comercial">
          <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
        </Field>
      )}
    </Modal>
  )
}
