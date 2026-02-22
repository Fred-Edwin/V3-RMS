'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

interface TimeElapsedProps {
  startTime: string | Date
  className?: string
}

function formatElapsed(startTime: string | Date): string {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime
  const elapsedMs = Date.now() - start.getTime()
  const totalSeconds = Math.floor(elapsedMs / 1000)

  if (totalSeconds < 60) return '< 1 min'

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

export function TimeElapsed({ startTime, className }: TimeElapsedProps) {
  const [display, setDisplay] = useState(() => formatElapsed(startTime))

  useEffect(() => {
    setDisplay(formatElapsed(startTime))
    const interval = setInterval(() => {
      setDisplay(formatElapsed(startTime))
    }, 30_000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <span aria-live="polite" className={cn('text-caption text-stone-500', className)}>
      {display}
    </span>
  )
}
