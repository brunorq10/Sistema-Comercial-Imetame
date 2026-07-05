import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// HH/dia padrão usado nos adicionais (mesma constante da tela de detalhe da parada)
const HH_DIA = 8.8
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

// ── GET: resumo agregável de todas as Paradas (cálculo por contrato) ──────────
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const contratos = await prisma.contrato.findMany({
    where: { cancelled_at: null, classificacao: 'PARADAS' },
    orderBy: { indice: 'asc' },
    include: {
      cliente:       { select: { id: true, nome: true, ramo_atuacao: true } },
      cliente_final: { select: { id: true, nome: true } },
      responsavel:   { select: { id: true, nome: true } },
      parada_hh_config: { include: { dias: true } },
      subindices:    { where: { deleted_at: null }, include: { notas_fiscais: { where: { ativa: true, deleted_at: null } } } },
    },
  })

  const data = contratos.map((c) => {
    const cfg = c.parada_hh_config
    const dias = cfg?.dias ?? []

    const somaEtapa = (etapa: 'PREPARATIVO' | 'PARADA' | 'ACOMP_DESMOB') => {
      let prev = 0, real = 0
      for (const d of dias) {
        if (d.etapa !== etapa) continue
        prev += Number(d.hh_plan ?? 0)
        real += Number(d.hh_real ?? 0)
      }
      return { prev, real }
    }
    const prep = somaEtapa('PREPARATIVO')
    const parada = somaEtapa('PARADA')
    const acomp = somaEtapa('ACOMP_DESMOB')

    // Pico de efetivo da etapa Parada (base dos adicionais)
    let picoPrev = 0, picoReal = 0
    for (const d of dias) {
      if (d.etapa !== 'PARADA') continue
      picoPrev = Math.max(picoPrev, Number(d.efetivo_plan ?? 0))
      picoReal = Math.max(picoReal, Number(d.efetivo_real ?? 0))
    }

    const num = (v: unknown) => Number(v ?? 0)
    const calc = (ativo: boolean | undefined, pico: number, qtdDias: unknown) =>
      ativo ? pico * num(qtdDias) * HH_DIA : 0
    const mob = { prev: calc(cfg?.mob_ativo, picoPrev, cfg?.mob_dias_prev), real: calc(cfg?.mob_ativo, picoReal, cfg?.mob_dias_real) }
    const integ = { prev: calc(cfg?.integ_ativo, picoPrev, cfg?.integ_dias_prev), real: calc(cfg?.integ_ativo, picoReal, cfg?.integ_dias_real) }
    const desmob = { prev: calc(cfg?.desmob_ativo, picoPrev, cfg?.desmob_dias_prev), real: calc(cfg?.desmob_ativo, picoReal, cfg?.desmob_dias_real) }
    const folga = {
      prev: cfg?.folga_ativo ? num(cfg.folga_pessoas_prev) * num(cfg.folga_dias_prev) * HH_DIA : 0,
      real: cfg?.folga_ativo ? num(cfg.folga_pessoas_real) * num(cfg.folga_dias_real) * HH_DIA : 0,
    }

    const fases = { mob, integ, prep, parada, acomp, desmob, folga }
    const hhPrev = mob.prev + integ.prev + prep.prev + parada.prev + acomp.prev + desmob.prev + folga.prev
    const hhReal = mob.real + integ.real + prep.real + parada.real + acomp.real + desmob.real + folga.real

    // Série mensal: dias têm data própria; adicionais são alocados às datas-base da config
    const mesesMap = new Map<string, { ano: number; mes: number; prev: number; real: number }>()
    const bucket = (date: Date | null | undefined, prev: number, real: number) => {
      if (!date || (prev === 0 && real === 0)) return
      const ano = date.getUTCFullYear(), mes = date.getUTCMonth()
      const k = `${ano}-${mes}`
      if (!mesesMap.has(k)) mesesMap.set(k, { ano, mes, prev: 0, real: 0 })
      const e = mesesMap.get(k)!
      e.prev += prev; e.real += real
    }
    for (const d of dias) bucket(d.data, Number(d.hh_plan ?? 0), Number(d.hh_real ?? 0))
    const refIni = cfg?.parada_inicio ?? cfg?.prep_inicio ?? cfg?.acomp_inicio ?? null
    const refFim = cfg?.parada_fim ?? cfg?.acomp_fim ?? cfg?.parada_inicio ?? null
    bucket(refIni, mob.prev, mob.real)
    bucket(refIni, integ.prev, integ.real)
    bucket(refIni, folga.prev, folga.real)
    bucket(refFim, desmob.prev, desmob.real)
    const meses = Array.from(mesesMap.values())

    // Financeiro
    const valorOrcado = c.subindices.reduce((acc, s) =>
      acc + MESES.reduce((b, m) => b + Number((s as Record<string, unknown>)[m] ?? 0), 0), 0)
    const valorFaturado = c.subindices.reduce((acc, s) =>
      acc + s.notas_fiscais.reduce((b, nf) => b + Number(nf.valor_atribuido), 0), 0)
    const ase = num(cfg?.fin_prev_ase)

    return {
      id: c.id, indice: c.indice, num_os: c.num_os, ano_referencia: c.ano_referencia,
      cliente: c.cliente, cliente_final: c.cliente_final ?? null,
      responsavel: c.responsavel, descricao: c.descricao,
      fases, hh_prev: hhPrev, hh_real: hhReal, meses,
      valor_orcado: valorOrcado, valor_faturado: valorFaturado, ase,
    }
  })

  return NextResponse.json({ data, error: null })
}
