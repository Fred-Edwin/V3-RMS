'use client';

import { Badge, PriceDisplay } from '@/components/ui';
import type { OrderSummary } from '@/types/order';

interface OrderHistoryRowProps {
  order: OrderSummary;
  onTap: () => void;
}

const statusVariantMap = {
  PENDING: 'pending',
  IN_PROGRESS: 'inprogress',
  READY: 'ready',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export function OrderHistoryRow({ order, onTap }: OrderHistoryRowProps) {
  return (
    <button
      type="button"
      className="grid w-full grid-cols-6 items-center gap-2 border-b border-stone-200 px-3 py-3 text-left hover:bg-stone-100"
      onClick={onTap}
    >
      <span className="text-body-sm text-stone-900">#{order.dailyNumber}</span>
      <span className="text-body-sm text-stone-700">{new Date(order.createdAt).toLocaleDateString()}</span>
      <span className="text-body-sm text-stone-700">{order.type.replace('_', ' ')}</span>
      <span className="text-body-sm text-stone-700">{order.prepTickets.length}</span>
      <PriceDisplay amount={Number.parseFloat(order.total)} />
      <Badge variant={statusVariantMap[order.status]} />
    </button>
  );
}
