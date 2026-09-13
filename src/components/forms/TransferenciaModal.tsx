'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal, ModalSection, ModalCancelButton } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Textarea } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Badge } from '@/components/ui/Badge'
import { formatDate, todayInput } from '@/lib/utils'
import { PERFIL_LABELS } from '@/types'
import type { UsuarioListItem } from '@/types'

interface EscopoItem {
  id: number
  numero?: string
  indice?: string
  cliente: string
  ativo: boolean
  temPendencia: boolean
}
interface EscopoResponse {
  substituicaoVigente: { substitutoNome: string; ate: string } | null
  solicitacoes: EscopoItem[]
  contratos: EscopoItem[]
}

type ItemKey = string // "SOLICITACAO:12" | "CONTRATO:34"
const key = (tipo: 'SOLICITACAO' | 'CONTRATO', id: number): ItemKey => `${tipo}:${id}`

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  usuarios: UsuarioListItem[]
  tipo: 'TRANSFERENCIA' | 'TROCA'
}

export function TransferenciaModal({ open, onClose, onSuccess, usuarios, tipo }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [origemId, setOrigemId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [dataEfetivacao, setDataEfetivacao] = useState('')
  const [motivo, setMotivo] = useState('')

  const [escopoOrigem, setEscopoOrigem] = useState<EscopoResponse | null>(null)
  const [escopoDestino, setEscopoDestino] = useState<EscopoResponse | null>(null)
  const [loadingEscopo, setLoadingEscopo] = useState(false)
  // selecionados que saem da origem (A→B, ou origem→destino na transferência simples)
  const [selecionadosOrigem, setSelecionadosOrigem] = useState<Set<ItemKey>>(new Set())
  // na Troca: selecionados que saem do destino (B→A)
  const [selecionadosDestino, setSelecionadosDestino] = useState<Set<ItemKey>>(new Set())

  const [confirmando, setConfirmando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStep(1); setOrigemId(''); setDestinoId(''); setDataEfetivacao(todayInput()); setMotivo('')
      setEscopoOrigem(null); setEscopoDestino(null)
      setSelecionadosOrigem(new Set()); setSelecionadosDestino(new Set())
      setConfirmando(false); setError(null)
    }
  }, [open])

  const origem = usuarios.find((u) => String(u.id) === origemId)
  const destino = usuarios.find((u) => String(u.id) === destinoId)

  const preencherAtivosPadrao = (esc: EscopoResponse): Set<ItemKey> => {
    const s = new Set<ItemKey>()
    esc.solicitacoes.filter((i) => i.ativo).forEach((i) => s.add(key('SOLICITACAO', i.id)))
    esc.contratos.filter((i) => i.ativo).forEach((i) => s.add(key('CONTRATO', i.id)))
    return s
  }

  const handleAvancar = async () => {
    if (!origemId) { setError('Selecione o responsável de origem'); return }
    if (!destinoId) { setError('Selecione o novo responsável'); return }
    if (origemId === destinoId) { setError('Origem e destino não podem ser a mesma pessoa'); return }
    if (!dataEfetivacao) { setError('Informe a data de efetivação'); return }
    if (!motivo.trim()) { setError('Informe o motivo'); return }

    setError(null); setLoadingEscopo(true)
    try {
      const resOrigem = await fetch(`/api/substituicoes/escopo?usuarioId=${origemId}`)
      const jsonOrigem = await resOrigem.json()
      if (!resOrigem.ok || jsonOrigem.error) { setError(jsonOrigem.error ?? 'Erro ao buscar itens'); return }
      setEscopoOrigem(jsonOrigem.data)
      setSelecionadosOrigem(preencherAtivosPadrao(jsonOrigem.data))

      if (tipo === 'TROCA') {
        const resDestino = await fetch(`/api/substituicoes/escopo?usuarioId=${destinoId}`)
        const jsonDestino = await resDestino.json()
        if (!resDestino.ok || jsonDestino.error) { setError(jsonDestino.error ?? 'Erro ao buscar itens'); return }
        setEscopoDestino(jsonDestino.data)
        setSelecionadosDestino(preencherAtivosPadrao(jsonDestino.data))
      }
      setStep(2)
    } finally {
      setLoadingEscopo(false)
    }
  }

  const toggle = (lado: 'origem' | 'destino', k: ItemKey) => {
    const set = lado === 'origem' ? selecionadosOrigem : selecionadosDestino
    const setter = lado === 'origem' ? setSelecionadosOrigem : setSelecionadosDestino
    const novo = new Set(set)
    novo.has(k) ? novo.delete(k) : novo.add(k)
    setter(novo)
  }

  const totalSelecionados = selecionadosOrigem.size + selecionadosDestino.size

  const montarItens = () => {
    const itens: { tipo_item: 'SOLICITACAO' | 'CONTRATO'; item_id: number; direcao?: 'A_PARA_B' | 'B_PARA_A' }[] = []
    selecionadosOrigem.forEach((k) => {
      const [t, id] = k.split(':')
      itens.push({ tipo_item: t as 'SOLICITACAO' | 'CONTRATO', item_id: Number(id), ...(tipo === 'TROCA' ? { direcao: 'A_PARA_B' as const } : {}) })
    })
    selecionadosDestino.forEach((k) => {
      const [t, id] = k.split(':')
      itens.push({ tipo_item: t as 'SOLICITACAO' | 'CONTRATO', item_id: Number(id), direcao: 'B_PARA_A' as const })
    })
    return itens
  }

  const handleConfirmar = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/substituicoes/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, origem_id: Number(origemId), destino_id: Number(destinoId),
          data_efetivacao: dataEfetivacao, motivo, itens: montarItens(),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'Erro ao salvar'); setConfirmando(false); return }
      onSuccess(); onClose()
    } finally {
      setLoading(false)
    }
  }

  const resumo = useMemo(() => {
    const todos = [...Array.from(selecionadosOrigem), ...Array.from(selecionadosDestino)]
    const nSol = todos.filter((k) => k.startsWith('SOLICITACAO')).length
    const nCt = todos.filter((k) => k.startsWith('CONTRATO')).length
    return { nSol, nCt }
  }, [selecionadosOrigem, selecionadosDestino])

  const titulo = tipo === 'TROCA' ? 'Nova Troca Definitiva' : 'Nova Transferência Definitiva'

  return (
    <>
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={titulo}
      subtitle={step === 1 ? 'Etapa 1 de 2 — envolvidos e motivo' : 'Etapa 2 de 2 — selecione os itens a transferir'}
      extraWide={step === 2}
      wide={step === 1}
      footer={
        step === 1 ? (
          <>
            <ModalCancelButton disabled={loadingEscopo} />
            <Button onClick={handleAvancar} disabled={loadingEscopo}>{loadingEscopo ? 'Buscando itens...' : 'Avançar'}</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>Voltar</Button>
            <Button onClick={() => setConfirmando(true)} disabled={loading || totalSelecionados === 0}>
              Revisar e efetivar ({totalSelecionados})
            </Button>
          </>
        )
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4">{error}</div>}

      {step === 1 && (
        <>
          <ModalSection>{tipo === 'TROCA' ? 'Responsável A / Responsável B' : 'Origem / Destino'}</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label={tipo === 'TROCA' ? 'Responsável A *' : 'Responsável atual *'}>
              <SearchableSelect
                value={origemId} onChange={setOrigemId}
                options={usuarios.map((u) => ({ value: String(u.id), label: `${u.nome} — ${PERFIL_LABELS[u.perfil]}` }))}
                placeholder="Buscar usuário..." emptyLabel="Nenhum selecionado"
              />
            </Field>
            <Field label={tipo === 'TROCA' ? 'Responsável B *' : 'Novo responsável *'}>
              <SearchableSelect
                value={destinoId} onChange={setDestinoId}
                options={usuarios.map((u) => ({ value: String(u.id), label: `${u.nome} — ${PERFIL_LABELS[u.perfil]}` }))}
                placeholder="Buscar usuário..." emptyLabel="Nenhum selecionado"
              />
            </Field>
          </div>

          <ModalSection>Efetivação</ModalSection>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <Field label="Data de efetivação *">
              <input type="date" value={dataEfetivacao} onChange={(e) => setDataEfetivacao(e.target.value)}
                className="w-full px-2.5 py-[7px] border border-gray-300 rounded text-xs text-gray-900 bg-white outline-none focus:border-green-primary" />
              <p className="text-[10px] text-gray-400 mt-1">Se for hoje ou uma data passada, a troca de responsável acontece na hora. Se for uma data futura, fica agendada.</p>
            </Field>
            <Field label="Motivo *">
              <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: saída da empresa, redistribuição de carteira..." />
            </Field>
          </div>
        </>
      )}

      {step === 2 && escopoOrigem && (
        <div className={tipo === 'TROCA' ? 'grid grid-cols-2 gap-4' : ''}>
          <EscopoColuna
            titulo={tipo === 'TROCA' ? `${origem?.nome} → ${destino?.nome}` : `Itens de ${origem?.nome}`}
            escopo={escopoOrigem}
            selecionados={selecionadosOrigem}
            onToggle={(k) => toggle('origem', k)}
            onSelecionarTodosAtivos={() => setSelecionadosOrigem(preencherAtivosPadrao(escopoOrigem))}
            onLimpar={() => setSelecionadosOrigem(new Set())}
          />
          {tipo === 'TROCA' && escopoDestino && (
            <EscopoColuna
              titulo={`${destino?.nome} → ${origem?.nome}`}
              escopo={escopoDestino}
              selecionados={selecionadosDestino}
              onToggle={(k) => toggle('destino', k)}
              onSelecionarTodosAtivos={() => setSelecionadosDestino(preencherAtivosPadrao(escopoDestino))}
              onLimpar={() => setSelecionadosDestino(new Set())}
            />
          )}
        </div>
      )}
    </Modal>

    <ConfirmDialog
      open={confirmando}
      title={tipo === 'TROCA' ? 'Confirmar troca definitiva' : 'Confirmar transferência definitiva'}
      variant="warning"
      confirmLabel={loading ? 'Efetivando...' : 'Efetivar agora'}
      onConfirm={handleConfirmar}
      onClose={() => setConfirmando(false)}
      loading={loading}
      error={error}
      message={
        <div className="space-y-1.5">
          <p>Esta ação altera o responsável dos itens selecionados{dataEfetivacao > todayInput() ? ` a partir de ${formatDate(dataEfetivacao)}` : ' imediatamente'} e não pode ser desfeita pelo fluxo normal.</p>
          <p className="font-semibold text-gray-800">
            {resumo.nSol} solicitação(ões) e {resumo.nCt} contrato(s) — {tipo === 'TROCA' ? `entre ${origem?.nome} e ${destino?.nome}` : `de ${origem?.nome} para ${destino?.nome}`}.
          </p>
        </div>
      }
    />
    </>
  )
}

