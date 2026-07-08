'use client'

import { AcoesMenu } from '@/components/ui/AcoesMenu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TIPO_MULTA_MAP } from '@/lib/multas'

export interface MultaListItem {
  id: number
  contrato_id: number
  contrato_indice: string
  cliente_nome: string
  tipo: string
  descricao: string
  data_ocorrencia: string
  data_notificacao_cliente: string | null
  data_desconto: string | null
  valor_total: number
  ativa: boolean
  motivo_inativacao: string | null
  autor: string
}

interface Props {
  multas: MultaListItem[]
  onEditar: (m: MultaListItem) => void
  onInativar: (m: MultaListItem) => void
  onExcluir: (m: MultaListItem) => void
  canEditar: boolean
  canExcluir: boolean
}

export function MultasRegistroTable({ multas, onEditar, onInativar, onExcluir, canEditar, canExcluir }: Props) {
  if (multas.length === 0) {
    return <p className="text-center text-gray-400 py-10 text-sm">Nenhuma multa/penalidade encontrada com os filtros aplicados.</p>
  }
  const th = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap border-b border-gray-200 bg-gray-50 sticky top-0 z-10'

  return (
    <div className="h-full overflow-auto border border-gray-100 rounded-lg">
      <table className="w-full border-collapse" style={{ minWidth: 1040 }}>
        <thead>
          <tr>
            <th className={th}>Tipo</th>
            <th className={th}>Índice</th>
            <th className={th}>Cliente</th>
            <th className={th}>Descrição</th>
            <th className={th}>Dt. Ocorrência</th>
            <th className={th}>Dt. Notificação</th>
            <th className={th}>Dt. Desconto</th>
            <th className={th}>Valor</th>
            <th className={th}>Status</th>
            <th className={th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {multas.map((m) => {
            const cfg = TIPO_MULTA_MAP[m.tipo]
            const td = `px-3 py-2 text-[11px] whitespace-nowrap border-b border-gray-100 ${m.ativa ? 'text-gray-700' : 'text-gray-400'}`
            return (
              <tr key={m.id} className={m.ativa ? 'hover:bg-gray-50' : 'bg-gray-50/50'}>
                <td className={td}>
                  <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5" style={{ color: cfg?.cor ?? '#6B7280', backgroundColor: cfg?.corBg ?? '#F3F4F6' }}>
                    {cfg?.label ?? m.tipo}
                  </span>
                </td>
                <td className={`${td} font-semibold text-green-dark`}>{m.contrato_indice}</td>
                <td className={td}>{m.cliente_nome}</td>
                <td className={`${td} max-w-[260px] truncate`} title={m.descricao}>{m.descricao}</td>
                <td className={td}>{formatDate(m.data_ocorrencia)}</td>
                <td className={td}>{m.data_notificacao_cliente ? formatDate(m.data_notificacao_cliente) : '—'}</td>
                <td className={td}>{m.data_desconto ? formatDate(m.data_desconto) : '—'}</td>
                <td className={`${td} font-semibold ${m.ativa ? 'text-auto-value' : ''}`}>{formatCurrency(m.valor_total)}</td>
                <td className={td}>
                  {m.ativa
                    ? <span className="text-[9px] font-semibold text-green-700 bg-green-50 rounded-full px-1.5 py-0.5">Ativa</span>
                    : <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5" title={m.motivo_inativacao ?? ''}>Inativa</span>}
                </td>
                <td className={` text-center w-[64px]`}>
                  <AcoesMenu items={[
                    { label: 'Editar multa', icon: '✎', destaque: true, visivel: canEditar, onClick: () => onEditar(m) },
                    { label: m.ativa ? 'Inativar' : 'Reativar', icon: m.ativa ? '⊘' : '↺', visivel: canEditar, onClick: () => onInativar(m) },
                    { label: 'Excluir', icon: '🗑', destrutiva: true, visivel: canExcluir, onClick: () => onExcluir(m) },
                  ]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
