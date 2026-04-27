'use client';

import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Receipt } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { DatePicker, EmptyState, IconButton, SkeletonTable } from '@/components/ui';
import type { HouseAccountOrder, HouseAccountOrdersPagination } from '@/services/houseAccountService';

const fmt = (v: string | number) => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });

function OrderItemsPanel({ order }: { order: HouseAccountOrder }) {
  const subtotal = order.items.reduce((sum, i) => sum + Number.parseFloat(i.subtotal), 0);
  return (
    <tr>
      <td colSpan={5} className="px-0 pb-0 pt-0">
        <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-stone-100 bg-stone-50">
          {/* waiter line */}
          <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 py-2.5">
            <span className="text-caption font-bold text-stone-400">Served by</span>
            <span className="text-caption font-medium text-stone-500">{order.createdBy.name}</span>
          </div>

          {/* sub-header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-stone-100 px-4 py-1.5">
            <span className="text-caption font-bold text-stone-400">Item</span>
            <span className="text-caption font-bold text-stone-400">Qty</span>
            <span className="text-right text-caption font-bold text-stone-400">Amount</span>
          </div>

          {order.items.length === 0 ? (
            <p className="px-4 py-3 text-body-sm text-stone-400">No item details available.</p>
          ) : (
            order.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-stone-100"
              >
                <div>
                  <p className="text-body-sm font-medium text-stone-800">{item.menuItem.name}</p>
                  {item.notes && (
                    <p className="mt-0.5 text-caption italic text-stone-400">{item.notes}</p>
                  )}
                </div>
                <span className="text-body-sm tabular-nums text-stone-600">×{item.quantity}</span>
                <span className="text-right font-mono text-body-sm tabular-nums text-stone-800">
                  {fmt(item.subtotal)}
                </span>
              </div>
            ))
          )}

          {/* sub-total row */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-t border-stone-200 bg-stone-100/60 px-4 py-2.5">
            <span className="text-label-sm font-semibold text-stone-700">Order Total</span>
            <span />
            <span className="text-right font-mono text-label-sm font-semibold tabular-nums text-espresso">
              {fmt(subtotal)}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

interface Props {
  orders: HouseAccountOrder[];
  pagination: HouseAccountOrdersPagination | null;
  isLoading: boolean;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onClearDate: () => void;
  onPageChange: (page: number) => void;
}

export function TabOrderHistoryTable({
  orders,
  pagination,
  isLoading,
  selectedDate,
  onDateChange,
  onClearDate,
  onPageChange,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const total = pagination?.total ?? 0;
  const page = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const perPage = pagination?.perPage ?? 15;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-6 py-4">
        <div>
          <h2 className="text-label-lg font-semibold text-stone-900">Orders on This Tab</h2>
          {!isLoading && (
            <p className="mt-0.5 text-body-sm text-stone-400">
              {total === 0
                ? selectedDate
                  ? 'No orders on this date'
                  : 'No orders yet'
                : `${total.toLocaleString()} order${total !== 1 ? 's' : ''}${selectedDate ? ' on this date' : ' total'}`}
            </p>
          )}
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2">
          <div className="w-44">
            <DatePicker
              value={selectedDate}
              onChange={onDateChange}
              max={new Date().toISOString().slice(0, 10)}
              align="right"
            />
          </div>
          {selectedDate && (
            <IconButton
              icon={<X size={14} />}
              label="Clear date filter"
              size="sm"
              variant="ghost"
              onClick={onClearDate}
            />
          )}
        </div>
      </div>

      {/* ── Table Body ── */}
      {isLoading ? (
        <div className="px-6 py-4">
          <SkeletonTable rows={5} columns={4} />
        </div>
      ) : orders.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={<Receipt size={22} />}
            heading={selectedDate ? 'No orders on this date' : 'No orders yet'}
            body={
              selectedDate
                ? 'Try selecting a different date, or clear the filter to see all orders.'
                : 'Orders charged to your house account will appear here.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/70">
                <th className="h-10 px-6 text-left text-label-xs font-semibold uppercase tracking-wider text-stone-400">
                  Date
                </th>
                <th className="h-10 px-4 text-left text-label-xs font-semibold uppercase tracking-wider text-stone-400">
                  Order
                </th>
                <th className="h-10 px-4 text-left text-label-xs font-semibold uppercase tracking-wider text-stone-400">
                  Time
                </th>
                <th className="h-10 px-4 text-left text-label-xs font-semibold uppercase tracking-wider text-stone-400">
                  Items
                </th>
                <th className="h-10 px-4 text-right text-label-xs font-semibold uppercase tracking-wider text-stone-400 pr-6">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => {
                const isExpanded = expandedId === order.id;
                const isLast = idx === orders.length - 1 && !isExpanded;
                return (
                  <>
                    <tr
                      key={order.id}
                      onClick={() => toggle(order.id)}
                      className={cn(
                        'cursor-pointer transition-colors duration-fast',
                        isExpanded
                          ? 'bg-stone-50'
                          : 'hover:bg-stone-50',
                        !isLast && 'border-b border-stone-100',
                      )}
                    >
                      {/* Date */}
                      <td className="px-6 py-3.5 text-body-sm font-medium text-stone-700">
                        {fmtDate(order.createdAt)}
                      </td>

                      {/* Order # */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 font-mono text-label-sm font-semibold text-stone-700">
                          #{order.dailyNumber}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3.5 text-body-sm text-stone-500">
                        {fmtTime(order.createdAt)}
                      </td>

                      {/* Items count */}
                      <td className="px-4 py-3.5 text-body-sm text-stone-500">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </td>

                      {/* Amount + expand chevron */}
                      <td className="px-4 py-3.5 pr-6">
                        <div className="flex items-center justify-end gap-3">
                          <span className="font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                            {fmt(order.total)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={15} className="shrink-0 text-amber-500" />
                          ) : (
                            <ChevronDown size={15} className="shrink-0 text-stone-300" />
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && <OrderItemsPanel key={`${order.id}-items`} order={order} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination Footer ── */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between border-t border-stone-100 px-6 py-3">
          <p className="text-body-sm text-stone-400">
            {from}–{to} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<ChevronLeft size={14} />}
              label="Previous page"
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            <span className="min-w-[60px] text-center text-label-sm text-stone-600">
              {page} / {totalPages}
            </span>
            <IconButton
              icon={<ChevronRight size={14} />}
              label="Next page"
              size="sm"
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
