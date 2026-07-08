'use client';

import { Clock, CheckCircle, XCircle } from 'lucide-react';
import type { HouseAccountAuthRequest } from '@/types/houseAccountAuth';

function formatItemLabel(item: HouseAccountAuthRequest['order']['items'][number]): string {
  const base = `${item.quantity}× ${item.menuItem.name}`;
  return item.notes ? `${base} (${item.notes})` : base;
}

/**
 * Shared "pending house account authorization" card used by both the Director
 * and Manager dashboards. Shows order line items so approvers aren't deciding blind.
 */
export function HouseAccountApprovalCard({
  pendingAuths,
  authOverrideSubmittingId,
  onDecide,
}: {
  pendingAuths: HouseAccountAuthRequest[];
  authOverrideSubmittingId: string | null;
  onDecide: (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => void;
}): JSX.Element | null {
  if (pendingAuths.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-4 space-y-3 print:hidden">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-warning shrink-0" />
        <p className="text-body-sm font-semibold text-warning">
          {pendingAuths.length === 1
            ? '1 house account charge awaiting your approval'
            : `${pendingAuths.length} house account charges awaiting your approval`}
        </p>
      </div>
      <div className="space-y-2">
        {pendingAuths.map((req) => {
          const loading = authOverrideSubmittingId === req.id;
          return (
            <div key={req.id} className="rounded-lg border border-warning-border bg-white p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold text-stone-900">
                  Order #{req.order.dailyNumber}
                  <span className="ml-2 font-normal text-stone-500">
                    KES {Number.parseFloat(req.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-caption text-stone-500 mt-0.5">
                  {req.houseAccount.user.name} · via {req.requestedBy.name}
                </p>
                {req.order.items.length > 0 && (
                  <p className="text-caption text-stone-600 mt-1 truncate">
                    {req.order.items.map(formatItemLabel).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={!!authOverrideSubmittingId}
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
                  disabled={!!authOverrideSubmittingId}
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
