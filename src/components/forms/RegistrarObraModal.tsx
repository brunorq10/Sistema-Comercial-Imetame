'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, AutoInput, IntegerInput, CurrencyInput } from '@/components/ui/Input'
import { formatCurrency, formatDate, formatRev } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string { return new Date().toISOString().split('T')[0] }

// ─── Categorias de peso ────────────────────────────────────────────────────────

const CATEGORIAS = [
  { key: 'equipamentos' as const, label: 'Equipamentos' },
  { key: 'tubulacoes' as const, label: 'Tubulações' },
  { key: 'suportes' as const, label: 'Suportes' },
  { key: 'estruturas' as const, label: 'Estruturas e Plataformas' },
]
type CatKey = typeof CATEGORIAS[number]['key']

// ─── Especialidades de terceiros ───────────────────────────────────────────────

const TERCEIROS = [
  { key: 'eletrica' as const, apiKey: 'valor_eletrica', label: 'Elétrica' },
  { key: 'isolamento' as const, apiKey: 'valor_isolamento', label: 'Isolamento' },
  { key: 'civil' as const, apiKey: 'valor_civil', label: 'Civil' },
  { key: 'hidraulica' as const, apiKey: 'valor_hidraulica', label: 'Hidráulica' },
  { key: 'fibra' as const, apiKey: 'valor_fibra', label: 'Fibra' },
  { key: 'tijolo' as const, apiKey: 'valor_tijolo_antiacido', label: 'Tijolo antiácido' },
  { key: 'outros' as const, apiKey: 'valor_outros_terceiros', label: 'Outros' },
]
type TerceiroKey = typeof TERCEIROS[number]['key']

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PropostaTecnicaObra {
  id: number
  versao: number
  hh_total: number | null
  peso_montagem: string | null
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
  propostasTecnicas: PropostaTecnicaObra[]
}

// ─── Toggle Sim / Não ─────────────────────────────────────────────────────────

function SimNaoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-gray-300 text-[11px] font-semibold">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1 transition-colors ${!value ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
      >
        Não
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1 transition-colors border-l border-gray-300 ${value ? 'bg-green-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
      >
        Sim
      </button>
    </div>
  )
}

// ─── Tab Técnica ──────────────────────────────────────────────────────────────

interface TabTecnicaProps {
  solicitacaoId: number
  onSuccess: () => void
  onClose: () => void
}

