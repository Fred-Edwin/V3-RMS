'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart2, CalendarDays, CheckCircle, ChevronUp, Clock, Clock3, ClipboardList, CreditCard, Printer, TrendingDown, Users, XCircle } from 'lucide-react';
import {
  Button,
  EmptyState,
  OrderCard,
  PageHeader,
  PageLayout,
  SkeletonTable,
  StatCard,
} from '@/components/ui';
import { ComparisonBars, HourlyBarsChart } from '@/components/dashboard/PremiumChart';
import { InboxNudge } from '@/components/comms/InboxNudge';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useToast } from '@/hooks/useToast';
import { getSocket } from '@/lib/socket';
import { houseAccountAuthService } from '@/services/houseAccountAuthService';
import { staffDiscountAuthService } from '@/services/staffDiscountAuthService';
import { customerDiscountAuthService } from '@/services/customerDiscountAuthService';
import { reportService } from '@/services/reportService';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { DailySummary, HourlyHeatmapReport, ItemsPerformanceReport } from '@/types/report';
import type { ShiftAssignment } from '@/types/shift';
import type { HouseAccountAuthRequest } from '@/types/houseAccountAuth';
import type { StaffDiscountAuthRequest } from '@/types/staffDiscountAuth';
import type { CustomerDiscountAuthRequest } from '@/types/discount';

const formatDisplayDate = (ymd: string): string => {
  const parsed = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return ymd;
  }

  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toYmdInTimeZone = (value: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return toYmd(value);
  }

  return `${year}-${month}-${day}`;
};

const shiftYmd = (ymd: string, deltaDays: number): string => {
  const [yearToken, monthToken, dayToken] = ymd.split('-');
  const year = Number(yearToken ?? '0');
  const month = Number(monthToken ?? '1');
  const day = Number(dayToken ?? '1');

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);

  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
};

const getClockStatus = (assignment: ShiftAssignment): { label: string; isOverride: boolean } => {
  const record = assignment.clockRecord;
  if (!record) {
    return { label: 'Not yet clocked', isOverride: false };
  }

  const isOverride = record.clockInMethod === 'OVERRIDE' || record.clockOutMethod === 'OVERRIDE';

  if (record.clockInAt && !record.clockOutAt) {
    return { label: 'Clocked in', isOverride };
  }

  if (record.clockInAt && record.clockOutAt) {
    return { label: 'Clocked out', isOverride };
  }

  return { label: 'Not yet clocked', isOverride };
};

