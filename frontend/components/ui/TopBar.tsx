'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { ConnectionIndicator } from './ConnectionIndicator'
import type { ConnectionStatus } from './ConnectionIndicator'

interface TopBarProps {
  branchName: string
  connectionStatus: ConnectionStatus
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

export function TopBar({ branchName, connectionStatus, className }: TopBarProps) {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    setTime(formatClock(new Date()))
    const interval = setInterval(() => {
      setTime(formatClock(new Date()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className={cn('h-14 bg-stone-900 text-crema grid grid-cols-3 items-center px-6 border-b border-stone-700 shrink-0', className)}>
      <span className="text-label-lg font-semibold text-crema truncate">{branchName}</span>
      <span className="text-heading-md font-display text-crema text-center tabular-nums">{time ?? '--:--:--'}</span>
      <div className="flex justify-end">
        <ConnectionIndicator
          status={connectionStatus}
          className="text-crema [&>span:not(.sr-only)]:text-crema [&_.bg-amber]:!bg-amber [&_.bg-green-500]:!bg-green-400"
        />
      </div>
    </header>
  )
}
