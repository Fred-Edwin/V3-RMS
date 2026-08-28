'use client';

import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { STAFF_DISCOUNT_PERCENT } from '@/lib/discountConstants';
import type { StaffDiscountAuthRequest } from '@/types/staffDiscountAuth';

/**
 * "Pending staff discount authorization" card for the Director dashboard.
 * Staff discounts are a director-only approval (client policy, 2026-08-28) —
 * managers no longer see or resolve these. Directors have no branch scope, so
 * this lists pending requests across every branch.
 */
export function StaffDiscountApprovalCard({
  pendingRequests,
  overrideSubmittingId,
  onDecide,
}: {
  pendingRequests: StaffDiscountAuthRequest[];
  overrideSubmittingId: string | null;
  onDecide: (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => void;
}): JSX.Element | null {
  if (pendingRequests.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-4 space-y-3 print:hidden">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-warning shrink-0" />
        <p className="text-body-sm font-semibold text-warning">
          {pendingRequests.length === 1
            ? '1 staff discount awaiting your approval'
            : `${pendingRequests.length} staff discounts awaiting your approval`}
        </p>
      </div>
      <div className="space-y-2">
        {pendingRequests.map((req) => {
          const loading = overrideSubmittingId === req.id;
          const original = Number.parseFloat(req.originalAmount);
          const discounted = original - Number.parseFloat(req.discountAmount);
          const percent = req.discountPercent || String(STAFF_DISCOUNT_PERCENT);
          return (
            <div key={req.id} className="rounded-lg border border-warning-border bg-white p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold text-stone-900">
                  Order #{req.order.dailyNumber}
                  <span className="ml-2 font-normal text-stone-500 line-through">
                    KES {original.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="ml-1.5 font-semibold text-success">
                    → KES {discounted.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-caption text-stone-500 mt-0.5">
                  {percent}% staff discount · requested by {req.requestedBy.name}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={!!overrideSubmittingId}
                  onClick={() => onDecide(req.id, 'APPROVED')}
                  className="flex items-center gap-1 rounded-md bg-success px-2.5 py-1.5 text-label-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <CheckCircle size={13} />
                  )}
                  Approve
                </button>
                <button
                  type="button"
                  disabled={!!overrideSubmittingId}
                  onClick={() => onDecide(req.id, 'REJECTED')}
                  className="flex items-center gap-1 rounded-md bg-danger px-2.5 py-1.5 text-label-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <XCircle size={13} />
                  )}
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
