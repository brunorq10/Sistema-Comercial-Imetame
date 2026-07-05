import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** Linha de apoio abaixo do título (instrução ou contexto da tela). */
  subtitle?: ReactNode
  /** Ações da página — sempre à direita; ação primária por último. */
  actions?: ReactNode
}

// Cabeçalho padrão de página: título 15px à esquerda, ações à direita,
// subtítulo em linha própria. Toda página de conteúdo deve usá-lo.
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
    </div>
  )
}
