'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, AutoInput, IntegerInput, CurrencyInput } from '@/components/ui/Input'
import { formatCurrency, formatDate, formatRev } from '@/lib/utils'

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PropostaTecnicaParada {
  id: number
  versao: number
  hh_direto: number | null
  hh_indireto: number | null
  hh_total: number | null
  peso_montagem: string | null
  efetivo_pico: number | null
  dias_parada: number | null
  turno: string | null
  finais_de_semana: boolean | null
  nao_aplicavel?: boolean
  data_envio: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  solicitacaoId: number
  numero: string
  defaultTab: 'tecnica' | 'comercial'
  propostasTecnicas: PropostaTecnicaParada[]
}

// â”€â”€â”€ Tab TÃ©cnica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TabTecnicaProps {
  solicitacaoId: number
  onSuccess: () => void
  onClose: () => void
}

function TabTecnica({ solicitacaoId, onSuccess, onClose }: TabTecnicaProps) {
  const [naoAplicavel, setNaoAplicavel] = useState(false)
  const [hhDireto, setHhDireto] = useState('')
  const [hhIndireto, setHhIndireto] = useState('')
  const [pesoMontagem, setPesoMontagem] = useState('')
  const [efetivoPico, setEfetivoPico] = useState('')
  const [diasParada, setDiasParada] = useState('')
  const [turno, setTurno] = useState('')
  const [finaisDeSemana, setFinaisDeSemana] = useState(false)
  const [dataBase, setDataBase] = useState('')
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split('T')[0])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numHhDireto = Number(hhDireto) || 0
  const numHhIndireto = Number(hhIndireto) || 0
  const hhTotal = numHhDireto + numHhIndireto
  const percIndireto = hhTotal > 0 ? ((numHhIndireto / hhTotal) * 100).toFixed(1) + '%' : 'â€”'

  const handleSubmit = async () => {
    if (!naoAplicavel) {
      if (!hhDireto || numHhDireto <= 0) { setError('Informe o HH Direto'); return }
      if (hhIndireto === '') { setError('Informe o HH Indireto (pode ser 0)'); return }
      if (!efetivoPico || parseInt(efetivoPico) <= 0) { setError('Informe o Efetivo Pico'); return }
      if (!diasParada || parseInt(diasParada) <= 0) { setError('Informe os Dias de Parada'); return }
    }

    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { nao_aplicavel: naoAplicavel, data_base: dataBase || undefined, data_envio: dataEnvio }
      if (!naoAplicavel) {
        body.hh_direto = numHhDireto
        body.hh_indireto = numHhIndireto
        body.efetivo_pico = Number(efetivoPico)
        body.dias_parada = Number(diasParada)
        body.finais_de_semana = finaisDeSemana
        if (pesoMontagem) body.peso_montagem = Number(pesoMontagem)
        if (turno) body.turno = turno
      }

      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-tecnica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }

      onSuccess()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* OpÃ§Ã£o de nÃ£o aplicÃ¡vel */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <input
          id="tec-nao-aplicavel"
          type="checkbox"
          checked={naoAplicavel}
          onChange={(e) => setNaoAplicavel(e.target.checked)}
          className="accent-green-primary"
        />
        <label htmlFor="tec-nao-aplicavel" className="text-[12px] font-medium cursor-pointer text-gray-700">
          Proposta tÃ©cnica nÃ£o aplicÃ¡vel para esta revisÃ£o
        </label>
      </div>

      {naoAplicavel ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-3 rounded mb-4">
          A proposta tÃ©cnica serÃ¡ marcada como nÃ£o aplicÃ¡vel. O registro serÃ¡ salvo e aguardarÃ¡ o envio da proposta comercial para finalizar a revisÃ£o.
        </div>
      ) : (
        <>
          <ModalSection>1. Horas-Homem</ModalSection>

          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="HH Direto">
              <IntegerInput placeholder="Ex: 15.000" value={hhDireto} onChange={setHhDireto} />
            </Field>
            <Field label="HH Indireto">
              <IntegerInput placeholder="Ex: 4.000" value={hhIndireto} onChange={setHhIndireto} />
            </Field>
            <Field label="HH Total">
              <AutoInput value={hhTotal > 0 ? hhTotal.toLocaleString('pt-BR') : 'â€”'} />
            </Field>
            <Field label="% Indireto">
              <AutoInput value={percIndireto} />
            </Field>
          </div>

          <ModalSection>2. Dados da Parada</ModalSection>

          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="Efetivo Pico (pessoas)">
              <IntegerInput placeholder="Ex: 300" value={efetivoPico} onChange={setEfetivoPico} />
            </Field>
            <Field label="Dias de Parada">
              <IntegerInput placeholder="Ex: 21" value={diasParada} onChange={setDiasParada} />
            </Field>
            <Field label="Turno Considerado">
              <Select value={turno} onChange={(e) => setTurno(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Turno adm">Turno adm</option>
                <option value="1 turno">1 turno</option>
                <option value="2 Turnos">2 Turnos</option>
                <option value="3 Turnos">3 Turnos</option>
              </Select>
            </Field>
            <Field label="Peso Montagem (ton, opcional)">
              <CurrencyInput placeholder="Ex: 1.250,50" value={pesoMontagem} onChange={setPesoMontagem} />
            </Field>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              id="finais-de-semana"
              type="checkbox"
              checked={finaisDeSemana}
              onChange={(e) => setFinaisDeSemana(e.target.checked)}
              className="accent-green-primary"
            />
            <label htmlFor="finais-de-semana" className="text-[12px] font-medium cursor-pointer">
              Trabalho em finais de semana?
            </label>
          </div>

          <ModalSection>3. Datas</ModalSection>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Data base">
              <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
            </Field>
            <Field label="Data de envio â€” tÃ©cnica">
              <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
            </Field>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <ModalCancelButton disabled={loading} />
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Salvando...' : naoAplicavel ? 'Confirmar â€” TÃ©cnica nÃ£o aplicÃ¡vel' : 'Confirmar envio tÃ©cnica'}
        </Button>
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab Comercial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TabComercialProps {
  solicitacaoId: number
  propostasTecnicas: PropostaTecnicaParada[]
  onSuccess: () => void
  onClose: () => void
}

function TabComercial({ solicitacaoId, propostasTecnicas, onSuccess, onClose }: TabComercialProps) {
  const [naoAplicavel, setNaoAplicavel] = useState(false)
  const [tecnicaId, setTecnicaId] = useState(() => {
    const latest = propostasTecnicas[0]
    return latest ? String(latest.id) : ''
  })
  const [valorTotal, setValorTotal] = useState('')
  const [valorTerceiros, setValorTerceiros] = useState('')
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split('T')[0])
  const [dataBase, setDataBase] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tecnicaSel = propostasTecnicas.find((pt) => String(pt.id) === tecnicaId) ?? null
  const hhTotal = tecnicaSel?.hh_total ?? null

  const numValorTotal = Number(valorTotal) || 0
  const numTerceiros = Number(valorTerceiros) || 0
  const valorSemTerceiros = numValorTotal > 0 ? numValorTotal - numTerceiros : null
  const rshhSemTerceiros = hhTotal && valorSemTerceiros && hhTotal > 0 ? valorSemTerceiros / hhTotal : null
  const rshhComTerceiros = hhTotal && numValorTotal > 0 && hhTotal > 0 ? numValorTotal / hhTotal : null

  const handleSubmit = async () => {
    if (!naoAplicavel) {
      if (!tecnicaId) { setError('Selecione a revisÃ£o tÃ©cnica de referÃªncia'); return }
      if (!valorTotal || numValorTotal <= 0) { setError('Informe o Valor Total'); return }
      if (!dataBase) { setError('Informe a Data base do contrato'); return }
    }

    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { nao_aplicavel: naoAplicavel, data_envio: dataEnvio }
      if (!naoAplicavel) {
        body.proposta_tecnica_id = Number(tecnicaId)
        body.valor_total_direto = numValorTotal
        if (numTerceiros > 0) body.valor_terceiros = numTerceiros
        body.data_base = dataBase
      }

      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-comercial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }

      onSuccess()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>
      )}

      {/* OpÃ§Ã£o de nÃ£o aplicÃ¡vel */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <input
          id="com-nao-aplicavel"
          type="checkbox"
          checked={naoAplicavel}
          onChange={(e) => setNaoAplicavel(e.target.checked)}
          className="accent-green-primary"
        />
        <label htmlFor="com-nao-aplicavel" className="text-[12px] font-medium cursor-pointer text-gray-700">
          Proposta comercial nÃ£o aplicÃ¡vel para esta revisÃ£o
        </label>
      </div>

      {naoAplicavel ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-3 rounded mb-4">
          A proposta comercial serÃ¡ marcada como nÃ£o aplicÃ¡vel. A revisÃ£o serÃ¡ finalizada automaticamente.
        </div>
      ) : (
        <>
      <ModalSection>1. RevisÃ£o tÃ©cnica de referÃªncia</ModalSection>

      {propostasTecnicas.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded mb-4">
          Nenhuma proposta tÃ©cnica registrada. Registre a tÃ©cnica primeiro.
        </div>
      ) : (
        <>
          <Field label="RevisÃ£o tÃ©cnica referente a esta comercial">
            <Select value={tecnicaId} onChange={(e) => setTecnicaId(e.target.value)}>
              <option value="">Selecione...</option>
              {propostasTecnicas.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {formatRev(pt.versao)}{pt === propostasTecnicas[0] ? ' (mais recente)' : ''}{pt.nao_aplicavel ? ' â€” N/A' : ''}{!pt.nao_aplicavel ? (' â€” HH Total: ' + (pt.hh_total ?? (pt.hh_direto !== null && pt.hh_indireto !== null ? pt.hh_direto + pt.hh_indireto : 'â€”'))) : ''}
                </option>
              ))}
            </Select>
          </Field>

          {tecnicaSel && (
            <div className="bg-[#F9FBF9] border border-[#C8E6C9] rounded p-3 mt-2 mb-3">
              {tecnicaSel.nao_aplicavel && (
                <p className="text-amber-700 text-[10px] font-medium mb-2 pb-2 border-b border-amber-200">
                  âš  Proposta tÃ©cnica marcada como N/A â€” informe os valores comerciais normalmente.
                </p>
              )}
              <p className="text-[11px] font-bold text-green-dark mb-2">Dados da revisÃ£o tÃ©cnica</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">HH Direto</p>
                  <p className="text-[11px] font-semibold">{tecnicaSel.hh_direto ?? 'â€”'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">HH Indireto</p>
                  <p className="text-[11px] font-semibold">{tecnicaSel.hh_indireto ?? 'â€”'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">HH Total</p>
                  <p className="text-[11px] font-semibold text-auto-value">{hhTotal ?? 'â€”'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Efetivo Pico</p>
                  <p className="text-[11px] font-semibold">{tecnicaSel.efetivo_pico ?? 'â€”'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Dias Parada</p>
                  <p className="text-[11px] font-semibold">{tecnicaSel.dias_parada ?? 'â€”'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Turno</p>
                  <p className="text-[11px] font-semibold">{tecnicaSel.turno ?? 'â€”'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Finais Semana</p>
                  <p className="text-[11px] font-semibold">{tecnicaSel.finais_de_semana ? 'Sim' : 'NÃ£o'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Env. TÃ©cnica</p>
                  <p className="text-[11px] font-semibold text-auto-value">{tecnicaSel.data_envio ? formatDate(tecnicaSel.data_envio) : 'â€”'}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ModalSection>2. Valores da proposta comercial</ModalSection>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Field label="Valor Total (R$)">
          <CurrencyInput value={valorTotal} onChange={setValorTotal} />
        </Field>
        <Field label="Valor Terceiros (R$, opcional)">
          <CurrencyInput value={valorTerceiros} onChange={setValorTerceiros} />
        </Field>
      </div>

      {/* Indicadores automÃ¡ticos */}
      {numValorTotal > 0 && (
        <div className="bg-[#EEF7EE] border border-[#C8E6C9] rounded p-3 grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">Valor sem Terceiros</p>
            <p className="text-[13px] font-bold text-auto-value">
              {valorSemTerceiros !== null ? formatCurrency(valorSemTerceiros) : formatCurrency(numValorTotal)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">Total Geral</p>
            <p className="text-[13px] font-bold text-auto-value">{formatCurrency(numValorTotal)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">R$/HH sem Terceiros</p>
            <p className="text-[13px] font-bold text-auto-value">
              {rshhSemTerceiros ? formatCurrency(rshhSemTerceiros) : hhTotal ? formatCurrency(numValorTotal / hhTotal) : 'â€”'}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-bold">R$/HH com Terceiros</p>
            <p className="text-[13px] font-bold text-auto-value">
              {rshhComTerceiros ? formatCurrency(rshhComTerceiros) : 'â€”'}
            </p>
          </div>
        </div>
      )}

      <Field label="Data base do contrato *" className="mb-3 max-w-[200px]">
        <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
      </Field>

      <ModalSection>3. Data de Envio</ModalSection>

      <Field label="Data de envio â€” comercial">
        <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
      </Field>
        </>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <ModalCancelButton disabled={loading} />
        <Button
          onClick={handleSubmit}
          disabled={loading || (!naoAplicavel && propostasTecnicas.length === 0)}
        >
          {loading ? 'Salvando...' : naoAplicavel ? 'Confirmar â€” Comercial nÃ£o aplicÃ¡vel' : 'Confirmar envio comercial'}
        </Button>
      </div>
    </div>
  )
}

// â”€â”€â”€ Modal principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function RegistrarParadaModal({
  open, onClose, onSuccess, solicitacaoId, numero, defaultTab, propostasTecnicas,
}: Props) {
  const [tab, setTab] = useState<'tecnica' | 'comercial'>(defaultTab)

  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  const tabs: { key: 'tecnica' | 'comercial'; label: string }[] = [
    { key: 'tecnica', label: 'Proposta TÃ©cnica' },
    { key: 'comercial', label: 'Proposta Comercial' },
  ]

  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={`Registrar Envio â€” Parada Â· ${numero}`}
      wide
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 -mt-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors ' +
              (tab === t.key
                ? 'border-green-primary text-green-dark'
                : 'border-transparent text-gray-400 hover:text-gray-600')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: tab === 'tecnica' ? 'block' : 'none' }}>
        <TabTecnica
          solicitacaoId={solicitacaoId}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      </div>
      <div style={{ display: tab === 'comercial' ? 'block' : 'none' }}>
        <TabComercial
          solicitacaoId={solicitacaoId}
          propostasTecnicas={propostasTecnicas}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      </div>
    </Modal>
  )
}

