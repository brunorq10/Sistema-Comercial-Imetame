'use client'

interface Props {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (p: number) => void
}

export function Pagination({ page, pages, total, limit, onPage }: Props) {
  if (pages <= 1) return null

  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-2 py-2 border-t border-gray-200 bg-white text-[11px] text-gray-500">
      <span>{from}–{to} de {total}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(1)}
          disabled={page === 1}
          className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
        >
          «
        </button>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
        >
          ‹
        </button>
        <span className="px-2 py-0.5 font-semibold text-gray-700">{page} / {pages}</span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
        >
          ›
        </button>
        <button
          onClick={() => onPage(pages)}
          disabled={page === pages}
          className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
        >
          »
        </button>
      </div>
    </div>
  )
}
