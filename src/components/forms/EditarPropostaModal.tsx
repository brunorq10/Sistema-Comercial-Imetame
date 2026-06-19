'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, AutoInput, IntegerInput, CurrencyInput } from '@/components/ui/Input'
import { formatCurrency, formatDate, formatRev } from '@/lib/utils'
import { MOTIVO_PERDA_LABELS } from '@/types'
import type { PropostasItem, MotivoPerda } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  item: PropostasItem
  canRegistrarTecnica: boolean
  canRegistrarComercial: boolean
  canCancelar: boolean
}

const today = () => new Date().toISOString().split('T')[0]

const TURNOS = [
  { value: 'Turno adm', label: 'Turno adm' },
  { value: '1 turno',   label: '1 turno'   },
  { value: '2 Turnos',  label: '2 Turnos'  },
  { value: '3 Turnos',  label: '3 Turnos'  },
]

const TERCEIROS_ESPECIALIDADES = [
  { key: 'valor_eletrica',         state: 'eletrica',   label: 'ElÃ©trica' },
  { key: 'valor_isolamento',       state: 'isolamento', label: 'Isolamento' },
  { key: 'valor_civil',            state: 'civil',      label: 'Civil' },
  { key: 'valor_hidraulica',       state: 'hidraulica', label: 'HidrÃ¡ulica' },
  { key: 'valor_fibra',            state: 'fibra',      label: 'Fibra' },
  { key: 'valor_tijolo_antiacido', state: 'tijolo',     label: 'Tijolo antiÃ¡cido' },
  { key: 'valor_outros_terceiros', state: 'outros',     label: 'Outros' },
] as const

type TerceiroKey = typeof TERCEIROS_ESPECIALIDADES[number]['state']
type Tab = 'tecnica' | 'comercial' | 'resultado' | 'cancelar'

interface EquipItem { id: number; descricao: string; pesoTon: string; valorTotal: string; obs: string }
const mkEquip = (id: number): EquipItem => ({ id, descricao: '', pesoTon: '', valorTotal: '', obs: '' })
const asStr = (v: string | number | null | undefined) => v != null ? String(Number(v)) : ''

function SimNaoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-gray-300 text-[11px] font-semibold">
      <button type="button" onClick={() => onChange(false)}
        className={`px-3 py-1 transition-colors ${!value ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>NÃ£o</button>
      <button type="button" onClick={() => onChange(true)}
        className={`px-3 py-1 transition-colors border-l border-gray-300 ${value ? 'bg-green-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>Sim</button>
    </div>
  )
}

