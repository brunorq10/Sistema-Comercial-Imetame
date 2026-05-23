'use client'

import { Fragment } from 'react'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatCurrency, formatRev, cn } from '@/lib/utils'
import { RESULTADO_LABELS } from '@/types'
import type { PropostasItem } from '@/types'

interface Props {
  open: boolean
  item: PropostasItem
  onClose: () => void
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ResultadoPill({ resultado }: { resultado: string | null }) {
  if (!resultado) return null
  const cls =
    resultado === 'GANHOU' ? 'bg-green-light text-green-dark'
    : resultado === 'PERDEU' ? 'bg-[#FFEBEE] text-[#C62828]'
    : 'bg-[#FFF3E0] text-[#E65100]'
  return (
    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full ml-1', cls)}>
      {RESULTADO_LABELS[resultado] ?? resultado}
    </span>
  )
}

function fmtPct(part: number, total: number): string {
  if (!total || !part) return '—'
  return Math.round((part / total) * 100) + '%'
}

function fmtInt(v: number): string {
  return v > 0 ? v.toLocaleString('pt-BR') : '—'
}

function fmtMoney(v: number | null): string {
  return v != null && v > 0 ? formatCurrency(v) : '—'
}

// ─── Shared table primitives ──────────────────────────────────────────────────

function SectionRow({ label, cols }: { label: string; cols: number }) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="px-2 py-[5px] text-[9px] font-bold uppercase tracking-widest text-white bg-[#424242]"
      >
        {label}
      </td>
    </tr>
  )
}

function SpacerRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="py-[3px] bg-gray-50" /></tr>
}

// ─── Histórico Técnica / Comercial (Obras e default) ─────────────────────────

type RevTC = {
  tec: PropostasItem['propostas_tecnicas'][0]
  com: PropostasItem['propostas_comerciais'][0] | null
  ht: number
  pesoTotal: number
  montagem: number | null
  eletrica: number | null
  isolamento: number | null
  civil: number | null
  fibra: number | null
  hidraulica: number | null
  outros: number | null
  fabricacao: number | null
  terceiros: number | null
  valorTotal: number | null
}

function buildRevisoes(item: PropostasItem): RevTC[] {
  return [...item.propostas_tecnicas]
    .sort((a, b) => a.versao - b.versao)
    .map((tec) => {
      const com = item.propostas_comerciais.find((c) => c.proposta_tecnica_id === tec.id) ?? null
      const hd = tec.hh_direto ?? 0
      const hi = tec.hh_indireto ?? 0
      const ht = tec.hh_total ?? (hd + hi)
      const pesoTotal = tec.peso_montagem ? Number(tec.peso_montagem) : 0
      return {
        tec, com, ht, pesoTotal,
        montagem: com?.valor_montagem_mecanica ? Number(com.valor_montagem_mecanica) : null,
        eletrica: com?.valor_eletrica ? Number(com.valor_eletrica) : null,
        isolamento: com?.valor_isolamento ? Number(com.valor_isolamento) : null,
        civil: com?.valor_civil ? Number(com.valor_civil) : null,
        fibra: com?.valor_fibra ? Number(com.valor_fibra) : null,
        hidraulica: com?.valor_hidraulica ? Number(com.valor_hidraulica) : null,
        outros: com?.valor_outros_terceiros ? Number(com.valor_outros_terceiros) : null,
        fabricacao: com?.valor_fabricacao ? Number(com.valor_fabricacao) : null,
        terceiros: com?.valor_terceiros ? Number(com.valor_terceiros) : null,
        valorTotal: com?.valor_total ? Number(com.valor_total) : null,
      }
    })
}

