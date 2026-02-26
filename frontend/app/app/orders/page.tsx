'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { getSocket } from '@/lib/socket';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import { useToast } from '@/hooks/useToast';
import { Button, OrderCard, PageHeader, PageLayout } from '@/components/ui';
import { ApiError } from '@/types/api';
import type { OrderDetail, OrderStatus, OrderType, PaymentMethod } from '@/types/order';

export const dynamic = 'force-dynamic';

const statusOptions: Array<{ value: 'ALL' | OrderStatus; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'READY', label: 'Ready' },
];

const typeOptions: Array<{ value: 'ALL' | OrderType; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DINE_IN', label: 'Dine-In' },
  { value: 'TAKE_AWAY', label: 'Takeaway' },
  { value: 'DELIVERY', label: 'Delivery' },
];

const parseStatusFilter = (value: string | null): 'ALL' | OrderStatus => {
  if (!value || value === 'ALL') {
    return 'ALL';
  }

  const allowed: OrderStatus[] = ['PENDING', 'IN_PROGRESS', 'READY', 'CLOSED', 'CANCELLED'];
  return allowed.includes(value as OrderStatus) ? (value as OrderStatus) : 'ALL';
};

const parseTypeFilter = (value: string | null): 'ALL' | OrderType => {
  if (!value || value === 'ALL') {
    return 'ALL';
  }

  const allowed: OrderType[] = ['DINE_IN', 'TAKE_AWAY', 'DELIVERY'];
  return allowed.includes(value as OrderType) ? (value as OrderType) : 'ALL';
};

export default function OrdersPage(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { activeOrders, isLoading, error } = useActiveOrders();
  const updateOrderRealTime = useOrderStore((state) => state.updateOrderRealTime);
  const removeOrderFromActive = useOrderStore((state) => state.removeOrderFromActive);

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OrderType>('ALL');

  const syncFiltersFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(parseStatusFilter(params.get('status')));
    setTypeFilter(parseTypeFilter(params.get('type')));
  }, []);

  useEffect(() => {
    syncFiltersFromUrl();
    window.addEventListener('popstate', syncFiltersFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFiltersFromUrl);
    };
  }, [syncFiltersFromUrl]);

  const sortedOrders = useMemo(
    () => [...activeOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [activeOrders],
  );

  const typeFilteredOrders = useMemo(() => {
    if (typeFilter === 'ALL') {
      return sortedOrders;
    }

    return sortedOrders.filter((order) => order.type === typeFilter);
  }, [sortedOrders, typeFilter]);

  const statusCounts = useMemo(() => {
    return {
      ALL: typeFilteredOrders.length,
      PENDING: typeFilteredOrders.filter((order) => order.status === 'PENDING').length,
      IN_PROGRESS: typeFilteredOrders.filter((order) => order.status === 'IN_PROGRESS').length,
      READY: typeFilteredOrders.filter((order) => order.status === 'READY').length,
    };
  }, [typeFilteredOrders]);

  const typeCounts = useMemo(() => {
    return {
      ALL: sortedOrders.length,
      DINE_IN: sortedOrders.filter((order) => order.type === 'DINE_IN').length,
      TAKE_AWAY: sortedOrders.filter((order) => order.type === 'TAKE_AWAY').length,
      DELIVERY: sortedOrders.filter((order) => order.type === 'DELIVERY').length,
    };
  }, [sortedOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') {
      return typeFilteredOrders;
    }

    return typeFilteredOrders.filter((order) => order.status === statusFilter);
  }, [statusFilter, typeFilteredOrders]);

  const updateQueryParam = useCallback(
    (key: 'status' | 'type', value: string) => {
      const nextParams = new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
      );
      if (value === 'ALL') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }

      const queryString = nextParams.toString();
      router.replace(queryString.length > 0 ? `${pathname}?${queryString}` : pathname, { scroll: false });

      if (key === 'status') {
        setStatusFilter(parseStatusFilter(value));
      } else {
        setTypeFilter(parseTypeFilter(value));
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const handleAllReady = (payload: { dailyNumber: number }) => {
      setBannerMessage(`Order #${payload.dailyNumber} is ready!`);
      setTimeout(() => setBannerMessage(null), 5000);
    };

    socket.on('order:all_ready', handleAllReady);
    return () => {
      socket.off('order:all_ready', handleAllReady);
    };
  }, []);

  const handleOpenOrder = async (orderId: string) => {
    if (!accessToken) {
      return;
    }

    try {
      const order = await orderService.getById(orderId, accessToken);
      setSelectedOrder(order);
      setIsDetailOpen(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load order details.';
      toast({
        variant: 'error',
        title: 'Load failed',
        message,
      });
    }
  };

  const handlePayment = async (orderId: string, method: PaymentMethod) => {
    if (!accessToken) {
      return;
    }

    if (isPaymentSubmitting) {
      return;
    }

    setIsPaymentSubmitting(true);
    try {
      await orderService.recordPayment(orderId, method, accessToken);
      updateOrderRealTime(orderId, { status: 'CLOSED' });
      removeOrderFromActive(orderId);
      toast({ variant: 'success', title: 'Payment recorded. Order closed.' });
      setIsDetailOpen(false);
      setSelectedOrder(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record payment.';
      toast({
        variant: 'error',
        title: 'Payment failed',
        message,
      });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  return (
    <PageLayout className="space-y-4">
      <PageHeader
        title="Active Orders"
        subtitle="Live order feed"
        action={<Button onClick={() => router.push('/app/orders/new')}>New Order</Button>}
      />

      {bannerMessage && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md border border-[#86EFAC] bg-[#EDFAF1] px-4 py-2 text-body-sm text-[#1A6B3C]">
          {bannerMessage}
        </div>
      )}

      <div className="space-y-3 rounded-md border border-stone-200 bg-white p-3">
        <div>
          <p className="text-label-sm text-stone-500">Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={statusFilter === option.value ? 'primary' : 'secondary'}
                onClick={() => updateQueryParam('status', option.value)}
              >
                {option.label} ({statusCounts[option.value as keyof typeof statusCounts] ?? 0})
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-label-sm text-stone-500">Type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {typeOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={typeFilter === option.value ? 'primary' : 'secondary'}
                onClick={() => updateQueryParam('type', option.value)}
              >
                {option.label} ({typeCounts[option.value as keyof typeof typeCounts] ?? 0})
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-body-md text-stone-500">Loading active orders...</p>}
      {error && <p className="text-body-md text-[#991B1B]">{error}</p>}

      {!isLoading && !error && filteredOrders.length === 0 && (
        <p className="text-body-sm text-stone-500">No active orders match the selected filters.</p>
      )}

      <div className="space-y-3">
        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            orderNumber={order.dailyNumber}
            status={order.status}
            type={order.type}
            tableNumber={order.tableNumber ?? undefined}
            startTime={order.createdAt}
            onTap={() => void handleOpenOrder(order.id)}
          />
        ))}
      </div>

      <OrderDetailBottomSheet
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setIsPaymentSubmitting(false);
        }}
        order={selectedOrder}
        onEdit={(orderId) => router.push(`/app/orders/${orderId}/edit`)}
        onPayment={(orderId, method) => void handlePayment(orderId, method)}
        isPaymentSubmitting={isPaymentSubmitting}
      />
    </PageLayout>
  );
}
