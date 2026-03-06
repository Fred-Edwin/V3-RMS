'use client';

import { useMemo, useState } from 'react';
import { Badge, DatePicker, Modal, PageHeader, PageLayout, PriceDisplay, Select } from '@/components/ui';
import { OrderHistoryRow } from '@/components/orders/OrderHistoryRow';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { usePrepTicketHistory } from '@/hooks/usePrepTicketHistory';
import { useToast } from '@/hooks/useToast';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { OrderDetail, OrderStatus, PrepTicketStatus } from '@/types/order';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const prepStatusVariantMap: Record<PrepTicketStatus, 'pending' | 'inprogress' | 'ready' | 'cancelled'> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inprogress',
  READY: 'ready',
  REJECTED: 'cancelled',
};

export default function HistoryPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const orderHistory = useOrderHistory({ status, startDate: startDate || undefined, endDate: endDate || undefined, page });
  const prepHistory = usePrepTicketHistory({ startDate: startDate || undefined, endDate: endDate || undefined, page });

  const totalOrders = orderHistory.pagination.total;

  const prepRows = useMemo(
    () =>
      prepHistory.tickets.map((ticket) => {
        const claimedAt = ticket.claimedAt ? new Date(ticket.claimedAt).getTime() : 0;
        const readyAt = ticket.readyAt ? new Date(ticket.readyAt).getTime() : 0;
        const durationMinutes = claimedAt && readyAt ? Math.max(0, Math.round((readyAt - claimedAt) / 60000)) : 0;
        return { ticket, durationMinutes };
      }),
    [prepHistory.tickets],
  );

  const openOrder = async (orderId: string) => {
    if (!accessToken) {
      return;
    }

    try {
      const detail = await orderService.getById(orderId, accessToken);
      setSelectedOrder(detail);
      setIsOrderModalOpen(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load order details.';
      toast({
        variant: 'error',
        title: message,
      });
    }
  };

  return (
    <PageLayout className="space-y-4">
      <PageHeader title="History" subtitle="Review completed and cancelled work" />

      <div className="grid grid-cols-1 gap-3 rounded-md border border-stone-200 bg-white p-3 md:grid-cols-3">
        <DatePicker label="Start Date" value={startDate} onChange={setStartDate} />
        <DatePicker label="End Date" value={endDate} onChange={setEndDate} />
        {role === 'WAITER' && (
          <Select
            label="Status"
            options={statusOptions}
            value={status ?? ''}
            onChange={(event) => {
              const nextStatus = event.target.value;
              setStatus(nextStatus ? (nextStatus as OrderStatus) : undefined);
            }}
          />
        )}
      </div>

      {role === 'WAITER' ? (
        <>
          <div className="rounded-md border border-stone-200 bg-white p-3">
            <p className="text-body-md text-stone-700">
              {totalOrders} orders - <PriceDisplay amount={orderHistory.totalValue} />
            </p>
          </div>

          <div className="rounded-md border border-stone-200 bg-white">
            {orderHistory.orders.map((order) => (
              <OrderHistoryRow key={order.id} order={order} onTap={() => void openOrder(order.id)} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-md border border-stone-200 bg-white">
          <div className="hidden grid-cols-5 gap-2 border-b border-stone-200 px-3 py-2 text-label-sm text-stone-500 md:grid">
            <span>Order</span>
            <span>Date</span>
            <span>Items</span>
            <span>Prep Time</span>
            <span>Status</span>
          </div>
          {prepRows.map(({ ticket, durationMinutes }) => (
            <div key={ticket.id} className="border-b border-stone-100 px-3 py-3 text-body-sm">
              <div className="md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-heading-sm font-semibold text-stone-900">#{ticket.orderDailyNumber}</p>
                    <p className="mt-0.5 text-body-sm text-stone-600">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={prepStatusVariantMap[ticket.status]} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-body-sm text-stone-600">{ticket.items.length} items</span>
                  <span className="text-body-sm text-stone-700">{durationMinutes} min</span>
                </div>
              </div>

              <div className="hidden grid-cols-5 gap-2 md:grid">
                <span>#{ticket.orderDailyNumber}</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                <span>{ticket.items.length}</span>
                <span>{durationMinutes} min</span>
                <span>
                  <Badge variant={prepStatusVariantMap[ticket.status]} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-md border border-stone-200 px-3 py-2 text-body-sm"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <span className="text-body-sm text-stone-600">
          Page {role === 'WAITER' ? orderHistory.pagination.page : prepHistory.pagination.page} of{' '}
          {role === 'WAITER' ? orderHistory.pagination.totalPages : prepHistory.pagination.totalPages}
        </span>
        <button
          type="button"
          className="rounded-md border border-stone-200 px-3 py-2 text-body-sm"
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>

      <Modal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Order Details">
        {selectedOrder && (
          <div className="space-y-2">
            <p className="text-body-md text-stone-900">Order #{selectedOrder.dailyNumber}</p>
            {selectedOrder.items.map((item) => (
              <p key={item.id} className="text-body-sm text-stone-700">
                {item.quantity} x {item.name} - KES {Number.parseFloat(item.subtotal).toFixed(2)}
              </p>
            ))}
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
