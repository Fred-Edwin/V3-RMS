'use client'

import { cn } from '@/lib/cn'
import { useUiStore } from '@/store/uiStore'

interface MobileLayoutProps {
  children: React.ReactNode
  bottomNav?: React.ReactNode
  className?: string
}

export function MobileLayout({ children, bottomNav, className }: MobileLayoutProps) {
  const hideBottomNav = useUiStore((s) => s.hideBottomNav)
  const showNav = bottomNav && !hideBottomNav

  return (
    <div className={cn('min-h-screen flex flex-col bg-crema', className)}>
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: showNav ? 'calc(64px + env(safe-area-inset-bottom))' : undefined }}
      >
        {children}
      </main>

      {showNav && (
        <div className="fixed bottom-0 left-0 right-0 z-40 print:hidden">
          {bottomNav}
        </div>
      )}
    </div>
  )
}
