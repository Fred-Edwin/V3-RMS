'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronUp,
  Clock3,
  DollarSign,
  ShoppingBag,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  DateRangeBar,
  EmptyState,
  ExportMenu,
  PageHeader,
  PageLayout,
  SkeletonTable,
  StatCard,
  TabBar,
} from '@/components/ui';
import { ComparisonBars, HourlyBarsChart, LineTrendChart } from '@/components/dashboard/PremiumChart';
import { RankedItemList } from '@/components/dashboard/RankedItemList';
import { CHART_AMBER, CHART_SUCCESS } from '@/lib/chart-colors';
import { RevenueBreakdownCard } from '@/components/dashboard/RevenueBreakdownCard';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { reportService } from '@/services/reportService';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  BranchOverview,
  BranchTrendsReport,
  DailySummary,
  HourlyHeatmapReport,
  ItemsPerformanceReport,
  StaffPerformancePeriod,
} from '@/types/report';
import type { ShiftAssignment } from '@/types/shift';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const getMonthStart = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);

const toYmd = (value: Date): string => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (ymd: string): string => {
  const parsed = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return ymd;
  return parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatShortDate = (ymd: string): string => {
  const parsed = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return ymd;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDay = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const daysBetween = (start: string, end: string): number => {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000));
};

type ClockStatusKind = 'in' | 'out' | 'none';

const getClockStatus = (assignment: ShiftAssignment): { label: string; kind: ClockStatusKind; isOverride: boolean } => {
  const record = assignment.clockRecord;
  if (!record) return { label: 'Not yet clocked', kind: 'none', isOverride: false };
  const isOverride = record.clockInMethod === 'OVERRIDE' || record.clockOutMethod === 'OVERRIDE';
  if (record.clockInAt && !record.clockOutAt) return { label: 'Clocked in', kind: 'in', isOverride };
  if (record.clockInAt && record.clockOutAt) return { label: 'Clocked out', kind: 'out', isOverride };
  return { label: 'Not yet clocked', kind: 'none', isOverride };
};

const clockStatusSortRank: Record<ClockStatusKind, number> = { in: 0, none: 1, out: 2 };

