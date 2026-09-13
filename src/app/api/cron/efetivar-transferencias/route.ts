import { NextRequest, NextResponse } from 'next/server'
import { efetivarTransferenciasVencidas } from '@/lib/substituicoes'

// GET /api/cron/efetivar-transferencias — chamado 1x/dia pelo Vercel Cron
// (vercel.json). Efetiva as transferências/trocas "agendadas" cuja
// data_efetivacao já chegou. Protegido pelo CRON_SECRET quando configurado
// (mesma convenção do Vercel Cron: header Authorization: Bearer <secret>).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ data: null, error: 'Não autorizado' }, { status: 401 })
    }
  }
  const efetivadas = await efetivarTransferenciasVencidas()
  return NextResponse.json({ data: { efetivadas }, error: null })
}
