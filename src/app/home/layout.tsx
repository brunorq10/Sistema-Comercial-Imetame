import { DashboardShell } from '@/components/layout/DashboardShell'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Início">{children}</DashboardShell>
}
