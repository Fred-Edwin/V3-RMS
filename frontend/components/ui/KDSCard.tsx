'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { ClaimButton } from '@/components/kitchen/ClaimButton'
import type { OrderType } from './OrderCard'

export interface KDSItem {
  quantity: number
  name: string
  notes?: string | null
}

export type TicketStatus = 'PENDING' | 'IN_PROGRESS' | 'READY'

interface KDSCardProps {
  orderNumber: number
  type: OrderType
  tableNumber?: string
  items: KDSItem[]
  specialInstructions?: string | null
  startTime: string | Date
  status: TicketStatus
  actionLabel: string
  isActionLoading?: boolean
  loadingMessage?: string
  onAction: () => void
  /** When provided on a PENDING ticket, renders an inline ClaimButton instead of the generic action button */
  staffOnShift?: Array<{ id: string; name: string }>
  onClaim?: (staffId: string) => void
  className?: string
}

// Full class strings — no interpolation
const ticketBorderClasses: Record<TicketStatus, string> = {
  PENDING: 'border-l-[#F0D080]',
  IN_PROGRESS: 'border-l-[#F5B87A]',
  READY: 'border-l-[#86EFAC]',
}

const typeLabels: Record<OrderType, string> = {
  DINE_IN: 'Dine-In',
  TAKE_AWAY: 'Take-Away',
  DELIVERY: 'Delivery',
}

function getElapsedMinutes(startTime: string | Date): number {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime
  return Math.floor((Date.now() - start.getTime()) / 60_000)
}

function getTimerClass(minutes: number): string {
  if (minutes >= 20) return 'text-[#991B1B]'
  if (minutes >= 10) return 'text-[#C4862A]'
  return 'text-stone-500'
}

export function KDSCard({
  orderNumber,
  type,
  tableNumber,
  items,
  specialInstructions,
  startTime,
  status,
  actionLabel,
  isActionLoading = false,
  loadingMessage = 'Updating ticket...',
  onAction,
  staffOnShift,
  onClaim,
  className,
}: KDSCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(() => getElapsedMinutes(startTime))

  useEffect(() => {
    setElapsedMinutes(getElapsedMinutes(startTime))
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(startTime))
    }, 30_000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <div
      className={cn(
        'flex min-h-[160px] flex-col rounded-md border border-stone-200 border-l-[4px] bg-white p-4 shadow-md',
        ticketBorderClasses[status],
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-heading-md font-semibold text-espresso">#{orderNumber}</span>
          <p className="text-label-md text-stone-700 mt-0.5">
            {typeLabels[type]}{tableNumber ? ` · Table ${tableNumber}` : ''}
          </p>
        </div>
        <span className={cn('text-label-sm tabular-nums shrink-0', getTimerClass(elapsedMinutes))}>
          {elapsedMinutes < 1 ? '< 1 min' : `${elapsedMinutes} min`}
        </span>
      </div>

      {/* Items */}
      <ul className="mt-2.5 flex-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-body-md text-stone-900">
            <span className="font-semibold">{item.quantity}×</span> {item.name}
            {item.notes && (
              <span className="text-label-sm text-stone-500 italic ml-1">({item.notes})</span>
            )}
          </li>
        ))}
      </ul>

      {/* Special instructions */}
      {specialInstructions && (
        <p className="mt-2.5 border-t border-stone-200 pt-2 text-body-sm italic text-stone-500">
          {specialInstructions}
        </p>
      )}

      {/* Action — only shown for PENDING and IN_PROGRESS tickets */}
      {status === 'PENDING' && staffOnShift && onClaim && (
        <ClaimButton
          staffOnShift={staffOnShift}
          isLoading={isActionLoading}
          onClaim={onClaim}
        />
      )}
      {status === 'PENDING' && (!staffOnShift || !onClaim) && (
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={onAction}
            isLoading={isActionLoading}
            className="mt-3 w-full"
          >
            {actionLabel}
          </Button>
          {isActionLoading && (
            <p className="mt-2 text-center text-caption text-stone-500">{loadingMessage}</p>
          )}
        </>
      )}
      {status === 'IN_PROGRESS' && (
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={onAction}
            isLoading={isActionLoading}
            className="mt-3 w-full"
          >
            {actionLabel}
          </Button>
          {isActionLoading && (
            <p className="mt-2 text-center text-caption text-stone-500">{loadingMessage}</p>
          )}
        </>
      )}
    </div>
  )
}
