'use client'

import { cn } from '@/lib/cn'

interface MobileLayoutProps {
  children: React.ReactNode
  bottomNav?: React.ReactNode
  className?: string
}

export function MobileLayout({ children, bottomNav, className }: MobileLayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col bg-crema', className)}>
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: bottomNav ? 'calc(64px + env(safe-area-inset-bottom))' : undefined }}
      >
        {children}
      </main>

      {bottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          {bottomNav}
        </div>
      )}
    </div>
  )
}
