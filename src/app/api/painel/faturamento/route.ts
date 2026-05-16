import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MESES_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
type MesKey = typeof MESES_KEYS[number]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPrev(s: any, key: MesKey): number {
  return s[key] != null ? Number(s[key]) : 0
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })

  const userId = Number(session.user.id)
  const { searchParams } = req.nextUrl
  const ano = searchParams.get('ano') ? Number(searchParams.get('ano')) : new Date().getFullYear()

  const contratos = await prisma.contrato.findMany({
    where: {
      responsavel_id: userId,
      cancelled_at: null,
      ano_referencia: ano,
    },
    include: {
      cliente: { select: { id: true, nome: true } },
      subindices: {
        orderBy: { ordem: 'asc' },
        include: { notas_fiscais: { where: { ativa: true } } },
      },
    },
    orderBy: { indice: 'asc' },
  })

  const hoje = new Date()
  const mesAtual   = hoje.getMonth()                              // 0-11
  const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1
  const mesProximo  = mesAtual === 11 ? 0  : mesAtual + 1

  const contratosData = contratos.map((c) => {
    const meses = MESES_KEYS.map((key, mi) => {
      const prev = c.subindices.reduce((a, s) => a + getPrev(s, key), 0)
      const fat  = c.subindices.reduce((a, s) => {
        return a + s.notas_fiscais
          .filter((nf) => {
            const d = new Date(nf.data_emissao)
            return d.getFullYear() === ano && d.getMonth() === mi
          })
          .reduce((b, nf) => b + Number(nf.valor_atribuido), 0)
      }, 0)
      return { prev, fat }
    })

    const totalPrevAno = meses.reduce((a, m) => a + m.prev, 0)
    const totalFatAno  = meses.reduce((a, m) => a + m.fat,  0)

    return {
      id:            c.id,
      indice:        c.indice,
      cliente_nome:  c.cliente.nome,
      descricao:     c.descricao,
      classificacao: c.classificacao as string | null,
      status:        c.status as string,
      meses,
      total_prev_ano: totalPrevAno,
      total_fat_ano:  totalFatAno,
      a_faturar_ano:  totalPrevAno - totalFatAno,
    }
  })

  // Indicadores
  const prevMesAtual  = contratosData.reduce((a, c) => a + c.meses[mesAtual].prev,   0)
  const fatMesAtual   = contratosData.reduce((a, c) => a + c.meses[mesAtual].fat,    0)
  const fatUltimoMes  = contratosData.reduce((a, c) => a + c.meses[mesAnterior].fat, 0)
  const prevProxMes   = contratosData.reduce((a, c) => a + c.meses[mesProximo].prev,  0)
  const fatProxMes    = contratosData.reduce((a, c) => a + c.meses[mesProximo].fat,   0)

  return NextResponse.json({
    data: {
      indicadores: {
        previsto_mes_atual:    prevMesAtual,
        faturado_mes_atual:    fatMesAtual,
        a_faturar_mes_atual:   prevMesAtual - fatMesAtual,
        faturado_ultimo_mes:   fatUltimoMes,
        a_faturar_proximo_mes: prevProxMes - fatProxMes,
        previsto_proximo_mes:  prevProxMes,
      },
      mes_atual: mesAtual,
      ano,
      contratos: contratosData,
    },
    error: null,
  })
}
