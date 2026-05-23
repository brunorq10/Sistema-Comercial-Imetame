'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, AutoInput, IntegerInput, CurrencyInput } from '@/components/ui/Input'
import { formatDate, formatCurrency, formatRev } from '@/lib/utils'
import { MOTIVO_PERDA_LABELS } from '@/types'
import type { PropostasItem, MotivoPerda } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  item: PropostasItem
  canRegistrarTecnica: boolean
  canRegistrarComercial: boolean
  canCancelar: boolean
}

type Section = 'tecnica' | 'comercial' | 'resultado' | 'fabricacao' | 'resultado_fab'

const today = () => new Date().toISOString().split('T')[0]

// ─── Equipamento form item ─────────────────────────────────────────────────────

interface EquipItem { id: number; descricao: string; pesoTon: string; valorTotal: string; obs: string }
function mkEquip(id: number): EquipItem { return { id, descricao: '', pesoTon: '', valorTotal: '', obs: '' } }

// ─── Modal ────────────────────────────────────────────────────────────────────

export function EditarPropostaModal({
  open, onClose, onSuccess, item, canRegistrarTecnica, canRegistrarComercial, canCancelar,
}: Props) {
  const isParadas = item.classificacao === 'PARADAS'
  const isFabricacao = item.classificacao === 'FABRICACOES' || item.classificacao === 'OLEO_GAS'

  const [openSection, setOpenSection] = useState<Section | null>(null)

  // ── Técnica (Obras) ────────────────────────────────────────────────────────
  const [hhDireto, setHhDireto] = useState('')
  const [hhIndireto, setHhIndireto] = useState('')
  const [pesoMontagem, setPesoMontagem] = useState('')
  const [dataEnvioTec, setDataEnvioTec] = useState(today())
  const [loadingTec, setLoadingTec] = useState(false)
  const [errorTec, setErrorTec] = useState<string | null>(null)
  const [okTec, setOkTec] = useState(false)

  // ── Técnica extra (Paradas) ────────────────────────────────────────────────
  const [efetivoPico, setEfetivoPico] = useState('')
  const [diasParada, setDiasParada] = useState('')
  const [turno, setTurno] = useState('')
  const [finaisDeSemana, setFinaisDeSemana] = useState(false)

  // ── Comercial (Obras) ─────────────────────────────────────────────────────
  const [tecnicaId, setTecnicaId] = useState('')
  const [valorMontagem, setValorMontagem] = useState('')
  const [possuiTerceiros, setPossuiTerceiros] = useState(false)
  const [valEletrica, setValEletrica] = useState('')
  const [valIsolamento, setValIsolamento] = useState('')
  const [valCivil, setValCivil] = useState('')
  const [valFibra, setValFibra] = useState('')
  const [valOutros, setValOutros] = useState('')
  const [possuiFabricacaoCom, setPossuiFabricacaoCom] = useState(false)
  const [valorFabricacaoCom, setValorFabricacaoCom] = useState('')
  const [dataEnvioCom, setDataEnvioCom] = useState(today())
  const [loadingCom, setLoadingCom] = useState(false)
  const [errorCom, setErrorCom] = useState<string | null>(null)
  const [okCom, setOkCom] = useState(false)

  // ── Comercial (Paradas) ────────────────────────────────────────────────────
  const [valorTotalParada, setValorTotalParada] = useState('')
  const [valorTerceirosParada, setValorTerceirosParada] = useState('')
  const [dataEnvioComParada, setDataEnvioComParada] = useState(today())

  // ── Resultado (Comercial) ─────────────────────────────────────────────────
  const [resultado, setResultado] = useState<string>('AGUARDANDO')
  const [motivoPerda, setMotivoPerda] = useState<MotivoPerda | ''>('')
  const [loadingRes, setLoadingRes] = useState(false)
  const [errorRes, setErrorRes] = useState<string | null>(null)
  const [okRes, setOkRes] = useState(false)

  // ── Resultado (Fabricação) ────────────────────────────────────────────────
  const [resultadoFab, setResultadoFab] = useState<string>('AGUARDANDO')
  const [motivoPerdaFab, setMotivoPerdaFab] = useState<MotivoPerda | ''>('')
  const [loadingResFab, setLoadingResFab] = useState(false)
  const [errorResFab, setErrorResFab] = useState<string | null>(null)
  const [okResFab, setOkResFab] = useState(false)

  // ── Fabricação ────────────────────────────────────────────────────────────
  const [equipamentos, setEquipamentos] = useState<EquipItem[]>([mkEquip(1)])
  const [nextEquipId, setNextEquipId] = useState(2)
  const [possuiTestes, setPossuiTestes] = useState(false)
  const [descTestes, setDescTestes] = useState('')
  const [valorTestes, setValorTestes] = useState('')
  const [dataEnvioFab, setDataEnvioFab] = useState(today())
  const [loadingFab, setLoadingFab] = useState(false)
  const [errorFab, setErrorFab] = useState<string | null>(null)
  const [okFab, setOkFab] = useState(false)

  // ── Cancelamento ──────────────────────────────────────────────────────────
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [loadingCancel, setLoadingCancel] = useState(false)
  const [errorCancel, setErrorCancel] = useState<string | null>(null)

  // Reset e pré-preenchimento ao abrir
  useEffect(() => {
    if (!open) return
    setOpenSection(null)
    setErrorTec(null); setOkTec(false)
    setErrorCom(null); setOkCom(false)
    setErrorRes(null); setOkRes(false)
    setErrorResFab(null); setOkResFab(false)
    setErrorFab(null); setOkFab(false)
    setConfirmCancel(false); setCancelReason(''); setErrorCancel(null)

    // Técnica
    const tec = item.propostas_tecnicas[0]
    setHhDireto(tec?.hh_direto != null ? String(tec.hh_direto) : '')
    setHhIndireto(tec?.hh_indireto != null ? String(tec.hh_indireto) : '')
    setPesoMontagem(tec?.peso_montagem != null ? String(Number(tec.peso_montagem)) : '')
    setDataEnvioTec(tec?.data_envio ? tec.data_envio.split('T')[0] : today())
    setEfetivoPico(tec?.efetivo_pico != null ? String(tec.efetivo_pico) : '')
    setDiasParada(tec?.dias_parada != null ? String(tec.dias_parada) : '')
    setTurno(tec?.turno ?? '')
    setFinaisDeSemana(tec?.finais_de_semana ?? false)

    // Comercial
    const com = item.propostas_comerciais[0]
    setTecnicaId(com ? String(com.proposta_tecnica_id) : '')
    setValorMontagem(com?.valor_montagem_mecanica != null ? String(Number(com.valor_montagem_mecanica)) : '')
    setPossuiTerceiros(com?.possui_terceiros ?? false)
    setValEletrica(com?.valor_eletrica != null ? String(Number(com.valor_eletrica)) : '')
    setValIsolamento(com?.valor_isolamento != null ? String(Number(com.valor_isolamento)) : '')
    setValCivil(com?.valor_civil != null ? String(Number(com.valor_civil)) : '')
    setValFibra(com?.valor_fibra != null ? String(Number(com.valor_fibra)) : '')
    setValOutros(com?.valor_outros_terceiros != null ? String(Number(com.valor_outros_terceiros)) : '')
    setPossuiFabricacaoCom(com?.possui_fabricacao ?? false)
    setValorFabricacaoCom(com?.valor_fabricacao != null ? String(Number(com.valor_fabricacao)) : '')
    setDataEnvioCom(com?.data_envio ? com.data_envio.split('T')[0] : today())
    setValorTotalParada(com?.valor_total != null ? String(Number(com.valor_total)) : '')
    setValorTerceirosParada(com?.valor_terceiros != null ? String(Number(com.valor_terceiros)) : '')
    setDataEnvioComParada(com?.data_envio ? com.data_envio.split('T')[0] : today())
    setResultado(com?.resultado ?? 'AGUARDANDO')
    setMotivoPerda((com?.motivo_perda ?? '') as MotivoPerda | '')

    // Fabricação
    const fab = item.propostas_fabricacao[0]
    if (fab) {
      const equips = fab.equipamentos.map((e, i) => ({
        id: i + 1,
        descricao: e.descricao,
        pesoTon: String(Number(e.peso_ton)),
        valorTotal: String(Number(e.valor_total)),
        obs: e.observacoes ?? '',
      }))
      setEquipamentos(equips.length > 0 ? equips : [mkEquip(1)])
      setNextEquipId(equips.length + 1)
      setPossuiTestes(fab.possui_testes)
      setDescTestes(fab.descricao_testes ?? '')
      setValorTestes(fab.valor_testes != null ? String(Number(fab.valor_testes)) : '')
      setDataEnvioFab(fab.data_envio ? fab.data_envio.split('T')[0] : today())
      setResultadoFab(fab.resultado ?? 'AGUARDANDO')
      setMotivoPerdaFab((fab.motivo_perda ?? '') as MotivoPerda | '')
    } else {
      setEquipamentos([mkEquip(1)]); setNextEquipId(2)
      setPossuiTestes(false); setDescTestes(''); setValorTestes(''); setDataEnvioFab(today())
      setResultadoFab('AGUARDANDO')
      setMotivoPerdaFab('')
    }
  }, [open, item])

  // ── Cálculos automáticos ──────────────────────────────────────────────────
  const hd = Number(hhDireto) || 0
  const hi = Number(hhIndireto) || 0
  const hhTotalCalc = hd + hi > 0 ? hd + hi : null
  const percIndiretoCalc = hhTotalCalc && hi ? ((hi / hhTotalCalc) * 100).toFixed(1) + '%' : null

  const tecnicaSelecionada = item.propostas_tecnicas.find((t) => String(t.id) === tecnicaId) ?? null
  const hhTotalTec = tecnicaSelecionada
    ? (tecnicaSelecionada.hh_total ?? ((tecnicaSelecionada.hh_direto ?? 0) + (tecnicaSelecionada.hh_indireto ?? 0)))
    : 0

  // Comercial Obras
  const numMontagem = Number(valorMontagem) || 0
  const totalTerceiros = possuiTerceiros
    ? (Number(valEletrica) || 0) + (Number(valIsolamento) || 0) + (Number(valCivil) || 0) + (Number(valFibra) || 0) + (Number(valOutros) || 0)
    : 0
  const numFabricacaoCom = possuiFabricacaoCom ? (Number(valorFabricacaoCom) || 0) : 0
  const totalGeral = numMontagem + totalTerceiros + numFabricacaoCom
  const rshhMecanica = hhTotalTec > 0 && numMontagem > 0 ? numMontagem / hhTotalTec : null
  const rshhTotal = hhTotalTec > 0 && totalGeral > 0 ? totalGeral / hhTotalTec : null

  // Comercial Paradas
  const numValorTotalParada = Number(valorTotalParada) || 0
  const numTerceirosParada = Number(valorTerceirosParada) || 0
  const valorSemTerceiros = numValorTotalParada > 0 ? numValorTotalParada - numTerceirosParada : null
  const rshhSemTerceiros = valorSemTerceiros !== null && hhTotalTec > 0 ? valorSemTerceiros / hhTotalTec : null
  const rshhComTerceiros = numValorTotalParada > 0 && hhTotalTec > 0 ? numValorTotalParada / hhTotalTec : null

  // Fabricação
  const pesoTotalFab = equipamentos.reduce((s, e) => s + (Number(e.pesoTon) || 0), 0)
  const valorEquipFab = equipamentos.reduce((s, e) => s + (Number(e.valorTotal) || 0), 0)
  const numTestesFab = possuiTestes ? (Number(valorTestes) || 0) : 0
  const totalFab = valorEquipFab + numTestesFab

  const hasTecnica = item.propostas_tecnicas.length > 0
  const hasComercial = item.propostas_comerciais.length > 0
  const hasFabricacao = item.propostas_fabricacao.length > 0
  const currentRevLabel = hasTecnica ? formatRev(item.propostas_tecnicas[0].versao) : null
  const currentRevFabLabel = hasFabricacao ? formatRev(item.propostas_fabricacao[0].versao) : null

  const toggle = (s: Section) => setOpenSection((prev) => (prev === s ? null : s))

  // ── Submits ───────────────────────────────────────────────────────────────

  const handleSaveTecnica = async () => {
    if (!hhDireto || !hhIndireto) { setErrorTec('HH Direto e HH Indireto são obrigatórios'); return }
    if (isParadas) {
      if (!efetivoPico || parseInt(efetivoPico) <= 0) { setErrorTec('Efetivo Pico é obrigatório para Paradas'); return }
      if (!diasParada || parseInt(diasParada) <= 0) { setErrorTec('Dias de Parada são obrigatórios'); return }
    }
    setLoadingTec(true); setErrorTec(null)
    try {
      const body: Record<string, unknown> = {
        hh_direto: Number(hhDireto),
        hh_indireto: Number(hhIndireto),
        data_envio: dataEnvioTec,
      }
      if (pesoMontagem) body.peso_montagem = Number(pesoMontagem)
      if (isParadas) {
        body.efetivo_pico = parseInt(efetivoPico)
        body.dias_parada = parseInt(diasParada)
        if (turno) body.turno = turno
        body.finais_de_semana = finaisDeSemana
      }
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-tecnica`, {
        method: hasTecnica ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorTec(json.error ?? 'Erro ao salvar'); return }
      setOkTec(true); setOpenSection(null); onSuccess()
    } finally { setLoadingTec(false) }
  }

  const handleSaveComercial = async () => {
    if (!tecnicaId) { setErrorCom('Selecione a revisão técnica de referência'); return }
    if (isParadas) {
      if (!valorTotalParada || numValorTotalParada <= 0) { setErrorCom('Informe o Valor Total'); return }
    } else {
      if (!valorMontagem || numMontagem <= 0) { setErrorCom('Informe o Valor Total da Montagem Mecânica'); return }
    }
    setLoadingCom(true); setErrorCom(null)
    try {
      const body: Record<string, unknown> = { proposta_tecnica_id: Number(tecnicaId), data_envio: dataEnvioCom }
      if (isParadas) {
        body.valor_total_direto = numValorTotalParada
        if (numTerceirosParada > 0) body.valor_terceiros = numTerceirosParada
      } else {
        body.valor_montagem_mecanica = numMontagem
        body.possui_terceiros = possuiTerceiros
        if (possuiTerceiros) {
          if (Number(valEletrica) > 0) body.valor_eletrica = Number(valEletrica)
          if (Number(valIsolamento) > 0) body.valor_isolamento = Number(valIsolamento)
          if (Number(valCivil) > 0) body.valor_civil = Number(valCivil)
          if (Number(valFibra) > 0) body.valor_fibra = Number(valFibra)
          if (Number(valOutros) > 0) body.valor_outros_terceiros = Number(valOutros)
        }
        body.possui_fabricacao = possuiFabricacaoCom
        if (possuiFabricacaoCom && numFabricacaoCom > 0) body.valor_fabricacao = numFabricacaoCom
      }
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-comercial`, {
        method: hasComercial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorCom(json.error ?? 'Erro ao salvar'); return }
      setOkCom(true); setOpenSection(null); onSuccess()
    } finally { setLoadingCom(false) }
  }

  const handleSaveResultado = async () => {
    if (resultado === 'PERDEU' && !motivoPerda) { setErrorRes('Motivo de perda é obrigatório'); return }
    setLoadingRes(true); setErrorRes(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-comercial`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado, motivo_perda: resultado === 'PERDEU' ? motivoPerda : undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorRes(json.error ?? 'Erro ao salvar'); return }
      setOkRes(true); setOpenSection(null); onSuccess()
    } finally { setLoadingRes(false) }
  }

  const handleSaveResultadoFab = async () => {
    if (resultadoFab === 'PERDEU' && !motivoPerdaFab) { setErrorResFab('Motivo de perda é obrigatório'); return }
    setLoadingResFab(true); setErrorResFab(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-fabricacao`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado: resultadoFab, motivo_perda: resultadoFab === 'PERDEU' ? motivoPerdaFab : undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorResFab(json.error ?? 'Erro ao salvar'); return }
      setOkResFab(true); setOpenSection(null); onSuccess()
    } finally { setLoadingResFab(false) }
  }

  const handleSaveFabricacao = async () => {
    const invalidos = equipamentos.filter((e) => !e.descricao || !e.pesoTon || Number(e.valorTotal) <= 0)
    if (invalidos.length > 0) { setErrorFab('Preencha descrição, peso e valor em todos os equipamentos'); return }
    setLoadingFab(true); setErrorFab(null)
    try {
      const body = {
        equipamentos: equipamentos.map((e) => ({
          descricao: e.descricao,
          peso_ton: Number(e.pesoTon),
          valor_total: Number(e.valorTotal),
          observacoes: e.obs || undefined,
        })),
        possui_testes: possuiTestes,
        descricao_testes: possuiTestes && descTestes ? descTestes : undefined,
        valor_testes: possuiTestes && numTestesFab > 0 ? numTestesFab : undefined,
        data_envio: dataEnvioFab,
      }
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-fabricacao`, {
        method: hasFabricacao ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorFab(json.error ?? 'Erro ao salvar'); return }
      setOkFab(true); setOpenSection(null); onSuccess()
    } finally { setLoadingFab(false) }
  }

  const handleCancelar = async () => {
    if (cancelReason.trim().length < 5) { setErrorCancel('Justificativa obrigatória (mín. 5 caracteres)'); return }
    setLoadingCancel(true); setErrorCancel(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_reason: cancelReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorCancel(json.error ?? 'Erro ao cancelar'); return }
      onSuccess(); onClose()
    } finally { setLoadingCancel(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar Proposta · ${item.numero}`}
      wide
      footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}
    >

      {/* ════ SEÇÃO TÉCNICA (Obras + Paradas) ════════════════════════════ */}
      {!isFabricacao && canRegistrarTecnica && (
        <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
          <button
            onClick={() => toggle('tecnica')}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-50 cursor-pointer
              ${openSection === 'tecnica' ? 'bg-gray-50' : 'bg-white'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{openSection === 'tecnica' ? '▼' : '▶'}</span>
              <span>1. Proposta Técnica</span>
              {currentRevLabel && <span className="text-[11px] text-gray-400 font-normal">— {currentRevLabel}</span>}
              {okTec && <span className="text-[11px] text-green-primary font-semibold">✓ Salva</span>}
            </div>
            {item.propostas_tecnicas.length > 0 && (
              <span className="text-[11px] text-gray-400">
                Última: {formatRev(item.propostas_tecnicas[0].versao)} · {formatDate(item.propostas_tecnicas[0].data_envio)}
              </span>
            )}
          </button>

          {openSection === 'tecnica' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              {errorTec && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorTec}</div>}

              <ModalSection>Horas-Homem</ModalSection>
              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <Field label="HH Direto *">
                  <IntegerInput placeholder="Ex: 3.200" value={hhDireto} onChange={setHhDireto} />
                </Field>
                <Field label="HH Indireto *">
                  <IntegerInput placeholder="Ex: 1.600" value={hhIndireto} onChange={setHhIndireto} />
                </Field>
                <Field label="HH Total (automático)">
                  <AutoInput value={hhTotalCalc !== null ? hhTotalCalc.toLocaleString('pt-BR') : ''} placeholder="—" />
                </Field>
                <Field label="% Indireto (automático)">
                  <AutoInput value={percIndiretoCalc ?? ''} placeholder="—" />
                </Field>
              </div>

              {isParadas ? (
                <>
                  <ModalSection>Dados da Parada</ModalSection>
                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                    <Field label="Efetivo Pico (pessoas) *">
                      <IntegerInput placeholder="Ex: 300" value={efetivoPico} onChange={setEfetivoPico} />
                    </Field>
                    <Field label="Dias de Parada *">
                      <IntegerInput placeholder="Ex: 21" value={diasParada} onChange={setDiasParada} />
                    </Field>
                    <Field label="Turno Considerado">
                      <Select value={turno} onChange={(e) => setTurno(e.target.value)}>
                        <option value="">Selecione...</option>
                        <option value="Hora normal">Hora normal</option>
                        <option value="Turno estendido">Turno estendido</option>
                        <option value="2 Turnos">2 Turnos</option>
                        <option value="3 Turnos">3 Turnos</option>
                      </Select>
                    </Field>
                    <Field label="Peso Total Mont. (t, opcional)">
                      <CurrencyInput placeholder="Ex: 1.250,50" value={pesoMontagem} onChange={setPesoMontagem} />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <input id="fin-sem-ed" type="checkbox" checked={finaisDeSemana} onChange={(e) => setFinaisDeSemana(e.target.checked)} className="accent-green-primary" />
                    <label htmlFor="fin-sem-ed" className="text-[12px] font-medium cursor-pointer">Trabalho em finais de semana?</label>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  <Field label="Peso Total Mont. (t)">
                    <CurrencyInput placeholder="Ex: 148,50" value={pesoMontagem} onChange={setPesoMontagem} />
                  </Field>
                </div>
              )}

              <ModalSection>Data de Envio</ModalSection>
              <div className="mb-3">
                <Field label="Data de envio — técnica">
                  <Input type="date" value={dataEnvioTec} onChange={(e) => setDataEnvioTec(e.target.value)} />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTecnica} disabled={loadingTec}>
                  {loadingTec ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ SEÇÃO COMERCIAL ════════════════════════════════════════════ */}
      {!isFabricacao && canRegistrarComercial && (
        <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
          <button
            onClick={() => item.propostas_tecnicas.length > 0 && toggle('comercial')}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors
              ${item.propostas_tecnicas.length > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}
              ${openSection === 'comercial' ? 'bg-gray-50' : 'bg-white'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{openSection === 'comercial' ? '▼' : '▶'}</span>
              <span>2. Proposta Comercial</span>
              {item.propostas_tecnicas.length === 0 && <span className="text-[11px] text-amber-500 font-normal">— registre a técnica primeiro</span>}
              {okCom && <span className="text-[11px] text-green-primary font-semibold">✓ Salva</span>}
            </div>
            {item.propostas_comerciais.length > 0 && (
              <span className="text-[11px] text-gray-400">
                Última: {item.propostas_comerciais[0].valor_total ? formatCurrency(Number(item.propostas_comerciais[0].valor_total)) : '—'}
                {' · '}{formatDate(item.propostas_comerciais[0].data_envio)}
              </span>
            )}
          </button>

          {openSection === 'comercial' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              {errorCom && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorCom}</div>}

              <ModalSection>Revisão técnica de referência</ModalSection>
              <Field label="Selecione a revisão técnica" className="mb-3">
                <Select value={tecnicaId} onChange={(e) => setTecnicaId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {item.propostas_tecnicas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatRev(t.versao)} — {t.data_envio ? formatDate(t.data_envio) : 'sem data'}
                      {t === item.propostas_tecnicas[0] ? ' (mais recente)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {tecnicaSelecionada && (
                <div className="bg-[#F9FBF9] border border-[#C8E6C9] rounded p-3 mb-3">
                  <p className="text-[10px] font-bold text-green-dark mb-1.5">Dados da revisão selecionada</p>
                  {isParadas ? (
                    <div className="grid grid-cols-4 gap-3 text-[11px]">
                      <div><p className="text-[9px] text-gray-400 uppercase">HH Direto</p><p className="font-semibold">{tecnicaSelecionada.hh_direto ?? '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">HH Indireto</p><p className="font-semibold">{tecnicaSelecionada.hh_indireto ?? '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">HH Total</p><p className="font-semibold text-auto-value">{hhTotalTec || '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">Efetivo Pico</p><p className="font-semibold">{tecnicaSelecionada.efetivo_pico ?? '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">Dias Parada</p><p className="font-semibold">{tecnicaSelecionada.dias_parada ?? '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">Turno</p><p className="font-semibold">{tecnicaSelecionada.turno ?? '—'}</p></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div><p className="text-[9px] text-gray-400 uppercase">HH Direto</p><p className="font-semibold">{tecnicaSelecionada.hh_direto ?? '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">HH Indireto</p><p className="font-semibold">{tecnicaSelecionada.hh_indireto ?? '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase">Peso Mont.</p><p className="font-semibold">{tecnicaSelecionada.peso_montagem ?? '—'}</p></div>
                    </div>
                  )}
                </div>
              )}

              {isParadas ? (
                <>
                  <ModalSection>Valores</ModalSection>
                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                    <Field label="Valor Total (R$) *">
                      <CurrencyInput value={valorTotalParada} onChange={setValorTotalParada} />
                    </Field>
                    <Field label="Valor Terceiros (R$, opcional)">
                      <CurrencyInput value={valorTerceirosParada} onChange={setValorTerceirosParada} />
                    </Field>
                  </div>
                  {numValorTotalParada > 0 && (
                    <div className="bg-auto-bg border border-auto-value/20 rounded p-3 mb-3 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase mb-0.5">Valor sem Terceiros</p>
                        <p className="font-bold text-auto-value">{formatCurrency(valorSemTerceiros ?? numValorTotalParada)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/HH sem Terceiros</p>
                        <p className="font-bold text-auto-value">{rshhSemTerceiros ? formatCurrency(rshhSemTerceiros) : hhTotalTec > 0 ? formatCurrency(numValorTotalParada / hhTotalTec) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/HH com Terceiros</p>
                        <p className="font-bold text-auto-value">{rshhComTerceiros ? formatCurrency(rshhComTerceiros) : '—'}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <ModalSection>Valores</ModalSection>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <Field label="Montagem Mecânica (R$) *">
                      <CurrencyInput value={valorMontagem} onChange={setValorMontagem} />
                    </Field>
                  </div>
                  <div className="mb-3">
                    <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer mb-2">
                      <input type="checkbox" checked={possuiTerceiros} onChange={(e) => setPossuiTerceiros(e.target.checked)} className="rounded" />
                      Possui Terceiros?
                    </label>
                    {possuiTerceiros && (
                      <div className="grid grid-cols-3 gap-2 pl-5">
                        {([['Elétrica', valEletrica, setValEletrica], ['Isolamento', valIsolamento, setValIsolamento], ['Civil', valCivil, setValCivil], ['Fibra', valFibra, setValFibra], ['Outros', valOutros, setValOutros]] as [string, string, (v: string) => void][]).map(([lbl, val, set]) => (
                          <Field key={lbl} label={lbl}>
                            <CurrencyInput value={val} onChange={set} />
                          </Field>
                        ))}
                        {totalTerceiros > 0 && <div className="col-span-3"><p className="text-[10px] text-auto-value">Total Terceiros: {formatCurrency(totalTerceiros)}</p></div>}
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer mb-2">
                      <input type="checkbox" checked={possuiFabricacaoCom} onChange={(e) => setPossuiFabricacaoCom(e.target.checked)} className="rounded" />
                      Possui Fabricação?
                    </label>
                    {possuiFabricacaoCom && (
                      <div className="pl-5">
                        <Field label="Valor Fabricação (R$)">
                          <CurrencyInput value={valorFabricacaoCom} onChange={setValorFabricacaoCom} />
                        </Field>
                      </div>
                    )}
                  </div>
                  {totalGeral > 0 && (
                    <div className="bg-auto-bg border border-auto-value/20 rounded p-3 mb-3 grid grid-cols-3 gap-3 text-[11px]">
                      <div><p className="text-[9px] text-gray-400 uppercase mb-0.5">Total Geral</p><p className="font-bold text-auto-value">{formatCurrency(totalGeral)}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/HH Mecânica</p><p className="font-bold text-auto-value">{rshhMecanica ? formatCurrency(rshhMecanica) : '—'}</p></div>
                      <div><p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/HH Total</p><p className="font-bold text-auto-value">{rshhTotal ? formatCurrency(rshhTotal) : '—'}</p></div>
                    </div>
                  )}
                </>
              )}

              <ModalSection>Data de Envio</ModalSection>
              <Field label="Data de envio — comercial" className="mb-3">
                <Input type="date" value={dataEnvioCom} onChange={(e) => setDataEnvioCom(e.target.value)} />
              </Field>

              <div className="flex justify-end">
                <Button onClick={handleSaveComercial} disabled={loadingCom}>
                  {loadingCom ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ SEÇÃO FABRICAÇÃO (Fabricações / Óleo e Gás) ════════════════ */}
      {isFabricacao && (
        <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
          <button
            onClick={() => canRegistrarTecnica && toggle('fabricacao')}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors
              ${canRegistrarTecnica ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}
              ${openSection === 'fabricacao' ? 'bg-gray-50' : 'bg-white'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{openSection === 'fabricacao' ? '▼' : '▶'}</span>
              <span>1. Proposta de Fabricação</span>
              {currentRevFabLabel && <span className="text-[11px] text-gray-400 font-normal">— {currentRevFabLabel}</span>}
              {okFab && <span className="text-[11px] text-green-primary font-semibold">✓ Salva</span>}
            </div>
            {hasFabricacao && (
              <span className="text-[11px] text-gray-400">
                Última: {formatCurrency(Number(item.propostas_fabricacao[0].valor_total))} · {formatDate(item.propostas_fabricacao[0].data_envio)}
              </span>
            )}
          </button>

          {openSection === 'fabricacao' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              {errorFab && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorFab}</div>}

              <ModalSection>Equipamentos</ModalSection>
              {equipamentos.map((eq, idx) => (
                <div key={eq.id} className="grid grid-cols-12 gap-2 mb-2 items-start">
                  <div className="col-span-4">
                    {idx === 0 && <p className="text-[9px] text-gray-400 uppercase mb-1">Descrição</p>}
                    <Input placeholder="Ex: Vaso de pressão V-101" value={eq.descricao}
                      onChange={(e) => setEquipamentos((prev) => prev.map((x) => x.id === eq.id ? { ...x, descricao: e.target.value } : x))} />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <p className="text-[9px] text-gray-400 uppercase mb-1">Peso (ton)</p>}
                    <CurrencyInput value={eq.pesoTon}
                      onChange={(v) => setEquipamentos((prev) => prev.map((x) => x.id === eq.id ? { ...x, pesoTon: v } : x))} />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <p className="text-[9px] text-gray-400 uppercase mb-1">Valor Total (R$)</p>}
                    <CurrencyInput value={eq.valorTotal}
                      onChange={(v) => setEquipamentos((prev) => prev.map((x) => x.id === eq.id ? { ...x, valorTotal: v } : x))} />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <p className="text-[9px] text-gray-400 uppercase mb-1">Obs.</p>}
                    <Input placeholder="Opcional" value={eq.obs}
                      onChange={(e) => setEquipamentos((prev) => prev.map((x) => x.id === eq.id ? { ...x, obs: e.target.value } : x))} />
                  </div>
                  <div className="col-span-1 flex items-end pb-[1px]">
                    {idx === 0 && <p className="text-[9px] text-gray-400 uppercase mb-1 invisible">X</p>}
                    <button
                      onClick={() => equipamentos.length > 1 && setEquipamentos((prev) => prev.filter((x) => x.id !== eq.id))}
                      disabled={equipamentos.length === 1}
                      className="text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none w-full text-center"
                    >✕</button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setEquipamentos((prev) => [...prev, mkEquip(nextEquipId)]); setNextEquipId((n) => n + 1) }}
                className="text-[11px] text-green-primary hover:underline mb-3"
              >+ Adicionar equipamento</button>

              {pesoTotalFab > 0 && (
                <div className="bg-gray-100 rounded px-3 py-2 mb-3 grid grid-cols-3 gap-3 text-[11px]">
                  <div><p className="text-[9px] text-gray-400 uppercase">Peso Total</p><p className="font-semibold">{pesoTotalFab.toFixed(2).replace('.', ',')} ton</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Valor Equipamentos</p><p className="font-semibold">{formatCurrency(valorEquipFab)}</p></div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <input id="testes-ed" type="checkbox" checked={possuiTestes} onChange={(e) => setPossuiTestes(e.target.checked)} className="accent-green-primary" />
                <label htmlFor="testes-ed" className="text-[12px] font-medium cursor-pointer">Possui Testes?</label>
              </div>
              {possuiTestes && (
                <div className="pl-4 border-l-2 border-green-primary/30 mb-3 grid grid-cols-2 gap-2.5">
                  <Field label="Descrição dos testes">
                    <Input placeholder="Ex: Teste hidrostático" value={descTestes} onChange={(e) => setDescTestes(e.target.value)} />
                  </Field>
                  <Field label="Valor dos testes (R$)">
                    <CurrencyInput value={valorTestes} onChange={setValorTestes} />
                  </Field>
                </div>
              )}

              {totalFab > 0 && (
                <div className="bg-[#EEF7EE] border border-[#C8E6C9] rounded px-3 py-2 mb-3 grid grid-cols-2 gap-3 text-[11px]">
                  <div><p className="text-[9px] text-gray-500 uppercase font-bold">Total Geral</p><p className="font-bold text-auto-value text-[13px]">{formatCurrency(totalFab)}</p></div>
                </div>
              )}

              <ModalSection>Data de Envio</ModalSection>
              <Field label="Data de envio" className="mb-3">
                <Input type="date" value={dataEnvioFab} onChange={(e) => setDataEnvioFab(e.target.value)} />
              </Field>

              <div className="flex justify-end">
                <Button onClick={handleSaveFabricacao} disabled={loadingFab}>
                  {loadingFab ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ SEÇÃO RESULTADO (Comercial — Obras/Paradas) ════════════════ */}
      {!isFabricacao && (
        <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
          <button
            onClick={() => hasComercial && toggle('resultado')}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors
              ${hasComercial ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}
              ${openSection === 'resultado' ? 'bg-gray-50' : 'bg-white'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{openSection === 'resultado' ? '▼' : '▶'}</span>
              <span>3. Resultado</span>
              {!hasComercial && <span className="text-[11px] text-amber-500 font-normal">— registre a comercial primeiro</span>}
              {okRes && <span className="text-[11px] text-green-primary font-semibold">✓ Salvo</span>}
            </div>
            {item.resultado && (
              <span className="text-[11px] text-gray-400">
                Atual: {item.resultado === 'AGUARDANDO' ? 'Aguardando' : item.resultado === 'GANHOU' ? 'Ganhou' : 'Perdeu'}
              </span>
            )}
          </button>

          {openSection === 'resultado' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              {errorRes && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorRes}</div>}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <Field label="Resultado *">
                  <Select value={resultado} onChange={(e) => { setResultado(e.target.value); setMotivoPerda('') }}>
                    <option value="AGUARDANDO">Aguardando</option>
                    <option value="GANHOU">Ganhou</option>
                    <option value="PERDEU">Perdeu</option>
                  </Select>
                </Field>
                {resultado === 'PERDEU' && (
                  <Field label="Motivo de perda *">
                    <Select value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value as MotivoPerda)}>
                      <option value="">Selecione...</option>
                      {(Object.keys(MOTIVO_PERDA_LABELS) as MotivoPerda[]).map((k) => (
                        <option key={k} value={k}>{MOTIVO_PERDA_LABELS[k]}</option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveResultado} disabled={loadingRes}>{loadingRes ? 'Salvando...' : 'Salvar Resultado'}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ SEÇÃO RESULTADO (Fabricação) ═══════════════════════════════ */}
      {isFabricacao && (
        <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
          <button
            onClick={() => hasFabricacao && toggle('resultado_fab')}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors
              ${hasFabricacao ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}
              ${openSection === 'resultado_fab' ? 'bg-gray-50' : 'bg-white'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{openSection === 'resultado_fab' ? '▼' : '▶'}</span>
              <span>2. Resultado</span>
              {!hasFabricacao && <span className="text-[11px] text-amber-500 font-normal">— registre a proposta primeiro</span>}
              {okResFab && <span className="text-[11px] text-green-primary font-semibold">✓ Salvo</span>}
            </div>
            {item.propostas_fabricacao[0]?.resultado && (
              <span className="text-[11px] text-gray-400">
                Atual: {item.propostas_fabricacao[0].resultado === 'AGUARDANDO' ? 'Aguardando' : item.propostas_fabricacao[0].resultado === 'GANHOU' ? 'Ganhou' : 'Perdeu'}
              </span>
            )}
          </button>

          {openSection === 'resultado_fab' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              {errorResFab && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorResFab}</div>}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <Field label="Resultado *">
                  <Select value={resultadoFab} onChange={(e) => { setResultadoFab(e.target.value); setMotivoPerdaFab('') }}>
                    <option value="AGUARDANDO">Aguardando</option>
                    <option value="GANHOU">Ganhou</option>
                    <option value="PERDEU">Perdeu</option>
                  </Select>
                </Field>
                {resultadoFab === 'PERDEU' && (
                  <Field label="Motivo de perda *">
                    <Select value={motivoPerdaFab} onChange={(e) => setMotivoPerdaFab(e.target.value as MotivoPerda)}>
                      <option value="">Selecione...</option>
                      {(Object.keys(MOTIVO_PERDA_LABELS) as MotivoPerda[]).map((k) => (
                        <option key={k} value={k}>{MOTIVO_PERDA_LABELS[k]}</option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveResultadoFab} disabled={loadingResFab}>{loadingResFab ? 'Salvando...' : 'Salvar Resultado'}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ SEÇÃO CANCELAMENTO ════════════════════════════════════════════ */}
      {canCancelar && (
        <div className="mt-4 border border-red-200 rounded-lg overflow-hidden">
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors bg-white"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px]">⚠</span>
                <span>Cancelar / Excluir Proposta</span>
              </div>
              <span className="text-[11px] text-red-400 font-normal">Ação irreversível — RN-18</span>
            </button>
          ) : (
            <div className="px-4 py-3 bg-red-50">
              <p className="text-xs font-semibold text-red-700 mb-1">Tem certeza? Esta ação cancela a proposta e não pode ser desfeita.</p>
              <p className="text-[11px] text-red-500 mb-3">O registro é mantido no histórico com status <strong>Cancelada</strong>.</p>
              {errorCancel && <div className="bg-red-100 border border-red-300 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorCancel}</div>}
              <Field label="Justificativa *" className="mb-3">
                <textarea
                  rows={2}
                  placeholder="Descreva o motivo do cancelamento (mín. 5 caracteres)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none"
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setConfirmCancel(false); setCancelReason(''); setErrorCancel(null) }} className="text-xs text-gray-500 hover:underline px-3 py-1.5">Voltar</button>
                <button onClick={handleCancelar} disabled={loadingCancel} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded-md disabled:opacity-60 transition-colors">
                  {loadingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