function CancelSection({ confirmCancel, setConfirmCancel, cancelReason, setCancelReason, errorCancel, loadingCancel, onCancelar, canCancelar }: {
  confirmCancel: boolean; setConfirmCancel: (v: boolean) => void
  cancelReason: string; setCancelReason: (v: string) => void
  errorCancel: string | null; loadingCancel: boolean
  onCancelar: () => void; canCancelar: boolean
}) {
  if (!canCancelar) return null
  return (
    <div className="mt-4 border border-red-200 rounded-lg overflow-hidden">
      {!confirmCancel ? (
        <button onClick={() => setConfirmCancel(true)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors bg-white">
          <div className="flex items-center gap-2"><span className="text-[10px]">âš </span><span>Cancelar / Excluir Proposta</span></div>
          <span className="text-[11px] text-red-400 font-normal">AÃ§Ã£o irreversÃ­vel â€” RN-18</span>
        </button>
      ) : (
        <div className="px-4 py-3 bg-red-50">
          <p className="text-xs font-semibold text-red-700 mb-1">Tem certeza? Esta aÃ§Ã£o cancela a proposta e nÃ£o pode ser desfeita.</p>
          <p className="text-[11px] text-red-500 mb-3">O registro Ã© mantido no histÃ³rico com status <strong>Cancelada</strong>.</p>
          {errorCancel && <div className="bg-red-100 border border-red-300 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorCancel}</div>}
          <Field label="Justificativa *" className="mb-3">
            <textarea rows={2} placeholder="Descreva o motivo do cancelamento (mÃ­n. 5 caracteres)..."
              value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none" />
          </Field>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmCancel(false)} className="text-xs text-gray-500 hover:underline px-3 py-1.5">Voltar</button>
            <button onClick={onCancelar} disabled={loadingCancel}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded-md disabled:opacity-60 transition-colors">
              {loadingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function EditarPropostaModal({
  open, onClose, onSuccess, item, canRegistrarTecnica, canRegistrarComercial, canCancelar,
}: Props) {
  const isFab    = item.classificacao === 'FABRICACOES' || item.classificacao === 'OLEO_GAS'
  const isParada = item.classificacao === 'PARADAS'
  const isObra   = item.classificacao === 'OBRAS'

  const [tab, setTab] = useState<Tab>('tecnica')

  // â”€â”€ Estado tÃ©cnica Paradas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [hhDireto,     setHhDireto]     = useState('')
  const [hhIndireto,   setHhIndireto]   = useState('')
  const [pesoMontagem, setPesoMontagem] = useState('')
  const [efetivoPico,  setEfetivoPico]  = useState('')
  const [diasParada,   setDiasParada]   = useState('')
  const [turno,        setTurno]        = useState('')
  const [finaisSemana, setFinaisSemana] = useState(false)
  const [dataEnvioTec, setDataEnvioTec] = useState(today())
  const [loadingTec,   setLoadingTec]   = useState(false)
  const [errorTec,     setErrorTec]     = useState<string | null>(null)

  // â”€â”€ Estado tÃ©cnica Obras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [pesosObra, setPesosObra] = useState({ equipamentos: '', tubulacoes: '', suportes: '', estruturas: '' })
  const [hhTotalObra, setHhTotalObra] = useState('')

  // â”€â”€ Estado comercial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tecnicaId,       setTecnicaId]       = useState('')
  const [valorMontagem,   setValorMontagem]   = useState('')
  const [possuiTerceiros, setPossuiTerceiros] = useState(false)
  const [terceiros, setTerceiros] = useState<Record<TerceiroKey, string>>({
    eletrica: '', isolamento: '', civil: '', hidraulica: '', fibra: '', tijolo: '', outros: '',
  })
  const [possuiFab,    setPossuiFab]    = useState(false)
  const [valorFab,     setValorFab]     = useState('')
  const [pesoFab,      setPesoFab]      = useState('')
  const [dataEnvioCom, setDataEnvioCom] = useState(today())
  const [loadingCom,   setLoadingCom]   = useState(false)
  const [errorCom,     setErrorCom]     = useState<string | null>(null)

  // Paradas comercial
  const [valorTotalParada,     setValorTotalParada]     = useState('')
  const [valorTerceirosParada, setValorTerceirosParada] = useState('')

  // â”€â”€ Estado resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [resultado,   setResultado]   = useState('AGUARDANDO')
  const [motivoPerda, setMotivoPerda] = useState<MotivoPerda | ''>('')
  const [loadingRes,  setLoadingRes]  = useState(false)
  const [errorRes,    setErrorRes]    = useState<string | null>(null)

  // â”€â”€ Estado fabricaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [equipamentos,   setEquipamentos]   = useState<EquipItem[]>([mkEquip(1)])
  const [nextEquipId,    setNextEquipId]    = useState(2)
  const [possuiTestes,   setPossuiTestes]   = useState(false)
  const [descTestes,     setDescTestes]     = useState('')
  const [valorTestes,    setValorTestes]    = useState('')
  const [possuiMontagem, setPossuiMontagem] = useState(false)
  const [valorMontFab,   setValorMontFab]   = useState('')
  const [dataEnvioFab,   setDataEnvioFab]   = useState(today())
  const [loadingFab,     setLoadingFab]     = useState(false)
  const [errorFab,       setErrorFab]       = useState<string | null>(null)
  const [resultadoFab,   setResultadoFab]   = useState('AGUARDANDO')
  const [motivoPerdaFab, setMotivoPerdaFab] = useState<MotivoPerda | ''>('')
  const [loadingResFab,  setLoadingResFab]  = useState(false)
  const [errorResFab,    setErrorResFab]    = useState<string | null>(null)

  // â”€â”€ Cancelamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason,  setCancelReason]  = useState('')
  const [loadingCancel, setLoadingCancel] = useState(false)
  const [errorCancel,   setErrorCancel]   = useState<string | null>(null)

  // â”€â”€ PrÃ©-preenchimento ao abrir â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!open) return
    setTab('tecnica')
    setErrorTec(null); setErrorCom(null); setErrorRes(null)
    setErrorFab(null); setErrorResFab(null)
    setConfirmCancel(false); setCancelReason(''); setErrorCancel(null)

    const tec = item.propostas_tecnicas[0] ?? null

    // TÃ©cnica Paradas
    setHhDireto(tec?.hh_direto != null ? String(tec.hh_direto) : '')
    setHhIndireto(tec?.hh_indireto != null ? String(tec.hh_indireto) : '')
    setPesoMontagem(asStr(tec?.peso_montagem))
    setDataEnvioTec(tec?.data_envio ? tec.data_envio.split('T')[0] : today())
    setEfetivoPico(tec?.efetivo_pico != null ? String(tec.efetivo_pico) : '')
    setDiasParada(tec?.dias_parada != null ? String(tec.dias_parada) : '')
    setTurno(tec?.turno ?? '')
    setFinaisSemana(tec?.finais_de_semana ?? false)

    // TÃ©cnica Obras
    setPesosObra({
      equipamentos: asStr(tec?.peso_equipamentos),
      tubulacoes:   asStr(tec?.peso_tubulacoes),
      suportes:     asStr(tec?.peso_suportes),
      estruturas:   asStr(tec?.peso_estruturas),
    })
    setHhTotalObra(tec?.hh_total != null ? String(tec.hh_total) : '')

    // Comercial — usa apenas o da revisão atual para não pré-preencher com dados de revisões antigas
    const revAtual = Math.max(item.revisao_esperada, tec?.versao ?? 0)
    const com = item.propostas_comerciais.find(c => c.versao === revAtual) ?? null
    setTecnicaId(com?.proposta_tecnica_id != null ? String(com.proposta_tecnica_id) : (tec ? String(tec.id) : ''))
    setValorMontagem(asStr(com?.valor_montagem_mecanica))
    setPossuiTerceiros(com?.possui_terceiros ?? false)
    setTerceiros({
      eletrica:   asStr(com?.valor_eletrica),
      isolamento: asStr(com?.valor_isolamento),
      civil:      asStr(com?.valor_civil),
      hidraulica: asStr(com?.valor_hidraulica),
      fibra:      asStr(com?.valor_fibra),
      tijolo:     asStr(com?.valor_tijolo_antiacido),
      outros:     asStr(com?.valor_outros_terceiros),
    })
    setPossuiFab(com?.possui_fabricacao ?? false)
    setValorFab(asStr(com?.valor_fabricacao))
    setPesoFab(asStr(com?.peso_fabricacao))
    setDataEnvioCom(com?.data_envio ? com.data_envio.split('T')[0] : today())
    setValorTotalParada(asStr(com?.valor_total))
    setValorTerceirosParada(asStr(com?.valor_terceiros))
    setResultado(com?.resultado ?? 'AGUARDANDO')
    setMotivoPerda((com?.motivo_perda ?? '') as MotivoPerda | '')

    // FabricaÃ§Ã£o
    const fab = item.propostas_fabricacao[0] ?? null
    if (fab) {
      const equips = fab.equipamentos.map((e, i) => ({
        id: i + 1, descricao: e.descricao, pesoTon: asStr(e.peso_ton),
        valorTotal: asStr(e.valor_total), obs: e.observacoes ?? '',
      }))
      setEquipamentos(equips.length > 0 ? equips : [mkEquip(1)])
      setNextEquipId(equips.length + 1)
      setPossuiTestes(fab.possui_testes)
      setDescTestes(fab.descricao_testes ?? '')
      setValorTestes(asStr(fab.valor_testes))
      setPossuiMontagem(fab.possui_montagem)
      setValorMontFab(asStr(fab.valor_montagem))
      setDataEnvioFab(fab.data_envio ? fab.data_envio.split('T')[0] : today())
      setResultadoFab(fab.resultado ?? 'AGUARDANDO')
      setMotivoPerdaFab((fab.motivo_perda ?? '') as MotivoPerda | '')
    } else {
      setEquipamentos([mkEquip(1)]); setNextEquipId(2)
      setPossuiTestes(false); setDescTestes(''); setValorTestes('')
      setPossuiMontagem(false); setValorMontFab(''); setDataEnvioFab(today())
      setResultadoFab('AGUARDANDO'); setMotivoPerdaFab('')
    }
  }, [open, item])

  // â”€â”€ CÃ¡lculos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const hd = Number(hhDireto) || 0
  const hi = Number(hhIndireto) || 0
  const hhTotalCalc = hd + hi

  const pesoCats = ['equipamentos', 'tubulacoes', 'suportes', 'estruturas'] as const
  const pesoTotalObra = pesoCats.reduce((s, k) => s + (Number(pesosObra[k]) || 0), 0)
  const pesoPercents  = pesoCats.map(k => {
    const v = Number(pesosObra[k]) || 0
    return pesoTotalObra > 0 && v > 0 ? ((v / pesoTotalObra) * 100).toFixed(1) + '%' : 'â€”'
  })
  const pesoCatLabels: Record<string, string> = {
    equipamentos: 'Equipamentos', tubulacoes: 'TubulaÃ§Ãµes',
    suportes: 'Suportes', estruturas: 'Estruturas e Plataformas',
  }
  const numHhObra    = Number(hhTotalObra) || 0
  const hhPorTonObra = pesoTotalObra > 0 && numHhObra > 0 ? (numHhObra / pesoTotalObra).toFixed(0) : null

  const tecSel       = item.propostas_tecnicas.find(t => String(t.id) === tecnicaId) ?? null
  const hhTotalTec   = tecSel ? (tecSel.hh_total ?? ((tecSel.hh_direto ?? 0) + (tecSel.hh_indireto ?? 0))) : 0
  const pesoTotalTec = tecSel?.peso_montagem != null ? Number(tecSel.peso_montagem) : null

  const numMontagem  = Number(valorMontagem) || 0
  const sumTerceiros = TERCEIROS_ESPECIALIDADES.reduce((s, e) => s + (Number(terceiros[e.state]) || 0), 0)
  const numFab       = possuiFab ? (Number(valorFab) || 0) : 0
  const numPesoFab   = possuiFab ? (Number(pesoFab) || 0) : 0
  const totalGeral   = numMontagem + (possuiTerceiros ? sumTerceiros : 0) + numFab
  const rsPorKgMont  = pesoTotalTec && pesoTotalTec > 0 && numMontagem > 0 ? numMontagem / (pesoTotalTec * 1000) : null
  const rsPorHhMont  = hhTotalTec > 0 && numMontagem > 0 ? numMontagem / hhTotalTec : null
  const rsPorKgGlob  = pesoTotalTec && pesoTotalTec > 0 && totalGeral > 0 ? totalGeral / (pesoTotalTec * 1000) : null
  const rsPorHhGlob  = hhTotalTec > 0 && totalGeral > 0 ? totalGeral / hhTotalTec : null
  const rsPorKgFab   = numPesoFab > 0 && numFab > 0 ? numFab / (numPesoFab * 1000) : null

  const numValParada  = Number(valorTotalParada) || 0
  const numTercParada = Number(valorTerceirosParada) || 0
  const valorSemTerc  = numValParada > 0 ? numValParada - numTercParada : null
  const rshhSemTerc   = valorSemTerc !== null && hhTotalTec > 0 ? valorSemTerc / hhTotalTec : null
  const rshhComTerc   = numValParada > 0 && hhTotalTec > 0 ? numValParada / hhTotalTec : null

  const pesoTotalFab  = equipamentos.reduce((s, e) => s + (Number(e.pesoTon) || 0), 0)
  const valorEquipFab = equipamentos.reduce((s, e) => s + (Number(e.valorTotal) || 0), 0)
  const numTestesFab  = possuiTestes ? (Number(valorTestes) || 0) : 0
  const numMontFab    = possuiMontagem ? (Number(valorMontFab) || 0) : 0
  const totalFab      = valorEquipFab + numTestesFab + numMontFab
  const rsPorKgFabFab = pesoTotalFab > 0 && totalFab > 0 ? totalFab / (pesoTotalFab * 1000) : null

  // Revisão atual = slot que técnica/comercial devem preencher
  const revisaoAtual = Math.max(item.revisao_esperada, item.propostas_tecnicas[0]?.versao ?? 0)
  // Decide PUT (editar existente da revisão atual) vs POST (criar para nova revisão)
  const hasTecnicaCurrentRev  = item.propostas_tecnicas.some(t => t.versao === revisaoAtual)
  const hasComercialCurrentRev = item.propostas_comerciais.some(c => c.versao === revisaoAtual)

  const hasTecnica    = item.propostas_tecnicas.length > 0
  const hasComercial  = item.propostas_comerciais.length > 0
  const hasFabricacao = item.propostas_fabricacao.length > 0

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveTecnicaParada = async () => {
    if (hd <= 0)                               { setErrorTec('HH Direto Ã© obrigatÃ³rio'); return }
    if (!efetivoPico || parseInt(efetivoPico) <= 0) { setErrorTec('Efetivo Pico Ã© obrigatÃ³rio'); return }
    if (!diasParada  || parseInt(diasParada)  <= 0) { setErrorTec('Dias de Parada Ã© obrigatÃ³rio'); return }
    setLoadingTec(true); setErrorTec(null)
    try {
      const body: Record<string, unknown> = {
        hh_direto: hd, hh_indireto: hi,
        efetivo_pico: parseInt(efetivoPico), dias_parada: parseInt(diasParada),
        finais_de_semana: finaisSemana, data_envio: dataEnvioTec,
      }
      if (pesoMontagem) body.peso_montagem = Number(pesoMontagem)
      if (turno) body.turno = turno
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-tecnica`, {
        method: hasTecnicaCurrentRev ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorTec(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingTec(false) }
  }

  const saveTecnicaObra = async () => {
    if (pesoTotalObra <= 0)         { setErrorTec('Informe o peso de ao menos uma categoria'); return }
    if (!hhTotalObra || numHhObra <= 0) { setErrorTec('HH Total Ã© obrigatÃ³rio'); return }
    setLoadingTec(true); setErrorTec(null)
    try {
      const body: Record<string, unknown> = { hh_total: numHhObra, peso_montagem: pesoTotalObra, data_envio: dataEnvioTec }
      pesoCats.forEach(k => { if (Number(pesosObra[k]) > 0) body[`peso_${k}`] = Number(pesosObra[k]) })
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-tecnica`, {
        method: hasTecnicaCurrentRev ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorTec(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingTec(false) }
  }

  const saveComercialObra = async () => {
    if (!tecnicaId)      { setErrorCom('Selecione a revisÃ£o tÃ©cnica'); return }
    if (numMontagem <= 0) { setErrorCom('Valor da Montagem Ã© obrigatÃ³rio'); return }
    setLoadingCom(true); setErrorCom(null)
    try {
      const body: Record<string, unknown> = {
        proposta_tecnica_id: Number(tecnicaId), valor_montagem_mecanica: numMontagem,
        possui_terceiros: possuiTerceiros, possui_fabricacao: possuiFab, data_envio: dataEnvioCom,
      }
      if (possuiTerceiros) {
        for (const e of TERCEIROS_ESPECIALIDADES) {
          const v = Number(terceiros[e.state]) || 0
          if (v > 0) body[e.key] = v
        }
      }
      if (possuiFab && numFab > 0) {
        body.valor_fabricacao = numFab
        if (numPesoFab > 0) body.peso_fabricacao = numPesoFab
      }
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-comercial`, {
        method: hasComercialCurrentRev ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorCom(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingCom(false) }
  }

  const saveComercialParada = async () => {
    if (!tecnicaId)       { setErrorCom('Selecione a revisÃ£o tÃ©cnica'); return }
    if (numValParada <= 0) { setErrorCom('Valor Total Ã© obrigatÃ³rio'); return }
    setLoadingCom(true); setErrorCom(null)
    try {
      const body: Record<string, unknown> = {
        proposta_tecnica_id: Number(tecnicaId), valor_total_direto: numValParada, data_envio: dataEnvioCom,
      }
      if (numTercParada > 0) body.valor_terceiros = numTercParada
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-comercial`, {
        method: hasComercialCurrentRev ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorCom(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingCom(false) }
  }

  const saveResultado = async () => {
    if (resultado === 'PERDEU' && !motivoPerda) { setErrorRes('Motivo de perda Ã© obrigatÃ³rio'); return }
    setLoadingRes(true); setErrorRes(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-comercial`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado, motivo_perda: resultado === 'PERDEU' ? motivoPerda : undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorRes(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingRes(false) }
  }

  const saveFabricacao = async () => {
    const validos = equipamentos.filter(e => e.descricao.trim() && Number(e.pesoTon) > 0)
    if (validos.length === 0) { setErrorFab('Adicione ao menos um equipamento com descriÃ§Ã£o e peso'); return }
    setLoadingFab(true); setErrorFab(null)
    try {
      const body: Record<string, unknown> = {
        equipamentos: validos.map(e => ({
          descricao: e.descricao.trim(), peso_ton: Number(e.pesoTon),
          valor_total: Number(e.valorTotal), ...(e.obs.trim() ? { observacoes: e.obs.trim() } : {}),
        })),
        possui_testes: possuiTestes, possui_montagem: possuiMontagem, data_envio: dataEnvioFab,
      }
      if (possuiTestes) {
        if (descTestes.trim()) body.descricao_testes = descTestes.trim()
        if (numTestesFab > 0) body.valor_testes = numTestesFab
      }
      if (possuiMontagem && numMontFab > 0) body.valor_montagem = numMontFab
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-fabricacao`, {
        method: hasFabricacao ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorFab(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingFab(false) }
  }

  const saveResultadoFab = async () => {
    if (resultadoFab === 'PERDEU' && !motivoPerdaFab) { setErrorResFab('Motivo de perda Ã© obrigatÃ³rio'); return }
    setLoadingResFab(true); setErrorResFab(null)
    try {
      const res = await fetch(`/api/solicitacoes/${item.id}/proposta-fabricacao`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado: resultadoFab, motivo_perda: resultadoFab === 'PERDEU' ? motivoPerdaFab : undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorResFab(json.error ?? 'Erro ao salvar'); return }
      onSuccess()
    } finally { setLoadingResFab(false) }
  }

  const handleCancelar = async () => {
    if (cancelReason.trim().length < 5) { setErrorCancel('Justificativa obrigatÃ³ria (mÃ­n. 5 caracteres)'); return }
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

  // â”€â”€ Render FabricaÃ§Ãµes (scroll Ãºnico, sem tabs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isFab) {
    return (
      <Modal open={open}
      confirmClose onClose={onClose} title={`Editar Proposta Â· ${item.numero}`} extraWide
        footer={<ModalCancelButton label="Fechar" />}
      >
        {canRegistrarTecnica && (
          <>
            {errorFab && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorFab}</div>}
            <ModalSection>1. Equipamentos a fabricar</ModalSection>
            <div className="flex flex-col gap-3 mb-3">
              {equipamentos.map((eq, idx) => {
                const p = Number(eq.pesoTon) || 0; const v = Number(eq.valorTotal) || 0
                const rskg = p > 0 && v > 0 ? formatCurrency(v / (p * 1000)) + '/kg' : null
                return (
                  <div key={eq.id} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Equipamento {idx + 1}</span>
                      {equipamentos.length > 1 && (
                        <button onClick={() => setEquipamentos(pr => pr.filter(x => x.id !== eq.id))}
                          className="text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-0.5">âœ• Remover</button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 mb-2">
                      <Field label="DescriÃ§Ã£o" className="col-span-1">
                        <Input value={eq.descricao} onChange={e => setEquipamentos(pr => pr.map(x => x.id === eq.id ? { ...x, descricao: e.target.value } : x))} />
                      </Field>
                      <Field label="Peso (ton)">
                        <CurrencyInput value={eq.pesoTon} onChange={v2 => setEquipamentos(pr => pr.map(x => x.id === eq.id ? { ...x, pesoTon: v2 } : x))} />
                      </Field>
                      <Field label="Valor Total (R$)">
                        <CurrencyInput value={eq.valorTotal} onChange={v2 => setEquipamentos(pr => pr.map(x => x.id === eq.id ? { ...x, valorTotal: v2 } : x))} />
                      </Field>
                    </div>
                    {rskg && <p className="text-[10px] text-auto-value font-bold mb-2">{rskg}</p>}
                    <Field label="ObservaÃ§Ãµes">
                      <Input value={eq.obs} onChange={e => setEquipamentos(pr => pr.map(x => x.id === eq.id ? { ...x, obs: e.target.value } : x))} />
                    </Field>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { setEquipamentos(p => [...p, mkEquip(nextEquipId)]); setNextEquipId(n => n + 1) }}
              className="text-[11px] text-green-primary border border-green-primary/40 rounded px-3 py-1.5 hover:bg-green-light transition-colors mb-4">
              + Adicionar equipamento
            </button>

            <ModalSection>2. Testes</ModalSection>
            <div className="flex gap-3 mb-3">
              {([false, true] as const).map(v => (
                <button key={String(v)} onClick={() => setPossuiTestes(v)}
                  className={`text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${possuiTestes === v ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-300'}`}>
                  {v ? 'Sim â€” serÃ¡ necessÃ¡rio realizar testes' : 'NÃ£o'}
                </button>
              ))}
            </div>
            {possuiTestes && (
              <div className="pl-4 border-l-2 border-green-primary/30 mb-4 grid grid-cols-2 gap-2.5">
                <Field label="DescriÃ§Ã£o dos testes"><Input value={descTestes} onChange={e => setDescTestes(e.target.value)} /></Field>
                <Field label="Valor dos testes (R$)"><CurrencyInput value={valorTestes} onChange={setValorTestes} /></Field>
              </div>
            )}

            <ModalSection>3. Montagem</ModalSection>
            <div className="flex gap-3 mb-3">
              {([false, true] as const).map(v => (
                <button key={String(v)} onClick={() => setPossuiMontagem(v)}
                  className={`text-[11px] font-semibold px-4 py-1.5 rounded-full border transition-colors ${possuiMontagem === v ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-300'}`}>
                  {v ? 'Sim â€” haverÃ¡ montagem' : 'NÃ£o'}
                </button>
              ))}
            </div>
            {possuiMontagem && (
              <div className="pl-4 border-l-2 border-green-primary/30 mb-4">
                <Field label="Valor da Montagem (R$)"><CurrencyInput value={valorMontFab} onChange={setValorMontFab} /></Field>
              </div>
            )}

            {totalFab > 0 && (
              <>
                <ModalSection>4. Total Geral</ModalSection>
                <div className="bg-[#EEF7EE] border border-[#C8E6C9] rounded p-3 mb-4">
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div><p className="text-[9px] text-gray-500 uppercase font-bold">Peso Total (ton)</p><p className="text-[15px] font-bold text-gray-700">{pesoTotalFab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-bold">Valor Total</p><p className="text-[15px] font-bold text-auto-value">{formatCurrency(totalFab)}</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-bold">R$/kg final</p><p className="text-[15px] font-bold text-auto-value">{rsPorKgFabFab ? formatCurrency(rsPorKgFabFab) + '/kg' : 'â€”'}</p></div>
                  </div>
                  {(numTestesFab > 0 || numMontFab > 0) && (
                    <div className="text-[10px] text-gray-500 flex gap-4 pt-2 border-t border-[#C8E6C9]">
                      <span>Equipamentos: {formatCurrency(valorEquipFab)}</span>
                      {numTestesFab > 0 && <span>Testes: {formatCurrency(numTestesFab)}</span>}
                      {numMontFab > 0 && <span>Montagem: {formatCurrency(numMontFab)}</span>}
                    </div>
                  )}
                </div>
              </>
            )}

            <ModalSection>5. Data de Envio</ModalSection>
            <Field label="Data de envio" className="mb-4">
              <Input type="date" value={dataEnvioFab} onChange={e => setDataEnvioFab(e.target.value)} className="max-w-[200px]" />
            </Field>
            <div className="flex justify-end mb-6">
              <Button onClick={saveFabricacao} disabled={loadingFab}>{loadingFab ? 'Salvando...' : 'Salvar Proposta'}</Button>
            </div>
          </>
        )}

        <ModalSection>Resultado</ModalSection>
        {errorResFab && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{errorResFab}</div>}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Field label="Resultado *">
            <Select value={resultadoFab} onChange={e => { setResultadoFab(e.target.value); setMotivoPerdaFab('') }}>
              <option value="AGUARDANDO">Aguardando</option>
              <option value="GANHOU">Ganhou</option>
              <option value="PERDEU">Perdeu</option>
            </Select>
          </Field>
          {resultadoFab === 'PERDEU' && (
            <Field label="Motivo de perda *">
              <Select value={motivoPerdaFab} onChange={e => setMotivoPerdaFab(e.target.value as MotivoPerda)}>
                <option value="">Selecione...</option>
                {(Object.keys(MOTIVO_PERDA_LABELS) as MotivoPerda[]).map(k => <option key={k} value={k}>{MOTIVO_PERDA_LABELS[k]}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="flex justify-end mb-4">
          <Button onClick={saveResultadoFab} disabled={loadingResFab}>{loadingResFab ? 'Salvando...' : 'Salvar Resultado'}</Button>
        </div>
        <CancelSection {...{ confirmCancel, setConfirmCancel, cancelReason, setCancelReason, errorCancel, loadingCancel, onCancelar: handleCancelar, canCancelar }} />
      </Modal>
    )
  }

  // â”€â”€ Render Obras / Paradas (tabs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const TABS: { key: Tab; label: string }[] = ([
    { key: 'tecnica'   as Tab, label: 'Proposta TÃ©cnica',  show: canRegistrarTecnica },
    { key: 'comercial' as Tab, label: 'Proposta Comercial', show: canRegistrarComercial },
    { key: 'resultado' as Tab, label: 'Resultado',          show: true },
    { key: 'cancelar'  as Tab, label: 'Cancelar',           show: canCancelar },
  ] as { key: Tab; label: string; show: boolean }[]).filter(t => t.show)

  return (
    <Modal open={open}
      confirmClose onClose={onClose} title={`Editar Proposta Â· ${item.numero}`} wide
      footer={<ModalCancelButton label="Fechar" />}
    >
      <div className="flex border-b border-gray-200 mb-4 -mt-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-green-primary text-green-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ TÃ©cnica Paradas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tab === 'tecnica' && isParada && (
        <div>
          {errorTec && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{errorTec}</div>}
          <ModalSection>1. Horas-Homem</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="HH Direto *"><IntegerInput value={hhDireto} onChange={setHhDireto} /></Field>
            <Field label="HH Indireto *"><IntegerInput value={hhIndireto} onChange={setHhIndireto} /></Field>
            <Field label="HH Total"><AutoInput value={hhTotalCalc > 0 ? hhTotalCalc.toLocaleString('pt-BR') : 'â€”'} /></Field>
            <Field label="% Indireto"><AutoInput value={hhTotalCalc > 0 && hi > 0 ? ((hi / hhTotalCalc) * 100).toFixed(1) + '%' : 'â€”'} /></Field>
          </div>
          <ModalSection>2. Dados da Parada</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="Efetivo Pico (pessoas) *"><IntegerInput value={efetivoPico} onChange={setEfetivoPico} /></Field>
            <Field label="Dias de Parada *"><IntegerInput value={diasParada} onChange={setDiasParada} /></Field>
            <Field label="Turno Considerado">
              <Select value={turno} onChange={e => setTurno(e.target.value)}>
                <option value="">Selecione...</option>
                {TURNOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Peso Montagem (ton, opcional)"><CurrencyInput value={pesoMontagem} onChange={setPesoMontagem} /></Field>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="fds-ed" checked={finaisSemana} onChange={e => setFinaisSemana(e.target.checked)} className="accent-green-primary" />
            <label htmlFor="fds-ed" className="text-[12px] font-medium cursor-pointer">Trabalho em finais de semana?</label>
          </div>
          <ModalSection>3. Data de Envio</ModalSection>
          <Field label="Data de envio â€” tÃ©cnica" className="mb-5">
            <Input type="date" value={dataEnvioTec} onChange={e => setDataEnvioTec(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveTecnicaParada} disabled={loadingTec}>{loadingTec ? 'Salvando...' : 'Confirmar envio tÃ©cnica'}</Button>
          </div>
        </div>
      )}

      {/* â”€â”€ TÃ©cnica Obras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tab === 'tecnica' && isObra && (
        <div>
          {errorTec && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{errorTec}</div>}
          <ModalSection>Categorias de Montagem</ModalSection>
          <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
            <table className="w-full text-[11px]">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[45%]">Categoria</th>
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[35%]">Peso (t)</th>
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[20%]">% do Total</th>
              </tr></thead>
              <tbody>
                {pesoCats.map((k, i) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 font-medium text-gray-700">{pesoCatLabels[k]}</td>
                    <td className="px-3 py-1.5"><CurrencyInput value={pesosObra[k]} onChange={v => setPesosObra(p => ({ ...p, [k]: v }))} /></td>
                    <td className="px-3 py-1.5"><AutoInput value={pesoPercents[i]} /></td>
                  </tr>
                ))}
                <tr className="bg-[#EEF7EE] border-t-2 border-[#C8E6C9]">
                  <td className="px-3 py-2 text-[11px] font-bold text-green-dark">Total</td>
                  <td className="px-3 py-2"><AutoInput value={pesoTotalObra > 0 ? pesoTotalObra.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : 'â€”'} /></td>
                  <td className="px-3 py-2"><AutoInput value={pesoTotalObra > 0 ? '100%' : 'â€”'} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <ModalSection>Horas-Homem</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <Field label="HH Total *"><IntegerInput value={hhTotalObra} onChange={setHhTotalObra} /></Field>
            <Field label="HH/ton (automÃ¡tico)"><AutoInput value={hhPorTonObra ? `${hhPorTonObra} HH/t` : 'â€”'} /></Field>
          </div>
          <ModalSection>Data de Envio</ModalSection>
          <Field label="Data de envio â€” tÃ©cnica" className="mb-5">
            <Input type="date" value={dataEnvioTec} onChange={e => setDataEnvioTec(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveTecnicaObra} disabled={loadingTec}>{loadingTec ? 'Salvando...' : 'Confirmar envio tÃ©cnica'}</Button>
          </div>
        </div>
      )}

      {/* â”€â”€ Comercial Paradas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tab === 'comercial' && isParada && (
        <div>
          {errorCom && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{errorCom}</div>}
          <ModalSection>1. RevisÃ£o tÃ©cnica de referÃªncia</ModalSection>
          {item.propostas_tecnicas.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded mb-4">Nenhuma proposta tÃ©cnica registrada. Registre a tÃ©cnica primeiro.</div>
          ) : (
            <>
              <Field label="RevisÃ£o tÃ©cnica" className="mb-3">
                <Select value={tecnicaId} onChange={e => setTecnicaId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {item.propostas_tecnicas.map(t => (
                    <option key={t.id} value={t.id}>{formatRev(t.versao)}{t === item.propostas_tecnicas[0] ? ' (mais recente)' : ''} â€” HH: {t.hh_total ?? ((t.hh_direto ?? 0) + (t.hh_indireto ?? 0))}</option>
                  ))}
                </Select>
              </Field>
              {tecSel && (
                <div className="bg-[#F9FBF9] border border-[#C8E6C9] rounded p-3 mb-3 grid grid-cols-4 gap-3 text-[11px]">
                  <div><p className="text-[9px] text-gray-400 uppercase">HH Direto</p><p className="font-semibold">{tecSel.hh_direto ?? 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">HH Indireto</p><p className="font-semibold">{tecSel.hh_indireto ?? 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">HH Total</p><p className="font-semibold text-auto-value">{hhTotalTec || 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Efetivo Pico</p><p className="font-semibold">{tecSel.efetivo_pico ?? 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Dias Parada</p><p className="font-semibold">{tecSel.dias_parada ?? 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Turno</p><p className="font-semibold">{tecSel.turno ?? 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Finais Semana</p><p className="font-semibold">{tecSel.finais_de_semana ? 'Sim' : 'NÃ£o'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Env. TÃ©cnica</p><p className="font-semibold text-auto-value">{formatDate(tecSel.data_envio)}</p></div>
                </div>
              )}
            </>
          )}
          <ModalSection>2. Valores da proposta comercial</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="Valor Total (R$) *"><CurrencyInput value={valorTotalParada} onChange={setValorTotalParada} /></Field>
            <Field label="Valor Terceiros (R$, opcional)"><CurrencyInput value={valorTerceirosParada} onChange={setValorTerceirosParada} /></Field>
          </div>
          {numValParada > 0 && (
            <div className="bg-[#EEF7EE] border border-[#C8E6C9] rounded p-3 mb-3 grid grid-cols-2 gap-3 text-[11px]">
              <div><p className="text-[9px] text-gray-500 uppercase font-bold">Valor sem Terceiros</p><p className="font-bold text-auto-value">{formatCurrency(valorSemTerc ?? numValParada)}</p></div>
              <div><p className="text-[9px] text-gray-500 uppercase font-bold">Total Geral</p><p className="font-bold text-auto-value">{formatCurrency(numValParada)}</p></div>
              <div><p className="text-[9px] text-gray-500 uppercase font-bold">R$/HH sem Terceiros</p><p className="font-bold text-auto-value">{rshhSemTerc ? formatCurrency(rshhSemTerc) : hhTotalTec > 0 ? formatCurrency(numValParada / hhTotalTec) : 'â€”'}</p></div>
              <div><p className="text-[9px] text-gray-500 uppercase font-bold">R$/HH com Terceiros</p><p className="font-bold text-auto-value">{rshhComTerc ? formatCurrency(rshhComTerc) : 'â€”'}</p></div>
            </div>
          )}
          <ModalSection>3. Data de Envio</ModalSection>
          <Field label="Data de envio â€” comercial" className="mb-5">
            <Input type="date" value={dataEnvioCom} onChange={e => setDataEnvioCom(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveComercialParada} disabled={loadingCom}>{loadingCom ? 'Salvando...' : 'Confirmar envio comercial'}</Button>
          </div>
        </div>
      )}

      {/* â”€â”€ Comercial Obras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tab === 'comercial' && isObra && (
        <div>
          {errorCom && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{errorCom}</div>}
          {item.propostas_tecnicas.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded mb-4">Nenhuma proposta tÃ©cnica registrada. Registre a tÃ©cnica primeiro.</div>
          ) : (
            <>
              <ModalSection>RevisÃ£o tÃ©cnica de referÃªncia</ModalSection>
              <Field label="RevisÃ£o tÃ©cnica *" className="mb-3">
                <Select value={tecnicaId} onChange={e => setTecnicaId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {item.propostas_tecnicas.map(t => (
                    <option key={t.id} value={t.id}>{formatRev(t.versao)}{t === item.propostas_tecnicas[0] ? ' (mais recente)' : ''}</option>
                  ))}
                </Select>
              </Field>
              {tecSel && (
                <div className="bg-[#F9FBF9] border border-[#C8E6C9] rounded p-3 mb-4 grid grid-cols-4 gap-3 text-[11px]">
                  <div><p className="text-[9px] text-gray-400 uppercase">Peso Total</p><p className="font-bold text-auto-value">{pesoTotalTec ? pesoTotalTec.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' t' : 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">HH Total</p><p className="font-bold text-auto-value">{hhTotalTec || 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">HH/ton</p><p className="font-bold text-auto-value">{pesoTotalTec && pesoTotalTec > 0 && hhTotalTec > 0 ? (hhTotalTec / pesoTotalTec).toFixed(0) + ' HH/t' : 'â€”'}</p></div>
                  <div><p className="text-[9px] text-gray-400 uppercase">Env. TÃ©cnica</p><p className="font-bold text-auto-value">{formatDate(tecSel.data_envio)}</p></div>
                </div>
              )}
            </>
          )}

          <ModalSection>Montagem</ModalSection>
          <Field label="Valor da Montagem (R$) *" className="mb-2.5">
            <CurrencyInput value={valorMontagem} onChange={setValorMontagem} />
          </Field>
          {numMontagem > 0 && (
            <div className="bg-auto-bg border border-auto-value/20 rounded p-3 mb-4 grid grid-cols-2 gap-3 text-[11px]">
              <div><p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/kg Montagem</p><p className="font-bold text-auto-value">{rsPorKgMont ? formatCurrency(rsPorKgMont) : 'â€”'}</p></div>
              <div><p className="text-[9px] text-gray-400 uppercase mb-0.5">R$/HH Montagem</p><p className="font-bold text-auto-value">{rsPorHhMont ? formatCurrency(rsPorHhMont) : 'â€”'}</p></div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <ModalSection className="mb-0">Terceiros</ModalSection>
            <SimNaoToggle value={possuiTerceiros} onChange={setPossuiTerceiros} />
          </div>
          {possuiTerceiros && (
            <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
              <table className="w-full text-[11px]">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[50%]">Especialidade</th>
                  <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase font-semibold w-[50%]">Valor (R$)</th>
                </tr></thead>
                <tbody>
                  {TERCEIROS_ESPECIALIDADES.map(e => (
                    <tr key={e.state} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-medium text-gray-700">{e.label}</td>
                      <td className="px-3 py-1.5"><CurrencyInput value={terceiros[e.state]} onChange={v => setTerceiros(p => ({ ...p, [e.state]: v }))} /></td>
                    </tr>
                  ))}
                  <tr className="bg-[#EEF7EE] border-t-2 border-[#C8E6C9]">
                    <td className="px-3 py-2 text-[11px] font-bold text-green-dark">Total Terceiros</td>
                    <td className="px-3 py-2 text-[11px] font-bold text-auto-value">{sumTerceiros > 0 ? formatCurrency(sumTerceiros) : 'â€”'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <ModalSection className="mb-0">FabricaÃ§Ãµes</ModalSection>
            <SimNaoToggle value={possuiFab} onChange={setPossuiFab} />
          </div>
          {possuiFab && (
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2.5 mb-2">
                <Field label="Valor das FabricaÃ§Ãµes (R$)"><CurrencyInput value={valorFab} onChange={setValorFab} /></Field>
                <Field label="Peso das FabricaÃ§Ãµes (t)"><CurrencyInput value={pesoFab} onChange={setPesoFab} /></Field>
              </div>
              {rsPorKgFab && (
                <div className="bg-auto-bg border border-auto-value/20 rounded px-3 py-2 text-[11px]">
                  <span className="text-[9px] text-gray-400 uppercase mr-2">R$/kg FabricaÃ§Ãµes</span>
                  <span className="font-bold text-auto-value">{formatCurrency(rsPorKgFab)}</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-[#1B5E20] text-white rounded-md px-4 py-3 mb-4">
            <div className="grid grid-cols-3 gap-4 mb-2">
              <div><p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">Valor Global</p><p className="text-[15px] font-bold">{totalGeral > 0 ? formatCurrency(totalGeral) : 'â€”'}</p></div>
              <div><p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">R$/kg Global</p><p className="text-[15px] font-bold">{rsPorKgGlob ? formatCurrency(rsPorKgGlob) : 'â€”'}</p></div>
              <div><p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">R$/HH Global</p><p className="text-[15px] font-bold">{rsPorHhGlob ? formatCurrency(rsPorHhGlob) : 'â€”'}</p></div>
            </div>
            {totalGeral > 0 && (
              <div className="text-[10px] opacity-70 flex gap-4 pt-2 border-t border-white/20">
                <span>Montagem: {formatCurrency(numMontagem)}</span>
                {possuiTerceiros && sumTerceiros > 0 && <span>Terceiros: {formatCurrency(sumTerceiros)}</span>}
                {possuiFab && numFab > 0 && <span>FabricaÃ§Ãµes: {formatCurrency(numFab)}</span>}
              </div>
            )}
          </div>

          <ModalSection>Data de Envio</ModalSection>
          <Field label="Data de envio â€” comercial" className="mb-5">
            <Input type="date" value={dataEnvioCom} onChange={e => setDataEnvioCom(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveComercialObra} disabled={loadingCom}>{loadingCom ? 'Salvando...' : 'Confirmar envio comercial'}</Button>
          </div>
        </div>
      )}

      {/* â”€â”€ Resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tab === 'resultado' && (
        <div>
          {errorRes && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{errorRes}</div>}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <Field label="Resultado *">
              <Select value={resultado} onChange={e => { setResultado(e.target.value); setMotivoPerda('') }}>
                <option value="AGUARDANDO">Aguardando</option>
                <option value="GANHOU">Ganhou</option>
                <option value="PERDEU">Perdeu</option>
              </Select>
            </Field>
            {resultado === 'PERDEU' && (
              <Field label="Motivo de perda *">
                <Select value={motivoPerda} onChange={e => setMotivoPerda(e.target.value as MotivoPerda)}>
                  <option value="">Selecione...</option>
                  {(Object.keys(MOTIVO_PERDA_LABELS) as MotivoPerda[]).map(k => <option key={k} value={k}>{MOTIVO_PERDA_LABELS[k]}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveResultado} disabled={loadingRes}>{loadingRes ? 'Salvando...' : 'Salvar Resultado'}</Button>
          </div>
        </div>
      )}

      {/* â”€â”€ Cancelar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tab === 'cancelar' && (
        <CancelSection {...{ confirmCancel, setConfirmCancel, cancelReason, setCancelReason, errorCancel, loadingCancel, onCancelar: handleCancelar, canCancelar }} />
      )}
    </Modal>
  )
}

