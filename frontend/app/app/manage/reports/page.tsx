'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  ChevronUp,
  Clock,
  Download,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  Select,
  SkeletonTable,
  StatCard,
  Table,
  type TableColumn,
} from '@/components/ui';
import { HourlyBarsChart, LineTrendChart } from '@/components/dashboard/PremiumChart';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  BranchTrendsReport,
  HourlyHeatmapReport,
  ItemsPerformanceReport,
  StaffPerformancePeriod,
  StaffPerformanceRow,
} from '@/types/report';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStart = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);


const formatDay = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatDisplayDate = (ymd: string): string => {
  const parsed = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return ymd;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const TABS = ['Overview', 'Staff', 'Peak Hours', 'Menu Items'] as const;
type Tab = (typeof TABS)[number];

type StaffRow = Record<string, unknown> & StaffPerformanceRow;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerAnalyticsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const defaultStart = useMemo(() => toYmd(getMonthStart(new Date())), []);
  const defaultEnd = useMemo(() => toYmd(new Date()), []);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [committedStart, setCommittedStart] = useState<string>(defaultStart);
  const [committedEnd, setCommittedEnd] = useState<string>(defaultEnd);
  const [hasRun, setHasRun] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Overview data (tab 1) ─────────────────────────────────────────────────
  const [branchTrends, setBranchTrends] = useState<BranchTrendsReport | null>(null);
  const [staffSummary, setStaffSummary] = useState<StaffPerformancePeriod | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // ── Staff (tab 2) ─────────────────────────────────────────────────────────
  const [staffRole, setStaffRole] = useState<string>('ALL');
  const [staffReport, setStaffReport] = useState<StaffPerformancePeriod | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // ── Peak Hours (tab 3) ────────────────────────────────────────────────────
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [isLoadingHourly, setIsLoadingHourly] = useState(false);

  // ── Menu Items (tab 4) ────────────────────────────────────────────────────
  const [itemsLimit, setItemsLimit] = useState<number>(10);
  const [itemsData, setItemsData] = useState<ItemsPerformanceReport | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const runOverview = useCallback(async (start: string, end: string): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingOverview(true);
    try {
      const [trendData, staffData] = await Promise.all([
        reportService.getBranchTrends(accessToken, { startDate: start, endDate: end }),
        reportService.getStaffPerformance(accessToken, { startDate: start, endDate: end }),
      ]);
      setBranchTrends(trendData);
      setStaffSummary(staffData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load analytics.';
      toast({ variant: 'error', title: 'Analytics failed', message });
      setBranchTrends(null);
      setStaffSummary(null);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [accessToken, toast]);

  const runStaff = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingStaff(true);
    try {
      const data = await reportService.getStaffPerformance(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        role: staffRole === 'ALL' ? undefined : (staffRole as 'WAITER' | 'CHEF' | 'BARISTA'),
      });
      setStaffReport(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff report.';
      toast({ variant: 'error', title: 'Staff report failed', message });
      setStaffReport(null);
    } finally {
      setIsLoadingStaff(false);
    }
  }, [accessToken, committedEnd, committedStart, staffRole, toast]);

  const runHourly = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingHourly(true);
    try {
      const data = await reportService.getHourlyHeatmap(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
      });
      setHourlyData(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load hourly data.';
      toast({ variant: 'error', title: 'Peak hours failed', message });
      setHourlyData(null);
    } finally {
      setIsLoadingHourly(false);
    }
  }, [accessToken, committedEnd, committedStart, toast]);

  const runItems = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingItems(true);
    try {
      const data = await reportService.getItemsPerformance(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        limit: itemsLimit,
      });
      setItemsData(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load items data.';
      toast({ variant: 'error', title: 'Items report failed', message });
      setItemsData(null);
    } finally {
      setIsLoadingItems(false);
    }
  }, [accessToken, committedEnd, committedStart, itemsLimit, toast]);

  const handleRun = useCallback((): void => {
    setCommittedStart(startDate);
    setCommittedEnd(endDate);
    setHasRun(true);
    void runOverview(startDate, endDate);
  }, [endDate, runOverview, startDate]);

  const handleExport = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsExporting(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'manager_analytics',
        format: 'pdf',
        startDate: committedStart,
        endDate: committedEnd,
      });
      toast({ variant: 'success', title: 'PDF download started' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to export report.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExporting(false);
    }
  }, [accessToken, committedEnd, committedStart, toast]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasRun) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);

  useEffect(() => {
    if (!hasRun) return;
    if (activeTab === 'Staff' && !staffReport && !isLoadingStaff) {
      void runStaff();
    }
    if (activeTab === 'Peak Hours' && !hourlyData && !isLoadingHourly) {
      void runHourly();
    }
    if (activeTab === 'Menu Items' && !itemsData && !isLoadingItems) {
      void runItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when tab changes
  }, [activeTab, hasRun]);

  // ── Derived values ────────────────────────────────────────────────────────

  const periodLabel = `${formatDisplayDate(committedStart)} – ${formatDisplayDate(committedEnd)}`;

  const kpiStats = useMemo(() => {
    if (!staffSummary || staffSummary.staff.length === 0) return null;
    const totalOrders = staffSummary.staff.reduce((sum, s) => sum + s.ordersHandled, 0);
    const prepStaff = staffSummary.staff.filter((s) => s.role === 'CHEF' || s.role === 'BARISTA');
    const avgPrepTime =
      prepStaff.length > 0
        ? prepStaff.reduce((sum, s) => sum + (s.averagePrepTimeMinutes ?? 0), 0) / prepStaff.length
        : 0;
    const scheduledTotal = staffSummary.staff.reduce((sum, s) => sum + s.scheduledHours, 0);
    const actualTotal = staffSummary.staff.reduce((sum, s) => sum + s.actualHours, 0);
    const attendanceRate = scheduledTotal > 0 ? (actualTotal / scheduledTotal) * 100 : 0;
    return { totalOrders, avgPrepTime, attendanceRate };
  }, [staffSummary]);

  const ordersTrendData = useMemo(
    () =>
      branchTrends?.points.map((p) => ({
        label: formatDay(p.date),
        value: p.orders,
        date: p.date,
      })) ?? [],
    [branchTrends],
  );

  const prepTrendData = useMemo(
    () =>
      branchTrends?.points.map((p) => ({
        label: formatDay(p.date),
        value: p.avgPrepCombined,
        date: p.date,
      })) ?? [],
    [branchTrends],
  );

  const staffRows = useMemo<StaffRow[]>(
    () => staffReport?.staff.map((r) => ({ ...r })) ?? [],
    [staffReport],
  );

  const waiterRows = useMemo<StaffRow[]>(
    () => staffRows.filter((r) => r.role === 'WAITER'),
    [staffRows],
  );

  const waiterCollectionTotals = useMemo(() => {
    if (waiterRows.length === 0) return null;
    let mpesa = 0, cash = 0, card = 0, total = 0;
    for (const w of waiterRows) {
      if (!w.paymentBreakdown) continue;
      mpesa += Number.parseFloat(w.paymentBreakdown.mpesa);
      cash += Number.parseFloat(w.paymentBreakdown.cash);
      card += Number.parseFloat(w.paymentBreakdown.card);
      total += Number.parseFloat(w.paymentBreakdown.total);
    }
    return { mpesa, cash, card, total };
  }, [waiterRows]);

  const staffColumns: Array<TableColumn<StaffRow>> = useMemo(() => [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    {
      key: 'ordersHandled',
      label: 'Orders / Tickets',
      render: (value) => <span className="tabular-nums">{String(value)}</span>,
    },
    {
      key: 'avgPrep',
      label: 'Avg Prep',
      render: (_v, row) => (
        <span className="tabular-nums">{row.averagePrepTimeMinutes ?? 0} min</span>
      ),
    },
    {
      key: 'scheduledHours',
      label: 'Sched Hrs',
      render: (value) => <span className="tabular-nums">{Number(value).toFixed(2)}</span>,
    },
    {
      key: 'actualHours',
      label: 'Actual Hrs',
      render: (value) => <span className="tabular-nums">{Number(value).toFixed(2)}</span>,
    },
  ], []);

  const showCollections = staffRole === 'ALL' || staffRole === 'WAITER';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout className="animate-fade-up space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Analytics"
            titleClassName="font-display text-display-lg font-semibold text-espresso"
            subtitle="Branch performance across the selected date range."
          />
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Button
              leftIcon={<BarChart2 size={15} />}
              onClick={handleRun}
              isLoading={isLoadingOverview}
            >
              Run
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download size={15} />}
              onClick={() => void handleExport()}
              isLoading={isExporting}
            >
              Download Report
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-label-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-espresso text-espresso'
                  : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1 — OVERVIEW
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {isLoadingOverview ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-shimmer rounded-lg bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
              ))}
            </div>
          ) : kpiStats ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard
                label="Total Orders / Tickets"
                value={kpiStats.totalOrders}
                icon={<Users size={18} />}
                caption={periodLabel}
              />
              <StatCard
                label="Avg Prep Time"
                value={`${Math.round(kpiStats.avgPrepTime)} min`}
                icon={<Clock size={18} />}
                caption="Kitchen + Barista"
              />
              <StatCard
                label="Attendance Rate"
                value={`${kpiStats.attendanceRate.toFixed(1)}%`}
                icon={<Users size={18} />}
                caption="Actual vs scheduled"
              />
            </div>
          ) : (
            <EmptyState icon={<TrendingUp size={22} />} heading="No data" body="Select a date range and click Run." />
          )}

          {isLoadingOverview ? (
            <SkeletonTable rows={6} columns={4} />
          ) : branchTrends ? (
            <div className="space-y-4">
              <LineTrendChart
                title="Total Orders"
                subtitle="Daily closed orders"
                data={ordersTrendData}
                accentColor="#C4862A"
                valueFormatter={(v) => String(Math.round(v))}
                tooltipUnit="Orders"
                summaryLabel="Total Orders"
              />
              <LineTrendChart
                title="Avg Prep Time (min)"
                subtitle="Daily average — kitchen + barista combined"
                data={prepTrendData}
                accentColor="#64748B"
                valueFormatter={(v) => `${Math.round(v)} min`}
                tooltipUnit="min"
                summaryLabel="Avg Prep"
              />
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2 — STAFF
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Staff' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-heading-md font-semibold text-stone-900">Staff Performance</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {staffReport ? `${staffReport.organizationName} · ${periodLabel}` : periodLabel}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select
                label="Role"
                value={staffRole}
                options={[
                  { value: 'ALL', label: 'All Roles' },
                  { value: 'WAITER', label: 'Waiter' },
                  { value: 'CHEF', label: 'Chef' },
                  { value: 'BARISTA', label: 'Barista' },
                ]}
                onChange={(e) => setStaffRole(e.target.value)}
              />
              <div className="col-span-2 flex items-end sm:col-span-3">
                <Button leftIcon={<Users size={15} />} onClick={() => void runStaff()} isLoading={isLoadingStaff}>
                  Run Report
                </Button>
              </div>
            </div>

            {isLoadingStaff ? (
              <SkeletonTable rows={6} columns={6} />
            ) : staffRows.length === 0 ? (
              <EmptyState icon={<Users size={22} />} heading="No staff data" body="Click Run Report to load staff metrics." />
            ) : (
              <div className="overflow-x-auto">
                <Table columns={staffColumns} data={staffRows} keyField="id" />
              </div>
            )}
          </div>

          {/* Waiter Collections Breakdown */}
          {!isLoadingStaff && showCollections && waiterRows.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-heading-md font-semibold text-stone-900">Waiter Collections</h2>
                <p className="mt-0.5 text-body-sm text-stone-500">
                  Payment method breakdown per waiter — {staffReport?.organizationName ?? ''} · {periodLabel}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-200 bg-stone-50">
                      {['Waiter', 'Orders', 'M-Pesa', 'Cash', 'Card', 'Total'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500 last:text-right">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {waiterRows.map((w, i) => (
                      <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                        <td className="px-3 py-2.5 font-medium text-stone-900">{w.name}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{w.ordersHandled}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{w.paymentBreakdown ? formatCurrency(w.paymentBreakdown.mpesa) : '—'}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{w.paymentBreakdown ? formatCurrency(w.paymentBreakdown.cash) : '—'}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{w.paymentBreakdown ? formatCurrency(w.paymentBreakdown.card) : '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-stone-900">{w.paymentBreakdown ? formatCurrency(w.paymentBreakdown.total) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {waiterCollectionTotals && (
                    <tfoot>
                      <tr className="border-t-2 border-stone-200 bg-stone-50">
                        <td className="px-3 py-2.5 text-label-sm font-semibold uppercase text-stone-700">Total</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-stone-900">
                          {waiterRows.reduce((sum, w) => sum + w.ordersHandled, 0)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-stone-900">{formatCurrency(waiterCollectionTotals.mpesa)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-stone-900">{formatCurrency(waiterCollectionTotals.cash)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-stone-900">{formatCurrency(waiterCollectionTotals.card)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-stone-900">{formatCurrency(waiterCollectionTotals.total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3 — PEAK HOURS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Peak Hours' && (
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-heading-md font-semibold text-stone-900">Order Volume by Time of Day</h2>
            <p className="mt-0.5 text-body-sm text-stone-500">
              {hourlyData ? `${hourlyData.organizationName} · ${periodLabel}` : periodLabel}
            </p>
          </div>
          {isLoadingHourly ? (
            <SkeletonTable rows={4} columns={4} />
          ) : !hourlyData ? (
            <EmptyState icon={<Clock size={22} />} heading="No data" body="Click Run to load peak hours data." />
          ) : (
            <HourlyBarsChart data={hourlyData} showDow />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4 — MENU ITEMS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Menu Items' && (
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-heading-md font-semibold text-stone-900">Item Performance</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {itemsData ? `${itemsData.organizationName} · ${periodLabel}` : 'Best and worst selling items for the period.'}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-label-sm text-stone-500">Show top / bottom</span>
                <select
                  value={itemsLimit}
                  onChange={(e) => setItemsLimit(Number(e.target.value))}
                  className="rounded-md border border-stone-200 bg-white px-2 py-1 text-body-sm text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber"
                >
                  {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={() => void runItems()} isLoading={isLoadingItems}>
                  Load Report
                </Button>
              </div>
            </div>
          </div>

          {isLoadingItems ? (
            <SkeletonTable rows={5} columns={4} />
          ) : !itemsData ? (
            <EmptyState icon={<ShoppingBag size={22} />} heading="No items data" body="Click Load Report to see item performance." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <ChevronUp size={16} className="text-status-ready-text" />
                  <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                    Top {itemsData.limit} Items
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="w-full text-left text-body-sm">
                    <thead>
                      <tr className="border-b-2 border-stone-200 bg-stone-50">
                        {['#', 'Item', 'Qty', 'Revenue'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {itemsData.topItems.map((item, i) => (
                        <tr key={item.menuItemId} className="hover:bg-stone-50">
                          <td className="px-3 py-2.5 tabular-nums text-stone-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-stone-900">{item.name}</span>
                            <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-stone-700">{item.quantitySold}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-stone-900">{formatCurrency(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-400" />
                  <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                    Bottom {itemsData.limit} Items
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="w-full text-left text-body-sm">
                    <thead>
                      <tr className="border-b-2 border-stone-200 bg-stone-50">
                        {['#', 'Item', 'Qty', 'Revenue'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {itemsData.bottomItems.map((item, i) => (
                        <tr key={item.menuItemId} className="hover:bg-stone-50">
                          <td className="px-3 py-2.5 tabular-nums text-stone-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-stone-900">{item.name}</span>
                            <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-stone-700">{item.quantitySold}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-stone-900">{formatCurrency(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </PageLayout>
  );
}
