'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
import { ActiveOrdersSummary } from '@/components/dashboard/ActiveOrdersSummary';
import { StaleOrderLiabilityCard } from '@/components/dashboard/StaleOrderLiabilityCard';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { ClockWidget } from '@/components/shifts/ClockWidget';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useFcmToken } from '@/hooks/useFcmToken';
import { usePrepTickets } from '@/hooks/usePrepTickets';
import { getTodayYmdInTimeZone } from '@/lib/date';
import { env } from '@/lib/env';
import { corporateAccountService, type CorporateAccountDropdownItem } from '@/services/corporateAccountService';
import { customerCreditService, type CustomerCreditDropdownItem } from '@/services/customerCreditService';
import { houseAccountService, type HouseAccountDropdownItem } from '@/services/houseAccountService';
import { orderService } from '@/services/orderService';
import { prepTicketService } from '@/services/prepTicketService';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { Avatar, Button, KDSCard, OrderCard, PageHeader, PageLayout, StatCard } from '@/components/ui';
import { InboxNudge } from '@/components/comms/InboxNudge';
import { ApiError } from '@/types/api';
import type { OrderDetail, OrderSummary, SplitPaymentLine } from '@/types/order';
import type { AddSplitLinePayload, PaymentPayload } from '@/components/orders/OrderDetailBottomSheet';
import type { ShiftAssignment, ShiftAssignmentClockRecord } from '@/types/shift';

const ROLE_PLACEHOLDERS = new Set(['waiter', 'chef', 'barista', 'manager', 'director', 'admin', 'staff', 'user', 'system']);

const toTitleCase = (value: string): string => {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
};

const getPreferredFirstName = (rawName: string | undefined): string => {
  if (!rawName) {
    return 'there';
  }

  const trimmedName = rawName.trim();
  if (!trimmedName) {
    return 'there';
  }

  const words = trimmedName.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return toTitleCase(words[0]);
  }

  const parts = trimmedName.split(/[._-]+/).filter(Boolean);
  const cleanedParts = parts
    .map((part) => part.replace(/\d+/g, '').replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean);

  const nonRolePart = cleanedParts.find((part) => !ROLE_PLACEHOLDERS.has(part.toLowerCase()));
  if (nonRolePart) {
    return toTitleCase(nonRolePart);
  }

  if (cleanedParts[0]) {
    return toTitleCase(cleanedParts[0]);
  }

  return toTitleCase(trimmedName.replace(/[^a-zA-Z]/g, '')) || 'there';
};

