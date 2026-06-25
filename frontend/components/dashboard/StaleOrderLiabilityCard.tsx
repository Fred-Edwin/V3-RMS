'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { waiterLiabilityService } from '@/services/waiterLiabilityService';
import type { MyWaiterLiabilityReport } from '@/types/waiterLiability';

const formatKsh = (value: string): string =>
  new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

const formatOrderDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });

/**
 * Shows the waiter their unresolved stale (unpaid, unclosed from a prior day) orders and
 * the total they sum to, with a notice to resolve them with the Accountant before month-end
 * or the amount may be deducted from their salary. Renders nothing when there are none.
 */
export function StaleOrderLiabilityCard({ accessToken }: { accessToken: string | null }): JSX.Element | null {
  const [report, setReport] = useState<MyWaiterLiabilityReport | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void waiterLiabilityService
      .getMyLiabilities(accessToken)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        /* non-critical — dashboard still works without this card */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!report || report.totalOrders === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/60 shadow-sm">
      <div className="flex items-start gap-3 border-b border-red-100 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle size={17} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-red-800">
            Unresolved Orders &mdash; Ksh {formatKsh(report.totalLiability)}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-red-700/90">
            You have {report.totalOrders} unpaid order{report.totalOrders > 1 ? 's' : ''} that
            were never closed. Resolve {report.totalOrders > 1 ? 'them' : 'it'} with the
            Accountant before month-end, or this amount may be deducted from your salary.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-red-100">
        {report.orders.map((order) => (
          <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <span className="text-[13px] font-semibold text-stone-800">#{order.dailyNumber}</span>
              <span className="ml-2 text-[12px] text-stone-500">
                {formatOrderDate(order.orderDate)}
                {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
              </span>
            </div>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-red-700">
              Ksh {formatKsh(order.total)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
