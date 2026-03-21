'use client'

import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ConnectionIndicator } from './ConnectionIndicator'
import type { ConnectionStatus } from './ConnectionIndicator'

interface TopBarProps {
  branchName: string
  stationLabel?: string
  connectionStatus: ConnectionStatus
  tone?: 'dark' | 'light'
  className?: string
  onLogout?: () => void
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function TopBar({ branchName, stationLabel, connectionStatus, tone = 'dark', className, onLogout }: TopBarProps) {
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
      <div className="truncate">
        <span className={cn('text-label-lg font-semibold', tone === 'dark' ? 'text-crema' : 'text-stone-900')}>
          {branchName}
        </span>
        {stationLabel && (
          <span className={cn('ml-2 text-label-sm', tone === 'dark' ? 'text-crema/60' : 'text-stone-500')}>
            {stationLabel}
          </span>
        )}
      </div>
      <span
        className={cn(
          'text-center font-display text-heading-md tabular-nums',
          tone === 'dark' ? 'text-crema' : 'text-stone-900',
        )}
      >
        {time ?? '--:--:--'}
      </span>
      <div className="flex items-center justify-end gap-3">
        <ConnectionIndicator
          status={connectionStatus}
          className={
            tone === 'dark'
              ? 'text-crema [&>span:not(.sr-only)]:text-crema [&_.bg-amber]:!bg-amber [&_.bg-green-500]:!bg-green-400'
              : 'text-stone-700 [&>span:not(.sr-only)]:text-stone-700'
          }
        />
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            className={cn(
              'rounded p-1.5 transition-colors',
              tone === 'dark'
                ? 'text-crema/60 hover:bg-stone-700 hover:text-crema'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900',
            )}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  )
}
