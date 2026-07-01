'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CampoPublico } from '@/lib/relatorios/catalog'
import type { PivotResult } from '@/lib/relatorios/shared'
import { SearchableMultiSelect } from '@/components/ui/SearchableSelect'
import { FieldPanel } from '@/components/relatorios/FieldPanel'
import { Zones, type ChipDim, type ChipVal, type Gran, type Agg, type Zona } from '@/components/relatorios/Zones'
import { ResultTable } from '@/components/relatorios/ResultTable'

type Modulo = 'comercial' | 'acordos'
const MODULO_LABEL: Record<Modulo, string> = { comercial: 'Comercial', acordos: 'Acordos (Faturamento)' }
const DATA_PADRAO: Record<Modulo, string> = { comercial: 'Data da solicitação', acordos: 'Data de início do contrato' }
interface Opcao { id: number; nome: string }

export default function ConstrutorRelatorioPage() {
  const [campos, setCampos] = useState<CampoPublico[]>([])
  const [clientes, setClientes] = useState<Opcao[]>([])
  const [responsaveis, setResponsaveis] = useState<Opcao[]>([])
  const [busca, setBusca] = useState('')

  const [linhas, setLinhas] = useState<ChipDim[]>([])
  const [colunas, setColunas] = useState<ChipDim[]>([])
  const [valores, setValores] = useState<ChipVal[]>([])

  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [clienteIds, setClienteIds] = useState<string[]>([])
  const [responsavelIds, setResponsavelIds] = useState<string[]>([])

  const [pivot, setPivot] = useState<PivotResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPreview, setIsPreview] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [alerta, setAlerta] = useState<string | null>(null)
  const [confirmarSemData, setConfirmarSemData] = useState<null | 'executar' | 'exportar'>(null)
  const deRef = useRef<HTMLInputElement>(null)

  const camposMap = useMemo(() => new Map(campos.map((c) => [c.key, c])), [campos])

  useEffect(() => {
    fetch('/api/relatorios/opcoes').then((r) => r.json()).then((j) => {
      if (j.data) { setCampos(j.data.campos ?? []); setClientes(j.data.clientes ?? []); setResponsaveis(j.data.responsaveis ?? []) }
    }).catch(() => {})
  }, [])

  const modulo: Modulo | null = useMemo(() => {
    const first = [...linhas, ...colunas, ...valores][0]
    return first ? (camposMap.get(first.campo)?.modulo ?? null) : null
  }, [linhas, colunas, valores, camposMap])

  const flash = (msg: string) => { setAlerta(msg); setTimeout(() => setAlerta(null), 3500) }

  const addField = useCallback((zona: Zona, key: string) => {
    const campo = camposMap.get(key)
    if (!campo) return
    const dimZona = zona === 'linhas' || zona === 'colunas'
    if (dimZona && !(campo.tipo === 'dim' || campo.tipo === 'data')) { flash(`"${campo.label}" é um valor — vá para a zona Valores.`); return }
    if (zona === 'valores' && !(campo.tipo === 'met' || campo.tipo === 'calc')) { flash(`"${campo.label}" é uma dimensão — use Linhas ou Colunas.`); return }
    if (modulo && campo.modulo !== modulo) { flash(`Este relatório é do módulo ${MODULO_LABEL[modulo]}. Remova os campos atuais para trocar de módulo.`); return }

    if (zona === 'linhas') { if (linhas.some((c) => c.campo === key)) return; setLinhas((p) => [...p, { campo: key, granularidade: campo.tipo === 'data' ? 'mes' : undefined }]) }
    else if (zona === 'colunas') { if (colunas.some((c) => c.campo === key)) return; setColunas((p) => [...p, { campo: key, granularidade: campo.tipo === 'data' ? 'mes' : undefined }]) }
    else { if (valores.some((c) => c.campo === key)) return; setValores((p) => [...p, { campo: key, agregacao: campo.tipo === 'met' && !campo.count ? campo.aggPadrao : undefined }]) }
  }, [camposMap, modulo, linhas, colunas, valores])

  const remove = (zona: Zona, idx: number) => {
    if (zona === 'linhas') setLinhas((p) => p.filter((_, i) => i !== idx))
    else if (zona === 'colunas') setColunas((p) => p.filter((_, i) => i !== idx))
    else setValores((p) => p.filter((_, i) => i !== idx))
  }
  const setGran = (zona: 'linhas' | 'colunas', idx: number, gran: Gran) => {
    const upd = (p: ChipDim[]) => p.map((c, i) => (i === idx ? { ...c, granularidade: gran } : c))
    zona === 'linhas' ? setLinhas(upd) : setColunas(upd)
  }
  const setAgg = (idx: number, agg: Agg) => setValores((p) => p.map((c, i) => (i === idx ? { ...c, agregacao: agg } : c)))

  const limparTudo = () => { setLinhas([]); setColunas([]); setValores([]); setPivot(null); setErro(null) }
  const limparFiltros = () => { setDe(''); setAte(''); setClienteIds([]); setResponsavelIds([]) }

  const configValida = valores.length > 0 && (linhas.length > 0 || colunas.length > 0) && !!modulo

  const dataRefLabel = useMemo(() => {
    const df = [...linhas, ...colunas].map((c) => camposMap.get(c.campo)).find((c) => c?.tipo === 'data')
    return df ? df.label : modulo ? DATA_PADRAO[modulo] : '—'
  }, [linhas, colunas, camposMap, modulo])

  // Score de complexidade (frontend, antes de executar)
  const score = useMemo(() => {
    let p = linhas.length * 1 + colunas.length * 2 + valores.length * 1
    if (!de || !ate) p += 5
    return p
  }, [linhas, colunas, valores, de, ate])

  const buildRequest = useCallback(() => ({
    modulo,
    linhas, colunas, valores,
    filtros: {
      de: de || null, ate: ate || null, campoDataRef: null,
      cliente_id: clienteIds.map(Number), responsavel_id: responsavelIds.map(Number),
    },
  }), [modulo, linhas, colunas, valores, de, ate, clienteIds, responsavelIds])

  const rodar = useCallback(async (endpoint: 'preview' | 'executar') => {
    if (!configValida) { setPivot(null); return }
    setLoading(true); setErro(null)
    try {
      const res = await fetch(`/api/relatorios/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest()) })
      const j = await res.json()
      if (!res.ok || j.error) { setErro(j.error ?? 'Erro ao gerar o relatório.'); setPivot(null); return }
      setPivot(j.data.pivot); setIsPreview(!!j.data.preview)
    } catch { setErro('Falha de comunicação com o servidor.') }
    finally { setLoading(false) }
  }, [configValida, buildRequest])

  // Preview automático (debounce 800ms)
  useEffect(() => {
    if (!configValida) { setPivot(null); return }
    const t = setTimeout(() => { rodar('preview') }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, colunas, valores, de, ate, clienteIds, responsavelIds])

  const executar = () => {
    if (score > 25) { flash('Relatório muito complexo. Remova alguns campos ou defina o período.'); return }
    if (!de || !ate) { setConfirmarSemData('executar'); return }
    rodar('executar')
  }

  const exportar = async () => {
    if (!de || !ate) { setConfirmarSemData('exportar'); return }
    await doExport()
  }
  const doExport = async () => {
    setLoading(true); setErro(null)
    try {
      const res = await fetch('/api/relatorios/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relatorio: buildRequest(), nome: 'Relatório' }) })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErro(j.error ?? 'Erro ao gerar o Excel.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `relatorio_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch { setErro('Falha ao exportar.') }
    finally { setLoading(false) }
  }

  const prosseguirSemData = () => {
    const acao = confirmarSemData; setConfirmarSemData(null)
    if (acao === 'executar') rodar('executar')
    else if (acao === 'exportar') doExport()
  }

  return (
    <div className="flex gap-3 h-full p-3">
      <FieldPanel campos={campos} busca={busca} onBusca={setBusca} onDragField={() => {}} />

      <div className="flex-1 min-w-0 flex flex-col gap-2.5 overflow-y-auto">
        {/* Barra de módulo + ações */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {modulo
              ? <span className="text-[11px] font-semibold px-2 py-1 rounded text-white" style={{ background: '#0A1F44' }}>Módulo: {MODULO_LABEL[modulo]}</span>
              : <span className="text-[11px] text-gray-400">Arraste campos para começar</span>}
            {score > 15 && <span className="text-[10px] text-amber-600 font-medium">Complexidade {score} — considere reduzir campos/definir período</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={limparTudo} className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] hover:bg-gray-100">Limpar tudo</button>
            <button onClick={executar} disabled={!configValida || loading} className="bg-green-primary text-white rounded px-3 py-[5px] text-[11px] font-semibold hover:bg-green-dark disabled:opacity-50">Atualizar</button>
            <button onClick={exportar} disabled={!configValida || loading} className="border border-green-primary text-green-primary rounded px-2.5 py-[5px] text-[11px] font-semibold hover:bg-green-light disabled:opacity-50">Exportar Excel</button>
          </div>
        </div>

        {alerta && <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded">{alerta}</div>}

        <Zones camposMap={camposMap} linhas={linhas} colunas={colunas} valores={valores}
          onDrop={addField} onRemove={remove} onGran={setGran} onAgg={setAgg} />

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 flex flex-wrap gap-2.5 items-end">
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase mb-0.5">De</label>
            <input ref={deRef} type="date" value={de} onChange={(e) => setDe(e.target.value)} className="border border-gray-300 rounded px-2 py-[5px] text-[11px]" />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase mb-0.5">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="border border-gray-300 rounded px-2 py-[5px] text-[11px]" />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-[9px] font-semibold text-gray-500 uppercase mb-0.5">Cliente</label>
            <SearchableMultiSelect values={clienteIds} onChange={setClienteIds} options={clientes.map((c) => ({ value: String(c.id), label: c.nome }))} />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-[9px] font-semibold text-gray-500 uppercase mb-0.5">Responsável</label>
            <SearchableMultiSelect values={responsavelIds} onChange={setResponsavelIds} options={responsaveis.map((r) => ({ value: String(r.id), label: r.nome }))} />
          </div>
          <button onClick={limparFiltros} className="text-[11px] font-semibold text-green-primary hover:underline mb-1.5">Limpar filtros</button>
          <div className="w-full text-[10px] text-gray-400">Aplicado sobre: <span className="font-medium text-gray-600">{dataRefLabel}</span></div>
        </div>

        {/* Resultado */}
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded">{erro}</div>}
        {!configValida && !erro && (
          <div className="text-center text-gray-400 text-sm py-12 border border-dashed border-gray-200 rounded-md">
            Arraste campos para as zonas acima para gerar o relatório.
          </div>
        )}
        {configValida && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {loading && <span className="text-[11px] text-gray-400">Carregando…</span>}
              {isPreview && pivot && !loading && <span className="text-[10px] text-amber-600 font-medium">Prévia (máx. 50 linhas) — clique em Atualizar para o resultado completo</span>}
            </div>
            {pivot && <ResultTable pivot={pivot} />}
            {pivot && (
              <p className="text-[10px] text-gray-500">
                Linhas: {pivot.rowDimLabels.join(' · ') || '—'} · Colunas: {pivot.colDimLabels.join(' · ') || '—'} ·
                Valores: {pivot.valoresMeta.map((v) => v.label).join(', ')} · Aplicado sobre: {dataRefLabel} ·
                {de && ate ? ` Filtro: ${de} a ${ate}` : ' SEM FILTRO DE DATA (todos os registros)'} · Módulo: {modulo ? MODULO_LABEL[modulo] : '—'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal período em branco */}
      {confirmarSemData && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg w-[420px] max-w-[95%] shadow-2xl p-5">
            <h3 className="text-[14px] font-bold text-gray-800 mb-2">Período sem filtro de data</h3>
            <p className="text-[12px] text-gray-600 mb-4">Você não definiu De/Até. O relatório incluirá <strong>todos os registros históricos</strong>, o que pode gerar volumes grandes.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setConfirmarSemData(null); deRef.current?.focus() }} className="border border-gray-300 text-gray-600 rounded px-3 py-1.5 text-[12px] hover:bg-gray-100">Definir período</button>
              <button onClick={prosseguirSemData} className="bg-green-primary text-white rounded px-3 py-1.5 text-[12px] font-semibold hover:bg-green-dark">Continuar mesmo assim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
