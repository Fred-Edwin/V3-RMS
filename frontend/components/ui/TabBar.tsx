'use client'

import { cn } from '@/lib/cn'

export interface TabBarProps<T extends string> {
  tabs: ReadonlyArray<{ value: T; label: string }>
  active: T
  onChange: (value: T) => void
  /** `underline` — border-bottom strip; `segmented` — pill switcher on a track */
  variant?: 'underline' | 'segmented'
  className?: string
}

/**
 * Standard tab switcher. Replaces the hand-rolled tab strips on dashboard
 * pages — do not rebuild these button rows inline.
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  variant = 'underline',
  className,
}: TabBarProps<T>) {
  if (variant === 'segmented') {
    return (
      <div className={cn('flex w-fit gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'rounded-md px-4 py-1.5 text-label-md font-medium transition-colors duration-fast',
              active === tab.value
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('border-b border-stone-200', className)}>
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'shrink-0 border-b-2 px-4 py-2.5 text-label-sm font-medium transition-colors',
              active === tab.value
                ? 'border-espresso text-espresso'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
