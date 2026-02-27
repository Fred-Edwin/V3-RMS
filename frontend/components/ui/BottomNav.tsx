'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Ellipsis } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BottomSheet } from './BottomSheet'

export interface NavTab {
  label: string
  href: string
  icon: React.ElementType
}

interface BottomNavProps {
  tabs: NavTab[]
  activeHref: string
  className?: string
  overflowTabs?: NavTab[]
  moreLabel?: string
}

const isTabActive = (activeHref: string, href: string): boolean => {
  return activeHref === href || activeHref.startsWith(`${href}/`)
}

export function BottomNav({
  tabs,
  activeHref,
  className,
  overflowTabs = [],
  moreLabel = 'More',
}: BottomNavProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const hasOverflowTabs = overflowTabs.length > 0
  const isMoreActive = useMemo(
    () => overflowTabs.some((tab) => isTabActive(activeHref, tab.href)),
    [activeHref, overflowTabs]
  )

  useEffect(() => {
    setIsMoreOpen(false)
  }, [activeHref])

  return (
    <>
      <nav
        className={cn('h-16 bg-white border-t border-stone-200 flex', className)}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => {
          const isActive = isTabActive(activeHref, tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-fast',
                isActive ? 'text-espresso' : 'text-stone-400'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-amber rounded-b-full" />
              )}
              <span className={cn(
                'flex items-center justify-center rounded-full transition-colors duration-fast',
                isActive ? 'bg-espresso/10 px-3 py-1' : 'px-3 py-1'
              )}>
                <Icon size={22} className="shrink-0" />
              </span>
              <span className="max-w-full truncate text-caption font-medium">
                {tab.label}
              </span>
            </Link>
          )
        })}

        {hasOverflowTabs ? (
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-fast',
              isMoreActive ? 'text-espresso' : 'text-stone-400'
            )}
            aria-label={moreLabel}
            aria-expanded={isMoreOpen}
            aria-haspopup="dialog"
          >
            {isMoreActive && (
              <span className="absolute top-0 left-0 right-0 h-0.5 bg-amber rounded-b-full" />
            )}
            <span className={cn(
              'flex items-center justify-center rounded-full transition-colors duration-fast',
              isMoreActive ? 'bg-espresso/10 px-3 py-1' : 'px-3 py-1'
            )}>
              <Ellipsis size={22} className="shrink-0" />
            </span>
            <span className="max-w-full truncate text-caption font-medium">
              {moreLabel}
            </span>
          </button>
        ) : null}
      </nav>

      {hasOverflowTabs ? (
        <BottomSheet
          isOpen={isMoreOpen}
          onClose={() => setIsMoreOpen(false)}
          title={moreLabel}
        >
          <div className="space-y-2">
            {overflowTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = isTabActive(activeHref, tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex min-h-[44px] items-center gap-3 rounded-md border px-3 py-2 text-label-md transition-colors duration-fast',
                    isActive
                      ? 'border-espresso bg-[#FDF3DC] text-espresso'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                  )}
                >
                  <Icon size={18} className={cn(isActive ? 'text-espresso' : 'text-stone-500')} />
                  <span>{tab.label}</span>
                </Link>
              )
            })}
          </div>
        </BottomSheet>
      ) : null}
    </>
  )
}
