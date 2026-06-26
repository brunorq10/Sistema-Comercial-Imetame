// ════════════════════════════════════════════════════════════════════════════
// Controle de acesso — fonte única de verdade da matriz de permissões.
//
// Arquitetura (validada com o cliente — planilha "Lista de Perfis.xlsx"):
//  - 6 perfis-base: ADM_GERAL, GESTAO_ACORDOS, GESTAO_COMERCIAL, ADM_COMERCIAL,
//    ACORDOS, ORCAMENTISTA.
//  - "Analista Crítico" NÃO é perfil: é um FLAG (is_analista_critico) somável a
//    qualquer perfil-base, que ACRESCENTA permissões.
//  - ADM_GERAL é soberano (pode tudo).
//  - Algumas permissões têm escopo por TITULARIDADE: liberadas para registros
//    do próprio usuário ("proprio") e/ou para qualquer registro ("todos").
// ════════════════════════════════════════════════════════════════════════════

export type Perfil =
  | 'ADM_GERAL'
  | 'GESTAO_ACORDOS'
  | 'GESTAO_COMERCIAL'
  | 'ADM_COMERCIAL'
  | 'ACORDOS'
  | 'ORCAMENTISTA'

export interface Usuario {
  id: number
  perfil: Perfil
  is_analista_critico?: boolean
}

// Entrada simples: concedida a um conjunto fixo de perfis (+ opcional flag analista).
interface EntradaSimples { perfis: Perfil[]; analista?: boolean }
// Entrada por titularidade: "todos" = qualquer registro; "proprio" = só os do usuário.
interface EntradaTitular { todos: Perfil[]; proprio: Perfil[]; analista?: boolean }
type Entrada = EntradaSimples | EntradaTitular

function ehTitular(e: Entrada): e is EntradaTitular {
  return (e as EntradaTitular).proprio !== undefined
}

