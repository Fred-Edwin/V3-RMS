'use client'

import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Input } from './Input'

interface DateRangeBarProps {
  startDate: string
  endDate: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onRun: () => void
  isRunning?: boolean
  runLabel?: string
  runIcon?: React.ReactNode
  /** Extra actions rendered after the Run button (e.g. export menus) */
  children?: React.ReactNode
  className?: string
}

/** Standard start/end date + Run control cluster for report pages. */
export function DateRangeBar({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onRun,
  isRunning = false,
  runLabel = 'Run',
  runIcon,
  children,
  className,
}: DateRangeBarProps) {
  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      <Input label="Start Date" type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} />
      <Input label="End Date" type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} />
      <div className="flex items-end gap-2">
        <Button leftIcon={runIcon} onClick={onRun} isLoading={isRunning}>
          {runLabel}
        </Button>
        {children}
      </div>
    </div>
  )
}
