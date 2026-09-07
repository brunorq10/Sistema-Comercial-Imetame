import { DashboardShell } from '@/components/layout/DashboardShell'

export default function ExcecoesLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Painel de Exceções">{children}</DashboardShell>
}
