'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActiveOrdersSummary } from '@/components/dashboard/ActiveOrdersSummary';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { ClockWidget } from '@/components/shifts/ClockWidget';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useFcmToken } from '@/hooks/useFcmToken';
import { usePrepTickets } from '@/hooks/usePrepTickets';
import { orderService } from '@/services/orderService';
import { prepTicketService } from '@/services/prepTicketService';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { Button, KDSCard, OrderCard, PageHeader, PageLayout, StatCard } from '@/components/ui';
import { ApiError } from '@/types/api';
import type { OrderDetail, OrderSummary, PaymentMethod } from '@/types/order';
import type { ShiftAssignment, ShiftAssignmentClockRecord } from '@/types/shift';

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const { activeOrders, reload: reloadActiveOrders } = useActiveOrders();
  const {
    canPrompt: canPromptFcmPermission,
    isRegistering: isRegisteringFcmToken,
    requestPermissionAndRegister,
    dismissPrompt,
  } = useFcmToken();
  const { inProgressTickets } = usePrepTickets();

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [todayTotalValue, setTodayTotalValue] = useState(0);
  const [latestOrders, setLatestOrders] = useState<OrderSummary[]>([]);
  const [ticketsCompletedToday, setTicketsCompletedToday] = useState(0);
  const [avgPrepMinutesToday, setAvgPrepMinutesToday] = useState(0);
  const [todayShiftAssignment, setTodayShiftAssignment] = useState<ShiftAssignment | null>(null);

  const myInProgressTickets = useMemo(
    () => inProgressTickets.filter((ticket) => ticket.claimedBy?.id === user?.id),
    [inProgressTickets, user?.id],
  );

  const loadWaiterDashboardData = useCallback(async () => {
    if (!accessToken || role !== 'WAITER') {
      return;
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const perPage = 50;
    let page = 1;
    let totalPages = 1;
    const collectedOrders: OrderSummary[] = [];

    do {
      const result = await orderService.getMany(
        {
          date: todayDate,
          page,
          perPage,
        },
        accessToken,
      );

      collectedOrders.push(...result.orders);
      totalPages = result.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);

    setTodayOrderCount(collectedOrders.length);
    setTodayTotalValue(
      collectedOrders.reduce((sum, order) => sum + Number.parseFloat(order.total), 0),
    );
    setLatestOrders(collectedOrders.slice(0, 5));
  }, [accessToken, role]);

  useEffect(() => {
    void loadWaiterDashboardData();
  }, [loadWaiterDashboardData]);

  const loadPrepDashboardData = useCallback(async () => {
    if (!accessToken || (role !== 'CHEF' && role !== 'BARISTA') || !user?.id) {
      return;
    }

    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const perPage = 50;
      let page = 1;
      let totalPages = 1;
      let completedCount = 0;
      let totalDurationMinutes = 0;

      do {
        const result = await prepTicketService.getTickets(
          {
            status: 'READY',
            startDate: todayDate,
            endDate: todayDate,
            page,
            perPage,
          },
          accessToken,
        );

        const myCompleted = result.tickets.filter(
          (ticket) =>
            ticket.claimedBy?.id === user.id &&
            Boolean(ticket.claimedAt) &&
            Boolean(ticket.readyAt),
        );

        completedCount += myCompleted.length;
        totalDurationMinutes += myCompleted.reduce((sum, ticket) => {
          const claimedAt = new Date(ticket.claimedAt ?? ticket.createdAt).getTime();
          const readyAt = new Date(ticket.readyAt ?? ticket.createdAt).getTime();
          return sum + Math.max(0, Math.round((readyAt - claimedAt) / 60000));
        }, 0);

        totalPages = result.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      setTicketsCompletedToday(completedCount);
      setAvgPrepMinutesToday(
        completedCount > 0 ? Math.round(totalDurationMinutes / completedCount) : 0,
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load prep metrics.';
      toast({
        variant: 'warning',
        title: message,
      });
    }
  }, [accessToken, role, toast, user?.id]);

  useEffect(() => {
    void loadPrepDashboardData();
  }, [loadPrepDashboardData]);

  const loadTodayShiftAssignment = useCallback(async () => {
    if (!accessToken || (role !== 'WAITER' && role !== 'CHEF' && role !== 'BARISTA')) {
      return;
    }

    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const assignments = await shiftService.listAssignments(
        {
          startDate: todayDate,
          endDate: todayDate,
        },
        accessToken,
      );
      setTodayShiftAssignment(assignments[0] ?? null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load today shift.';
      toast({
        variant: 'warning',
        title: message,
      });
    }
  }, [accessToken, role, toast]);

  useEffect(() => {
    void loadTodayShiftAssignment();
  }, [loadTodayShiftAssignment]);

  const handleClockUpdated = useCallback((record: ShiftAssignmentClockRecord) => {
    setTodayShiftAssignment((current) =>
      current
        ? {
            ...current,
            clockRecord: record,
          }
        : current,
    );
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
        title: message,
      });
    }
  };

  const handlePayment = async (orderId: string, method: PaymentMethod) => {
    if (!accessToken) {
      return;
    }

    try {
      await orderService.recordPayment(orderId, method, accessToken);
      await Promise.all([reloadActiveOrders(), loadWaiterDashboardData()]);
      setIsDetailOpen(false);
      toast({
        variant: 'success',
        title: 'Payment recorded. Order closed.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record payment.';
      toast({
        variant: 'error',
        title: message,
      });
    }
  };

  if (role === 'WAITER') {
    return (
      <PageLayout className="space-y-6">
        <PageHeader
          title={`Good morning, ${user?.name ?? 'Waiter'}`}
          subtitle="Your live order dashboard"
          action={<Button onClick={() => router.push('/app/orders/new')}>New Order</Button>}
        />

        {canPromptFcmPermission && (
          <div className="rounded-md border border-[#F0D080] bg-[#FDF3DC] p-3">
            <p className="text-body-sm text-[#92650A]">
              Enable notifications to receive order-ready alerts even when the app is in the background.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => void requestPermissionAndRegister()}
                isLoading={isRegisteringFcmToken}
              >
                Enable Notifications
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissPrompt}>
                Not now
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatCard label="Orders Today" value={String(todayOrderCount)} />
          <StatCard label="Total Value Today" value={`KES ${todayTotalValue.toFixed(2)}`} />
        </div>

        <ClockWidget assignment={todayShiftAssignment} onUpdated={handleClockUpdated} />

        <ActiveOrdersSummary orders={activeOrders} />

        <section>
          <h2 className="mb-3 text-heading-sm font-semibold text-stone-900">Last 5 Orders</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {latestOrders.map((order) => (
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
        </section>

        <OrderDetailBottomSheet
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          order={selectedOrder}
          onEdit={(orderId) => router.push(`/app/orders/${orderId}/edit`)}
          onPayment={(orderId, method) => void handlePayment(orderId, method)}
        />
      </PageLayout>
    );
  }

  if (role === 'CHEF' || role === 'BARISTA') {
    return (
      <PageLayout className="space-y-6">
        <PageHeader
          title={`Good morning, ${user?.name ?? 'Staff'}`}
          subtitle="Your preparation queue snapshot"
          action={
            <Button onClick={() => router.push(role === 'CHEF' ? '/app/kitchen' : '/app/barista')}>
              Go to {role === 'CHEF' ? 'Kitchen Display' : 'Barista Display'}
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatCard label="Tickets Completed Today" value={String(ticketsCompletedToday)} />
          <StatCard label="Avg Prep Time Today" value={`${avgPrepMinutesToday} min`} />
        </div>

        <ClockWidget assignment={todayShiftAssignment} onUpdated={handleClockUpdated} />

        <section>
          <h2 className="mb-3 text-heading-sm font-semibold text-stone-900">My Active Orders</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {myInProgressTickets.map((ticket) => (
              <KDSCard
                key={ticket.id}
                orderNumber={ticket.orderDailyNumber}
                type={ticket.orderType}
                tableNumber={ticket.tableNumber ?? undefined}
                items={ticket.items}
                specialInstructions={ticket.orderNotes}
                startTime={ticket.createdAt}
                status={ticket.status}
                actionLabel="Mark Ready"
                onAction={() => {}}
              />
            ))}
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Dashboard" subtitle="No dashboard view available for this role." />
    </PageLayout>
  );
}
