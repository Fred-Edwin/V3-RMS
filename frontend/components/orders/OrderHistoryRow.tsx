'use client';

import { cn } from '@/lib/cn';
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
  AWAITING_AUTHORIZATION: 'awaiting',
  AWAITING_CANCELLATION_APPROVAL: 'cancellationPending',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

const ticketStatusDot: Record<'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED', string> = {
  PENDING: 'bg-[#F0D080]',
  IN_PROGRESS: 'bg-[#F5B87A]',
  READY: 'bg-[#86EFAC]',
  REJECTED: 'bg-red-400',
};

const stationLabels: Record<'KITCHEN' | 'BARISTA' | 'PIZZA' | 'PASTRY', string> = {
  KITCHEN: 'Kitchen',
  BARISTA: 'Barista',
  PIZZA: 'Pizza',
  PASTRY: 'Pastry',
};

const formatOrderType = (type: OrderSummary['type']): string => {
  return type.replace('_', ' ');
};

export function OrderHistoryRow({ order, onTap }: OrderHistoryRowProps) {
  // For the history view, show one chip per unique station (summary only)
  const uniqueStations = Object.values(
    order.prepTickets.reduce<Record<string, OrderSummary['prepTickets'][number]>>((acc, t) => {
      if (!acc[t.station]) acc[t.station] = t;
      return acc;
    }, {}),
  );

  return (
    <button
      type="button"
      className="w-full border-b border-stone-200 px-3 py-3 text-left transition-colors duration-fast hover:bg-stone-50"
      onClick={onTap}
    >
      {/* ── Mobile layout ── */}
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-heading-sm font-semibold text-stone-900">#{order.dailyNumber}</p>
            <p className="mt-0.5 text-body-sm text-stone-500">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={statusVariantMap[order.status]} />
        </div>

        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-label-sm uppercase tracking-wide text-stone-500">
            {formatOrderType(order.type)}
          </span>
          {order.tableNumber && (
            <span className="text-label-sm text-stone-500">Table {order.tableNumber}</span>
          )}
        </div>

        {/* Placed by */}
        <p className="mt-1 text-label-sm text-stone-400">
          by <span className="font-medium text-stone-600">{order.createdBy.name}</span>
        </p>

        {/* Station summary chips */}
        {uniqueStations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {uniqueStations.map((ticket) => (
              <span
                key={ticket.station}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-100 bg-stone-50 px-2 py-0.5 text-label-sm text-stone-600"
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

        <div className="mt-2">
          <PriceDisplay amount={Number.parseFloat(order.total)} />
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden items-center gap-3 md:grid md:grid-cols-[80px_100px_90px_1fr_1fr_100px_80px]">
        <span className="text-body-sm font-semibold text-stone-900">#{order.dailyNumber}</span>
        <span className="text-body-sm text-stone-600">
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
        <span className="text-body-sm text-stone-600">{formatOrderType(order.type)}</span>
        <span className="text-body-sm text-stone-700">{order.createdBy.name}</span>
        <span className="flex flex-wrap gap-1">
          {uniqueStations.map((ticket) => (
            <span
              key={ticket.station}
              className="inline-flex items-center gap-1 rounded-full border border-stone-100 bg-stone-50 px-2 py-0.5 text-label-sm text-stone-600"
            >
              <span className={cn('size-1.5 rounded-full', ticketStatusDot[ticket.status])} />
              {stationLabels[ticket.station]}: {ticket.claimedBy ? ticket.claimedBy.name : '—'}
            </span>
          ))}
        </span>
        <PriceDisplay amount={Number.parseFloat(order.total)} />
        <Badge variant={statusVariantMap[order.status]} />
      </div>
    </button>
  );
}
