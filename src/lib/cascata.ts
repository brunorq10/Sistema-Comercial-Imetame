// ─────────────────────────────────────────────────────────────────────────────
// Filtros em cascata (cascading filters): as opções exibidas em cada filtro
// consideram as seleções feitas nos DEMAIS filtros, mostrando apenas valores
// que existem no conjunto de dados resultante.
//
// Cada tela fornece `linhas`: uma tupla por item filtrável (ex.: uma por
// solicitação/contrato) com os valores de cada campo de filtro já no formato
// usado pelas opções (string) ou null quando o item não tem o valor.
// ─────────────────────────────────────────────────────────────────────────────

export type LinhaCascata = Record<string, string | null>

/**
 * Valores válidos para o filtro `campo`, dadas as seleções dos outros campos.
 * A própria seleção de `campo` é ignorada (para permitir marcar/desmarcar) e
 * os valores já selecionados permanecem sempre disponíveis.
 */
export function opcoesValidas(
  linhas: LinhaCascata[],
  selecoes: Record<string, string[]>,
  campo: string,
): Set<string> {
  const outras = Object.entries(selecoes).filter(([k, sel]) => k !== campo && sel.length > 0)
  const validas = new Set<string>()
  for (const linha of linhas) {
    let ok = true
    for (const [k, sel] of outras) {
      const v = linha[k]
      if (v == null || !sel.includes(v)) { ok = false; break }
    }
    if (ok) {
      const v = linha[campo]
      if (v != null && v !== '') validas.add(v)
    }
  }
  for (const v of selecoes[campo] ?? []) validas.add(v)
  return validas
}

/** Filtra uma lista de opções `{ value, label }` mantendo só as válidas em cascata. */
export function filtrarOpcoes<T extends { value: string }>(
  opcoes: T[],
  linhas: LinhaCascata[],
  selecoes: Record<string, string[]>,
  campo: string,
): T[] {
  // Sem tuplas carregadas (ou API antiga em cache) → não restringe nada
  if (linhas.length === 0) return opcoes
  const validas = opcoesValidas(linhas, selecoes, campo)
  return opcoes.filter((o) => validas.has(o.value))
}
