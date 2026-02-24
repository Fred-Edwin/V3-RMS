'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { getSocket } from '@/lib/socket';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import { useToast } from '@/hooks/useToast';
import { Button, OrderCard, PageHeader, PageLayout } from '@/components/ui';
import { ApiError } from '@/types/api';
import type { OrderDetail, PaymentMethod } from '@/types/order';

export default function OrdersPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { activeOrders, isLoading, error } = useActiveOrders();
  const updateOrderRealTime = useOrderStore((state) => state.updateOrderRealTime);
  const removeOrderFromActive = useOrderStore((state) => state.removeOrderFromActive);

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const sortedOrders = useMemo(
    () => [...activeOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [activeOrders],
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

      {isLoading && <p className="text-body-md text-stone-500">Loading active orders...</p>}
      {error && <p className="text-body-md text-[#991B1B]">{error}</p>}

      <div className="space-y-3">
        {sortedOrders.map((order) => (
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
