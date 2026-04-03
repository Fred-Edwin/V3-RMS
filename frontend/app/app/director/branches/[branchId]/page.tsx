'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  DollarSign,
  ShoppingBag,
  Users,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  PageLayout,
  SkeletonTable,
  StatCard,
} from '@/components/ui';
import { ComparisonBars, HourlyBarsChart } from '@/components/dashboard/PremiumChart';
import { RevenueBreakdownCard } from '@/components/dashboard/RevenueBreakdownCard';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { reportService } from '@/services/reportService';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { DailySummary, HourlyHeatmapReport, StaffPerformancePeriod } from '@/types/report';
import type { ShiftAssignment } from '@/types/shift';

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toYmdInTimeZone = (value: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    const d = value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (ymd: string): string => {
  const parsed = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return ymd;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getClockStatus = (assignment: ShiftAssignment): { label: string; isOverride: boolean } => {
  const record = assignment.clockRecord;
  if (!record) return { label: 'Not yet clocked', isOverride: false };
  const isOverride = record.clockInMethod === 'OVERRIDE' || record.clockOutMethod === 'OVERRIDE';
  if (record.clockInAt && !record.clockOutAt) return { label: 'Clocked in', isOverride };
  if (record.clockInAt && record.clockOutAt) return { label: 'Clocked out', isOverride };
  return { label: 'Not yet clocked', isOverride };
};

export default function DirectorBranchDetailPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const branchId = typeof params.branchId === 'string' ? params.branchId : '';

  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const todayDate = useMemo(() => toYmdInTimeZone(new Date(), 'Africa/Nairobi'), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [waiterBreakdown, setWaiterBreakdown] = useState<StaffPerformancePeriod | null>(null);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);

  // Load branch metadata once
  useEffect(() => {
    if (!accessToken || !branchId) return;
    branchService.getBranchProfile(branchId, accessToken).then((b) => {
      setBranch(b);
    }).catch(() => {
      // Non-critical — page still works without branch name
    });
  }, [accessToken, branchId]);

  const loadDailySummary = useCallback(async (): Promise<void> => {
    if (!accessToken || !branchId) return;

    setIsLoadingSummary(true);
    try {
      const [summary, hourly, waiters] = await Promise.all([
        reportService.getDailySummary(accessToken, { date: selectedDate, organizationId: branchId }),
        reportService.getHourlyHeatmap(accessToken, { startDate: selectedDate, endDate: selectedDate, organizationId: branchId }),
        reportService.getStaffPerformance(accessToken, { startDate: selectedDate, endDate: selectedDate, role: 'WAITER', organizationId: branchId }),
      ]);

      if (selectedDate === todayDate && summary.orderCount === 0) {
        for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
          const fallbackDate = shiftYmd(todayDate, -dayOffset);
          const [fallbackSummary, fallbackHourly, fallbackWaiters] = await Promise.all([
            reportService.getDailySummary(accessToken, { date: fallbackDate, organizationId: branchId }),
            reportService.getHourlyHeatmap(accessToken, { startDate: fallbackDate, endDate: fallbackDate, organizationId: branchId }),
            reportService.getStaffPerformance(accessToken, { startDate: fallbackDate, endDate: fallbackDate, role: 'WAITER', organizationId: branchId }),
          ]);
          if (fallbackSummary.orderCount > 0) {
            setSelectedDate(fallbackDate);
            setDailySummary(fallbackSummary);
            setHourlyData(fallbackHourly);
            setWaiterBreakdown(fallbackWaiters);
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
      setWaiterBreakdown(waiters);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branch summary.';
      toast({ variant: 'error', title: 'Branch summary failed', message });
      setDailySummary(null);
      setHourlyData(null);
      setWaiterBreakdown(null);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [accessToken, branchId, selectedDate, toast, todayDate]);

  const loadShiftAssignments = useCallback(async (): Promise<void> => {
    if (!accessToken || !branchId) return;

    setIsLoadingShifts(true);
    try {
      const assignments = await shiftService.listAssignments(
        { startDate: todayDate, endDate: todayDate, organizationId: branchId },
        accessToken,
      );
      setShiftAssignments(assignments);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load shift roster.';
      toast({ variant: 'warning', title: 'Shift roster failed', message });
      setShiftAssignments([]);
    } finally {
      setIsLoadingShifts(false);
    }
  }, [accessToken, branchId, todayDate, toast]);

  useEffect(() => {
    void loadDailySummary();
  }, [loadDailySummary]);

  useEffect(() => {
    void loadShiftAssignments();
  }, [loadShiftAssignments]);

  const summaryAvgPrep = useMemo(() => {
    if (!dailySummary) return 0;
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

  const totalRevenueNum = useMemo(() => {
    if (!dailySummary) return 0;
    return Number.parseFloat(dailySummary.totalRevenue) || 0;
  }, [dailySummary]);

  const orderTypeBars = useMemo(() => {
    if (!dailySummary) return [];
    return [
      { label: 'Dine-In', value: dailySummary.ordersByType.DINE_IN },
      { label: 'Take-Away', value: dailySummary.ordersByType.TAKE_AWAY },
      { label: 'Delivery', value: dailySummary.ordersByType.DELIVERY },
    ];
  }, [dailySummary]);

  const paymentMethodBars = useMemo(() => {
    if (!dailySummary) return [];
    return [
      { label: 'MPESA', value: Number.parseFloat(dailySummary.revenueByPaymentMethod.MPESA) || 0 },
      { label: 'Cash', value: Number.parseFloat(dailySummary.revenueByPaymentMethod.CASH) || 0 },
      { label: 'Card', value: Number.parseFloat(dailySummary.revenueByPaymentMethod.CARD) || 0 },
    ];
  }, [dailySummary]);

  const isTodaySelected = selectedDate === todayDate;
  const topCardLabelSuffix = isTodaySelected ? 'Today' : formatDisplayDate(selectedDate);
  const formattedSelectedDate = formatDisplayDate(selectedDate);
  const hasClosedOrders = (dailySummary?.orderCount ?? 0) > 0;
  const branchName = branch?.name ?? 'Branch';

  return (
    <PageLayout className="animate-fade-up space-y-6">
      {/* ── Back navigation ── */}
      <div>
        <Button
          variant="ghost"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => router.push('/app/director')}
          className="-ml-2 text-stone-600"
        >
          Back to Dashboard
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title={branchName}
          subtitle="Full branch operational and financial overview."
          titleClassName="font-display text-display-lg font-semibold text-espresso"
        />
      </div>

      {/* ── Top stat cards ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Closed Orders"
          value={dailySummary?.orderCount ?? 0}
          caption={topCardLabelSuffix}
          icon={<Activity size={18} />}
        />
        <StatCard
          label="Revenue"
          value={formattedTotalRevenue}
          caption={topCardLabelSuffix}
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
          caption={topCardLabelSuffix}
          icon={<Clock3 size={18} />}
          className="col-span-2 sm:col-span-1"
        />
      </section>

      {/* ── Staff on shift / date selector ── */}
      <section className="grid gap-4 lg:grid-cols-2">
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

        {/* Revenue breakdown card */}
        <RevenueBreakdownCard
          totalRevenue={totalRevenueNum}
          period={formattedSelectedDate}
        />
      </section>

      {/* ── Daily Summary ── */}
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
            icon={<DollarSign size={22} />}
            heading="No summary data"
            body="Try a different date or verify order closure activity for this branch."
            className="mt-4"
          />
        ) : (
          <div className="mt-5 space-y-6">
            {!hasClosedOrders && (
              <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/8 px-4 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
                <p className="text-body-sm text-stone-700">
                  No closed orders for <span className="font-medium">{formattedSelectedDate}</span>.
                </p>
              </div>
            )}

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

            {waiterBreakdown && waiterBreakdown.staff.some((r) => r.paymentBreakdown && Number.parseFloat(r.paymentBreakdown.total) > 0) && (
              <div>
                <h4 className="mb-3 text-heading-sm font-semibold text-stone-900">Collections by Waiter</h4>
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-left text-body-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50">
                        <th className="px-4 py-2.5 font-semibold text-stone-600">Waiter</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-stone-600">M-Pesa</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-stone-600">Cash</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-stone-600">Card</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-stone-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {waiterBreakdown.staff
                        .filter((r) => r.paymentBreakdown && Number.parseFloat(r.paymentBreakdown.total) > 0)
                        .map((r) => (
                          <tr key={r.id} className="transition-colors hover:bg-stone-50/60">
                            <td className="px-4 py-2.5 font-medium text-stone-800">{r.name}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                              {Number.parseFloat(r.paymentBreakdown!.mpesa) > 0
                                ? formatCurrency(r.paymentBreakdown!.mpesa)
                                : <span className="text-stone-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                              {Number.parseFloat(r.paymentBreakdown!.cash) > 0
                                ? formatCurrency(r.paymentBreakdown!.cash)
                                : <span className="text-stone-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                              {Number.parseFloat(r.paymentBreakdown!.card) > 0
                                ? formatCurrency(r.paymentBreakdown!.card)
                                : <span className="text-stone-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-stone-900">
                              {formatCurrency(r.paymentBreakdown!.total)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
