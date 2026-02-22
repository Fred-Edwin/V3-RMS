'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'

export interface NavTab {
  label: string
  href: string
  icon: React.ElementType
}

interface BottomNavProps {
  tabs: NavTab[]
  activeHref: string
  className?: string
}

export function BottomNav({ tabs, activeHref, className }: BottomNavProps) {
  return (
    <nav
      className={cn('h-16 bg-white border-t border-stone-200 flex', className)}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const isActive = activeHref === tab.href || activeHref.startsWith(tab.href + '/')
        const Icon = tab.icon

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 relative min-h-[44px] transition-colors duration-fast',
              isActive ? 'text-espresso' : 'text-stone-400'
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-0.5 bg-amber rounded-b-full" />
            )}
            <Icon size={22} className="shrink-0" />
            <span className="text-caption font-medium">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
