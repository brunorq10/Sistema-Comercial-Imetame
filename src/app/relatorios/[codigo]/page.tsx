'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { REPORT_REGISTRY } from '@/components/relatorios/reportRegistry'

export default function RelatorioAbertoPage() {
  const params = useParams<{ codigo: string }>()
  const Componente = REPORT_REGISTRY[params.codigo]

  if (!Componente) {
    return (
      <div className="p-4">
        <Link href="/relatorios" className="text-[12px] text-green-primary hover:text-green-dark font-semibold">← Voltar à biblioteca</Link>
        <p className="text-center text-gray-400 py-14 text-sm">Relatório não encontrado.</p>
      </div>
    )
  }

  return <Componente />
}
