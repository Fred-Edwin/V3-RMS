'use client';

import { useState } from 'react';
import { DatePicker, PageHeader, PageLayout, PriceDisplay, Select } from '@/components/ui';
import { OrderHistoryRow } from '@/components/orders/OrderHistoryRow';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { useToast } from '@/hooks/useToast';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { OrderDetail, OrderStatus } from '@/types/order';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function HistoryPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { orders, pagination, isLoading, error, totalValue } = useOrderHistory({
    status,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
  });

  const isManager = role === 'MANAGER' || role === 'DIRECTOR';
  const isOwner = Boolean(selectedOrder && userId && selectedOrder.createdBy.id === userId);

  const openOrder = async (orderId: string) => {
    if (!accessToken) return;
    try {
      const detail = await orderService.getById(orderId, accessToken);
      setSelectedOrder(detail);
      setIsDetailOpen(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to load order details.';
      toast({ variant: 'error', title: message });
    }
  };

  return (
    <PageLayout className="space-y-4">
      <PageHeader title="History" subtitle="Review completed and cancelled orders" />

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-3 md:grid-cols-3">
        <DatePicker label="Start Date" value={startDate} onChange={setStartDate} />
        <DatePicker label="End Date" value={endDate} onChange={setEndDate} />
        <Select
          label="Status"
          options={statusOptions}
          value={status ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setStatus(v ? (v as OrderStatus) : undefined);
            setPage(1);
          }}
        />
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
        <p className="text-body-sm text-stone-600">
          <span className="font-semibold text-stone-900">{pagination.total}</span> orders
        </p>
        <PriceDisplay amount={totalValue} />
      </div>

      {/* Order list */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {/* Desktop header */}
        <div className="hidden grid-cols-[80px_100px_90px_1fr_1fr_100px_80px] gap-3 border-b border-stone-200 px-3 py-2 text-label-sm font-medium text-stone-500 md:grid">
          <span>Order</span>
          <span>Date</span>
          <span>Type</span>
          <span>Placed By</span>
          <span>Prep Staff</span>
          <span>Total</span>
          <span>Status</span>
        </div>

        {isLoading && (
          <div className="space-y-0 divide-y divide-stone-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-stone-50 px-3 py-3" />
            ))}
          </div>
        )}

        {error && (
          <p className="px-4 py-6 text-body-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-stone-100">
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-body-md font-medium text-stone-700">No orders found</p>
            <p className="mt-1 text-body-sm text-stone-400">
              Try adjusting the date range or status filter.
            </p>
          </div>
        )}

        {!isLoading && orders.map((order) => (
          <OrderHistoryRow
            key={order.id}
            order={order}
            onTap={() => void openOrder(order.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-body-sm text-stone-700 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span className="text-body-sm text-stone-500">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          type="button"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-body-sm text-stone-700 disabled:opacity-40"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <OrderDetailBottomSheet
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onEdit={() => {/* read-only in history */}}
        onPayment={() => {/* read-only in history */}}
        isOwner={isOwner}
        isManager={isManager}
      />
    </PageLayout>
  );
}
