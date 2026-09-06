'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { ComercialTerritorio } from '@/components/relatorios/ComercialTerritorio'
import { ClientesTerritorio } from '@/components/relatorios/ClientesTerritorio'
import { FaturamentoTerritorio } from '@/components/relatorios/FaturamentoTerritorio'
import { ContratosTerritorio } from '@/components/relatorios/ContratosTerritorio'
import { OcorrenciasTerritorio } from '@/components/relatorios/OcorrenciasTerritorio'
import { CruzamentoTerritorio } from '@/components/relatorios/CruzamentoTerritorio'
import { GestaoTerritorio } from '@/components/relatorios/GestaoTerritorio'

type Territorio = 'comercial' | 'clientes' | 'faturamento' | 'contratos' | 'ocorrencias' | 'cruzamento' | 'gestao'

const TERRITORIOS: { key: Territorio; label: string }[] = [
  { key: 'comercial',    label: 'Comercial' },
  { key: 'clientes',     label: 'Clientes' },
  { key: 'faturamento',  label: 'Faturamento' },
  { key: 'contratos',    label: 'Contratos & Execução' },
  { key: 'ocorrencias',  label: 'Ocorrências & Multas' },
  { key: 'cruzamento',   label: 'Comercial × Acordos' },
  { key: 'gestao',       label: 'Gestão & Capacidade' },
]

export default function RelatoriosPage() {
  const [aba, setAba] = useState<Territorio>('comercial')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 p-4 pb-0">
        <PageHeader
          title="Relatórios"
          subtitle="Biblioteca de análises prontas — Comercial e Acordos. Substitui o antigo Construtor de Relatórios."
        />
        <DashboardTabs tabs={TERRITORIOS} active={aba} onChange={setAba} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {aba === 'comercial' && <ComercialTerritorio />}
        {aba === 'clientes' && <ClientesTerritorio />}
        {aba === 'faturamento' && <FaturamentoTerritorio />}
        {aba === 'contratos' && <ContratosTerritorio />}
        {aba === 'ocorrencias' && <OcorrenciasTerritorio />}
        {aba === 'cruzamento' && <CruzamentoTerritorio />}
        {aba === 'gestao' && <GestaoTerritorio />}
      </div>
    </div>
  )
}
