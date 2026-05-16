import { DashboardShell } from '@/components/layout/DashboardShell'

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Cadastros">{children}</DashboardShell>
}