export default function ManagerDashboardPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { activeOrders, isLoading: isLoadingOrders } = useActiveOrders();

  const todayDate = useMemo(() => toYmdInTimeZone(new Date(), 'Africa/Nairobi'), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [itemsData, setItemsData] = useState<ItemsPerformanceReport | null>(null);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [pendingAuths, setPendingAuths] = useState<HouseAccountAuthRequest[]>([]);
  const [authOverrideSubmittingId, setAuthOverrideSubmittingId] = useState<string | null>(null);
  const [pendingDiscountAuths, setPendingDiscountAuths] = useState<StaffDiscountAuthRequest[]>([]);
  const [discountOverrideSubmittingId, setDiscountOverrideSubmittingId] = useState<string | null>(null);
  const [pendingCustomerDiscountAuths, setPendingCustomerDiscountAuths] = useState<CustomerDiscountAuthRequest[]>([]);
  const [customerDiscountOverrideSubmittingId, setCustomerDiscountOverrideSubmittingId] = useState<string | null>(null);

  const loadDailySummary = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoadingSummary(true);
    try {
      const [summary, hourly, items] = await Promise.all([
        reportService.getDailySummary(accessToken, { date: selectedDate }),
        reportService.getHourlyHeatmap(accessToken, { startDate: selectedDate, endDate: selectedDate }),
        reportService.getItemsPerformance(accessToken, { startDate: selectedDate, endDate: selectedDate, limit: 5 }),
      ]);

      if (selectedDate === todayDate && summary.orderCount === 0) {
        for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
          const fallbackDate = shiftYmd(todayDate, -dayOffset);
          const [fallbackSummary, fallbackHourly, fallbackItems] = await Promise.all([
            reportService.getDailySummary(accessToken, { date: fallbackDate }),
            reportService.getHourlyHeatmap(accessToken, { startDate: fallbackDate, endDate: fallbackDate }),
            reportService.getItemsPerformance(accessToken, { startDate: fallbackDate, endDate: fallbackDate, limit: 5 }),
          ]);
          if (fallbackSummary.orderCount > 0) {
            setSelectedDate(fallbackDate);
            setDailySummary(fallbackSummary);
            setHourlyData(fallbackHourly);
            setItemsData(fallbackItems);
            toast({
              variant: 'info',
              title: 'Showing latest sales day',
              message: `No closed orders today. Showing ${fallbackDate} instead.`,
            });
            return;
          }
        }
      }

      setDailySummary(summary);
      setHourlyData(hourly);
      setItemsData(items);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load daily summary.';
      toast({
        variant: 'error',
        title: 'Daily summary failed',
        message,
      });
      setDailySummary(null);
      setHourlyData(null);
      setItemsData(null);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [accessToken, selectedDate, toast, todayDate]);

  const loadShiftAssignments = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoadingShifts(true);
    try {
      const assignments = await shiftService.listAssignments(
        {
          startDate: todayDate,
          endDate: todayDate,
        },
        accessToken,
      );
      setShiftAssignments(assignments);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load today shift roster.';
      toast({
        variant: 'warning',
        title: 'Shift roster failed',
        message,
      });
      setShiftAssignments([]);
    } finally {
      setIsLoadingShifts(false);
    }
  }, [accessToken, todayDate, toast]);

  useEffect(() => {
    void loadDailySummary();
  }, [loadDailySummary]);

  useEffect(() => {
    void loadShiftAssignments();
  }, [loadShiftAssignments]);

  useEffect(() => {
    if (!accessToken) return;
    houseAccountAuthService.listPending(accessToken)
      .then((data) => setPendingAuths(data))
      .catch(() => { /* non-critical */ });
    staffDiscountAuthService.listPending(accessToken)
      .then((data) => setPendingDiscountAuths(data))
      .catch(() => { /* non-critical */ });
    customerDiscountAuthService.listPending(accessToken)
      .then((data) => setPendingCustomerDiscountAuths(data))
      .catch(() => { /* non-critical */ });
  }, [accessToken]);

  // Keep widget in sync via socket — add new pending auths and remove resolved ones
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAuthPending = (payload: { orderId: string; authRequestId: string }) => {
      if (!accessToken) return;
      // Re-fetch the full auth record so we have holder name, amount, etc.
      houseAccountAuthService.getById(payload.authRequestId, accessToken)
        .then((req) => setPendingAuths((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [...prev, req];
        }))
        .catch(() => { /* non-critical */ });
    };
    const handleAuthResolved = (payload: { orderId: string }) => {
      setPendingAuths((prev) => prev.filter((r) => r.orderId !== payload.orderId));
    };
    socket.on('order:auth_pending', handleAuthPending);
    socket.on('order:auth_resolved', handleAuthResolved);
    return () => {
      socket.off('order:auth_pending', handleAuthPending);
      socket.off('order:auth_resolved', handleAuthResolved);
    };
  }, [accessToken]);

  // Keep staff discount widget in sync via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleDiscountPending = (payload: { orderId: string; authRequestId: string }) => {
      if (!accessToken) return;
      staffDiscountAuthService.getById(payload.authRequestId, accessToken)
        .then((req) => setPendingDiscountAuths((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [...prev, req];
        }))
        .catch(() => { /* non-critical */ });
    };
    const handleDiscountResolved = (payload: { orderId: string }) => {
      setPendingDiscountAuths((prev) => prev.filter((r) => r.orderId !== payload.orderId));
    };
    socket.on('order:staff_discount_pending', handleDiscountPending);
    socket.on('order:staff_discount_resolved', handleDiscountResolved);
    return () => {
      socket.off('order:staff_discount_pending', handleDiscountPending);
      socket.off('order:staff_discount_resolved', handleDiscountResolved);
    };
  }, [accessToken]);

  // Keep customer discount widget in sync via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleCustomerDiscountPending = (payload: { orderId: string; authRequestId: string }) => {
      if (!accessToken) return;
      customerDiscountAuthService.getById(payload.authRequestId, accessToken)
        .then((req) => setPendingCustomerDiscountAuths((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [...prev, req];
        }))
        .catch(() => { /* non-critical */ });
    };
    const handleCustomerDiscountResolved = (payload: { orderId: string }) => {
      setPendingCustomerDiscountAuths((prev) => prev.filter((r) => r.orderId !== payload.orderId));
    };
    socket.on('order:customer_discount_pending', handleCustomerDiscountPending);
    socket.on('order:customer_discount_resolved', handleCustomerDiscountResolved);
    return () => {
      socket.off('order:customer_discount_pending', handleCustomerDiscountPending);
      socket.off('order:customer_discount_resolved', handleCustomerDiscountResolved);
    };
  }, [accessToken]);

  const handleDiscountDecision = useCallback(async (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || discountOverrideSubmittingId) return;
    setDiscountOverrideSubmittingId(authRequestId);
    try {
      await staffDiscountAuthService.override(authRequestId, decision, accessToken);
      setPendingDiscountAuths((prev) => prev.filter((r) => r.id !== authRequestId));
      toast({
        variant: 'success',
        title: decision === 'APPROVED' ? 'Discount approved' : 'Discount rejected',
        message: decision === 'APPROVED' ? 'Order returned to Ready at discounted total.' : 'Order returned to Ready at full price.',
      });
    } catch {
      toast({ variant: 'error', title: 'Action failed', message: 'Could not process the decision.' });
    } finally {
      setDiscountOverrideSubmittingId(null);
    }
  }, [accessToken, discountOverrideSubmittingId, toast]);

  const handleCustomerDiscountDecision = useCallback(async (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || customerDiscountOverrideSubmittingId) return;
    setCustomerDiscountOverrideSubmittingId(authRequestId);
    try {
      await customerDiscountAuthService.override(authRequestId, decision, accessToken);
      setPendingCustomerDiscountAuths((prev) => prev.filter((r) => r.id !== authRequestId));
      toast({
        variant: 'success',
        title: decision === 'APPROVED' ? 'Discount approved' : 'Discount rejected',
        message: decision === 'APPROVED' ? 'Order returned to Ready at discounted total.' : 'Order returned to Ready at full price.',
      });
    } catch {
      toast({ variant: 'error', title: 'Action failed', message: 'Could not process the decision.' });
    } finally {
      setCustomerDiscountOverrideSubmittingId(null);
    }
  }, [accessToken, customerDiscountOverrideSubmittingId, toast]);

  const handleAuthDecision = useCallback(async (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || authOverrideSubmittingId) return;
    setAuthOverrideSubmittingId(authRequestId);
    try {
      await houseAccountAuthService.override(authRequestId, decision, accessToken);
      setPendingAuths((prev) => prev.filter((r) => r.id !== authRequestId));
      toast({
        variant: 'success',
        title: decision === 'APPROVED' ? 'Charge approved' : 'Charge rejected',
        message: decision === 'APPROVED' ? 'The order has been closed.' : 'Order returned to the waiter.',
      });
    } catch {
      toast({ variant: 'error', title: 'Action failed', message: 'Could not process the decision.' });
    } finally {
      setAuthOverrideSubmittingId(null);
    }
  }, [accessToken, authOverrideSubmittingId, toast]);

  const summaryAvgPrep = useMemo(() => {
    if (!dailySummary) {
      return 0;
    }

    return Math.round(
      (dailySummary.averagePrepTimeMinutes.KITCHEN + dailySummary.averagePrepTimeMinutes.BARISTA) / 2,
    );
  }, [dailySummary]);

  const orderTypeBars = useMemo(() => {
    if (!dailySummary) {
      return [];
    }

    return [
      { label: 'Dine-In', value: dailySummary.ordersByType.DINE_IN },
      { label: 'Take-Away', value: dailySummary.ordersByType.TAKE_AWAY },
      { label: 'Delivery', value: dailySummary.ordersByType.DELIVERY },
    ];
  }, [dailySummary]);

  const isTodaySelected = selectedDate === todayDate;
  const topCardLabelSuffix = isTodaySelected ? 'Today' : formatDisplayDate(selectedDate);
  const formattedSelectedDate = formatDisplayDate(selectedDate);
  const hasClosedOrdersForSelectedDate = (dailySummary?.orderCount ?? 0) > 0;

  const idleReadyOrders = useMemo(() => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return activeOrders.filter(
      (o) => o.status === 'READY' && new Date(o.createdAt) < thirtyMinutesAgo,
    );
  }, [activeOrders]);

  return (
    <PageLayout className="animate-fade-up space-y-6 print:space-y-4">
      {/* ── Print header (hidden on screen) ───────────────────────── */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-stone-900">Manager Dashboard — Daily Summary</h1>
        <p className="mt-1 text-sm text-stone-600">{formattedSelectedDate}</p>
        <p className="mt-1 text-xs text-stone-400">Generated {new Date().toLocaleString('en-GB')}</p>
        <hr className="mt-3 border-stone-200" />
      </div>

      <div className="flex items-start justify-between gap-3 print:hidden">
        <PageHeader
          title="Manager Dashboard"
          subtitle="Live operations and daily branch insights."
          titleClassName="font-display text-display-lg font-semibold text-espresso"
        />
        <Button
          variant="ghost"
          leftIcon={<Printer size={16} />}
          className="mt-1 shrink-0"
          onClick={() => window.print()}
        >
          Print
        </Button>
      </div>

      <InboxNudge />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard
          label="Closed Orders"
          value={dailySummary?.orderCount ?? 0}
          caption={isTodaySelected ? 'Today' : topCardLabelSuffix}
          icon={<Activity size={18} />}
        />
        <StatCard
          label="Avg Prep"
          value={`${summaryAvgPrep} min`}
          caption={isTodaySelected ? 'Today' : topCardLabelSuffix}
          icon={<Clock3 size={18} />}
        />
      </section>

      {!hasClosedOrdersForSelectedDate && (
        <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/8 px-4 py-3">
          <CalendarDays size={16} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-body-sm text-stone-700">
            No closed orders for <span className="font-medium">{formattedSelectedDate}</span>. Totals reflect closed orders only.
          </p>
        </div>
      )}

      {/* Idle READY orders alert — only shown when waiters have forgotten to close */}
      {idleReadyOrders.length > 0 && (
        <div className="rounded-xl border border-amber/40 bg-amber/8 p-4 print:hidden">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-[#92400E]">
                {idleReadyOrders.length === 1
                  ? '1 order has been ready for over 30 minutes'
                  : `${idleReadyOrders.length} orders have been ready for over 30 minutes`}
              </p>
              <p className="mt-0.5 text-caption text-stone-500">A waiter may have forgotten to record payment.</p>
              <div className="mt-3 space-y-1.5">
                {idleReadyOrders.map((order) => {
                  const minutesAgo = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                  const elapsed = minutesAgo >= 60
                    ? `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`
                    : `${minutesAgo}m ago`;
                  return (
                    <div key={order.id} className="flex items-center gap-2 text-body-sm">
                      <span className="font-medium text-stone-800">#{order.dailyNumber}</span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-600">{order.createdBy.name}</span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-400">{elapsed}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending House Account Authorizations ───────────────────── */}
      {pendingAuths.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 print:hidden">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600 shrink-0" />
            <p className="text-body-sm font-semibold text-amber-800">
              {pendingAuths.length === 1
                ? '1 house account charge awaiting your approval'
                : `${pendingAuths.length} house account charges awaiting your approval`}
            </p>
          </div>
          <div className="space-y-2">
            {pendingAuths.map((req) => {
              const expired = new Date(req.expiresAt) < new Date();
              const loading = authOverrideSubmittingId === req.id;
              return (
                <div key={req.id} className="rounded-lg border border-amber-200 bg-white p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-stone-900">
                      Order #{req.order.dailyNumber}
                      <span className="ml-2 font-normal text-stone-500">
                        KES {Number.parseFloat(req.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p className="text-caption text-stone-500 mt-0.5">
                      {req.houseAccount.user.name} · via {req.requestedBy.name}
                      {expired && <span className="ml-1 text-red-500">· Expired</span>}
                    </p>
                  </div>
                  {!expired && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={!!authOverrideSubmittingId}
                        onClick={() => void handleAuthDecision(req.id, 'APPROVED')}
                        className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-label-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? (
                          <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <CheckCircle size={13} />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={!!authOverrideSubmittingId}
                        onClick={() => void handleAuthDecision(req.id, 'REJECTED')}
                        className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-label-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? (
                          <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <XCircle size={13} />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending Staff Discount Authorizations ──────────────────── */}
      {pendingDiscountAuths.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 print:hidden">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600 shrink-0" />
            <p className="text-body-sm font-semibold text-amber-800">
              {pendingDiscountAuths.length === 1
                ? '1 staff discount awaiting your approval'
                : `${pendingDiscountAuths.length} staff discounts awaiting your approval`}
            </p>
          </div>
          <div className="space-y-2">
            {pendingDiscountAuths.map((req) => {
              const loading = discountOverrideSubmittingId === req.id;
              const original = Number.parseFloat(req.originalAmount);
              const discounted = original - Number.parseFloat(req.discountAmount);
              return (
                <div key={req.id} className="rounded-lg border border-amber-200 bg-white p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-stone-900">
                      Order #{req.order.dailyNumber}
                      <span className="ml-2 font-normal text-stone-500 line-through">
                        KES {original.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="ml-1.5 font-semibold text-green-700">
                        → KES {discounted.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p className="text-caption text-stone-500 mt-0.5">
                      30% staff discount · requested by {req.requestedBy.name}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!!discountOverrideSubmittingId}
                      onClick={() => void handleDiscountDecision(req.id, 'APPROVED')}
                      className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-label-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <CheckCircle size={13} />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={!!discountOverrideSubmittingId}
                      onClick={() => void handleDiscountDecision(req.id, 'REJECTED')}
                      className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-label-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <XCircle size={13} />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending Customer Discount Authorizations ──────────────── */}
      {pendingCustomerDiscountAuths.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 print:hidden">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600 shrink-0" />
            <p className="text-body-sm font-semibold text-amber-800">
              {pendingCustomerDiscountAuths.length === 1
                ? '1 customer discount awaiting your approval'
                : `${pendingCustomerDiscountAuths.length} customer discounts awaiting your approval`}
            </p>
          </div>
          <div className="space-y-2">
            {pendingCustomerDiscountAuths.map((req) => {
              const loading = customerDiscountOverrideSubmittingId === req.id;
              const original = Number.parseFloat(req.originalAmount);
              const discounted = original - Number.parseFloat(req.discountAmount);
              const discountLabel = req.discount.type === 'PERCENTAGE'
                ? `${req.discount.value}% off`
                : `KES ${Number.parseFloat(req.discount.value).toLocaleString('en-KE', { minimumFractionDigits: 2 })} off`;
              return (
                <div key={req.id} className="rounded-lg border border-amber-200 bg-white p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-stone-900">
                      Order #{req.order.dailyNumber}
                      <span className="ml-2 font-normal text-stone-500 line-through">
                        KES {original.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="ml-1.5 font-semibold text-green-700">
                        → KES {discounted.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p className="text-caption text-stone-500 mt-0.5">
                      {req.discount.name} · {discountLabel} · requested by {req.requestedBy.name}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!!customerDiscountOverrideSubmittingId}
                      onClick={() => void handleCustomerDiscountDecision(req.id, 'APPROVED')}
                      className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-label-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <CheckCircle size={13} />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={!!customerDiscountOverrideSubmittingId}
                      onClick={() => void handleCustomerDiscountDecision(req.id, 'REJECTED')}
                      className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-label-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <XCircle size={13} />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-heading-md font-semibold text-stone-900">Active Orders Feed</h3>
          <p className="mt-0.5 text-body-sm text-stone-500">Real-time branch order activity.</p>

          <div className="mt-4 space-y-3">
            {isLoadingOrders ? (
              <SkeletonTable rows={4} columns={2} />
            ) : activeOrders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={22} />}
                heading="No active orders"
                body="New incoming orders will appear here in real time."
              />
            ) : (
              activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  orderNumber={order.dailyNumber}
                  status={order.status}
                  type={order.type}
                  tableNumber={order.tableNumber ?? undefined}
                  startTime={order.createdAt}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-heading-md font-semibold text-stone-900">Staff On Shift Today</h3>
          <p className="mt-0.5 text-body-sm text-stone-500">Clock-in status and override visibility.</p>

          <div className="mt-4 divide-y divide-stone-100">
            {isLoadingShifts ? (
              <SkeletonTable rows={4} columns={3} />
            ) : shiftAssignments.length === 0 ? (
              <EmptyState
                icon={<Users size={22} />}
                heading="No assignments for today"
                body="Staff assigned for today will appear here."
              />
            ) : (
              shiftAssignments.map((assignment) => {
                const status = getClockStatus(assignment);
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-body-sm font-medium text-stone-900">{assignment.user.name}</p>
                      <p className="text-caption text-stone-500">{assignment.user.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-label-sm font-semibold text-espresso">{status.label}</p>
                      {status.isOverride && (
                        <p className="text-caption text-amber">Override</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-display-lg font-semibold text-espresso">Daily Summary</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">Order mix, top items, and prep performance.</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-label-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-100">
            <CalendarDays size={14} className="shrink-0 text-stone-500" />
            <span>{formattedSelectedDate}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {isLoadingSummary ? (
          <div className="mt-4">
            <SkeletonTable rows={5} columns={4} />
          </div>
        ) : !dailySummary ? (
          <EmptyState
            icon={<CreditCard size={22} />}
            heading="No summary data"
            body="Try a different date or verify order closure and payment activity."
            className="mt-4"
          />
        ) : (
          <div className="mt-5 space-y-6">
            {!hasClosedOrdersForSelectedDate && (
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-body-sm text-stone-600">
                No closed orders were recorded for {formattedSelectedDate}. Active orders still appear in the Live Operations panel.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              <StatCard label="Closed Orders" value={dailySummary.orderCount} icon={<Activity size={16} />} />
              <StatCard
                label="Top Item"
                value={dailySummary.topItems[0]?.name ?? '—'}
                caption={dailySummary.topItems[0] ? `Qty ${dailySummary.topItems[0].quantitySold}` : undefined}
                icon={<BarChart2 size={16} />}
              />
              <StatCard
                label="Prep K / B"
                value={`${dailySummary.averagePrepTimeMinutes.KITCHEN} / ${dailySummary.averagePrepTimeMinutes.BARISTA} min`}
                icon={<Clock3 size={16} />}
              />
            </div>

            <ComparisonBars
              title="Order Count by Type"
              data={orderTypeBars}
            />

            {hourlyData && (
              <div>
                <h4 className="mb-3 text-heading-sm font-semibold text-stone-900">Orders by Hour</h4>
                <HourlyBarsChart data={hourlyData} showDow={false} />
              </div>
            )}

            {/* Item Performance — top + bottom */}
            {itemsData && (itemsData.topItems.length > 0 || itemsData.bottomItems.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <ChevronUp size={14} className="text-status-ready-text" />
                    <h4 className="text-heading-sm font-semibold text-stone-900">Top 5 Items</h4>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {itemsData.topItems.map((item, i) => (
                      <div key={item.menuItemId} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-espresso text-[10px] font-bold text-crema">{i + 1}</span>
                          <div>
                            <span className="text-body-sm text-stone-800">{item.name}</span>
                            <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-label-sm font-semibold text-espresso">{item.quantitySold} sold</p>
                          <p className="text-caption text-stone-400">KES {Number.parseFloat(item.revenue).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <TrendingDown size={14} className="text-red-400" />
                    <h4 className="text-heading-sm font-semibold text-stone-900">Bottom 5 Items</h4>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {itemsData.bottomItems.map((item, i) => (
                      <div key={item.menuItemId} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600">{i + 1}</span>
                          <div>
                            <span className="text-body-sm text-stone-800">{item.name}</span>
                            <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-label-sm font-semibold text-stone-700">{item.quantitySold} sold</p>
                          <p className="text-caption text-stone-400">KES {Number.parseFloat(item.revenue).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </PageLayout>
  );
}

