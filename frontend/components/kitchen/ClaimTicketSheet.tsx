'use client';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui';
import { Check } from 'lucide-react';
import type { PrepStation } from '@/types/order';

interface ClaimPickerProps {
  station: PrepStation;
  staffOnShift: Array<{ id: string; name: string }>;
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
            const isDisabled = isSubmitting;
            const isLast = index === staffOnShift.length - 1;

            return (
              <button
                key={staff.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onClaim(staff.id)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-100',
                  // Divider between rows (no bottom border on last row)
                  !isLast && 'border-b border-stone-100',
                  // Hover / focus
                  'hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400',
                  // Active (claiming) row
                  isClaiming && 'bg-[#F8F4EF]',
                  // Disabled when another row is being claimed
                  isDisabled && !isClaiming && 'cursor-not-allowed opacity-40',
                )}
              >
                {/* Staff name */}
                <span
                  className={cn(
                    'text-body-md font-medium',
                    isClaiming ? 'text-espresso' : 'text-stone-800',
                  )}
                >
                  {staff.name}
                </span>

                {/* Right side: spinner while claiming, checkmark affordance otherwise */}
                <span className="ml-3 flex h-5 w-5 shrink-0 items-center justify-center">
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
