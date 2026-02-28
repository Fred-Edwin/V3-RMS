'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { ConnectionIndicator } from './ConnectionIndicator'
import type { ConnectionStatus } from './ConnectionIndicator'

interface TopBarProps {
  branchName: string
  connectionStatus: ConnectionStatus
  tone?: 'dark' | 'light'
  className?: string
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function TopBar({ branchName, connectionStatus, tone = 'dark', className }: TopBarProps) {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    setTime(formatClock(new Date()))
    const interval = setInterval(() => {
      setTime(formatClock(new Date()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header
      className={cn(
        'grid h-14 shrink-0 grid-cols-3 items-center px-6',
        tone === 'dark'
          ? 'border-b border-stone-700 bg-stone-900 text-crema'
          : 'border-b border-stone-200 bg-white text-stone-900 shadow-sm',
        className,
      )}
    >
      <span className={cn('truncate text-label-lg font-semibold', tone === 'dark' ? 'text-crema' : 'text-stone-900')}>
        {branchName}
      </span>
      <span
        className={cn(
          'text-center font-display text-heading-md tabular-nums',
          tone === 'dark' ? 'text-crema' : 'text-stone-900',
        )}
      >
        {time ?? '--:--:--'}
      </span>
      <div className="flex justify-end">
        <ConnectionIndicator
          status={connectionStatus}
          className={
            tone === 'dark'
              ? 'text-crema [&>span:not(.sr-only)]:text-crema [&_.bg-amber]:!bg-amber [&_.bg-green-500]:!bg-green-400'
              : 'text-stone-700 [&>span:not(.sr-only)]:text-stone-700'
          }
        />
      </div>
    </header>
  )
}
