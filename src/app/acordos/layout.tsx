import { DashboardShell } from '@/components/layout/DashboardShell'

export default function AcordosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell title="Acordos">{children}</DashboardShell>
}
