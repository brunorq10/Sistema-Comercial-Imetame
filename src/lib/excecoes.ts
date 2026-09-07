import { prisma } from '@/lib/prisma'

// ════════════════════════════════════════════════════════════════════════════
// Painel de Exceções — pendências geradas automaticamente pelas regras abaixo.
// Uma exceção existe enquanto a condição que a gerou continuar verdadeira e
// desaparece sozinha quando resolvida (não é "lida e descartada" como uma
// notificação). V1: as 9 exceções indispensáveis da análise aprovada.
// ════════════════════════════════════════════════════════════════════════════

export type ModuloExcecao = 'comercial' | 'acordos'
export type SeveridadeExcecao = 'critica' | 'atencao' | 'informativa'

export interface ExcecaoItem {
  chave: string
  tipo: string
  modulo: ModuloExcecao
  titulo: string
  detalhe: string
  severidade: SeveridadeExcecao
  dias: number | null
  link: string
}

interface UsuarioEscopo {
  id: number
  perfil: string
  is_analista_critico: boolean
}

type Escopo = 'todos' | 'proprio' | null

// ── Escopo por perfil (regra definida com o usuário) ──────────────────────────
function resolverEscopo(usuario: UsuarioEscopo): { comercial: Escopo; acordos: Escopo } {
  if (usuario.perfil === 'ADM_GERAL' || usuario.is_analista_critico) return { comercial: 'todos', acordos: 'todos' }
  if (usuario.perfil === 'GESTAO_COMERCIAL' || usuario.perfil === 'ADM_COMERCIAL') return { comercial: 'todos', acordos: null }
  if (usuario.perfil === 'GESTAO_ACORDOS') return { comercial: null, acordos: 'todos' }
  if (usuario.perfil === 'ORCAMENTISTA') return { comercial: 'proprio', acordos: null }
  if (usuario.perfil === 'ACORDOS') return { comercial: null, acordos: 'proprio' }
  return { comercial: null, acordos: null }
}

// ── Helpers de data ────────────────────────────────────────────────────────────
function zerarHora(d: Date): Date { const c = new Date(d); c.setHours(0, 0, 0, 0); return c }
const HOJE = () => zerarHora(new Date())
function diasEntre(de: Date, ate: Date): number { return Math.round((zerarHora(ate).getTime() - zerarHora(de).getTime()) / 86_400_000) }
/** Dias até `data` (negativo = já passou). */
function diasAte(data: Date): number { return diasEntre(HOJE(), data) }
/** Dias desde `data` (positivo = já passou há X dias). */
function diasDesde(data: Date): number { return diasEntre(data, HOJE()) }

