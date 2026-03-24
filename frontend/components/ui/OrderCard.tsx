'use client'

import { cn } from '@/lib/cn'
import { Badge } from './Badge'
import { TimeElapsed } from './TimeElapsed'
import type { BadgeVariant } from './Badge'

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CLOSED' | 'CANCELLED'
export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY'

interface PrepTicketStaff {
  station: 'KITCHEN' | 'BARISTA' | 'PIZZA' | 'PASTRY'
  claimedBy: { id: string; name: string } | null
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED'
}

interface OrderCardProps {
  orderNumber: number
  status: OrderStatus
  type: OrderType
  tableNumber?: string
  startTime: string | Date
  placedBy?: string
  prepTickets?: PrepTicketStaff[]
  hasRejectedTickets?: boolean
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

const stationLabels: Record<'KITCHEN' | 'BARISTA' | 'PIZZA' | 'PASTRY', string> = {
  KITCHEN: 'Kitchen',
  BARISTA: 'Barista',
  PIZZA: 'Pizza',
  PASTRY: 'Pastry',
}

const ticketStatusDot: Record<'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED', string> = {
  PENDING: 'bg-[#F0D080]',
  IN_PROGRESS: 'bg-[#F5B87A]',
  READY: 'bg-[#86EFAC]',
  REJECTED: 'bg-red-400',
}

export function OrderCard({ orderNumber, status, type, tableNumber, startTime, placedBy, prepTickets, hasRejectedTickets, onTap, className }: OrderCardProps) {
  // Deduplicate: show only the latest ticket per station
  const latestPerStation = prepTickets
    ? Object.values(
        prepTickets.reduce<Record<string, PrepTicketStaff>>((acc, t) => {
          acc[t.station] = t
          return acc
        }, {}),
      )
    : []

  return (
    <div
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } } : undefined}
      className={cn(
        'bg-white border-l-[3px] shadow-sm rounded-xl p-4',
        hasRejectedTickets ? 'border-l-red-500' : statusBorderClasses[status],
        onTap && 'cursor-pointer hover:shadow-md transition-shadow duration-fast focus-visible:outline-none focus-visible:shadow-focus',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-heading-md font-bold text-espresso">#{orderNumber}</span>
          <p className="text-label-sm text-stone-500 mt-0.5">
            {typeLabels[type]}{tableNumber ? ` · Table ${tableNumber}` : ''}
          </p>
        </div>
        <TimeElapsed startTime={startTime} />
      </div>

      {/* Placed by */}
      {placedBy && (
        <p className="mt-1 text-label-sm text-stone-400">
          by <span className="font-medium text-stone-600">{placedBy}</span>
        </p>
      )}

      <div className="flex items-center justify-between mt-3">
        <Badge variant={statusToBadgeVariant[status]} />
        {hasRejectedTickets && (
          <span className="text-caption text-red-600 font-medium tracking-tight bg-red-50 px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            Action Required
          </span>
        )}
      </div>

      {/* Prep staff summary */}
      {latestPerStation.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {latestPerStation.map((ticket) => (
            <span
              key={ticket.station}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-100 bg-stone-50 px-2.5 py-0.5 text-label-sm text-stone-600"
            >
              <span className={cn('size-1.5 rounded-full', ticketStatusDot[ticket.status])} />
              <span className="text-stone-400">{stationLabels[ticket.station]}:</span>
              <span className="font-medium">
                {ticket.claimedBy ? ticket.claimedBy.name : '—'}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