type ActiveTab = 'daily' | 'period';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectorBranchDetailPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const branchId = typeof params.branchId === 'string' ? params.branchId : '';

  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const todayDate = useMemo(() => toYmdInTimeZone(new Date(), 'Africa/Nairobi'), []);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');

  // ── Branch metadata ───────────────────────────────────────────────────────
  const [branch, setBranch] = useState<BranchDto | null>(null);

  // ── Daily tab state ───────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [hourlyDataDaily, setHourlyDataDaily] = useState<HourlyHeatmapReport | null>(null);
  const [waiterBreakdown, setWaiterBreakdown] = useState<StaffPerformancePeriod | null>(null);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);

  // ── Period tab state ──────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [endDate, setEndDate] = useState<string>(() => toYmd(new Date()));
  const [committedStart, setCommittedStart] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [committedEnd, setCommittedEnd] = useState<string>(() => toYmd(new Date()));
  const [periodOverview, setPeriodOverview] = useState<BranchOverview | null>(null);
  const [periodTrends, setPeriodTrends] = useState<BranchTrendsReport | null>(null);
  const [periodStaff, setPeriodStaff] = useState<StaffPerformancePeriod | null>(null);
  const [periodHourly, setPeriodHourly] = useState<HourlyHeatmapReport | null>(null);
  const [periodItems, setPeriodItems] = useState<ItemsPerformanceReport | null>(null);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
  const [isExportingBranch, setIsExportingBranch] = useState(false);
  const [isExportingStaff, setIsExportingStaff] = useState(false);
  const [hasRunPeriod, setHasRunPeriod] = useState(false);

  // ── Load branch metadata ──────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !branchId) return;
    branchService.getBranchProfile(branchId, accessToken).then((b) => {
      setBranch(b);
    }).catch(() => {});
  }, [accessToken, branchId]);

  // ── Daily loaders ─────────────────────────────────────────────────────────

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
            setHourlyDataDaily(fallbackHourly);
            setWaiterBreakdown(fallbackWaiters);
            toast({ variant: 'info', title: 'Showing latest sales day', message: `No closed orders today. Showing ${fallbackDate} instead.` });
            return;
          }
        }
      }

      setDailySummary(summary);
      setHourlyDataDaily(hourly);
      setWaiterBreakdown(waiters);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branch summary.';
      toast({ variant: 'error', title: 'Branch summary failed', message });
      setDailySummary(null);
      setHourlyDataDaily(null);
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

  useEffect(() => { void loadDailySummary(); }, [loadDailySummary]);
  useEffect(() => { void loadShiftAssignments(); }, [loadShiftAssignments]);

  // ── Period loader ─────────────────────────────────────────────────────────

  const runPeriodReport = useCallback(async (start: string, end: string): Promise<void> => {
    if (!accessToken || !branchId) return;
    setIsLoadingPeriod(true);
    try {
      const [overview, trends, staff, hourly, items] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: start, endDate: end }),
        reportService.getBranchTrends(accessToken, { startDate: start, endDate: end, organizationId: branchId }),
        reportService.getStaffPerformance(accessToken, { startDate: start, endDate: end, organizationId: branchId }),
        reportService.getHourlyHeatmap(accessToken, { startDate: start, endDate: end, organizationId: branchId }),
        reportService.getItemsPerformance(accessToken, { startDate: start, endDate: end, organizationId: branchId, limit: 10 }),
      ]);
      // getBranchOverview is system-wide — find this branch's row
      const branchRow = overview.branches.find((b) => b.id === branchId) ?? null;
      setPeriodOverview(branchRow ? { ...overview, branches: [branchRow], totalRevenue: branchRow.revenue, totalOrders: branchRow.orderCount } : overview);
      setPeriodTrends(trends);
      setPeriodStaff(staff);
      setPeriodHourly(hourly);
      setPeriodItems(items);
      setHasRunPeriod(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load period report.';
      toast({ variant: 'error', title: 'Period report failed', message });
      setPeriodOverview(null);
      setPeriodTrends(null);
      setPeriodStaff(null);
      setPeriodHourly(null);
      setPeriodItems(null);
    } finally {
      setIsLoadingPeriod(false);
    }
  }, [accessToken, branchId, toast]);

  const handleRunPeriod = useCallback((): void => {
    setCommittedStart(startDate);
    setCommittedEnd(endDate);
    void runPeriodReport(startDate, endDate);
  }, [endDate, runPeriodReport, startDate]);

  // Auto-run period on first switch to that tab
  useEffect(() => {
    if (activeTab === 'period' && !hasRunPeriod) {
      void runPeriodReport(startDate, endDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on tab switch
  }, [activeTab]);

  // ── Export handlers ───────────────────────────────────────────────────────

  const exportBranchReport = useCallback(async (format: 'csv' | 'pdf'): Promise<void> => {
    if (!accessToken) return;
    setIsExportingBranch(true);
    try {
      await reportService.exportReport(accessToken, { reportType: 'branch_overview', format, startDate: committedStart, endDate: committedEnd });
      toast({ variant: 'success', title: `${format.toUpperCase()} download started` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Export failed.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingBranch(false);
    }
  }, [accessToken, committedEnd, committedStart, toast]);

  const exportStaffReport = useCallback(async (format: 'csv' | 'pdf'): Promise<void> => {
    if (!accessToken) return;
    setIsExportingStaff(true);
    try {
      await reportService.exportReport(accessToken, { reportType: 'staff_performance', format, startDate: committedStart, endDate: committedEnd, organizationId: branchId });
      toast({ variant: 'success', title: `${format.toUpperCase()} download started` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Export failed.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingStaff(false);
    }
  }, [accessToken, branchId, committedEnd, committedStart, toast]);

  // ── Derived — daily ───────────────────────────────────────────────────────

  const summaryAvgPrep = useMemo(() => {
    if (!dailySummary) return 0;
    return Math.round((dailySummary.averagePrepTimeMinutes.KITCHEN + dailySummary.averagePrepTimeMinutes.BARISTA) / 2);
  }, [dailySummary]);

  const summaryAvgOrderValue = useMemo(() => {
    if (!dailySummary || dailySummary.orderCount === 0) return 'KES 0.00';
    const total = Number.parseFloat(dailySummary.totalRevenue);
    if (Number.isNaN(total)) return 'KES 0.00';
    return `KES ${(total / dailySummary.orderCount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [dailySummary]);

  const formattedTotalRevenue = useMemo(() => {
    if (!dailySummary) return 'KES 0.00';
    const num = Number.parseFloat(dailySummary.totalRevenue);
    return Number.isNaN(num) ? 'KES 0.00' : `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [dailySummary]);

  const totalRevenueNum = useMemo(() => Number.parseFloat(dailySummary?.totalRevenue ?? '0') || 0, [dailySummary]);

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

  // ── Derived — period ──────────────────────────────────────────────────────

  const periodRevenueTrendData = useMemo(
    () => periodTrends?.points.map((p) => ({ label: formatDay(p.date), value: Number.parseFloat(p.revenue) || 0, date: p.date })) ?? [],
    [periodTrends],
  );

  const periodOrdersTrendData = useMemo(
    () => periodTrends?.points.map((p) => ({ label: formatDay(p.date), value: p.orders, date: p.date })) ?? [],
    [periodTrends],
  );

  const periodTotalRevenue = useMemo(
    () => Number.parseFloat(periodOverview?.totalRevenue ?? '0') || 0,
    [periodOverview],
  );

  const periodAvgOrderValue = useMemo(() => {
    if (!periodOverview || periodOverview.totalOrders === 0) return 'KES 0.00';
    const avg = periodTotalRevenue / periodOverview.totalOrders;
    return `KES ${avg.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [periodOverview, periodTotalRevenue]);

  const periodAvgPrep = useMemo(() => {
    const row = periodOverview?.branches[0];
    if (!row) return null;
    return Math.round((row.averagePrepTimeMinutes.KITCHEN + row.averagePrepTimeMinutes.BARISTA) / 2);
  }, [periodOverview]);

  const periodLabel = `${formatShortDate(committedStart)} – ${formatShortDate(committedEnd)}`;

  const isTodaySelected = selectedDate === todayDate;
  const topCardLabelSuffix = isTodaySelected ? 'Today' : formatDisplayDate(selectedDate);
  const formattedSelectedDate = formatDisplayDate(selectedDate);
  const hasClosedOrders = (dailySummary?.orderCount ?? 0) > 0;
  const branchName = branch?.name ?? 'Branch';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-office-canvas">
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

      {/* ── Tab switcher ── */}
      <TabBar
        variant="segmented"
        tabs={[
          { value: 'daily', label: 'Daily View' },
          { value: 'period', label: 'Period Report' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DAILY TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'daily' && (
        <>
          {/* Top stat cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Closed Orders" value={dailySummary?.orderCount ?? 0} caption={topCardLabelSuffix} icon={<Activity size={18} />} />
            <StatCard label="Revenue" value={formattedTotalRevenue} caption={topCardLabelSuffix} icon={<DollarSign size={18} />} />
            <StatCard label="Avg Order Value" value={summaryAvgOrderValue} caption="Closed orders" icon={<ShoppingBag size={18} />} />
            <StatCard label="Avg Prep" value={`${summaryAvgPrep} min`} caption={topCardLabelSuffix} icon={<Clock3 size={18} />} className="col-span-2 sm:col-span-1" />
          </section>

          {/* Staff on shift + revenue breakdown */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-heading-md font-semibold text-stone-900">Staff On Shift Today</h3>
              <p className="mt-0.5 text-body-sm text-stone-500">Clock-in status and override visibility.</p>
              <div className="mt-4 divide-y divide-stone-100">
                {isLoadingShifts ? (
                  <SkeletonTable rows={4} columns={3} />
                ) : shiftAssignments.length === 0 ? (
                  <EmptyState icon={<Users size={22} />} heading="No assignments for today" body="Staff assigned for today will appear here." />
                ) : (
                  [...shiftAssignments]
                    .sort((a, b) => clockStatusSortRank[getClockStatus(a).kind] - clockStatusSortRank[getClockStatus(b).kind])
                    .map((assignment) => {
                      const status = getClockStatus(assignment);
                      return (
                        <div key={assignment.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                          <div>
                            <p className="text-body-sm font-medium text-stone-900">{assignment.user.name}</p>
                            <p className="text-caption text-stone-500">{assignment.user.role}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {status.isOverride && <Badge tone="warning">Override</Badge>}
                            <Badge tone={status.kind === 'in' ? 'success' : 'neutral'}>{status.label}</Badge>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
            <RevenueBreakdownCard totalRevenue={totalRevenueNum} period={formattedSelectedDate} />
          </section>

          {/* Daily Summary section */}
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
              <div className="mt-4"><SkeletonTable rows={5} columns={4} /></div>
            ) : !dailySummary ? (
              <EmptyState icon={<DollarSign size={22} />} heading="No summary data" body="Try a different date or verify order closure activity for this branch." className="mt-4" />
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
                  <ComparisonBars title="Order Count by Type" data={orderTypeBars} />
                  <ComparisonBars title="Revenue by Payment Method" data={paymentMethodBars} valueFormatter={(value) => `KES ${value.toFixed(2)}`} />
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
                                  {Number.parseFloat(r.paymentBreakdown!.mpesa) > 0 ? formatCurrency(r.paymentBreakdown!.mpesa) : <span className="text-stone-400">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                                  {Number.parseFloat(r.paymentBreakdown!.cash) > 0 ? formatCurrency(r.paymentBreakdown!.cash) : <span className="text-stone-400">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                                  {Number.parseFloat(r.paymentBreakdown!.card) > 0 ? formatCurrency(r.paymentBreakdown!.card) : <span className="text-stone-400">—</span>}
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

                {hourlyDataDaily && (
                  <div>
                    <h4 className="mb-3 text-heading-sm font-semibold text-stone-900">Orders by Hour</h4>
                    <HourlyBarsChart data={hourlyDataDaily} showDow={false} />
                  </div>
                )}

                <div>
                  <h4 className="mb-3 text-heading-sm font-semibold text-stone-900">Top Selling Items</h4>
                  {dailySummary.topItems.length === 0 ? (
                    <p className="text-body-sm text-stone-500">No sales data for this date.</p>
                  ) : (
                    <RankedItemList items={dailySummary.topItems} variant="top" formatCurrency={formatCurrency} />
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PERIOD TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'period' && (
        <>
          {/* Date range controls */}
          <DateRangeBar
            className="gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onRun={handleRunPeriod}
            isRunning={isLoadingPeriod}
          >
            <ExportMenu label="Export Branch" isLoading={isExportingBranch} onExport={(format) => void exportBranchReport(format)} />
            <ExportMenu label="Export Staff" isLoading={isExportingStaff} onExport={(format) => void exportStaffReport(format)} />
          </DateRangeBar>

          {isLoadingPeriod ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 animate-shimmer rounded-lg bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
                ))}
              </div>
              <SkeletonTable rows={6} columns={4} />
            </div>
          ) : !hasRunPeriod ? (
            <EmptyState icon={<Activity size={22} />} heading="Select a date range" body="Choose a start and end date above, then click Run." />
          ) : (
            <div className="space-y-6">

              {/* KPI strip */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Total Revenue" value={formatCurrency(periodTotalRevenue)} caption={periodLabel} icon={<DollarSign size={18} />} />
                <StatCard label="Total Orders" value={periodOverview?.totalOrders ?? 0} caption={periodLabel} icon={<Activity size={18} />} />
                <StatCard label="Avg Order Value" value={periodAvgOrderValue} caption={periodLabel} icon={<ShoppingBag size={18} />} />
                <StatCard label="Avg Prep" value={periodAvgPrep !== null ? `${periodAvgPrep} min` : '—'} caption="Kitchen + Barista avg" icon={<Clock3 size={18} />} />
              </div>

              {/* Revenue allocation */}
              {periodTotalRevenue > 0 && (
                <RevenueBreakdownCard totalRevenue={periodTotalRevenue} period={periodLabel} />
              )}

              {/* Trend charts */}
              {periodTrends && periodTrends.points.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <LineTrendChart
                    title="Revenue (KES)"
                    subtitle={`Daily revenue — ${periodLabel}`}
                    data={periodRevenueTrendData}
                    accentColor={CHART_SUCCESS}
                    valueFormatter={(value) => `KES ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}`}
                    tooltipUnit="KES"
                    summaryLabel="Total Revenue"
                  />
                  <LineTrendChart
                    title="Orders"
                    subtitle={`Daily order volume — ${periodLabel}`}
                    data={periodOrdersTrendData}
                    accentColor={CHART_AMBER}
                    valueFormatter={(value) => String(Math.round(value))}
                    tooltipUnit="Orders"
                    summaryLabel="Total Orders"
                  />
                </div>
              )}

              {/* Hourly heatmap */}
              {periodHourly && (
                <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-heading-sm font-semibold text-stone-900">Orders by Hour</h3>
                  <HourlyBarsChart data={periodHourly} showDow={daysBetween(committedStart, committedEnd) >= 14} />
                </div>
              )}

              {/* Staff performance */}
              {periodStaff && periodStaff.staff.length > 0 && (
                <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-heading-sm font-semibold text-stone-900">Staff Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-body-sm">
                      <thead>
                        <tr className="border-b-2 border-stone-200">
                          <th className="pb-2.5 pr-4 text-label-sm font-medium uppercase tracking-wider text-stone-500">Name</th>
                          <th className="pb-2.5 pr-4 text-label-sm font-medium uppercase tracking-wider text-stone-500">Role</th>
                          <th className="pb-2.5 pr-4 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Orders / Tickets</th>
                          <th className="pb-2.5 pr-4 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Avg Value / Prep</th>
                          <th className="pb-2.5 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Sched / Actual Hrs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {periodStaff.staff.map((row) => (
                          <tr key={row.id} className="h-[52px] hover:bg-stone-50">
                            <td className="pr-4 font-medium text-stone-900">{row.name}</td>
                            <td className="pr-4 text-stone-600">{row.role}</td>
                            <td className="pr-4 text-right tabular-nums text-stone-700">{row.ordersHandled}</td>
                            <td className="pr-4 text-right tabular-nums text-stone-700">
                              {row.role === 'WAITER' ? formatCurrency(row.averageOrderValue ?? '0') : `${row.averagePrepTimeMinutes ?? 0} min`}
                            </td>
                            <td className="text-right tabular-nums text-stone-700">
                              {row.scheduledHours.toFixed(1)} / {row.actualHours.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Item Performance */}
              {periodItems && (periodItems.topItems.length > 0 || periodItems.bottomItems.length > 0) && (
                <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-heading-sm font-semibold text-stone-900">Item Performance</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-1.5">
                        <ChevronUp size={14} className="text-status-ready-text" />
                        <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">Top {periodItems.limit}</span>
                      </div>
                      <RankedItemList items={periodItems.topItems} variant="top" formatCurrency={formatCurrency} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-1.5">
                        <TrendingDown size={14} className="text-danger" />
                        <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">Bottom {periodItems.limit}</span>
                      </div>
                      <RankedItemList items={periodItems.bottomItems} variant="bottom" formatCurrency={formatCurrency} />
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}

    </PageLayout>
    </div>
  );
}
