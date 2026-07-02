import { describe, it, expect } from 'vitest'
import { buildQuery, type ReportRequest } from './query'
import { buildPivot } from './pivot'
import { validarRequest } from './service'
import type { DimMeta, ValMeta } from './shared'

// ── buildQuery: SQL seguro e correto ─────────────────────────────────────────
describe('buildQuery', () => {
  const req: ReportRequest = {
    modulo: 'comercial',
    linhas: [{ campo: 'com_data_solic', granularidade: 'mes' }],
    colunas: [{ campo: 'com_resultado' }],
    valores: [{ campo: 'com_valor', agregacao: 'soma' }, { campo: 'com_rs_hh' }],
    filtros: { de: '2025-01-01', ate: '2025-12-31' },
  }

  it('gera DATE_TRUNC para dimensão de data + granularidade', () => {
    expect(buildQuery(req).sql).toContain("DATE_TRUNC('month'")
  })

  it('agrupa e ordena pelas dimensões (linhas + colunas) por ordinal', () => {
    expect(buildQuery(req).sql).toMatch(/GROUP BY 1, 2 ORDER BY 1, 2/)
  })

  it('parametriza o filtro de data (De/Até) — sem interpolar string', () => {
    const b = buildQuery(req)
    expect(b.params).toEqual(['2025-01-01', '2025-12-31'])
    expect(b.sql).toContain('$1::date')
    expect(b.sql).toContain('$2::date')
  })

  it('campo calculado vira SUM(num)/NULLIF(SUM(den),0) — nunca AVG(a/b)', () => {
    const sql = buildQuery(req).sql
    expect(sql).toContain('NULLIF(SUM(pt.hh_total), 0)')
    expect(sql).not.toMatch(/AVG\([^)]*\/[^)]*\)/)
  })

  it('aplica LIMIT apenas quando pedido (preview)', () => {
    expect(buildQuery(req, { limit: 50 }).sql).toContain('LIMIT 50')
    // sem preview não há LIMIT externo (o "LIMIT 1" das subqueries LATERAL é interno)
    expect(buildQuery(req).sql).not.toContain('LIMIT 50')
    expect(buildQuery(req).sql.trimEnd()).toMatch(/ORDER BY 1, 2$/)
  })

  it('rejeita campo fora do catálogo (anti SQL injection)', () => {
    expect(() => buildQuery({ ...req, linhas: [{ campo: 'x; DROP TABLE users' }] })).toThrow()
  })

  it('filtro de cliente usa ids inteiros coeridos (IN)', () => {
    const b = buildQuery({ ...req, filtros: { ...req.filtros, cliente_id: [1, 2, 3] } })
    expect(b.sql).toContain('IN (1,2,3)')
  })
})

// ── HH (Obras): UNION previsto/planejado + realizado ─────────────────────────
describe('buildQuery — módulo HH', () => {
  const req: ReportRequest = {
    modulo: 'hh',
    linhas: [{ campo: 'hh_data', granularidade: 'mes' }],
    colunas: [],
    valores: [{ campo: 'hh_previsto' }, { campo: 'hh_realizado' }, { campo: 'hh_desvio' }],
    filtros: {},
  }
  it('usa UNION ALL das fontes de HH e make_date para a data', () => {
    const sql = buildQuery(req).sql
    expect(sql).toContain('UNION ALL')
    expect(sql).toContain('make_date(hh.ano, hh.mes, 1)')
  })
  it('pega a última versão do lançamento (MAX(versao))', () => {
    expect(buildQuery(req).sql).toContain('MAX(versao)')
  })
  it('desvio = (realizado - planejado) / NULLIF(SUM(planejado),0), sem média de médias', () => {
    const sql = buildQuery(req).sql
    expect(sql).toContain('NULLIF(SUM(hh.hh_planejado), 0)')
    expect(sql).toContain('SUM((hh.hh_realizado - hh.hh_planejado))')
  })
})

// ── Inter-módulos: proposta de origem na base Acordos ────────────────────────
describe('buildQuery — Acordos × proposta de origem', () => {
  const req: ReportRequest = {
    modulo: 'acordos',
    linhas: [{ campo: 'aco_cliente' }],
    colunas: [],
    valores: [{ campo: 'aco_faturado' }, { campo: 'aco_valor_proposta' }, { campo: 'aco_fat_vs_prop' }],
    filtros: {},
  }
  it('junta a proposta de origem via solicitacao_id (LATERAL) no grão do contrato', () => {
    const sql = buildQuery(req).sql
    expect(sql).toContain('pc.solicitacao_id = c.solicitacao_id')
    expect(sql).toContain('pcorig.valor_total')
  })
  it('% faturado sobre proposta usa NULLIF no denominador', () => {
    expect(buildQuery(req).sql).toContain('NULLIF(SUM(pcorig.valor_total), 0)')
  })
})

// ── validarRequest: regras semânticas ────────────────────────────────────────
describe('validarRequest', () => {
  it('aceita configuração válida', () => {
    expect(validarRequest({ modulo: 'comercial', linhas: [{ campo: 'com_cliente' }], colunas: [], valores: [{ campo: 'com_valor' }], filtros: {} })).toBeNull()
  })
  it('rejeita métrica em Linhas', () => {
    expect(validarRequest({ modulo: 'comercial', linhas: [{ campo: 'com_valor' }], colunas: [], valores: [{ campo: 'com_valor' }], filtros: {} })).toBeTruthy()
  })
  it('rejeita dimensão em Valores', () => {
    expect(validarRequest({ modulo: 'comercial', linhas: [{ campo: 'com_cliente' }], colunas: [], valores: [{ campo: 'com_cliente' }], filtros: {} })).toBeTruthy()
  })
  it('rejeita mistura de módulos', () => {
    expect(validarRequest({ modulo: 'comercial', linhas: [{ campo: 'aco_cliente' }], colunas: [], valores: [{ campo: 'com_valor' }], filtros: {} })).toBeTruthy()
  })
})

