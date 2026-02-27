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

const formatOrderType = (type: OrderSummary['type']): string => {
  return type.replace('_', ' ');
};

export function OrderHistoryRow({ order, onTap }: OrderHistoryRowProps) {
  return (
    <button
      type="button"
      className="w-full border-b border-stone-200 px-3 py-3 text-left transition-colors duration-fast hover:bg-stone-100"
      onClick={onTap}
    >
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-heading-sm font-semibold text-stone-900">#{order.dailyNumber}</p>
            <p className="mt-0.5 text-body-sm text-stone-600">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={statusVariantMap[order.status]} />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-label-md uppercase tracking-wide text-stone-600">
            {formatOrderType(order.type)}
          </span>
          <span className="text-body-sm text-stone-600">{order.prepTickets.length} items</span>
        </div>

        <div className="mt-2">
          <PriceDisplay amount={Number.parseFloat(order.total)} />
        </div>
      </div>

      <div className="hidden items-center gap-2 md:grid md:grid-cols-6">
        <span className="text-body-sm text-stone-900">#{order.dailyNumber}</span>
        <span className="text-body-sm text-stone-700">{new Date(order.createdAt).toLocaleDateString()}</span>
        <span className="text-body-sm text-stone-700">{formatOrderType(order.type)}</span>
        <span className="text-body-sm text-stone-700">{order.prepTickets.length}</span>
        <PriceDisplay amount={Number.parseFloat(order.total)} />
        <Badge variant={statusVariantMap[order.status]} />
      </div>
    </button>
  );
}
