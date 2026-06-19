import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ShellFrame } from '@/components/layout/ShellFrame'

interface DashboardShellProps {
  children: React.ReactNode
  title: string
}

export async function DashboardShell({ children, title }: DashboardShellProps) {
  const session = await auth()
  if (!session) redirect('/login')

  return <ShellFrame title={title}>{children}</ShellFrame>
}