// ── buildPivot: remodelagem e totais corretos ────────────────────────────────
const dim = (key: string, label: string, eData = false, granularidade?: 'mes'): DimMeta => ({ key, label, eData, granularidade })
const val = (key: string, label: string, formato = 'moeda'): ValMeta => ({ key, label, formato })

describe('buildPivot — sem colunas', () => {
  const p = buildPivot({
    linhasMeta: [dim('com_cliente', 'Cliente')],
    colunasMeta: [],
    valoresMeta: [val('com_valor', 'Valor')],
    main: [{ d0: 'ACME', m0: 100 }, { d0: 'Beta', m0: 50 }],
    rowTotais: [], colTotais: [],
    grand: [{ m0: 150 }],
  })
  it('lista as linhas na ordem recebida', () => expect(p.rows.map((r) => r.dims[0])).toEqual(['ACME', 'Beta']))
  it('preserva os valores das células', () => expect(p.rows[0].values).toEqual([100]))
  it('linha Total vem do agregado geral (grand), não da soma das células', () => expect(p.totalRow).toEqual([150]))
  it('sem colunas não há grupo Total à direita', () => expect(p.topHeader).toBeNull())
})

describe('buildPivot — com colunas (cross-tab)', () => {
  const p = buildPivot({
    linhasMeta: [dim('aco_cliente', 'Cliente')],
    colunasMeta: [dim('aco_status', 'Status')],
    valoresMeta: [val('aco_faturado', 'Faturado')],
    // ACME: GANHO=100, PERDIDO=40 ; Beta: GANHO=30
    main: [
      { d0: 'ACME', d1: 'GANHO', m0: 100 },
      { d0: 'ACME', d1: 'PERDIDO', m0: 40 },
      { d0: 'Beta', d1: 'GANHO', m0: 30 },
    ],
    rowTotais: [{ d0: 'ACME', m0: 140 }, { d0: 'Beta', m0: 30 }],   // total por linha
    colTotais: [{ d0: 'GANHO', m0: 130 }, { d0: 'PERDIDO', m0: 40 }], // total por coluna
    grand: [{ m0: 170 }],
  })
  it('cria colunas-folha por combinação + grupo Total', () => {
    expect(p.topHeader?.map((g) => g.label)).toEqual(['GANHO', 'PERDIDO', 'Total'])
    expect(p.leaves.length).toBe(3)
    expect(p.leaves[2].isTotal).toBe(true)
  })
  it('preenche células e a coluna Total (agregado por linha)', () => {
    const acme = p.rows.find((r) => r.dims[0] === 'ACME')!
    expect(acme.values).toEqual([100, 40, 140]) // GANHO, PERDIDO, Total-linha
    const beta = p.rows.find((r) => r.dims[0] === 'Beta')!
    expect(beta.values).toEqual([30, null, 30]) // Beta não tem PERDIDO
  })
  it('linha Total: por coluna vem de colTotais; célula final vem do grand', () => {
    expect(p.totalRow).toEqual([130, 40, 170])
  })
})

describe('buildPivot — calculado com denominador nulo/zero', () => {
  const p = buildPivot({
    linhasMeta: [dim('aco_cliente', 'Cliente')],
    colunasMeta: [],
    valoresMeta: [val('aco_pct', '% faturado', 'percent')],
    main: [{ d0: 'ACME', m0: 42.5 }, { d0: 'SemContrato', m0: null }],
    rowTotais: [], colTotais: [],
    grand: [{ m0: null }],
  })
  it('mantém null (frontend exibe —), nunca NaN', () => {
    expect(p.rows[1].values).toEqual([null])
    expect(p.totalRow).toEqual([null])
  })
})

describe('buildPivot — série de datas preenche períodos sem dados', () => {
  const jan = new Date(Date.UTC(2025, 0, 1)), fev = new Date(Date.UTC(2025, 1, 1)), mar = new Date(Date.UTC(2025, 2, 1))
  const p = buildPivot({
    linhasMeta: [dim('com_data_solic', 'Mês', true, 'mes')],
    colunasMeta: [],
    valoresMeta: [val('com_qtd', 'Qtde', 'numero')],
    main: [{ d0: fev, m0: 99 }], // só fevereiro tem dado
    rowTotais: [], colTotais: [],
    grand: [{ m0: 99 }],
    rowSeedDates: [jan, fev, mar],
  })
  it('inclui os 3 meses em ordem cronológica', () => {
    expect(p.rows.map((r) => r.dims[0])).toEqual(['Jan/2025', 'Fev/2025', 'Mar/2025'])
  })
  it('meses sem dados ficam nulos; o mês com dado mantém o valor', () => {
    expect(p.rows[0].values).toEqual([null]) // Jan
    expect(p.rows[1].values).toEqual([99])   // Fev
    expect(p.rows[2].values).toEqual([null]) // Mar
  })
})
