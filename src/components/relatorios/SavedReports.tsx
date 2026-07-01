'use client'

export interface RelatorioSalvoItem { id: number; nome: string; versaoAtual: number; updated_at: string }

interface Props {
  salvos: RelatorioSalvoItem[]
  ativoId: number | null
  onLoad: (id: number) => void
  onVersoes: (id: number) => void
  onRename: (id: number, nomeAtual: string) => void
  onDelete: (id: number, nome: string) => void
}

export function SavedReports({ salvos, ativoId, onLoad, onVersoes, onRename, onDelete }: Props) {
  return (
    <div className="w-[220px] flex-shrink-0 border border-gray-200 rounded-md bg-white flex flex-col overflow-hidden max-h-[240px]">
      <div className="px-2.5 py-1.5 border-b border-gray-100 text-[9px] font-bold uppercase tracking-wide text-gray-500">Favoritos</div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {salvos.length === 0 && <p className="text-[10px] text-gray-400 text-center py-3">Nenhum relatório salvo.</p>}
        {salvos.map((r) => (
          <div key={r.id} className={`group rounded border px-2 py-1.5 ${ativoId === r.id ? 'border-green-primary bg-green-light/40' : 'border-gray-200 hover:bg-gray-50'}`}>
            <button onClick={() => onLoad(r.id)} className="block w-full text-left" title="Carregar">
              <span className="text-[11px] font-medium text-gray-700 truncate block">{r.nome}</span>
              <span className="text-[9px] text-gray-400">v{r.versaoAtual}</span>
            </button>
            <div className="flex gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onVersoes(r.id)} className="text-[9px] text-blue-500 hover:underline">histórico</button>
              <button onClick={() => onRename(r.id, r.nome)} className="text-[9px] text-gray-500 hover:underline">renomear</button>
              <button onClick={() => onDelete(r.id, r.nome)} className="text-[9px] text-red-400 hover:underline">excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