// ── Catálogo (espelha a planilha). ADM_GERAL é implícito em tudo. ────────────
export const CATALOGO = {
  // ─────────── Orçamentos ───────────
  // Meu Painel
  'orc.proposta.enviar':     { todos: [],                proprio: ['ORCAMENTISTA'] },
  // Interações (Linha do Tempo): qualquer perfil com acesso à solicitação cria
  'orc.info.registrar':      { perfis: ['ADM_COMERCIAL', 'ORCAMENTISTA', 'GESTAO_COMERCIAL'], analista: true },
  // Excluir interação: supervisão (Gestão Comercial / ADM Geral) — autor é
  // verificado à parte na rota (created_by). ADM_GERAL é soberano.
  'orc.info.excluir':        { perfis: ['GESTAO_COMERCIAL'] },
  // Solicitações
  'orc.solicitacao.criar':   { perfis: ['ADM_COMERCIAL'], analista: true },
  'orc.solicitacao.revisao': { perfis: ['ADM_COMERCIAL'], analista: true },
  'orc.solicitacao.editar':  { perfis: ['ADM_COMERCIAL'], analista: true },
  'orc.solicitacao.cancelar':{ perfis: ['ADM_COMERCIAL'], analista: true },
  // Análise de Solicitações
  'orc.analise.ver':         { perfis: ['GESTAO_COMERCIAL', 'ADM_COMERCIAL'], analista: true },
  'orc.analise.abrir':       { perfis: [], analista: true },
  'orc.analise.decidir':     { perfis: [], analista: true },
  // Propostas
  'orc.proposta.editar':     { todos: [],                proprio: ['ORCAMENTISTA'] },

  // ─────────── Acordos ───────────
  // Meu Painel
  'acordos.painel.prev.editar':       { todos: ['GESTAO_ACORDOS'], proprio: ['ACORDOS'] },
  // Lançar faturamento (criar NF): gestão lança qualquer (APROVADO direto);
  // responsável (ACORDOS) lança no PRÓPRIO contrato via Meu Painel (gera PENDENTE).
  'acordos.faturamento.lancar':       { todos: ['GESTAO_ACORDOS'], proprio: ['ACORDOS'] },
  // Controle de Faturamento
  'acordos.faturamento.item.editar':  { perfis: ['GESTAO_ACORDOS'] },
  'acordos.faturamento.item.excluir': { perfis: ['GESTAO_ACORDOS'] },
  'acordos.faturamento.novo':         { perfis: ['GESTAO_ACORDOS'] },
  'acordos.consolidado.gerar':        { perfis: ['GESTAO_ACORDOS'] },
  // Registro de NF
  'acordos.nf.editar':                { todos: ['GESTAO_ACORDOS'], proprio: ['ACORDOS'] },
  'acordos.nf.inativar':              { perfis: ['GESTAO_ACORDOS'] },
  'acordos.nf.excluir':               { perfis: [] },                 // só ADM_GERAL
  // Aprovações
  'acordos.aprovacoes.ver':           { perfis: ['GESTAO_ACORDOS'] },
  'acordos.aprovacoes.decidir':       { perfis: ['GESTAO_ACORDOS'] },
  // HH — Obras
  'acordos.obras.cadastrais.editar':  { perfis: ['GESTAO_ACORDOS'] },
  'acordos.obras.hh.lancar':          { todos: ['GESTAO_ACORDOS'], proprio: ['ACORDOS'] },
  'acordos.obras.remover':            { perfis: ['GESTAO_ACORDOS'] },
  'acordos.obras.novo':               { perfis: ['GESTAO_ACORDOS'] },
  // HH — Paradas
  'acordos.paradas.cadastrais.editar':{ perfis: ['GESTAO_ACORDOS'] },
  'acordos.paradas.controlehh.editar':{ todos: ['GESTAO_ACORDOS'], proprio: ['ACORDOS'] },
  'acordos.paradas.remover':          { perfis: ['GESTAO_ACORDOS'] },
  'acordos.paradas.novo':             { perfis: ['GESTAO_ACORDOS'] },
  // HH — Fabricações
  'acordos.fab.itens.editar':         { perfis: ['GESTAO_ACORDOS'] },
  'acordos.fab.excluir':              { perfis: ['GESTAO_ACORDOS'] },
  'acordos.fab.realizado.lancar':     { todos: ['GESTAO_ACORDOS'], proprio: ['ACORDOS'] },
  'acordos.fab.novo':                 { perfis: ['GESTAO_ACORDOS'] },

  // ─────────── Cadastro ───────────
  'cadastro.cliente.criar':    { perfis: ['ADM_COMERCIAL'], analista: true },
  'cadastro.cliente.editar':   { perfis: ['ADM_COMERCIAL'], analista: true },
  'cadastro.cliente.inativar': { perfis: ['ADM_COMERCIAL'], analista: true },
  'cadastro.usuario.gerenciar':{ perfis: [] },                        // só ADM_GERAL
} satisfies Record<string, Entrada>

export type Permissao = keyof typeof CATALOGO

// ── Verificação central ──────────────────────────────────────────────────────
// opts.ehDono: informe se o registro alvo pertence ao usuário (para permissões
// com escopo de titularidade). Calcule com ehDono() e passe aqui.
export function pode(usuario: Usuario | null | undefined, permissao: Permissao, opts?: { ehDono?: boolean }): boolean {
  if (!usuario) return false
  if (usuario.perfil === 'ADM_GERAL') return true   // soberano

  const e: Entrada = CATALOGO[permissao]
  const analista = !!(e.analista && usuario.is_analista_critico)

  if (ehTitular(e)) {
    // "todos" libera para qualquer registro; analista (quando marcado) também
    if (e.todos.includes(usuario.perfil) || analista) return true
    // "proprio" libera apenas o registro do próprio usuário
    if (e.proprio.includes(usuario.perfil)) return !!opts?.ehDono
    return false
  }

  return e.perfis.includes(usuario.perfil) || analista
}

// ── Titularidade ("dono") por tipo de registro ───────────────────────────────
export type TipoRegistro = 'solicitacao' | 'contrato' | 'nf'

interface RegistroDono {
  orcamentista_id?: number | null
  responsavel_id?: number | null
  created_by?: number | null
}

export function ehDono(usuario: Usuario | null | undefined, registro: RegistroDono | null | undefined, tipo: TipoRegistro): boolean {
  if (!usuario || !registro) return false
  switch (tipo) {
    case 'solicitacao': return registro.orcamentista_id === usuario.id
    case 'contrato':    return registro.responsavel_id === usuario.id
    case 'nf':          return registro.created_by === usuario.id
  }
}
