'use client'

import { UCR_FAIXAS, UCR_REGIOES, type UcrCampo, type UcrFaixaValores, type UcrRegiao } from '@/lib/ucr'

const fmtBr = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  /** Valores por região para o período sendo exibido; null = sem vigência cadastrada naquele período. */
  valoresPorRegiao: Partial<Record<UcrRegiao, UcrFaixaValores | null>>
  /** Região a destacar (ex.: a do contrato sendo visualizado). */
  regiaoDestaque?: UcrRegiao | null
  /** Label da faixa "ativa" (resultado da classificação) por região — realça a célula correspondente. */
  faixaAtivaPorRegiao?: Partial<Record<UcrRegiao, string | null>>
}

// Tabela somente-leitura 5×5 (faixas × regiões) — reaproveitada em FaixasUcrView
// (seção Vigentes) e na seção UCR da tela do contrato de Parada.
export function UcrFaixasTabela({ valoresPorRegiao, regiaoDestaque, faixaAtivaPorRegiao }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full table-fixed" style={{ fontSize: '11px' }}>
        <colgroup>
          <col style={{ width: 160 }} />
          {UCR_REGIOES.map((r) => <col key={r.regiao} style={{ width: `${80 / UCR_REGIOES.length}%` }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600">Faixa</th>
            {UCR_REGIOES.map(({ regiao, label, exemplos }) => (
              <th key={regiao} className="border border-gray-200 bg-gray-50 px-3 py-2 text-center"
                style={regiao === regiaoDestaque ? { background: '#EEF7EE' } : undefined}>
                <div className="font-bold text-gray-700">{label}</div>
                <div className="text-[9px] font-normal text-gray-400 mt-0.5 whitespace-normal leading-tight">{exemplos}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UCR_FAIXAS.map(({ campo, label, cor, bg }) => (
            <tr key={campo}>
              <td className="border border-gray-200 px-3 py-2 font-semibold" style={{ background: bg, color: cor }}>{label}</td>
              {UCR_REGIOES.map(({ regiao }) => {
                const valores = valoresPorRegiao[regiao]
                const ativa = faixaAtivaPorRegiao?.[regiao] === label
                return (
                  <td key={regiao} className="border border-gray-200 px-2 py-1.5 text-center"
                    style={ativa ? { background: bg, fontWeight: 700, color: cor } : undefined}>
                    {valores ? `R$ ${fmtBr(valores[campo as UcrCampo])}` : <span className="text-gray-300">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
