'use client'

import { cn } from '@/lib/cn'
import { Badge } from './Badge'
import { TimeElapsed } from './TimeElapsed'
import type { BadgeVariant } from './Badge'

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CLOSED' | 'CANCELLED'
export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY'

interface OrderCardProps {
  orderNumber: number
  status: OrderStatus
  type: OrderType
  tableNumber?: string
  startTime: string | Date
  onTap?: () => void
  className?: string
}

// Full class strings — no interpolation
const statusBorderClasses: Record<OrderStatus, string> = {
  PENDING: 'border-l-[#F0D080]',
  IN_PROGRESS: 'border-l-[#F5B87A]',
  READY: 'border-l-[#86EFAC]',
  CLOSED: 'border-l-stone-300',
  CANCELLED: 'border-l-[#F5A898]',
}

const statusToBadgeVariant: Record<OrderStatus, BadgeVariant> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inprogress',
  READY: 'ready',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
}

const typeLabels: Record<OrderType, string> = {
  DINE_IN: 'Dine-In',
  TAKE_AWAY: 'Take-Away',
  DELIVERY: 'Delivery',
}

export function OrderCard({ orderNumber, status, type, tableNumber, startTime, onTap, className }: OrderCardProps) {
  return (
    <div
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } } : undefined}
      className={cn(
        'bg-white border border-stone-200 border-l-[3px] shadow-sm rounded-md p-4',
        statusBorderClasses[status],
        onTap && 'cursor-pointer hover:shadow-md transition-shadow duration-fast focus-visible:outline-none focus-visible:shadow-focus',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-heading-sm font-semibold text-espresso">#{orderNumber}</span>
          <p className="text-label-sm text-stone-500 mt-0.5">
            {typeLabels[type]}{tableNumber ? ` · Table ${tableNumber}` : ''}
          </p>
        </div>
        <TimeElapsed startTime={startTime} />
      </div>

      <div className="flex items-center justify-between mt-3">
        <Badge variant={statusToBadgeVariant[status]} />
      </div>
    </div>
  )
}