function tituloPrazo(base: string, dias: number): string {
  if (dias < 0) return `${base} vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return `${base} vence hoje`
  return `${base} vence em ${dias} dia${dias === 1 ? '' : 's'}`
}

const STATUS_ABERTOS = ['AGUARDANDO_ANALISE', 'EM_ELABORACAO', 'PROPOSTA_ENVIADA'] as const

// ── 01/02 — Prazo técnico e comercial (ou fabricação) vencendo/vencido ────────
async function excPrazos(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const solicitacoes = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null,
      status: { in: [...STATUS_ABERTOS] },
      ...(escopo === 'proprio' ? { orcamentista_id: userId } : {}),
    },
    select: {
      id: true, numero: true, classificacao: true,
      prazo_tecnica: true, prazo_tecnica_indeterminado: true,
      prazo_comercial: true, prazo_comercial_indeterminado: true,
      cliente: { select: { nome: true } },
      propostas_tecnicas: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true, nao_aplicavel: true } },
      propostas_comerciais: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true, nao_aplicavel: true } },
      propostas_fabricacao: { orderBy: { versao: 'desc' }, take: 1, select: { data_envio: true } },
    },
  })

  const itens: ExcecaoItem[] = []
  for (const s of solicitacoes) {
    const isFab = s.classificacao === 'FABRICACOES'

    if (!isFab && s.prazo_tecnica && !s.prazo_tecnica_indeterminado) {
      const ultimaTec = s.propostas_tecnicas[0]
      const pendente = !ultimaTec || (!ultimaTec.data_envio && !ultimaTec.nao_aplicavel)
      if (pendente) {
        const dias = diasAte(s.prazo_tecnica)
        if (dias <= 3) {
          itens.push({
            chave: `prazo-tecnico-${s.id}`, tipo: 'prazo-tecnico', modulo: 'comercial',
            titulo: tituloPrazo('Prazo da proposta técnica', dias),
            detalhe: `${s.numero} — ${s.cliente.nome}`,
            severidade: dias < 0 ? 'critica' : 'atencao',
            dias, link: '/orcamentos/painel',
          })
        }
      }
    }

    const prazoComercial = s.prazo_comercial
    const comercialIndeterminado = s.prazo_comercial_indeterminado
    let comercialPendente: boolean
    if (isFab) {
      const ultimaFab = s.propostas_fabricacao[0]
      comercialPendente = !ultimaFab || !ultimaFab.data_envio
    } else {
      const ultimaCom = s.propostas_comerciais[0]
      comercialPendente = !ultimaCom || (!ultimaCom.data_envio && !ultimaCom.nao_aplicavel)
    }
    if (prazoComercial && !comercialIndeterminado && comercialPendente) {
      const dias = diasAte(prazoComercial)
      if (dias <= 3) {
        itens.push({
          chave: `prazo-comercial-${s.id}`, tipo: 'prazo-comercial', modulo: 'comercial',
          titulo: tituloPrazo(isFab ? 'Prazo da proposta de fabricação' : 'Prazo da proposta comercial', dias),
          detalhe: `${s.numero} — ${s.cliente.nome}`,
          severidade: dias < 0 ? 'critica' : 'atencao',
          dias, link: '/orcamentos/painel',
        })
      }
    }
  }
  return itens
}

// ── 03 — Solicitação aguardando análise crítica ───────────────────────────────
async function excAnaliseAguardando(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const rows = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null, status_analise: 'AGUARDANDO',
      ...(escopo === 'proprio' ? { orcamentista_id: userId } : {}),
    },
    select: { id: true, numero: true, created_at: true, cliente: { select: { nome: true } } },
  })
  const itens: ExcecaoItem[] = []
  for (const s of rows) {
    const dias = diasDesde(s.created_at)
    if (dias < 2) continue
    itens.push({
      chave: `analise-${s.id}`, tipo: 'analise-aguardando', modulo: 'comercial',
      titulo: `Aguardando análise há ${dias} dia${dias === 1 ? '' : 's'}`,
      detalhe: `${s.numero} — ${s.cliente.nome}`,
      severidade: dias >= 5 ? 'critica' : 'atencao',
      dias, link: '/orcamentos/analise',
    })
  }
  return itens
}

// ── 04 — Revisão pendente de avaliação do orçamentista ────────────────────────
async function excRevisaoPendente(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const rows = await prisma.revisaoPendente.findMany({
    where: {
      status: 'PENDENTE',
      solicitacao: { cancelled_at: null, ...(escopo === 'proprio' ? { orcamentista_id: userId } : {}) },
    },
    select: { id: true, created_at: true, solicitacao: { select: { numero: true, cliente: { select: { nome: true } } } } },
  })
  const itens: ExcecaoItem[] = []
  for (const r of rows) {
    const dias = diasDesde(r.created_at)
    if (dias < 1) continue
    itens.push({
      chave: `revisao-${r.id}`, tipo: 'revisao-pendente', modulo: 'comercial',
      titulo: `Revisão aguardando sua avaliação há ${dias} dia${dias === 1 ? '' : 's'}`,
      detalhe: `${r.solicitacao.numero} — ${r.solicitacao.cliente.nome}`,
      severidade: dias >= 4 ? 'critica' : 'atencao',
      dias, link: '/orcamentos/painel',
    })
  }
  return itens
}

// ── 05 — Ganhou sem Relatório de Abertura de OS ───────────────────────────────
async function excGanhouSemOS(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const rows = await prisma.solicitacao.findMany({
    where: {
      cancelled_at: null, status: 'CONTRATO_GANHO', relatorio_os: null,
      ...(escopo === 'proprio' ? { orcamentista_id: userId } : {}),
    },
    select: { id: true, numero: true, updated_at: true, cliente: { select: { nome: true } } },
  })
  if (rows.length === 0) return []

  // data de referência = quando o status virou CONTRATO_GANHO (histórico); cai
  // para updated_at se, por algum motivo, o histórico não tiver esse registro.
  const historico = await prisma.historicoSolicitacao.findMany({
    where: { solicitacao_id: { in: rows.map((r) => r.id) }, campo: 'status', valor_para: 'CONTRATO_GANHO' },
    orderBy: { created_at: 'desc' },
    select: { solicitacao_id: true, created_at: true },
  })
  const dataGanhouMap = new Map<number, Date>()
  for (const h of historico) if (!dataGanhouMap.has(h.solicitacao_id)) dataGanhouMap.set(h.solicitacao_id, h.created_at)

  const itens: ExcecaoItem[] = []
  for (const s of rows) {
    const dataRef = dataGanhouMap.get(s.id) ?? s.updated_at
    const dias = diasDesde(dataRef)
    if (dias < 2) continue
    itens.push({
      chave: `ganhou-sem-os-${s.id}`, tipo: 'ganhou-sem-os', modulo: 'comercial',
      titulo: `Ganhou há ${dias} dia${dias === 1 ? '' : 's'} — Relatório de Abertura de OS pendente`,
      detalhe: `${s.numero} — ${s.cliente.nome}`,
      severidade: dias >= 7 ? 'critica' : 'atencao',
      dias, link: '/orcamentos/propostas',
    })
  }
  return itens
}

// ── 06 — Previsão do mês sem nota fiscal lançada ──────────────────────────────
const MESES_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const MESES_LABEL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

async function excPrevisaoSemNF(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const subindices = await prisma.subIndiceFaturamento.findMany({
    where: {
      deleted_at: null,
      contrato: { cancelled_at: null, ...(escopo === 'proprio' ? { responsavel_id: userId } : {}) },
    },
    select: {
      id: true, descricao: true, data_inicio: true,
      jan: true, fev: true, mar: true, abr: true, mai: true, jun: true,
      jul: true, ago: true, set: true, out: true, nov: true, dez: true,
      contrato: { select: { id: true, indice: true, ano_referencia: true, cliente: { select: { nome: true } } } },
      notas_fiscais: { where: { ativa: true, deleted_at: null }, select: { data_emissao: true } },
    },
  })

  const hoje = new Date()
  const anoAtual = hoje.getFullYear(), mesAtual = hoje.getMonth() + 1, diaAtual = hoje.getDate()
  const itens: ExcecaoItem[] = []

  for (const s of subindices) {
    const ano = s.data_inicio ? s.data_inicio.getUTCFullYear() : s.contrato.ano_referencia
    const mesesComNF = new Set(s.notas_fiscais.map((nf) => `${nf.data_emissao.getUTCFullYear()}-${nf.data_emissao.getUTCMonth() + 1}`))

    MESES_KEYS.forEach((chave, i) => {
      const mes = i + 1
      const previsto = Number(s[chave] ?? 0)
      if (previsto <= 0) return
      const jaDevido = ano < anoAtual || (ano === anoAtual && mes < mesAtual) || (ano === anoAtual && mes === mesAtual && diaAtual >= 25)
      if (!jaDevido) return
      if (mesesComNF.has(`${ano}-${mes}`)) return

      const dias = Math.max(0, diasDesde(new Date(Date.UTC(ano, mes - 1, 25))))
      itens.push({
        chave: `previsao-sem-nf-${s.id}-${ano}-${mes}`, tipo: 'previsao-sem-nf', modulo: 'acordos',
        titulo: `Previsão de ${previsto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${MESES_LABEL[i]} sem nenhuma NF lançada`,
        detalhe: `${s.contrato.indice} — ${s.contrato.cliente.nome} · ${s.descricao}`,
        severidade: 'critica',
        dias, link: `/acordos/faturamento/${s.contrato.id}`,
      })
    })
  }
  return itens
}

// ── 07 — Nota fiscal pendente de aprovação ────────────────────────────────────
async function excNfPendente(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const rows = await prisma.notaFiscalContrato.findMany({
    where: {
      deleted_at: null, status_aprovacao: 'PENDENTE',
      subindice: { contrato: { cancelled_at: null, ...(escopo === 'proprio' ? { responsavel_id: userId } : {}) } },
    },
    select: {
      id: true, numero_nf: true, created_at: true,
      subindice: { select: { contrato: { select: { id: true, indice: true, cliente: { select: { nome: true } } } } } },
    },
  })
  const itens: ExcecaoItem[] = []
  for (const nf of rows) {
    const dias = diasDesde(nf.created_at)
    if (dias < 2) continue
    itens.push({
      chave: `nf-pendente-${nf.id}`, tipo: 'nf-pendente', modulo: 'acordos',
      titulo: `NF ${nf.numero_nf} pendente de aprovação há ${dias} dia${dias === 1 ? '' : 's'}`,
      detalhe: `${nf.subindice.contrato.indice} — ${nf.subindice.contrato.cliente.nome}`,
      severidade: dias >= 5 ? 'critica' : 'atencao',
      dias, link: '/acordos/faturamento',
    })
  }
  return itens
}

// ── 08 — Parada encerrada sem fechamento do Controle de HH ────────────────────
async function excParadaSemFechamento(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const rows = await prisma.contrato.findMany({
    where: {
      cancelled_at: null, classificacao: 'PARADAS', hh_cancelado_at: null,
      ...(escopo === 'proprio' ? { responsavel_id: userId } : {}),
      parada_hh_config: { fechada_em: null },
    },
    select: {
      id: true, indice: true, cliente: { select: { nome: true } },
      parada_hh_config: { select: { acomp_fim: true, parada_fim: true } },
    },
  })
  const itens: ExcecaoItem[] = []
  for (const c of rows) {
    const fimRef = c.parada_hh_config?.acomp_fim ?? c.parada_hh_config?.parada_fim
    if (!fimRef) continue
    const dias = diasDesde(fimRef)
    if (dias < 3) continue
    itens.push({
      chave: `parada-fechamento-${c.id}`, tipo: 'parada-sem-fechamento', modulo: 'acordos',
      titulo: `Parada encerrada há ${dias} dia${dias === 1 ? '' : 's'} sem fechamento do Controle de HH`,
      detalhe: `${c.indice} — ${c.cliente.nome}`,
      severidade: dias >= 10 ? 'critica' : 'atencao',
      dias, link: `/acordos/hh/paradas/${c.id}`,
    })
  }
  return itens
}

// ── 09 — Contrato sem vínculo com a solicitação de origem ─────────────────────
async function excContratoSemVinculo(escopo: Escopo, userId: number): Promise<ExcecaoItem[]> {
  if (!escopo) return []
  const rows = await prisma.contrato.findMany({
    where: {
      cancelled_at: null, solicitacao_id: null, num_proposta: { not: null },
      ...(escopo === 'proprio' ? { responsavel_id: userId } : {}),
    },
    select: { id: true, indice: true, num_proposta: true, cliente: { select: { nome: true } } },
  })
  return rows.map((c) => ({
    chave: `contrato-sem-vinculo-${c.id}`, tipo: 'contrato-sem-vinculo', modulo: 'acordos' as const,
    titulo: `Nº Proposta "${c.num_proposta}" digitado sem solicitação de origem vinculada`,
    detalhe: `${c.indice} — ${c.cliente.nome}`,
    severidade: 'informativa' as const,
    dias: null, link: `/acordos/faturamento/${c.id}`,
  }))
}

// ── Orquestrador ───────────────────────────────────────────────────────────────
const ORDEM_SEVERIDADE: Record<SeveridadeExcecao, number> = { critica: 0, atencao: 1, informativa: 2 }

export async function listarExcecoes(usuario: UsuarioEscopo): Promise<ExcecaoItem[]> {
  const escopo = resolverEscopo(usuario)
  const [prazos, analise, revisao, ganhouSemOs, previsaoSemNf, nfPendente, paradaFechamento, contratoVinculo] = await Promise.all([
    excPrazos(escopo.comercial, usuario.id),
    excAnaliseAguardando(escopo.comercial, usuario.id),
    excRevisaoPendente(escopo.comercial, usuario.id),
    excGanhouSemOS(escopo.comercial, usuario.id),
    excPrevisaoSemNF(escopo.acordos, usuario.id),
    excNfPendente(escopo.acordos, usuario.id),
    excParadaSemFechamento(escopo.acordos, usuario.id),
    excContratoSemVinculo(escopo.acordos, usuario.id),
  ])

  const todos = [...prazos, ...analise, ...revisao, ...ganhouSemOs, ...previsaoSemNf, ...nfPendente, ...paradaFechamento, ...contratoVinculo]

  return todos.sort((a, b) => {
    const s = ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade]
    if (s !== 0) return s
    return (b.dias ?? -1) - (a.dias ?? -1)
  })
}
