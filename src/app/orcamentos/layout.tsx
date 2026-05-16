import { DashboardShell } from '@/components/layout/DashboardShell'

const TITLES: Record<string, string> = {
  solicitacoes: 'Solicitações de Orçamento',
  propostas: 'Propostas',
  painel: 'Meu Painel — Orçamentos',
  dashboard: 'Dashboard Comercial',
}

export default function OrcamentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell title="Orçamentos">{children}</DashboardShell>
}
