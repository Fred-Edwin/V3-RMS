'use client';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui';
import { Check } from 'lucide-react';
import type { PrepStation } from '@/types/order';

const MAX_IN_PROGRESS = 3;

interface ClaimPickerProps {
  station: PrepStation;
  staffOnShift: Array<{ id: string; name: string; inProgressCount: number }>;
  helperText?: string;
  isSubmitting?: boolean;
  claimingStaffId?: string | null;
  onClaim: (claimedById: string) => void;
  onCancel: () => void;
}

/**
 * Inline claim picker — replaces the card body when "Claim" is tapped on the
 * shared KDS/BDS tablet display.
 *
 * Design: a compact pre-expanded dropdown list of staff names. The list is
 * immediately visible — no extra tap required to open it. Tapping a row fires
 * the claim instantly. A thin header shows context and a cancel control.
 *
 * Interaction:
 *   Tap "Claim" on card  →  picker slides in (animate-fade-up)
 *   Tap a staff row      →  that row shows a spinner; others dim
 *   API resolves         →  card transitions to IN_PROGRESS, picker closes
 *   Tap × or outside     →  picker closes, card returns to normal view
 */
export function ClaimTicketSheet({
  station,
  staffOnShift,
  helperText,
  isSubmitting = false,
  claimingStaffId = null,
  onClaim,
  onCancel,
}: ClaimPickerProps) {
  const stationLabel = station === 'KITCHEN' ? 'Kitchen' : 'Barista';

  return (
    <div className="animate-fade-up">
      {/* ── Header ── */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-label-sm font-semibold uppercase tracking-wide text-stone-400">
          Select {stationLabel.toLowerCase()} staff
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Cancel"
          className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-40"
        >
          {/* Inline × — avoids importing an icon for a single glyph */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Staff list ── */}
      {staffOnShift.length === 0 ? (
        <p className="py-3 text-center text-body-sm text-stone-400">
          No {stationLabel.toLowerCase()} staff on shift.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
          {staffOnShift.map((staff, index) => {
            const isClaiming = claimingStaffId === staff.id;
            const atCapacity = staff.inProgressCount >= MAX_IN_PROGRESS;
            const isDisabled = isSubmitting || atCapacity;
            const isLast = index === staffOnShift.length - 1;

            return (
              <button
                key={staff.id}
                type="button"
                disabled={isDisabled}
                title={atCapacity ? `${staff.name.split(' ')[0]} has 3 tickets in progress` : undefined}
                onClick={() => onClaim(staff.id)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-100',
                  !isLast && 'border-b border-stone-100',
                  !isDisabled && 'hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400',
                  isClaiming && 'bg-[#F8F4EF]',
                  isDisabled && !isClaiming && 'cursor-not-allowed opacity-50',
                )}
              >
                {/* Staff name */}
                <span
                  className={cn(
                    'text-body-md font-medium',
                    isClaiming ? 'text-espresso' : atCapacity ? 'text-stone-400' : 'text-stone-800',
                  )}
                >
                  {staff.name}
                </span>

                {/* Right side: load badge + spinner / checkmark */}
                <span className="ml-3 flex shrink-0 items-center gap-2">
                  {/* In-progress count badge — always shown so supervisors can see load */}
                  {staff.inProgressCount > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-label-sm font-medium tabular-nums',
                        atCapacity
                          ? 'bg-[#FDF2F0] text-[#9B3A2A]'
                          : 'bg-[#FEF0E0] text-[#A04F0A]',
                      )}
                    >
                      {staff.inProgressCount}
                    </span>
                  )}
                  <span className="flex h-5 w-5 items-center justify-center">
                    {isClaiming ? (
                      <Spinner size="sm" />
                    ) : !isDisabled ? (
                      <Check
                        size={14}
                        className="text-stone-300 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Helper text — shown only when falling back to all active staff */}
      {helperText && (
        <p className="mt-2 text-caption italic text-amber-700">{helperText}</p>
      )}
    </div>
  );
}
