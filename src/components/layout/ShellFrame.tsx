'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

interface ShellFrameProps {
  children: React.ReactNode
  title: string
}

export function ShellFrame({ children, title }: ShellFrameProps) {
  // Drawer mobile (abaixo de lg)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Trilha recolhida no desktop (lg+) — persistente, só muda pelo hambúrguer
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="relative flex h-screen overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar
          title={title}
          onMenuClick={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          collapsed={collapsed}
        />
        <main className="isolate flex-1 overflow-auto bg-[#F0F0F0]">
          {children}
        </main>
      </div>
    </div>
  )
}