function EscopoColuna({
  titulo, escopo, selecionados, onToggle, onSelecionarTodosAtivos, onLimpar,
}: {
  titulo: string
  escopo: EscopoResponse
  selecionados: Set<ItemKey>
  onToggle: (k: ItemKey) => void
  onSelecionarTodosAtivos: () => void
  onLimpar: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-gray-700">{titulo}</p>
        <div className="flex gap-2 text-[10px]">
          <button type="button" onClick={onSelecionarTodosAtivos} className="text-green-primary hover:underline">Selecionar ativos</button>
          <button type="button" onClick={onLimpar} className="text-gray-400 hover:underline">Limpar</button>
        </div>
      </div>
      {escopo.substituicaoVigente && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-2.5 py-1.5 rounded mb-2">
          Está sendo substituído por {escopo.substituicaoVigente.substitutoNome} até {formatDate(escopo.substituicaoVigente.ate)}. Os itens transferidos deixam de ser cobertos por essa substituição; os que permanecerem continuam normalmente.
        </div>
      )}
      <div className="border border-gray-200 rounded-md max-h-[320px] overflow-y-auto">
        {escopo.solicitacoes.length === 0 && escopo.contratos.length === 0 ? (
          <p className="text-center text-[11px] text-gray-400 py-6">Nenhum item encontrado.</p>
        ) : (
          <>
            {escopo.solicitacoes.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase px-2.5 pt-2">Solicitações</p>
                {escopo.solicitacoes.map((i) => (
                  <ItemLinha key={`s${i.id}`} label={`${i.numero} — ${i.cliente}`} k={key('SOLICITACAO', i.id)} item={i} selecionados={selecionados} onToggle={onToggle} />
                ))}
              </div>
            )}
            {escopo.contratos.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase px-2.5 pt-2">Contratos</p>
                {escopo.contratos.map((i) => (
                  <ItemLinha key={`c${i.id}`} label={`${i.indice} — ${i.cliente}`} k={key('CONTRATO', i.id)} item={i} selecionados={selecionados} onToggle={onToggle} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ItemLinha({ label, k, item, selecionados, onToggle }: {
  label: string; k: ItemKey; item: EscopoItem; selecionados: Set<ItemKey>; onToggle: (k: ItemKey) => void
}) {
  return (
    <label className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-gray-50 cursor-pointer">
      <input type="checkbox" checked={selecionados.has(k)} onChange={() => onToggle(k)} className="accent-green-primary" />
      <span className={item.ativo ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
      {!item.ativo && <Badge variant="gray">Encerrado</Badge>}
      {item.temPendencia && <Badge variant="amber">Pendência aberta</Badge>}
    </label>
  )
}