function TabTecnica({ solicitacaoId, onSuccess, onClose }: TabTecnicaProps) {
  const [naoAplicavel, setNaoAplicavel] = useState(false)
  const [pesos, setPesos] = useState<Record<CatKey, string>>({
    equipamentos: '', tubulacoes: '', suportes: '', estruturas: '',
  })
  const [hhTotal, setHhTotal] = useState('')
  const [dataBase, setDataBase] = useState('')
  const [dataEnvio, setDataEnvio] = useState(today())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numPesos = CATEGORIAS.map(({ key }) => Number(pesos[key]) || 0)
  const pesoTotal = numPesos.reduce((a, b) => a + b, 0)
  const numHh = Number(hhTotal) || 0
  const hhPorTon = pesoTotal > 0 && numHh > 0 ? (numHh / pesoTotal).toFixed(1) : null
  const percents = numPesos.map((p) =>
    pesoTotal > 0 && p > 0 ? ((p / pesoTotal) * 100).toFixed(1) + '%' : '—',
  )

  const handleSubmit = async () => {
    if (!naoAplicavel) {
      if (pesoTotal <= 0) { setError('Informe o peso de ao menos uma categoria'); return }
      if (!hhTotal || numHh <= 0) { setError('Informe o HH Total'); return }
      if (!dataEnvio) { setError('Informe a data de envio'); return }
    }

    setLoading(true); setError(null)
    try {
      const body: Record<string, unknown> = { nao_aplicavel: naoAplicavel, data_base: dataBase || undefined, data_envio: dataEnvio }
      if (!naoAplicavel) {
        body.hh_total = numHh
        body.peso_montagem = pesoTotal
        const numEq = Number(pesos.equipamentos) || 0
        const numTub = Number(pesos.tubulacoes) || 0
        const numSup = Number(pesos.suportes) || 0
        const numEst = Number(pesos.estruturas) || 0
        if (numEq > 0) body.peso_equipamentos = numEq
        if (numTub > 0) body.peso_tubulacoes = numTub
        if (numSup > 0) body.peso_suportes = numSup
        if (numEst > 0) body.peso_estruturas = numEst
      }

      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-tecnica`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }
      onSuccess(); onClose()
    } catch (err) {
      setError(String(err))
    } finally { setLoading(false) }
  }

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      {/* Opção de não aplicável */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <input
          id="obra-tec-nao-aplicavel"
          type="checkbox"
          checked={naoAplicavel}
          onChange={(e) => setNaoAplicavel(e.target.checked)}
          className="accent-green-primary"
        />
        <label htmlFor="obra-tec-nao-aplicavel" className="text-[12px] font-medium cursor-pointer text-gray-700">
          Proposta técnica não aplicável para esta revisão
        </label>
      </div>

      {naoAplicavel ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-3 rounded mb-4">
          A proposta técnica será marcada como não aplicável. O registro será salvo e aguardará o envio da proposta comercial para finalizar a revisão.
        </div>
      ) : (
        <>
          <ModalSection>Categorias de Montagem</ModalSection>

          <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[45%]">Categoria</th>
                  <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[35%]">Peso (t)</th>
                  <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[20%]">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIAS.map(({ key, label }, i) => (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 font-medium text-gray-700">{label}</td>
                    <td className="px-3 py-1.5">
                      <CurrencyInput
                        value={pesos[key]}
                        onChange={(v) => setPesos((prev) => ({ ...prev, [key]: v }))}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <AutoInput value={percents[i]} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#EEF7EE] border-t-2 border-[#C8E6C9]">
                  <td className="px-3 py-2 text-[11px] font-bold text-green-dark">Total</td>
                  <td className="px-3 py-2">
                    <AutoInput value={pesoTotal > 0 ? pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'} />
                  </td>
                  <td className="px-3 py-2">
                    <AutoInput value={pesoTotal > 0 ? '100%' : '—'} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ModalSection>Horas-Homem</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <Field label="HH Total *">
              <IntegerInput placeholder="Ex: 15.000" value={hhTotal} onChange={setHhTotal} />
            </Field>
            <Field label="HH/ton (automático)">
              <AutoInput value={hhPorTon ? `${hhPorTon} HH/t` : '—'} />
            </Field>
          </div>

          <ModalSection>Datas</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <Field label="Data base">
              <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
            </Field>
            <Field label="Data de envio — técnica">
              <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
            </Field>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Salvando...' : naoAplicavel ? 'Confirmar — Técnica não aplicável' : 'Confirmar envio técnica'}
        </Button>
      </div>
    </div>
  )
}

// ─── Tab Comercial ────────────────────────────────────────────────────────────

interface TabComercialProps {
  solicitacaoId: number
  propostasTecnicas: PropostaTecnicaObra[]
  onSuccess: () => void
  onClose: () => void
}

function TabComercial({ solicitacaoId, propostasTecnicas, onSuccess, onClose }: TabComercialProps) {
  const [naoAplicavel, setNaoAplicavel] = useState(false)
  const [tecnicaId, setTecnicaId] = useState(() => {
    const latest = propostasTecnicas[0]
    return latest ? String(latest.id) : ''
  })
  const [valorMontagem, setValorMontagem] = useState('')
  const [possuiTerceiros, setPossuiTerceiros] = useState(false)
  const [terceiros, setTerceiros] = useState<Record<TerceiroKey, string>>({
    eletrica: '', isolamento: '', civil: '', hidraulica: '', fibra: '', tijolo: '', outros: '',
  })
  const [possuiFabricacao, setPossuiFabricacao] = useState(false)
  const [valorFabricacao, setValorFabricacao] = useState('')
  const [pesoFabricacao, setPesoFabricacao] = useState('')
  const [dataEnvio, setDataEnvio] = useState(today())
  const [dataBase, setDataBase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tecnicaSel = propostasTecnicas.find((pt) => String(pt.id) === tecnicaId) ?? null
  const hhTotalRef = tecnicaSel?.hh_total ?? null
  const pesoTotalRef = tecnicaSel?.peso_montagem ? Number(tecnicaSel.peso_montagem) : null
  const hhPorTonRef = pesoTotalRef && hhTotalRef && pesoTotalRef > 0
    ? (hhTotalRef / pesoTotalRef).toFixed(1) : null

  const numMontagem = Number(valorMontagem) || 0
  const rsPorKgMontagem = pesoTotalRef && pesoTotalRef > 0 && numMontagem > 0
    ? numMontagem / (pesoTotalRef * 1000) : null
  const rsPorHhMontagem = hhTotalRef && hhTotalRef > 0 && numMontagem > 0
    ? numMontagem / hhTotalRef : null

  const numTerceiros = TERCEIROS.reduce((sum, { key }) => sum + (Number(terceiros[key]) || 0), 0)
  const numFabricacao = possuiFabricacao ? (Number(valorFabricacao) || 0) : 0
  const numPesoFab = possuiFabricacao ? (Number(pesoFabricacao) || 0) : 0
  const rsPorKgFab = numPesoFab > 0 && numFabricacao > 0 ? numFabricacao / (numPesoFab * 1000) : null
  const valorGlobal = numMontagem + (possuiTerceiros ? numTerceiros : 0) + numFabricacao

  const rsPorKgGlobal = pesoTotalRef && pesoTotalRef > 0 && valorGlobal > 0
    ? valorGlobal / (pesoTotalRef * 1000) : null
  const rsPorHhGlobal = hhTotalRef && hhTotalRef > 0 && valorGlobal > 0
    ? valorGlobal / hhTotalRef : null

  const handleSubmit = async () => {
    if (!naoAplicavel) {
      if (!tecnicaId) { setError('Selecione a revisão técnica de referência'); return }
      if (!valorMontagem || numMontagem <= 0) { setError('Informe o Valor da Montagem'); return }
      if (!dataBase) { setError('Informe a Data base do contrato'); return }
      if (!dataEnvio) { setError('Informe a data de envio'); return }
    }

    setLoading(true); setError(null)
    try {
      const body: Record<string, unknown> = { nao_aplicavel: naoAplicavel, data_envio: dataEnvio }
      if (!naoAplicavel) {
        body.proposta_tecnica_id = Number(tecnicaId)
        body.valor_montagem_mecanica = numMontagem
        body.possui_terceiros = possuiTerceiros
        body.possui_fabricacao = possuiFabricacao
        body.data_base = dataBase
        if (possuiTerceiros) {
          for (const { key, apiKey } of TERCEIROS) {
            const v = Number(terceiros[key]) || 0
            if (v > 0) body[apiKey] = v
          }
        }
        if (possuiFabricacao && numFabricacao > 0) {
          body.valor_fabricacao = numFabricacao
          if (numPesoFab > 0) body.peso_fabricacao = numPesoFab
        }
      }

      const res = await fetch(`/api/solicitacoes/${solicitacaoId}/proposta-comercial`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao registrar'); return }
      onSuccess(); onClose()
    } catch (err) {
      setError(String(err))
    } finally { setLoading(false) }
  }

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      {/* Opção de não aplicável */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <input
          id="obra-com-nao-aplicavel"
          type="checkbox"
          checked={naoAplicavel}
          onChange={(e) => setNaoAplicavel(e.target.checked)}
          className="accent-green-primary"
        />
        <label htmlFor="obra-com-nao-aplicavel" className="text-[12px] font-medium cursor-pointer text-gray-700">
          Proposta comercial não aplicável para esta revisão
        </label>
      </div>

      {naoAplicavel ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-3 rounded mb-4">
          A proposta comercial será marcada como não aplicável. A revisão será finalizada automaticamente.
        </div>
      ) : (
        <>
      {/* Bloco de referência técnica */}
      {propostasTecnicas.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded mb-4">
          Nenhuma proposta técnica registrada. Registre a técnica primeiro.
        </div>
      ) : (
        <>
          <ModalSection>Revisão técnica de referência</ModalSection>
          <Field label="Revisão técnica *" className="mb-3">
            <select
              value={tecnicaId}
              onChange={(e) => setTecnicaId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2.5 py-[5px] text-[11px] focus:outline-none focus:ring-2 focus:ring-green-primary/30"
            >
              <option value="">Selecione...</option>
              {propostasTecnicas.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {formatRev(pt.versao)}{pt === propostasTecnicas[0] ? ' (mais recente)' : ''}{pt.nao_aplicavel ? ' — N/A' : ''}
                </option>
              ))}
            </select>
          </Field>
          {tecnicaSel && (
            <div className="bg-[#F9FBF9] border border-[#C8E6C9] rounded p-3 mb-4 text-[11px]">
              {tecnicaSel.nao_aplicavel && (
                <p className="text-amber-700 text-[10px] font-medium mb-2 pb-2 border-b border-amber-200">
                  ⚠ Proposta técnica marcada como N/A — informe os valores comerciais normalmente.
                </p>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Peso Total</p>
                  <p className="font-bold text-auto-value">
                    {pesoTotalRef ? pesoTotalRef.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' t' : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">HH Total</p>
                  <p className="font-bold text-auto-value">{hhTotalRef?.toLocaleString('pt-BR') ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">HH/ton</p>
                  <p className="font-bold text-auto-value">{hhPorTonRef ? hhPorTonRef + ' HH/t' : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase">Env. Técnica</p>
                  <p className="font-bold text-auto-value">{tecnicaSel.data_envio ? formatDate(tecnicaSel.data_envio) : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Montagem */}
      <ModalSection>Montagem</ModalSection>
      <Field label="Valor da Montagem (R$) *" className="mb-2.5">
        <CurrencyInput value={valorMontagem} onChange={setValorMontagem} />
      </Field>
      {numMontagem > 0 && (
        <div className="bg-auto-bg border border-auto-value/20 rounded p-3 mb-4 grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/kg Montagem</p>
            <p className="font-bold text-auto-value">{rsPorKgMontagem ? formatCurrency(rsPorKgMontagem) : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/HH Montagem</p>
            <p className="font-bold text-auto-value">{rsPorHhMontagem ? formatCurrency(rsPorHhMontagem) : '—'}</p>
          </div>
        </div>
      )}

      {/* Terceiros */}
      <div className="flex items-center justify-between mb-3">
        <ModalSection className="mb-0">Terceiros</ModalSection>
        <SimNaoToggle value={possuiTerceiros} onChange={setPossuiTerceiros} />
      </div>
      {possuiTerceiros && (
        <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[50%]">Especialidade</th>
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[50%]">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {TERCEIROS.map(({ key, label }) => (
                <tr key={key} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 font-medium text-gray-700">{label}</td>
                  <td className="px-3 py-1.5">
                    <CurrencyInput
                      value={terceiros[key]}
                      onChange={(v) => setTerceiros((prev) => ({ ...prev, [key]: v }))}
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-[#EEF7EE] border-t-2 border-[#C8E6C9]">
                <td className="px-3 py-2 text-[11px] font-bold text-green-dark">Total Terceiros</td>
                <td className="px-3 py-2 text-[11px] font-bold text-auto-value">
                  {numTerceiros > 0 ? formatCurrency(numTerceiros) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Fabricações */}
      <div className="flex items-center justify-between mb-3">
        <ModalSection className="mb-0">Fabricações</ModalSection>
        <SimNaoToggle value={possuiFabricacao} onChange={setPossuiFabricacao} />
      </div>
      {possuiFabricacao && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2.5 mb-2">
            <Field label="Valor das Fabricações (R$)">
              <CurrencyInput value={valorFabricacao} onChange={setValorFabricacao} />
            </Field>
            <Field label="Peso das Fabricações (t)">
              <CurrencyInput value={pesoFabricacao} onChange={setPesoFabricacao} />
            </Field>
          </div>
          {rsPorKgFab && (
            <div className="bg-auto-bg border border-auto-value/20 rounded px-3 py-2 text-[11px]">
              <span className="text-[9px] text-gray-400 uppercase mr-2">R$/kg Fabricações</span>
              <span className="font-bold text-auto-value">{formatCurrency(rsPorKgFab)}</span>
            </div>
          )}
        </div>
      )}

      {/* Total Global */}
      <div className="bg-[#1B5E20] text-white rounded-md px-4 py-3 mb-4">
        <div className="grid grid-cols-3 gap-4 mb-2">
          <div>
            <p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">Valor Global</p>
            <p className="text-[15px] font-bold">{valorGlobal > 0 ? formatCurrency(valorGlobal) : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">R$/kg Global</p>
            <p className="text-[15px] font-bold">{rsPorKgGlobal ? formatCurrency(rsPorKgGlobal) : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">R$/HH Global</p>
            <p className="text-[15px] font-bold">{rsPorHhGlobal ? formatCurrency(rsPorHhGlobal) : '—'}</p>
          </div>
        </div>
        {valorGlobal > 0 && (
          <div className="text-[10px] opacity-70 flex gap-4 pt-2 border-t border-white/20">
            <span>Montagem: {formatCurrency(numMontagem)}</span>
            {possuiTerceiros && numTerceiros > 0 && <span>Terceiros: {formatCurrency(numTerceiros)}</span>}
            {possuiFabricacao && numFabricacao > 0 && <span>Fabricações: {formatCurrency(numFabricacao)}</span>}
          </div>
        )}
      </div>

      <Field label="Data base do contrato *" className="mb-4 max-w-[200px]">
        <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
      </Field>

      {/* Data de envio */}
      <ModalSection>Data de Envio</ModalSection>
      <Field label="Data de envio — comercial" className="mb-5">
        <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
      </Field>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading || (!naoAplicavel && propostasTecnicas.length === 0)}>
          {loading ? 'Salvando...' : naoAplicavel ? 'Confirmar — Comercial não aplicável' : 'Confirmar envio comercial'}
        </Button>
      </div>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function RegistrarObraModal({
  open, onClose, onSuccess, solicitacaoId, numero, defaultTab, propostasTecnicas,
}: Props) {
  const [tab, setTab] = useState<'tecnica' | 'comercial'>(defaultTab)

  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar Envio — Obra · ${numero}`}
      wide
    >
      <div className="flex border-b border-gray-200 mb-4 -mt-1">
        {(['tecnica', 'comercial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              'px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors ' +
              (tab === t
                ? 'border-green-primary text-green-dark'
                : 'border-transparent text-gray-400 hover:text-gray-600')
            }
          >
            {t === 'tecnica' ? 'Proposta Técnica' : 'Proposta Comercial'}
          </button>
        ))}
      </div>

      <div style={{ display: tab === 'tecnica' ? 'block' : 'none' }}>
        <TabTecnica solicitacaoId={solicitacaoId} onSuccess={onSuccess} onClose={onClose} />
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
