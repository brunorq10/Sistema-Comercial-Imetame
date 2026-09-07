'use client'

import { createPortal } from 'react-dom'

/**
 * Renderiza os filhos direto em document.body, escapando do stacking context
 * isolado da <main> do ShellFrame (isolation: isolate — necessário para o
 * cabeçalho verde não ficar por baixo de colunas/linhas congeladas de
 * tabelas). Sem isso, qualquer overlay `fixed` (modal, confirmação) renderizado
 * dentro de uma página fica preso atrás do cabeçalho, mesmo com z-index alto.
 */
export function Overlay({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
