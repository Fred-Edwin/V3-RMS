'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SlidersHorizontal, Check } from 'lucide-react';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { getSocket } from '@/lib/socket';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import { useToast } from '@/hooks/useToast';
import { BottomSheet, IconButton, OrderCard, PageHeader, PageLayout } from '@/components/ui';
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
  { value: 'ALL', label: 'All types' },
  { value: 'DINE_IN', label: 'Dine-In' },
  { value: 'TAKE_AWAY', label: 'Takeaway' },
  { value: 'DELIVERY', label: 'Delivery' },
];

const parseStatusFilter = (value: string | null): 'ALL' | OrderStatus => {
  if (!value || value === 'ALL') return 'ALL';
  const allowed: OrderStatus[] = ['PENDING', 'IN_PROGRESS', 'READY', 'CLOSED', 'CANCELLED'];
  return allowed.includes(value as OrderStatus) ? (value as OrderStatus) : 'ALL';
};

const parseTypeFilter = (value: string | null): 'ALL' | OrderType => {
  if (!value || value === 'ALL') return 'ALL';
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
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OrderType>('ALL');

  const syncFiltersFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(parseStatusFilter(params.get('status')));
    setTypeFilter(parseTypeFilter(params.get('type')));
  }, []);

  useEffect(() => {
    syncFiltersFromUrl();
    window.addEventListener('popstate', syncFiltersFromUrl);
    return () => window.removeEventListener('popstate', syncFiltersFromUrl);
  }, [syncFiltersFromUrl]);

  const sortedOrders = useMemo(
    () => [...activeOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [activeOrders],
  );

  const typeFilteredOrders = useMemo(() => {
    if (typeFilter === 'ALL') return sortedOrders;
    return sortedOrders.filter((order) => order.type === typeFilter);
  }, [sortedOrders, typeFilter]);

  const statusCounts = useMemo(() => ({
    ALL: typeFilteredOrders.length,
    PENDING: typeFilteredOrders.filter((o) => o.status === 'PENDING').length,
    IN_PROGRESS: typeFilteredOrders.filter((o) => o.status === 'IN_PROGRESS').length,
    READY: typeFilteredOrders.filter((o) => o.status === 'READY').length,
  }), [typeFilteredOrders]);

  const typeCounts = useMemo(() => ({
    ALL: sortedOrders.length,
    DINE_IN: sortedOrders.filter((o) => o.type === 'DINE_IN').length,
    TAKE_AWAY: sortedOrders.filter((o) => o.type === 'TAKE_AWAY').length,
    DELIVERY: sortedOrders.filter((o) => o.type === 'DELIVERY').length,
  }), [sortedOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return typeFilteredOrders;
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
      const qs = nextParams.toString();
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
      if (key === 'status') {
        setStatusFilter(parseStatusFilter(value));
      } else {
        setTypeFilter(parseTypeFilter(value));
        setIsTypeFilterOpen(false);
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAllReady = (payload: { dailyNumber: number }) => {
      setBannerMessage(`Order #${payload.dailyNumber} is ready!`);
      setTimeout(() => setBannerMessage(null), 5000);
    };
    socket.on('order:all_ready', handleAllReady);
    return () => { socket.off('order:all_ready', handleAllReady); };
  }, []);

  const handleOpenOrder = async (orderId: string) => {
    if (!accessToken) return;
    try {
      const order = await orderService.getById(orderId, accessToken);
      setSelectedOrder(order);
      setIsDetailOpen(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load order details.';
      toast({ variant: 'error', title: 'Load failed', message });
    }
  };

  const handlePayment = async (orderId: string, method: PaymentMethod) => {
    if (!accessToken || isPaymentSubmitting) return;
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
      toast({ variant: 'error', title: 'Payment failed', message });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const typeFilterLabel = typeFilter === 'ALL' ? null : typeOptions.find((o) => o.value === typeFilter)?.label;

  return (
    <PageLayout className="space-y-4">
      <PageHeader
        title="Active Orders"
        subtitle="Live order feed"
        action={
          <div className="relative">
            <IconButton
              icon={<SlidersHorizontal size={18} />}
              label="Filter by type"
              aria-label="Filter by type"
              variant={typeFilter !== 'ALL' ? 'primary' : 'ghost'}
              onClick={() => setIsTypeFilterOpen(true)}
            />
            {typeFilter !== 'ALL' && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber pointer-events-none" />
            )}
          </div>
        }
      />

      {/* Ready banner */}
      {bannerMessage && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-[#86EFAC] bg-[#EDFAF1] px-5 py-2 text-body-sm font-medium text-[#1A6B3C] shadow-md">
          {bannerMessage}
        </div>
      )}

      {/* Active type filter indicator */}
      {typeFilterLabel && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-stone-500">Filtered:</span>
          <button
            type="button"
            onClick={() => updateQueryParam('type', 'ALL')}
            className="inline-flex items-center gap-1.5 rounded-full bg-espresso px-3 py-1 text-label-sm text-crema"
          >
            {typeFilterLabel}
            <span className="text-crema/60 leading-none">×</span>
          </button>
        </div>
      )}

      {/* Status pill filters — borderless, single scrollable row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {statusOptions.map((option) => {
          const count = statusCounts[option.value as keyof typeof statusCounts] ?? 0;
          const isActive = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateQueryParam('status', option.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-label-md font-medium transition-colors duration-fast ${
                isActive
                  ? 'bg-espresso text-crema'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {option.label}
              <span className={`ml-1.5 text-label-sm ${isActive ? 'text-crema/70' : 'text-stone-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Order list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-body-md text-[#991B1B]">{error}</p>}

      {!isLoading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
            <span className="text-2xl">☕</span>
          </div>
          <p className="text-body-md font-medium text-stone-700">No orders yet</p>
          <p className="text-body-sm text-stone-400 mt-1">
            {statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'Try adjusting the filters above.'
              : 'New orders will appear here in real time.'}
          </p>
        </div>
      )}

      {!isLoading && (
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
      )}

      {/* Type filter bottom sheet */}
      <BottomSheet
        isOpen={isTypeFilterOpen}
        onClose={() => setIsTypeFilterOpen(false)}
        title="Filter by type"
      >
        <div className="space-y-2 pb-2">
          {typeOptions.map((option) => {
            const count = typeCounts[option.value as keyof typeof typeCounts] ?? 0;
            const isActive = typeFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateQueryParam('type', option.value)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 transition-colors duration-fast ${
                  isActive
                    ? 'bg-espresso text-crema'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span className="text-body-sm font-medium">{option.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`text-label-sm ${isActive ? 'text-crema/70' : 'text-stone-400'}`}>
                    {count}
                  </span>
                  {isActive && <Check size={16} className="text-crema" />}
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>

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
