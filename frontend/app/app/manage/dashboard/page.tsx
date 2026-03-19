'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart2, CalendarDays, Clock3, ClipboardList, CreditCard, DollarSign, Printer, ShoppingBag, Users } from 'lucide-react';
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
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { DailySummary, HourlyHeatmapReport } from '@/types/report';
import type { ShiftAssignment } from '@/types/shift';

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
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);

  const loadDailySummary = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoadingSummary(true);
    try {
      const [summary, hourly] = await Promise.all([
        reportService.getDailySummary(accessToken, { date: selectedDate }),
        reportService.getHourlyHeatmap(accessToken, { startDate: selectedDate, endDate: selectedDate }),
      ]);

      if (selectedDate === todayDate && summary.orderCount === 0) {
        for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
          const fallbackDate = shiftYmd(todayDate, -dayOffset);
          const [fallbackSummary, fallbackHourly] = await Promise.all([
            reportService.getDailySummary(accessToken, { date: fallbackDate }),
            reportService.getHourlyHeatmap(accessToken, { startDate: fallbackDate, endDate: fallbackDate }),
          ]);
          if (fallbackSummary.orderCount > 0) {
            setSelectedDate(fallbackDate);
            setDailySummary(fallbackSummary);
            setHourlyData(fallbackHourly);
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
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load daily summary.';
      toast({
        variant: 'error',
        title: 'Daily summary failed',
        message,
      });
      setDailySummary(null);
      setHourlyData(null);
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

  const summaryAvgPrep = useMemo(() => {
    if (!dailySummary) {
      return 0;
    }

    return Math.round(
      (dailySummary.averagePrepTimeMinutes.KITCHEN + dailySummary.averagePrepTimeMinutes.BARISTA) / 2,
    );
  }, [dailySummary]);

  const summaryAvgOrderValue = useMemo(() => {
    if (!dailySummary || dailySummary.orderCount === 0) return 'KES 0.00';
    const total = Number.parseFloat(dailySummary.totalRevenue);
    if (Number.isNaN(total)) return 'KES 0.00';
    const avg = total / dailySummary.orderCount;
    return `KES ${avg.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [dailySummary]);

  const formattedTotalRevenue = useMemo(() => {
    if (!dailySummary) return 'KES 0.00';
    const num = Number.parseFloat(dailySummary.totalRevenue);
    if (Number.isNaN(num)) return 'KES 0.00';
    return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const paymentMethodBars = useMemo(() => {
    if (!dailySummary) {
      return [];
    }

    return [
      { label: 'MPESA', value: Number.parseFloat(dailySummary.revenueByPaymentMethod.MPESA) || 0 },
      { label: 'Cash', value: Number.parseFloat(dailySummary.revenueByPaymentMethod.CASH) || 0 },
      { label: 'Card', value: Number.parseFloat(dailySummary.revenueByPaymentMethod.CARD) || 0 },
    ];
  }, [dailySummary]);

  const isTodaySelected = selectedDate === todayDate;
  const topCardLabelSuffix = isTodaySelected ? 'Today' : formatDisplayDate(selectedDate);
  const formattedSelectedDate = formatDisplayDate(selectedDate);
  const hasClosedOrdersForSelectedDate = (dailySummary?.orderCount ?? 0) > 0;

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

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Closed Orders"
          value={dailySummary?.orderCount ?? 0}
          caption={isTodaySelected ? 'Today' : topCardLabelSuffix}
          icon={<Activity size={18} />}
        />
        <StatCard
          label="Revenue"
          value={formattedTotalRevenue}
          caption={isTodaySelected ? 'Today' : topCardLabelSuffix}
          icon={<DollarSign size={18} />}
        />
        <StatCard
          label="Avg Order Value"
          value={summaryAvgOrderValue}
          caption="Closed orders"
          icon={<ShoppingBag size={18} />}
        />
        <StatCard
          label="Avg Prep"
          value={`${summaryAvgPrep} min`}
          caption={isTodaySelected ? 'Today' : topCardLabelSuffix}
          icon={<Clock3 size={18} />}
          className="col-span-2 sm:col-span-1"
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
            <p className="mt-0.5 text-body-sm text-stone-500">Revenue, order mix, top items, and payment breakdown.</p>
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
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Total Revenue" value={formattedTotalRevenue} icon={<DollarSign size={16} />} />
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

            <div className="grid gap-4 lg:grid-cols-2">
              <ComparisonBars
                title="Order Count by Type"
                data={orderTypeBars}
              />
              <ComparisonBars
                title="Revenue by Payment Method"
                data={paymentMethodBars}
                valueFormatter={(value) => `KES ${value.toFixed(2)}`}
              />
            </div>

            {hourlyData && (
              <div>
                <h4 className="mb-3 text-heading-sm font-semibold text-stone-900">Orders by Hour</h4>
                <HourlyBarsChart data={hourlyData} showDow={false} />
              </div>
            )}

            <div>
              <h4 className="mb-3 text-heading-sm font-semibold text-stone-900">Top 5 Selling Items</h4>
              {dailySummary.topItems.length === 0 ? (
                <p className="text-body-sm text-stone-500">No sales data for this date.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {dailySummary.topItems.map((item, index) => (
                    <div
                      key={item.menuItemId}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-espresso text-[10px] font-bold text-crema">
                          {index + 1}
                        </span>
                        <span className="text-body-sm text-stone-800">{item.name}</span>
                      </div>
                      <span className="text-label-sm font-semibold text-espresso">{item.quantitySold} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </PageLayout>
  );
}