const getGreetingPrefix = (): 'morning' | 'afternoon' | 'evening' => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 18) {
    return 'afternoon';
  }
  return 'evening';
};

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
  const [houseAccounts, setHouseAccounts] = useState<HouseAccountDropdownItem[]>([]);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccountDropdownItem[]>([]);
  const [customerCreditAccounts, setCustomerCreditAccounts] = useState<CustomerCreditDropdownItem[]>([]);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [latestOrders, setLatestOrders] = useState<OrderSummary[]>([]);
  const [ticketsCompletedToday, setTicketsCompletedToday] = useState(0);
  const [avgPrepMinutesToday, setAvgPrepMinutesToday] = useState(0);
  const [todayShiftAssignments, setTodayShiftAssignments] = useState<ShiftAssignment[]>([]);

  const myInProgressTickets = useMemo(
    () => inProgressTickets.filter((ticket) => ticket.claimedBy?.id === user?.id),
    [inProgressTickets, user?.id],
  );
  const greetingTime = useMemo(() => getGreetingPrefix(), []);
  const displayFirstName = useMemo(() => getPreferredFirstName(user?.name), [user?.name]);
  const headerAvatarName = useMemo(() => {
    if (!user?.name) {
      return displayFirstName;
    }

    return user.name.includes(' ') ? user.name : displayFirstName;
  }, [displayFirstName, user?.name]);

  const loadWaiterDashboardData = useCallback(async () => {
    if (!accessToken || role !== 'WAITER') {
      return;
    }

    const todayDate = getTodayYmdInTimeZone();
    const perPage = 50;
    let page = 1;
    let totalPages = 1;
    const collectedOrders: OrderSummary[] = [];

    do {
      const result = await orderService.getMany(
        {
          date: todayDate,
          view: 'summary',
          page,
          perPage,
        },
        accessToken,
      );

      collectedOrders.push(...result.orders);
      totalPages = result.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);

    const nonCancelledOrders = collectedOrders.filter((order) => order.status !== 'CANCELLED');

    setTodayOrderCount(nonCancelledOrders.length);
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
      const todayDate = getTodayYmdInTimeZone();
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

  const loadTodayShiftAssignments = useCallback(async () => {
    if (!accessToken || (role !== 'WAITER' && role !== 'CHEF' && role !== 'BARISTA' && role !== 'STEWARD' && role !== 'HOUSEKEEPING')) {
      return;
    }

    try {
      const todayDate = getTodayYmdInTimeZone();
      const assignments = await shiftService.listAssignments(
        {
          startDate: todayDate,
          endDate: todayDate,
        },
        accessToken,
      );
      // Department heads get the full department roster back from this
      // endpoint (needed for the scheduling grid) — this widget is personal
      // clock-in only, so narrow to the signed-in user's own assignment(s).
      setTodayShiftAssignments(assignments.filter((a) => a.userId === user?.id));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load today shift.';
      toast({
        variant: 'warning',
        title: message,
      });
    }
  }, [accessToken, role, toast, user?.id]);

  useEffect(() => {
    void loadTodayShiftAssignments();
  }, [loadTodayShiftAssignments]);

  useEffect(() => {
    if (!accessToken || !env.creditAccounts) return;
    void houseAccountService.listActive(accessToken).then(setHouseAccounts).catch(() => { /* non-critical */ });
    void corporateAccountService.list(accessToken).then((data) => {
      setCorporateAccounts(data as CorporateAccountDropdownItem[]);
    }).catch(() => { /* non-critical */ });
    void customerCreditService.list(accessToken).then((data) => {
      setCustomerCreditAccounts(data as CustomerCreditDropdownItem[]);
    }).catch(() => { /* non-critical */ });
  }, [accessToken]);

  const handleClockUpdated = useCallback((assignmentId: string, record: ShiftAssignmentClockRecord) => {
    setTodayShiftAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId
          ? {
              ...assignment,
              clockRecord: record,
            }
          : assignment,
      ),
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

  const handlePayment = async (orderId: string, payload: PaymentPayload) => {
    if (!accessToken) {
      return;
    }

    try {
      await orderService.recordPayment(orderId, payload, accessToken);
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

  const handleAddSplitLine = async (orderId: string, payload: AddSplitLinePayload): Promise<SplitPaymentLine> => {
    if (!accessToken) throw new Error('Not authenticated');
    const line = await orderService.addSplitLine(orderId, payload, accessToken);
    setSelectedOrder((prev) =>
      prev ? { ...prev, splitPaymentLines: [...prev.splitPaymentLines, line] } : prev,
    );
    return line;
  };

  const handleDeleteSplitLine = async (orderId: string, lineId: string): Promise<void> => {
    if (!accessToken) throw new Error('Not authenticated');
    await orderService.deleteSplitLine(orderId, lineId, accessToken);
    setSelectedOrder((prev) =>
      prev ? { ...prev, splitPaymentLines: prev.splitPaymentLines.filter((l) => l.id !== lineId) } : prev,
    );
  };

  const handleCreateCustomerCredit = async (name: string, phone: string, creditLimit: string): Promise<string> => {
    if (!accessToken) throw new Error('Not authenticated');
    const account = await customerCreditService.createAccount({ customerName: name, customerPhone: phone, creditLimit }, accessToken);
    setCustomerCreditAccounts((prev) => [
      ...prev,
      { id: account.id, customerName: account.customerName, customerPhone: account.customerPhone, creditLimit: account.creditLimit, currentBalance: account.currentBalance },
    ]);
    return account.id;
  };

  if (role === 'WAITER') {
    return (
      <PageLayout className="space-y-6">
        <header className="mb-6 flex items-start justify-between border-b border-stone-200 pb-4">
          <div className="min-w-0 pr-4">
            <h1 className="text-heading-lg font-sans font-semibold leading-tight text-stone-900 sm:text-heading-xl">
              {`Good ${greetingTime}, ${displayFirstName}`}
            </h1>
            <p className="mt-1 text-body-md text-stone-500">Your live order dashboard</p>
          </div>
          <Link
            href="/app/profile"
            aria-label="Open profile"
            className="rounded-full focus-visible:outline-none focus-visible:shadow-focus"
          >
            <Avatar name={headerAvatarName} size="md" />
          </Link>
        </header>

        <InboxNudge />

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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
          <StatCard
            className="p-4"
            label="Orders Today"
            value={String(todayOrderCount)}
            valueClassName="font-sans text-heading-xl font-bold tabular-nums tracking-tight"
          />
        </div>

        {/* Unresolved stale-order liability warning (renders only when there are any) */}
        <StaleOrderLiabilityCard accessToken={accessToken} />

        {/* Other income quick action */}
        <Link
          href="/app/other-income/new"
          className="flex items-center gap-3 rounded-xl border border-[#F0D080] bg-[#FDF3DC] px-4 py-3 transition-colors hover:bg-[#FBE9B0] focus-visible:outline-none focus-visible:shadow-focus"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0D080]">
            <Banknote size={18} className="text-[#92650A]" />
          </div>
          <div className="min-w-0">
            <p className="text-label-md font-semibold text-[#92650A]">Record Other Income</p>
            <p className="text-body-sm text-[#92650A] opacity-70">Pool table, events, merchandise…</p>
          </div>
        </Link>

        <ClockWidget assignments={todayShiftAssignments} onUpdated={handleClockUpdated} />

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
                hasRejectedTickets={order.prepTickets.some((t) => t.status === 'REJECTED')}
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
          onPayment={(orderId, payload) => void handlePayment(orderId, payload)}
          houseAccounts={houseAccounts}
          corporateAccounts={corporateAccounts}
          customerCreditAccounts={customerCreditAccounts}
          onCreateCustomerCredit={(name, phone, limit) => handleCreateCustomerCredit(name, phone, limit)}
          onAddSplitLine={(orderId, payload) => handleAddSplitLine(orderId, payload)}
          onDeleteSplitLine={(orderId, lineId) => handleDeleteSplitLine(orderId, lineId)}
        />
      </PageLayout>
    );
  }

  if (role === 'CHEF' || role === 'BARISTA') {
    return (
      <PageLayout className="space-y-6">
        <header className="mb-6 flex items-start justify-between border-b border-stone-200 pb-4">
          <div className="min-w-0 pr-4">
            <h1 className="text-heading-lg font-sans font-semibold leading-tight text-stone-900 sm:text-heading-xl">
              {`Good ${greetingTime}, ${displayFirstName}`}
            </h1>
            <p className="mt-1 text-body-md text-stone-500">Your preparation queue snapshot</p>
          </div>
          <Link
            href="/app/profile"
            aria-label="Open profile"
            className="rounded-full focus-visible:outline-none focus-visible:shadow-focus"
          >
            <Avatar name={headerAvatarName} size="md" />
          </Link>
        </header>

        <InboxNudge />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StatCard
            className="p-4"
            label="Tickets Completed Today"
            value={String(ticketsCompletedToday)}
            valueClassName="font-sans text-heading-xl font-bold tabular-nums tracking-tight"
          />
          <StatCard
            className="p-4"
            label="Avg Prep Time Today"
            value={`${avgPrepMinutesToday} min`}
            valueClassName="font-sans text-heading-xl font-bold tabular-nums tracking-tight"
          />
        </div>

        <ClockWidget assignments={todayShiftAssignments} onUpdated={handleClockUpdated} />

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

  if (role === 'STEWARD' || role === 'HOUSEKEEPING') {
    const roleLabel = role === 'STEWARD' ? 'Steward' : 'Housekeeping';
    return (
      <PageLayout className="space-y-6">
        <header className="mb-6 flex items-start justify-between border-b border-stone-200 pb-4">
          <div className="min-w-0 pr-4">
            <h1 className="text-heading-lg font-sans font-semibold leading-tight text-stone-900 sm:text-heading-xl">
              {`Good ${greetingTime}, ${displayFirstName}`}
            </h1>
            <p className="mt-1 text-body-md text-stone-500">{roleLabel} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <Link
            href="/app/profile"
            aria-label="Open profile"
            className="rounded-full focus-visible:outline-none focus-visible:shadow-focus"
          >
            <Avatar name={headerAvatarName} size="md" />
          </Link>
        </header>

        <InboxNudge />

        {canPromptFcmPermission && (
          <div className="rounded-md border border-[#F0D080] bg-[#FDF3DC] p-3">
            <p className="text-body-sm text-[#92650A]">
              Enable notifications to get messages and shift reminders on this device.
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

        <ClockWidget assignments={todayShiftAssignments} onUpdated={handleClockUpdated} />

        {/* Quick-access cards */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/app/hr/my-leave"
            className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:bg-stone-50 transition-colors"
          >
            <span className="text-[22px]">🏖️</span>
            <span className="mt-1 text-[13px] font-semibold text-stone-800">My Leave</span>
            <span className="text-[11px] text-stone-400">View &amp; request leave</span>
          </Link>
          <Link
            href="/app/payslips"
            className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:bg-stone-50 transition-colors"
          >
            <span className="text-[22px]">💳</span>
            <span className="mt-1 text-[13px] font-semibold text-stone-800">My Payments</span>
            <span className="text-[11px] text-stone-400">Salary &amp; payslips</span>
          </Link>
          <Link
            href="/app/inbox"
            className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:bg-stone-50 transition-colors"
          >
            <span className="text-[22px]">💬</span>
            <span className="mt-1 text-[13px] font-semibold text-stone-800">Inbox</span>
            <span className="text-[11px] text-stone-400">Messages &amp; announcements</span>
          </Link>
          <Link
            href="/app/profile"
            className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:bg-stone-50 transition-colors"
          >
            <span className="text-[22px]">👤</span>
            <span className="mt-1 text-[13px] font-semibold text-stone-800">My Profile</span>
            <span className="text-[11px] text-stone-400">Account &amp; settings</span>
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Dashboard" subtitle="No dashboard view available for this role." />
    </PageLayout>
  );
}
