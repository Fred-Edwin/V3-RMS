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
  itemLabel: string
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

// Ticket status row background and text colours — warm semantic palette
const ticketRowClasses: Record<'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED', string> = {
  PENDING:     'bg-[#FDF3DC] text-[#92650A]',
  IN_PROGRESS: 'bg-[#FEF0E0] text-[#A04F0A]',
  READY:       'bg-[#EDFAF1] text-[#1A6B3C]',
  REJECTED:    'bg-[#FDF2F0] text-[#9B3A2A]',
}

const ticketStatusLabel: Record<'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED', string> = {
  PENDING:     'Pending',
  IN_PROGRESS: 'In Progress',
  READY:       'Ready',
  REJECTED:    'Rejected',
}

export function OrderCard({ orderNumber, status, type, tableNumber, startTime, placedBy, prepTickets, hasRejectedTickets, onTap, className }: OrderCardProps) {
  // Filter out REJECTED tickets unless all are rejected (avoids cluttering the view with noise)
  const visibleTickets = prepTickets
    ? prepTickets.filter((t) => t.status !== 'REJECTED')
    : []
  const allRejected = prepTickets && prepTickets.length > 0 && visibleTickets.length === 0
  const displayTickets = allRejected ? (prepTickets ?? []) : visibleTickets

  return (
    <div
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } } : undefined}
      className={cn(
        'bg-white border-l-[3px] shadow-sm rounded-xl p-4',
        hasRejectedTickets ? 'border-l-[#F5A898]' : statusBorderClasses[status],
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
          <span className="text-caption text-[#9B3A2A] font-medium bg-[#FDF2F0] px-2 py-0.5 rounded-full border border-[#F5A898] flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#F5A898] rounded-full animate-pulse" />
            Action Required
          </span>
        )}
      </div>

      {/* Per-item prep status rows */}
      {displayTickets.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {displayTickets.map((ticket) => (
            <div
              key={ticket.station + ticket.itemLabel}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5',
                ticketRowClasses[ticket.status],
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('shrink-0 size-1.5 rounded-full', ticketStatusDot[ticket.status])} />
                <span className="text-label-sm font-medium truncate">
                  {ticket.itemLabel || stationLabels[ticket.station]}
                </span>
                <span className="shrink-0 text-caption opacity-60">
                  · {stationLabels[ticket.station]}
                </span>
              </div>
              <span className="shrink-0 text-caption font-medium">
                {ticket.claimedBy ? ticket.claimedBy.name : ticketStatusLabel[ticket.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
