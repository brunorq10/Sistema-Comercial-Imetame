import { describe, it, expect } from 'vitest'
import { pode, ehDono, type Usuario } from './permissoes'

const u = (perfil: Usuario['perfil'], analista = false): Usuario => ({ id: 1, perfil, is_analista_critico: analista })
const outro = (perfil: Usuario['perfil'], analista = false): Usuario => ({ id: 2, perfil, is_analista_critico: analista })

describe('ADM_GERAL é soberano', () => {
  it('pode qualquer permissão', () => {
    expect(pode(u('ADM_GERAL'), 'cadastro.usuario.gerenciar')).toBe(true)
    expect(pode(u('ADM_GERAL'), 'acordos.nf.excluir')).toBe(true)
    expect(pode(u('ADM_GERAL'), 'orc.proposta.enviar')).toBe(true) // mesmo sem ehDono
  })
})

describe('Módulo Orçamentos', () => {
  it('concedida: ADM_COMERCIAL cria solicitação', () => {
    expect(pode(u('ADM_COMERCIAL'), 'orc.solicitacao.criar')).toBe(true)
  })
  it('negada: ORCAMENTISTA não cria solicitação', () => {
    expect(pode(u('ORCAMENTISTA'), 'orc.solicitacao.criar')).toBe(false)
  })
  it('flag Analista somado a um perfil-base concede análise', () => {
    expect(pode(u('GESTAO_COMERCIAL'), 'orc.analise.decidir')).toBe(false)          // base sem flag → negada
    expect(pode(u('GESTAO_COMERCIAL', true), 'orc.analise.decidir')).toBe(true)      // base + Analista → concedida
    expect(pode(u('ORCAMENTISTA', true), 'orc.solicitacao.criar')).toBe(true)        // Analista soma ao Orçamentista
  })
  it('titularidade: enviar proposta só na própria solicitação', () => {
    expect(pode(u('ORCAMENTISTA'), 'orc.proposta.enviar', { ehDono: true })).toBe(true)
    expect(pode(u('ORCAMENTISTA'), 'orc.proposta.enviar', { ehDono: false })).toBe(false)
    expect(pode(u('ADM_COMERCIAL'), 'orc.proposta.enviar', { ehDono: true })).toBe(false) // ADM_COMERCIAL não envia
  })
})

describe('Módulo Acordos', () => {
  it('concedida: GESTAO_ACORDOS edita item de faturamento', () => {
    expect(pode(u('GESTAO_ACORDOS'), 'acordos.faturamento.item.editar')).toBe(true)
  })
  it('negada: ACORDOS não edita item de faturamento (gestão-only)', () => {
    expect(pode(u('ACORDOS'), 'acordos.faturamento.item.editar')).toBe(false)
  })
  it('titularidade: ACORDOS lança HH só no próprio contrato; GESTAO em qualquer', () => {
    expect(pode(u('ACORDOS'), 'acordos.obras.hh.lancar', { ehDono: true })).toBe(true)
    expect(pode(u('ACORDOS'), 'acordos.obras.hh.lancar', { ehDono: false })).toBe(false)
    expect(pode(u('GESTAO_ACORDOS'), 'acordos.obras.hh.lancar', { ehDono: false })).toBe(true)
  })
  it('flag Analista NÃO concede ações de Acordos', () => {
    expect(pode(u('ACORDOS', true), 'acordos.faturamento.item.editar')).toBe(false)
  })
  it('excluir NF é exclusivo do ADM_GERAL', () => {
    expect(pode(u('GESTAO_ACORDOS'), 'acordos.nf.excluir')).toBe(false)
    expect(pode(u('ADM_GERAL'), 'acordos.nf.excluir')).toBe(true)
  })
})

describe('Módulo Cadastro', () => {
  it('concedida: ADM_COMERCIAL cadastra cliente', () => {
    expect(pode(u('ADM_COMERCIAL'), 'cadastro.cliente.criar')).toBe(true)
  })
  it('flag Analista concede cadastro de cliente', () => {
    expect(pode(u('ORCAMENTISTA'), 'cadastro.cliente.criar')).toBe(false)
    expect(pode(u('ORCAMENTISTA', true), 'cadastro.cliente.criar')).toBe(true)
  })
  it('gerenciar usuários é exclusivo do ADM_GERAL', () => {
    expect(pode(u('ADM_COMERCIAL'), 'cadastro.usuario.gerenciar')).toBe(false)
    expect(pode(u('ADM_COMERCIAL', true), 'cadastro.usuario.gerenciar')).toBe(false)
    expect(pode(u('ADM_GERAL'), 'cadastro.usuario.gerenciar')).toBe(true)
  })
})

describe('ehDono', () => {
  it('solicitação pelo orcamentista_id', () => {
    expect(ehDono(u('ORCAMENTISTA'), { orcamentista_id: 1 }, 'solicitacao')).toBe(true)
    expect(ehDono(u('ORCAMENTISTA'), { orcamentista_id: 99 }, 'solicitacao')).toBe(false)
  })
  it('contrato pelo responsavel_id', () => {
    expect(ehDono(u('ACORDOS'), { responsavel_id: 1 }, 'contrato')).toBe(true)
    expect(ehDono(outro('ACORDOS'), { responsavel_id: 1 }, 'contrato')).toBe(false)
  })
  it('NF por created_by', () => {
    expect(ehDono(u('ACORDOS'), { created_by: 1 }, 'nf')).toBe(true)
    expect(ehDono(u('ACORDOS'), { created_by: 2 }, 'nf')).toBe(false)
  })
})

describe('usuário ausente', () => {
  it('nega tudo', () => {
    expect(pode(null, 'orc.solicitacao.criar')).toBe(false)
    expect(pode(undefined, 'acordos.obras.hh.lancar', { ehDono: true })).toBe(false)
  })
})
