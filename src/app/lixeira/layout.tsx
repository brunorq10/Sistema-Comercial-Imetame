import { DashboardShell } from '@/components/layout/DashboardShell'

export default function LixeiraLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Lixeira">{children}</DashboardShell>
}
