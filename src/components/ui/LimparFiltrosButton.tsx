'use client'

// Botão padrão de "limpar filtros" — mesmo rótulo e estilo em todas as barras
// de filtro do sistema.
export function LimparFiltrosButton({ onClick, title = 'Limpar filtros' }: { onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="border border-gray-300 text-gray-500 rounded px-2.5 py-[5px] text-[11px] cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
    >
      ✕ Limpar
    </button>
  )
}
