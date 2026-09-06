import { DashboardShell } from '@/components/layout/DashboardShell'

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Relatórios">{children}</DashboardShell>
}
