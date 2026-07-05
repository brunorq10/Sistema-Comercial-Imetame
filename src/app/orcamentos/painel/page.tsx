'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { SolicitacaoCard, type PainelItem } from '@/components/painel/SolicitacaoCard'
import { RegistrarTecnicaModal } from '@/components/forms/RegistrarTecnicaModal'
import { RegistrarComercialModal } from '@/components/forms/RegistrarComercialModal'
import { RegistrarFabricacaoModal } from '@/components/forms/RegistrarFabricacaoModal'
import { RegistrarParadaModal } from '@/components/forms/RegistrarParadaModal'
import { RegistrarObraModal } from '@/components/forms/RegistrarObraModal'
import { RegistrarInfoModal } from '@/components/forms/RegistrarInfoModal'
import { RevisoesPendentes } from '@/components/painel/RevisoesPendentes'
import { PageHeader } from '@/components/ui/PageHeader'
import { Field, Input, Select } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

type FiltroIndicador = 'todas' | 'elaboracao' | 'noprazo' | 'atrasado' | 'enviadas'
type SubFiltro = 'tec' | 'com' | null

// ── Classificação de cada solicitação ──────────────────────────────────────────
// Enviada por completo: ambas as propostas resolvidas (enviada OU não aplicável
// para esta revisão) e ao menos uma efetivamente enviada.
function isEnviadaCompleta(i: PainelItem): boolean {
  const tecDone = i.tecnica_enviada || i.tecnica_nao_aplicavel
  const comDone = i.comercial_enviada || i.comercial_nao_aplicavel
  return tecDone && comDone && (i.tecnica_enviada || i.comercial_enviada)
}
// Em elaboração: ainda não enviada por completo (= No prazo + Atrasadas)
const isEmElaboracao = (i: PainelItem) => !isEnviadaCompleta(i)
const isAtrasada     = (i: PainelItem) => isEmElaboracao(i) && (i.tecnica_atrasada || i.comercial_atrasada)
const isNoPrazo      = (i: PainelItem) => isEmElaboracao(i) && !i.tecnica_atrasada && !i.comercial_atrasada