function HistoricoTecnicaComercial({ item }: { item: PropostasItem }) {
  const revisoes = buildRevisoes(item)

  if (revisoes.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Nenhuma proposta técnica registrada.</p>
  }

  const nr = revisoes.length
  // Columns: 1 label + 2 per revision (Peso | %)
  const totalCols = 1 + nr * 2

  const hasPeso = revisoes.some((r) => r.pesoTotal > 0)
  const hasHH = revisoes.some((r) => r.ht > 0)
  const hasMontagem = revisoes.some((r) => r.montagem != null)
  const hasFabricacao = revisoes.some((r) => r.com?.possui_fabricacao)
  const hasTerceiros = revisoes.some((r) => r.com?.possui_terceiros)

  const pesoRows: { label: string; get: (r: RevTC) => number }[] = [
    { label: 'Equipamentos',             get: (r) => r.tec.peso_equipamentos ? Number(r.tec.peso_equipamentos) : 0 },
    { label: 'Tubulações',               get: (r) => r.tec.peso_tubulacoes   ? Number(r.tec.peso_tubulacoes)   : 0 },
    { label: 'Suportes',                 get: (r) => r.tec.peso_suportes     ? Number(r.tec.peso_suportes)     : 0 },
    { label: 'Estruturas e Plataformas', get: (r) => r.tec.peso_estruturas   ? Number(r.tec.peso_estruturas)   : 0 },
  ]

  const terceirosRows: { label: string; get: (r: RevTC) => number | null }[] = [
    { label: 'Elétrica',           get: (r: RevTC) => r.eletrica },
    { label: 'Civil',              get: (r: RevTC) => r.civil },
    { label: 'Fibra',              get: (r: RevTC) => r.fibra },
    { label: 'Isolamento Térmico', get: (r: RevTC) => r.isolamento },
    { label: 'Hidráulica',         get: (r: RevTC) => r.hidraulica },
    { label: 'Outros',             get: (r: RevTC) => r.outros },
  ].filter(({ get }) => revisoes.some((r) => (get(r) ?? 0) > 0))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse border border-gray-200">
        <thead>
          <tr>
            <th className="px-2 py-2 bg-gray-100 border border-gray-200 w-[180px]" />
            {revisoes.map((r) => (
              <th
                key={r.tec.versao}
                colSpan={2}
                className="px-2 py-2 text-center bg-green-primary text-white font-bold border border-green-dark text-[11px]"
              >
                {formatRev(r.tec.versao)}
                <ResultadoPill resultado={r.com?.resultado ?? null} />
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-2 py-1 bg-gray-50 border border-gray-200 text-[9px] text-gray-500 font-medium text-left">Data de envio</th>
            {revisoes.map((r) => (
              <th key={r.tec.versao} colSpan={2} className="px-2 py-1 bg-gray-50 border border-gray-200 text-[9px] text-gray-500 text-center font-normal">
                {[
                  r.tec.data_envio ? `Téc: ${formatDate(r.tec.data_envio)}` : null,
                  r.com?.data_envio ? `Com: ${formatDate(r.com.data_envio)}` : null,
                ].filter(Boolean).join(' · ') || '—'}
              </th>
            ))}
          </tr>
          {hasPeso && (
            <tr>
              <th className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-600 font-semibold text-[9px] text-left">Categoria</th>
              {revisoes.map((r) => (
                <th key={r.tec.versao} className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-500 font-medium text-right text-[9px]">
                  Peso
                </th>
              ))}
              {revisoes.map((r) => (
                <th key={`pct-${r.tec.versao}`} className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-500 font-medium text-right text-[9px]">
                  %
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {/* ── Peso breakdown ── */}
          {hasPeso && (
            <>
              {pesoRows.map(({ label, get }) => (
                <tr key={label} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-600 border border-gray-200">{label}</td>
                  {revisoes.map((r) => {
                    const p = get(r)
                    return (
                      <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                        {p > 0 ? p.toFixed(0) : '—'}
                      </td>
                    )
                  })}
                  {revisoes.map((r) => {
                    const p = get(r)
                    return (
                      <td key={`pct-${r.tec.versao}`} className="px-2 py-1.5 text-right text-gray-500 border border-gray-200">
                        {fmtPct(p, r.pesoTotal)}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-2 py-1.5 text-gray-700 border border-gray-200">Total</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                    {r.pesoTotal > 0 ? r.pesoTotal.toFixed(0) : '—'}
                  </td>
                ))}
              </tr>
            </>
          )}

          {/* ── HH ── */}
          {hasHH && (
            <>
              <SpacerRow cols={totalCols} />
              <SectionRow label="HH" cols={totalCols} />
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-600 border border-gray-200">HH Total</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-700 font-medium border border-gray-200">
                    {fmtInt(r.ht)}
                  </td>
                ))}
              </tr>
              {hasPeso && (
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-600 border border-gray-200">HH/ton</td>
                  {revisoes.map((r) => (
                    <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                      {r.ht > 0 && r.pesoTotal > 0 ? Math.round(r.ht / r.pesoTotal).toLocaleString('pt-BR') : '—'}
                    </td>
                  ))}
                </tr>
              )}
            </>
          )}

          {/* ── Montagem ── */}
          {hasMontagem && (
            <>
              <SpacerRow cols={totalCols} />
              <SectionRow label="Valor Calculado — Montagem" cols={totalCols} />
              <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
                <td className="px-2 py-1.5 text-gray-700 border border-gray-200">R$</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-auto-value font-bold border border-gray-200">
                    {fmtMoney(r.montagem)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">R$/kg</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                    {r.montagem && r.pesoTotal > 0 ? formatCurrency(r.montagem / (r.pesoTotal * 1000)) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">R$/HH</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                    {r.montagem && r.ht > 0 ? formatCurrency(r.montagem / r.ht) : '—'}
                  </td>
                ))}
              </tr>
            </>
          )}

          {/* ── Fabricação ── */}
          {hasFabricacao && (
            <>
              <SpacerRow cols={totalCols} />
              <SectionRow label="Fabricação" cols={totalCols} />
              <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
                <td className="px-2 py-1.5 text-gray-700 border border-gray-200">R$</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-auto-value font-bold border border-gray-200">
                    {fmtMoney(r.fabricacao)}
                  </td>
                ))}
              </tr>
            </>
          )}

          {/* ── Terceiros ── */}
          {hasTerceiros && (
            <>
              <SpacerRow cols={totalCols} />
              <SectionRow label="Terceiros" cols={totalCols} />
              <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
                <td className="px-2 py-1.5 text-gray-700 border border-gray-200">R$</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-auto-value font-bold border border-gray-200">
                    {fmtMoney(r.terceiros)}
                  </td>
                ))}
              </tr>
              {terceirosRows.map(({ label, get }) => (
                <tr key={label} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">{label}</td>
                  {revisoes.map((r) => (
                    <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                      {fmtMoney(get(r))}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          )}

          {/* ── Valor Total ── */}
          <SpacerRow cols={totalCols} />
          <SectionRow label="Valor Total" cols={totalCols} />
          <tr className="bg-green-light font-semibold border-b border-gray-200">
            <td className="px-2 py-1.5 text-green-dark border border-gray-200">R$</td>
            {revisoes.map((r) => (
              <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-green-dark font-bold border border-gray-200">
                {fmtMoney(r.valorTotal)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">R$/kg</td>
            {revisoes.map((r) => (
              <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                {r.valorTotal && r.pesoTotal > 0 ? formatCurrency(r.valorTotal / (r.pesoTotal * 1000)) : '—'}
              </td>
            ))}
          </tr>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">R$/HH</td>
            {revisoes.map((r) => (
              <td key={r.tec.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                {r.valorTotal && r.ht > 0 ? formatCurrency(r.valorTotal / r.ht) : '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Histórico Paradas ────────────────────────────────────────────────────────

type RevParada = {
  tec: PropostasItem['propostas_tecnicas'][0]
  com: PropostasItem['propostas_comerciais'][0] | null
  ht: number
  valorTotal: number | null
  valorTerceiros: number | null
}

function HistoricoParada({ item }: { item: PropostasItem }) {
  const revisoes: RevParada[] = [...item.propostas_tecnicas]
    .sort((a, b) => a.versao - b.versao)
    .map((tec) => {
      const com = item.propostas_comerciais.find((c) => c.proposta_tecnica_id === tec.id) ?? null
      const hd = tec.hh_direto ?? 0
      const hi = tec.hh_indireto ?? 0
      const ht = tec.hh_total ?? (hd + hi)
      return {
        tec, com, ht,
        valorTotal: com?.valor_total ? Number(com.valor_total) : null,
        valorTerceiros: com?.valor_terceiros ? Number(com.valor_terceiros) : null,
      }
    })

  if (revisoes.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Nenhuma proposta registrada.</p>
  }

  const nr = revisoes.length
  const totalCols = 1 + nr

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse border border-gray-200">
        <thead>
          <tr>
            <th className="px-2 py-2 bg-gray-100 border border-gray-200 w-[180px]" />
            {revisoes.map((r) => (
              <th key={r.tec.versao} className="px-2 py-2 text-center bg-green-primary text-white font-bold border border-green-dark text-[11px]">
                {formatRev(r.tec.versao)}
                <ResultadoPill resultado={r.com?.resultado ?? null} />
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-2 py-1 bg-gray-50 border border-gray-200 text-[9px] text-gray-500 font-medium text-left">Data de envio</th>
            {revisoes.map((r) => (
              <th key={r.tec.versao} className="px-2 py-1 bg-gray-50 border border-gray-200 text-[9px] text-gray-500 text-center font-normal">
                {[
                  r.tec.data_envio ? `Téc: ${formatDate(r.tec.data_envio)}` : null,
                  r.com?.data_envio ? `Com: ${formatDate(r.com.data_envio)}` : null,
                ].filter(Boolean).join(' · ') || '—'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="Técnica" cols={totalCols} />
          {([
            { label: 'HH Direto',   get: (r: RevParada) => r.tec.hh_direto },
            { label: 'HH Indireto', get: (r: RevParada) => r.tec.hh_indireto },
          ] as { label: string; get: (r: RevParada) => number | null }[]).map(({ label, get }) => (
            <tr key={label} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-2 py-1.5 text-gray-600 border border-gray-200">{label}</td>
              {revisoes.map((r) => (
                <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                  {get(r) != null ? fmtInt(get(r)!) : '—'}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
            <td className="px-2 py-1.5 text-gray-700 border border-gray-200">HH Total</td>
            {revisoes.map((r) => (
              <td key={r.tec.versao} className="px-2 py-1.5 text-right text-auto-value font-bold border border-gray-200">
                {fmtInt(r.ht)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-2 py-1.5 text-gray-600 border border-gray-200">% Indireto</td>
            {revisoes.map((r) => {
              const hi = r.tec.hh_indireto ?? 0
              return (
                <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                  {fmtPct(hi, r.ht)}
                </td>
              )
            })}
          </tr>
          {revisoes.some((r) => r.tec.efetivo_pico) && (
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-2 py-1.5 text-gray-600 border border-gray-200">Efetivo Pico</td>
              {revisoes.map((r) => (
                <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                  {r.tec.efetivo_pico ?? '—'}
                </td>
              ))}
            </tr>
          )}
          {revisoes.some((r) => r.tec.dias_parada) && (
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-2 py-1.5 text-gray-600 border border-gray-200">Dias de Parada</td>
              {revisoes.map((r) => (
                <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                  {r.tec.dias_parada ?? '—'}
                </td>
              ))}
            </tr>
          )}
          {revisoes.some((r) => r.tec.turno) && (
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-2 py-1.5 text-gray-600 border border-gray-200">Turno</td>
              {revisoes.map((r) => (
                <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                  {r.tec.turno ?? '—'}
                </td>
              ))}
            </tr>
          )}

          {revisoes.some((r) => r.com) && (
            <>
              <SpacerRow cols={totalCols} />
              <SectionRow label="Comercial" cols={totalCols} />
              <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
                <td className="px-2 py-1.5 text-gray-700 border border-gray-200">Valor Total</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} className="px-2 py-1.5 text-right text-auto-value font-bold border border-gray-200">
                    {fmtMoney(r.valorTotal)}
                  </td>
                ))}
              </tr>
              {revisoes.some((r) => r.valorTerceiros) && (
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">Terceiros</td>
                  {revisoes.map((r) => (
                    <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                      {fmtMoney(r.valorTerceiros)}
                    </td>
                  ))}
                </tr>
              )}
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">R$/HH</td>
                {revisoes.map((r) => (
                  <td key={r.tec.versao} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                    {r.valorTotal && r.ht > 0 ? formatCurrency(r.valorTotal / r.ht) : '—'}
                  </td>
                ))}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Histórico Fabricação / Óleo e Gás ───────────────────────────────────────

function HistoricoFabricacao({ item }: { item: PropostasItem }) {
  const revisoes = [...item.propostas_fabricacao].sort((a, b) => a.versao - b.versao)

  if (revisoes.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Nenhuma proposta registrada.</p>
  }

  const nr = revisoes.length
  const totalCols = 1 + nr * 2

  const allEquip = Array.from(new Set(revisoes.flatMap((r) => r.equipamentos.map((e) => e.descricao))))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse border border-gray-200">
        <thead>
          <tr>
            <th className="px-2 py-2 bg-gray-100 border border-gray-200 w-[180px]" />
            {revisoes.map((r) => (
              <th key={r.versao} colSpan={2} className="px-2 py-2 text-center bg-green-primary text-white font-bold border border-green-dark text-[11px]">
                {formatRev(r.versao)}
                <ResultadoPill resultado={r.resultado} />
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-2 py-1 bg-gray-50 border border-gray-200 text-[9px] text-gray-500 font-medium text-left">Data de envio</th>
            {revisoes.map((r) => (
              <th key={r.versao} colSpan={2} className="px-2 py-1 bg-gray-50 border border-gray-200 text-[9px] text-gray-500 text-center font-normal">
                {r.data_envio ? formatDate(r.data_envio) : '—'}
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-600 font-semibold text-[9px] text-left">Equipamento</th>
            {revisoes.map((r) => (
              <Fragment key={r.versao}>
                <th className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-500 font-medium text-right text-[9px]">Peso (t)</th>
                <th className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-500 font-medium text-right text-[9px]">Valor</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {allEquip.map((desc) => (
            <tr key={desc} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-2 py-1.5 text-gray-600 border border-gray-200">{desc}</td>
              {revisoes.map((r) => {
                const eq = r.equipamentos.find((e) => e.descricao === desc)
                return (
                  <Fragment key={r.versao}>
                    <td className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                      {eq ? Number(eq.peso_ton).toFixed(2).replace('.', ',') : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                      {eq ? formatCurrency(Number(eq.valor_total)) : '—'}
                    </td>
                  </Fragment>
                )
              })}
            </tr>
          ))}

          <tr className="bg-gray-100 font-semibold border-b-2 border-gray-300">
            <td className="px-2 py-1.5 text-gray-700 border border-gray-200">Peso Total</td>
            {revisoes.map((r) => (
              <td key={r.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                {Number(r.peso_total).toFixed(3).replace('.', ',')} ton
              </td>
            ))}
          </tr>

          {revisoes.some((r) => r.possui_testes) && (
            <>
              <SpacerRow cols={totalCols} />
              <SectionRow label="Testes" cols={totalCols} />
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-600 border border-gray-200">Valor Testes</td>
                {revisoes.map((r) => (
                  <td key={r.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-700 border border-gray-200">
                    {r.possui_testes && r.valor_testes ? formatCurrency(Number(r.valor_testes)) : '—'}
                  </td>
                ))}
              </tr>
            </>
          )}

          <SpacerRow cols={totalCols} />
          <SectionRow label="Valor Total" cols={totalCols} />
          <tr className="bg-green-light font-semibold">
            <td className="px-2 py-1.5 text-green-dark border border-gray-200">R$</td>
            {revisoes.map((r) => (
              <td key={r.versao} colSpan={2} className="px-2 py-1.5 text-right text-green-dark font-bold border border-gray-200">
                {formatCurrency(Number(r.valor_total))}
              </td>
            ))}
          </tr>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-2 py-1.5 text-gray-500 pl-5 border border-gray-200">R$/kg</td>
            {revisoes.map((r) => {
              const pesoTon = Number(r.peso_total)
              const val = Number(r.valor_total)
              return (
                <td key={r.versao} colSpan={2} className="px-2 py-1.5 text-right text-gray-600 border border-gray-200">
                  {pesoTon > 0 && val > 0 ? formatCurrency(val / (pesoTon * 1000)) : '—'}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function HistoricoPropostaModal({ open, item, onClose }: Props) {
  const isFabricacaoType = item.classificacao === 'FABRICACOES' || item.classificacao === 'OLEO_GAS'
  const isParadasType = item.classificacao === 'PARADAS'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Histórico — ${item.numero} · ${item.cliente.nome}`}
      extraWide
    >
      {isFabricacaoType
        ? <HistoricoFabricacao item={item} />
        : isParadasType
        ? <HistoricoParada item={item} />
        : <HistoricoTecnicaComercial item={item} />
      }
    </Modal>
  )
}
