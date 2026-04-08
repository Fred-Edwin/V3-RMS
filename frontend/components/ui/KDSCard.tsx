'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { ClaimButton } from '@/components/kitchen/ClaimButton'
import { ClaimTicketSheet } from '@/components/kitchen/ClaimTicketSheet'
import type { OrderType } from './OrderCard'
import type { PrepStation } from '@/types/order'

export interface KDSItem {
  quantity: number
  name: string
  notes?: string | null
}

export type TicketStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED'

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
  /** Name of the waiter who placed the order */
  placedBy?: string
  /** Name of the staff member currently working the ticket */
  claimedByName?: string
  /** Personal phone flow: renders an inline ClaimButton instead of tablet picker */
  staffOnShift?: Array<{ id: string; name: string }>
  onClaim?: (staffId: string) => void
  /** Tablet display flow: enables the inline claim picker overlay */
  station?: PrepStation
  staffOnShiftForPicker?: Array<{ id: string; name: string; inProgressCount: number }>
  pickerHelperText?: string
  claimingStaffId?: string | null
  onTabletClaim?: (staffId: string) => void
  onReject?: () => void
  onUnclaim?: () => void
  claimedAt?: string | null
  className?: string
}

// Full class strings — no interpolation
const ticketBorderClasses: Record<TicketStatus, string> = {
  PENDING: 'border-l-[#F0D080]',
  IN_PROGRESS: 'border-l-[#F5B87A]',
  READY: 'border-l-[#86EFAC]',
  REJECTED: 'border-l-[#FCA5A5]',
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
  placedBy,
  claimedByName,
  staffOnShift,
  onClaim,
  station,
  staffOnShiftForPicker,
  pickerHelperText,
  claimingStaffId,
  onTabletClaim,
  onReject,
  onUnclaim,
  claimedAt,
  className,
}: KDSCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(() => getElapsedMinutes(startTime))
  // Tracks whether the inline claim picker is open on this card (tablet flow only)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setElapsedMinutes(getElapsedMinutes(startTime))
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(startTime))
    }, 30_000)
    return () => clearInterval(interval)
  }, [startTime])

  // Close the picker if the ticket is no longer pending (claimed by someone else)
  useEffect(() => {
    if (status !== 'PENDING') {
      setPickerOpen(false)
    }
  }, [status])

  const isTabletClaimFlow = Boolean(station && staffOnShiftForPicker && onTabletClaim)
  const isBeingClaimed = Boolean(claimingStaffId)

  return (
    <div
      className={cn(
        'flex min-h-[160px] flex-col rounded-md border border-stone-200 border-l-[4px] bg-white p-4 shadow-md',
        ticketBorderClasses[status],
        className
      )}
    >
      {/* Header — always visible */}
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

      {/* Accountability row */}
      {(placedBy || claimedByName) && (
        <div className="mt-1.5 flex items-center gap-3 text-label-sm">
          {placedBy && (
            <span className="flex items-center gap-1 text-stone-500">
              <span className="text-stone-400">by</span>
              <span className="font-medium text-stone-700">{placedBy}</span>
            </span>
          )}
          {claimedByName && status === 'IN_PROGRESS' && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
              <span className="size-1.5 rounded-full bg-amber-400 inline-block" />
              {claimedByName}
            </span>
          )}
          {claimedByName && status === 'READY' && (
            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-800">
              <span className="size-1.5 rounded-full bg-green-400 inline-block" />
              {claimedByName}
            </span>
          )}
        </div>
      )}

      {pickerOpen && isTabletClaimFlow ? (
        /*
         * CLAIM PICKER MODE — replaces items + action with the staff grid.
         * The card stays at its same position; only its body swaps.
         * A thin divider separates the header (order info) from the picker.
         */
        <div className="mt-3 border-t border-stone-100 pt-3">
          <ClaimTicketSheet
            station={station!}
            staffOnShift={staffOnShiftForPicker!}
            helperText={pickerHelperText}
            isSubmitting={isBeingClaimed}
            claimingStaffId={claimingStaffId ?? null}
            onClaim={(staffId) => {
              onTabletClaim!(staffId)
              // Sheet stays open with spinner until the parent closes it via
              // status change (PENDING → IN_PROGRESS triggers the useEffect above)
            }}
            onCancel={() => setPickerOpen(false)}
          />
        </div>
      ) : (
        <>
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

          {/* ── PENDING actions ── */}

          {/* Tablet display: "Claim" opens the inline picker */}
          {status === 'PENDING' && isTabletClaimFlow && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setPickerOpen(true)}
              isLoading={isActionLoading}
              className="mt-3 w-full"
            >
              Claim
            </Button>
          )}

          {/* Personal phone flow: inline ClaimButton (split button / direct claim) */}
          {status === 'PENDING' && staffOnShift && onClaim && (
            <ClaimButton
              staffOnShift={staffOnShift}
              isLoading={isActionLoading}
              onClaim={onClaim}
            />
          )}

          {/* Fallback generic button when no staff props are provided */}
          {status === 'PENDING' && !isTabletClaimFlow && (!staffOnShift || !onClaim) && (
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

          {/* Reject button for pending tickets (personal phone) */}
          {status === 'PENDING' && onReject && !isTabletClaimFlow && (
            <Button variant="destructive" size="sm" onClick={onReject} className="mt-2 w-full">
              Reject
            </Button>
          )}

          {/* ── IN_PROGRESS actions ── */}
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
              <div className="mt-2 flex gap-2">
                {onUnclaim && claimedAt && (Date.now() - new Date(claimedAt).getTime() < 2 * 60 * 1000) && (
                  <Button variant="secondary" size="sm" onClick={onUnclaim} className="flex-1">
                    Unclaim
                  </Button>
                )}
                {onReject && (
                  <Button variant="destructive" size="sm" onClick={onReject} className="flex-1">
                    Reject
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