export default function PainelOrcamentosPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ''
  const [items, setItems] = useState<PainelItem[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroAtivo, setFiltroAtivo] = useState<FiltroIndicador>('elaboracao')
  const [subFiltro, setSubFiltro] = useState<SubFiltro>(null)

  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [interesse, setInteresse] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [orcamentistaFiltro, setOrcamentistaFiltro] = useState('')   // '' = meu painel
  const [orcamentistas, setOrcamentistas] = useState<{ id: number; nome: string }[]>([])

  const [modalTecnica, setModalTecnica] = useState<PainelItem | null>(null)
  const [modalComercial, setModalComercial] = useState<PainelItem | null>(null)
  const [modalFabricacao, setModalFabricacao] = useState<PainelItem | null>(null)
  const [modalParada, setModalParada] = useState<{ item: PainelItem; tab: 'tecnica' | 'comercial' } | null>(null)
  const [modalObra, setModalObra] = useState<{ item: PainelItem; tab: 'tecnica' | 'comercial' } | null>(null)
  const [modalInfo, setModalInfo] = useState<PainelItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dataDe) params.set('data_de', dataDe)
      if (dataAte) params.set('data_ate', dataAte)
      if (classificacao) params.set('classificacao', classificacao)
      if (interesse) params.set('interesse', interesse)
      if (orcamentistaFiltro) params.set('orcamentista_id', orcamentistaFiltro)

      const res = await fetch(`/api/painel/orcamentista?${params.toString()}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [dataDe, dataAte, classificacao, interesse, orcamentistaFiltro])

  useEffect(() => { fetchData() }, [fetchData])

  // Lista de orçamentistas para o filtro (ver painel de outro orçamentista)
  useEffect(() => {
    fetch('/api/users/orcamentistas')
      .then((r) => r.json())
      .then((j) => setOrcamentistas(j.data ?? []))
      .catch(() => {})
  }, [])

  // Contagens para os indicadores
  const contagens = useMemo(() => ({
    todas: items.length,
    elaboracao: items.filter(isEmElaboracao).length,
    noprazo: items.filter(isNoPrazo).length,
    atrasado: items.filter(isAtrasada).length,
    atrasadoTec: items.filter((i) => isEmElaboracao(i) && i.tecnica_atrasada).length,
    atrasadoCom: items.filter((i) => isEmElaboracao(i) && i.comercial_atrasada).length,
    enviadas: items.filter(isEnviadaCompleta).length,
  }), [items])

  // Clientes únicos derivados dos itens carregados
  const clientesDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((i) => map.set(i.cliente, i.cliente))
    return Array.from(map.keys()).sort()
  }, [items])

  // Lista filtrada pelo indicador ativo + cliente, ordenada por urgência
  const itemsFiltrados = useMemo(() => {
    let lista = items
    if (filtroAtivo === 'elaboracao') {
      lista = items.filter(isEmElaboracao)
    } else if (filtroAtivo === 'noprazo') {
      lista = items.filter(isNoPrazo)
    } else if (filtroAtivo === 'atrasado') {
      lista = items.filter(isAtrasada)
      if (subFiltro === 'tec') lista = lista.filter((i) => i.tecnica_atrasada)
      if (subFiltro === 'com') lista = lista.filter((i) => i.comercial_atrasada)
    } else if (filtroAtivo === 'enviadas') {
      lista = items.filter(isEnviadaCompleta)
    }
    if (clienteFiltro) lista = lista.filter((i) => i.cliente === clienteFiltro)

    // Ordena do mais urgente ao menos urgente:
    // prazo mais próximo (ou já vencido) primeiro; sem prazo e já enviadas vão por último
    const now = Date.now()
    const urgency = (i: PainelItem): number => {
      if (i.comercial_enviada || i.fabricacao_enviada) return Infinity
      const deadline = i.tecnica_enviada
        ? (i.prazo_comercial ? new Date(i.prazo_comercial).getTime() : null)
        : (i.prazo_tecnica   ? new Date(i.prazo_tecnica).getTime()   : null)
      if (deadline === null) return Infinity - 1
      return deadline - now  // negativo = atrasada
    }
    return [...lista].sort((a, b) => urgency(a) - urgency(b))
  }, [items, filtroAtivo, subFiltro, clienteFiltro])

  const handleSetFiltro = (f: FiltroIndicador) => {
    setFiltroAtivo(f)
    setSubFiltro(null)
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <PageHeader
        title="Meu Painel — Orçamentos"
        subtitle='Clique nos indicadores para filtrar. Sub-filtros em "Atrasadas" permitem filtrar por tipo.'
      />

      {/* Revisões aguardando avaliação do orçamentista */}
      <RevisoesPendentes onChanged={fetchData} />

      {/* Indicadores filtráveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-3">
        <IndicadorCard
          label="Total de solicitações"
          valor={contagens.todas}
          sub="todas as atribuídas"
          variant="green"
          active={filtroAtivo === 'todas'}
          onClick={() => handleSetFiltro('todas')}
        />
        <IndicadorCard
          label="Em elaboração"
          valor={contagens.elaboracao}
          sub="no prazo + atrasadas"
          variant="amber"
          active={filtroAtivo === 'elaboracao'}
          onClick={() => handleSetFiltro('elaboracao')}
        />
        <IndicadorCard
          label="No prazo"
          valor={contagens.noprazo}
          sub="dentro do prazo"
          variant="blue"
          active={filtroAtivo === 'noprazo'}
          onClick={() => handleSetFiltro('noprazo')}
        />
        <IndicadorCard
          label="Atrasadas"
          valor={contagens.atrasado}
          sub="prazo vencido"
          variant="red"
          active={filtroAtivo === 'atrasado'}
          onClick={() => handleSetFiltro('atrasado')}
        >
          {/* Sub-filtros dentro do card Atrasadas */}
          <div className="mt-2 pt-2 border-t border-red-200 flex gap-1 flex-wrap">
            <button
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('atrasado'); setSubFiltro(subFiltro === 'tec' ? null : 'tec') }}
              className={cn(
                'text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors',
                subFiltro === 'tec'
                  ? 'bg-[#FFEBEE] text-red-700 border-red-400'
                  : 'bg-white text-gray-500 border-gray-300',
              )}
            >
              Técnica ({contagens.atrasadoTec})
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setFiltroAtivo('atrasado'); setSubFiltro(subFiltro === 'com' ? null : 'com') }}
              className={cn(
                'text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors',
                subFiltro === 'com'
                  ? 'bg-[#FFF3E0] text-[#E65100] border-[#FB8C00]'
                  : 'bg-white text-gray-500 border-gray-300',
              )}
            >
              Comercial ({contagens.atrasadoCom})
            </button>
          </div>
        </IndicadorCard>
        <IndicadorCard
          label="Total enviadas"
          valor={contagens.enviadas}
          sub="envio completo"
          variant="green"
          active={filtroAtivo === 'enviadas'}
          onClick={() => handleSetFiltro('enviadas')}
        />
      </div>

      {/* Filtros de período e categoria */}
      <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap gap-2.5 items-end">
        <Field label="Orçamentista" className="min-w-[150px] flex-1">
          <Select value={orcamentistaFiltro} onChange={(e) => setOrcamentistaFiltro(e.target.value)}>
            <option value="">Meu painel</option>
            {orcamentistas
              .filter((o) => String(o.id) !== String(userId))
              .map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Select>
        </Field>
        <Field label="Período de atribuição — de" className="min-w-[130px] flex-1">
          <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
        </Field>
        <Field label="até" className="min-w-[130px] flex-1">
          <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
        </Field>
        <Field label="Classificação" className="min-w-[130px] flex-1">
          <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value)}>
            <option value="">Todas</option>
            <option value="OBRAS">Obras</option>
            <option value="PARADAS">Paradas</option>
            <option value="OLEO_GAS">Óleo e Gás</option>
            <option value="FABRICACOES">Fabricações</option>
          </Select>
        </Field>
        <Field label="Nível de interesse" className="min-w-[130px] flex-1">
          <Select value={interesse} onChange={(e) => setInteresse(e.target.value)}>
            <option value="">Todos</option>
            <option value="ALTO">Alto</option>
            <option value="MEDIO">Médio</option>
            <option value="BAIXO">Baixo</option>
          </Select>
        </Field>
        <Field label="Cliente" className="min-w-[160px] flex-1">
          <Select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}>
            <option value="">Todos</option>
            {clientesDisponiveis.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <div className="flex-shrink-0">
          <button
            onClick={() => { setDataDe(''); setDataAte(''); setClassificacao(''); setInteresse(''); setClienteFiltro(''); setOrcamentistaFiltro('') }}
            className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center text-gray-400 py-10 text-sm">Carregando...</p>
      ) : itemsFiltrados.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">Nenhuma solicitação encontrada.</p>
      ) : (
        itemsFiltrados.map((item) => (
          <SolicitacaoCard
            key={item.id}
            item={item}
            onRegistrarTecnica={setModalTecnica}
            onRegistrarComercial={setModalComercial}
            onRegistrarFabricacao={setModalFabricacao}
            onRegistrarParada={(item, tab) => setModalParada({ item, tab })}
            onRegistrarObra={(item, tab) => setModalObra({ item, tab })}
            onRegistrarInfo={setModalInfo}
            onHistorico={(item) => router.push(`/orcamentos/propostas/${item.id}/historico?from=/orcamentos/painel`)}
            readOnly={!!orcamentistaFiltro}
          />
        ))
      )}

      {/* Modais */}
      {modalTecnica && (
        <RegistrarTecnicaModal
          open={true}
          onClose={() => setModalTecnica(null)}
          onSuccess={fetchData}
          solicitacaoId={modalTecnica.id}
          numero={modalTecnica.numero}
        />
      )}
      {modalComercial && (
        <RegistrarComercialModal
          open={true}
          onClose={() => setModalComercial(null)}
          onSuccess={fetchData}
          solicitacaoId={modalComercial.id}
          numero={modalComercial.numero}
          propostasTecnicas={modalComercial.propostas_tecnicas}
        />
      )}
      {modalFabricacao && (
        <RegistrarFabricacaoModal
          open={true}
          onClose={() => setModalFabricacao(null)}
          onSuccess={fetchData}
          solicitacaoId={modalFabricacao.id}
          numero={modalFabricacao.numero}
          classificacao={modalFabricacao.classificacao ?? ''}
        />
      )}
      {modalParada && (
        <RegistrarParadaModal
          open={true}
          onClose={() => setModalParada(null)}
          onSuccess={fetchData}
          solicitacaoId={modalParada.item.id}
          numero={modalParada.item.numero}
          defaultTab={modalParada.tab}
          propostasTecnicas={modalParada.item.propostas_tecnicas}
        />
      )}
      {modalObra && (
        <RegistrarObraModal
          open={true}
          onClose={() => setModalObra(null)}
          onSuccess={fetchData}
          solicitacaoId={modalObra.item.id}
          numero={modalObra.item.numero}
          defaultTab={modalObra.tab}
          propostasTecnicas={modalObra.item.propostas_tecnicas}
        />
      )}
      {modalInfo && (
        <RegistrarInfoModal
          open={true}
          onClose={() => setModalInfo(null)}
          onSuccess={fetchData}
          solicitacaoId={modalInfo.id}
          numero={modalInfo.numero}
        />
      )}
    </div>
  )
}

// ─── Componente de card indicador ────────────────────────────────────────────

interface IndicadorCardProps {
  label: string
  valor: number
  sub: string
  variant: 'green' | 'blue' | 'red' | 'amber'
  active: boolean
  onClick: () => void
  children?: React.ReactNode
}

function IndicadorCard({ label, valor, sub, variant, active, onClick, children }: IndicadorCardProps) {
  const borderColor = {
    green: 'border-l-green-primary',
    blue: 'border-l-[#1565C0]',
    red: 'border-l-[#C62828]',
    amber: 'border-l-[#FB8C00]',
  }[variant]

  const activeStyle = {
    green: 'bg-green-light border-green-primary shadow-[0_0_0_2px_rgba(46,125,50,0.2)]',
    blue: 'bg-[#E3F2FD] border-[#1565C0] shadow-[0_0_0_2px_rgba(21,101,192,0.2)]',
    red: 'bg-[#FFEBEE] border-[#C62828] shadow-[0_0_0_2px_rgba(198,40,40,0.2)]',
    amber: 'bg-[#FFF3E0] border-[#FB8C00] shadow-[0_0_0_2px_rgba(251,140,0,0.2)]',
  }[variant]

  const valorColor = {
    green: 'text-green-dark',
    blue: 'text-[#1565C0]',
    red: 'text-[#C62828]',
    amber: 'text-[#E65100]',
  }[variant]

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-200 rounded-md p-3 cursor-pointer border-l-[3px] transition-all select-none',
        borderColor,
        active && activeStyle,
      )}
    >
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.04em] mb-1">{label}</p>
      <p className={cn('text-[20px] font-bold', valorColor)}>{valor}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
      {children}
    </div>
  )
}
