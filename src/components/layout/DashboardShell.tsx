import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

interface DashboardShellProps {
  children: React.ReactNode
  title: string
}

export async function DashboardShell({ children, title }: DashboardShellProps) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar title={title} />
        <main className="flex-1 overflow-hidden bg-[#F0F0F0]">
          {children}
        </main>
      </div>
    </div>
  )
}
