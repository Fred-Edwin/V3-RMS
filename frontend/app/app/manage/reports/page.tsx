'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  CalendarOff,
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
import { listLeaveRequests } from '@/services/hrService';
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
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/hr';
import { LeaveTypeBadge, LeaveStatusBadge, formatDateRange, roleLabel } from '@/components/hr/LeaveTypeBadge';

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



const TABS = ['Overview', 'Staff', 'Peak Hours', 'Menu Items', 'Leave'] as const;
type Tab = (typeof TABS)[number];

const LEAVE_STATUS_FILTERS: { value: LeaveStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const LEAVE_TYPE_FILTERS: { value: LeaveType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SICK', label: 'Sick' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'UNPAID', label: 'Unpaid' },
];

type StaffRow = Record<string, unknown> & StaffPerformanceRow;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerAnalyticsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const searchParams = useSearchParams();

  const defaultStart = useMemo(() => toYmd(getMonthStart(new Date())), []);
  const defaultEnd = useMemo(() => toYmd(new Date()), []);

  // ── Shared state ──────────────────────────────────────────────────────────
  const initialTab = useMemo((): Tab => {
    const t = searchParams.get('tab');
    return (TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'Overview';
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
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
  const [itemsSortKey, setItemsSortKey] = useState<'quantitySold'>('quantitySold');
  const [itemsSortDir, setItemsSortDir] = useState<'desc' | 'asc'>('desc');

  // ── Leave (tab 5) ─────────────────────────────────────────────────────────
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[] | null>(null);
  const [isLoadingLeave, setIsLoadingLeave] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | ''>('');
  const [leaveSearch, setLeaveSearch] = useState('');

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

  const runLeave = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingLeave(true);
    try {
      const res = await listLeaveRequests({ page: 1, limit: 200 }, accessToken);
      setLeaveRequests(res.items);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load leave data.';
      toast({ variant: 'error', title: 'Leave report failed', message });
      setLeaveRequests(null);
    } finally {
      setIsLoadingLeave(false);
    }
  }, [accessToken, toast]);

  const handleRun = useCallback((): void => {
    setCommittedStart(startDate);
    setCommittedEnd(endDate);
    setHasRun(true);
    // Invalidate lazy-loaded tab data so it re-fetches with the new date range
    setLeaveRequests(null);
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
    if (activeTab === 'Leave' && !leaveRequests && !isLoadingLeave) {
      void runLeave();
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



  // ── Leave derived values ──────────────────────────────────────────────────

  const leaveStats = useMemo(() => {
    if (!leaveRequests) return null;
    const approved = leaveRequests.filter((r) => r.status === 'APPROVED');
    const pending = leaveRequests.filter((r) => r.status === 'PENDING');
    const rejected = leaveRequests.filter((r) => r.status === 'REJECTED');
    const totalDaysTaken = approved.reduce((sum, r) => sum + Number(r.totalDays), 0);
    const byType = (['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID'] as LeaveType[]).map((t) => ({
      type: t,
      count: approved.filter((r) => r.leaveType === t).length,
      days: approved.filter((r) => r.leaveType === t).reduce((s, r) => s + Number(r.totalDays), 0),
    }));
    return { approved: approved.length, pending: pending.length, rejected: rejected.length, totalDaysTaken, byType };
  }, [leaveRequests]);

  const filteredLeave = useMemo(() => {
    if (!leaveRequests) return [];
    return leaveRequests
      .filter((r) => leaveStatusFilter === 'ALL' || r.status === leaveStatusFilter)
      .filter((r) => !leaveTypeFilter || r.leaveType === leaveTypeFilter)
      .filter((r) => {
        if (!leaveSearch) return true;
        return r.employeeProfile.user.name.toLowerCase().includes(leaveSearch.toLowerCase());
      });
  }, [leaveRequests, leaveStatusFilter, leaveTypeFilter, leaveSearch]);

  // ── Items sort ────────────────────────────────────────────────────────────

  const sortedTopItems = useMemo(() => {
    if (!itemsData) return [];
    return [...itemsData.topItems].sort((a, b) =>
      itemsSortDir === 'desc' ? b.quantitySold - a.quantitySold : a.quantitySold - b.quantitySold
    );
  }, [itemsData, itemsSortDir]);

  const sortedBottomItems = useMemo(() => {
    if (!itemsData) return [];
    return [...itemsData.bottomItems].sort((a, b) =>
      itemsSortDir === 'desc' ? b.quantitySold - a.quantitySold : a.quantitySold - b.quantitySold
    );
  }, [itemsData, itemsSortDir]);

  const handleItemsSort = (key: 'quantitySold') => {
    if (itemsSortKey === key) {
      setItemsSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setItemsSortKey(key);
      setItemsSortDir('desc');
    }
  };

  const ItemsSortIcon = ({ col }: { col: 'quantitySold' }) => {
    if (itemsSortKey !== col) return <ArrowUpDown size={12} className="ml-1 inline opacity-30" />;
    return itemsSortDir === 'desc'
      ? <ArrowDown size={12} className="ml-1 inline text-espresso" />
      : <ArrowUp size={12} className="ml-1 inline text-espresso" />;
  };

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
                  <option value={0}>All</option>
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
          ) : itemsData.limit === 0 ? (
            /* ── All items — single ranked table ── */
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ChevronUp size={16} className="text-status-ready-text" />
                <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                  All Items ({sortedTopItems.length})
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b-2 border-stone-200 bg-stone-50">
                      <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">#</th>
                      <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">Item</th>
                      <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">Category</th>
                      <th
                        className="cursor-pointer select-none px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500 hover:text-stone-800"
                        onClick={() => handleItemsSort('quantitySold')}
                      >
                        Qty Sold<ItemsSortIcon col="quantitySold" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sortedTopItems.map((item, i) => (
                      <tr key={item.menuItemId} className="hover:bg-stone-50">
                        <td className="px-3 py-2.5 tabular-nums text-stone-400">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-stone-900">{item.name}</td>
                        <td className="px-3 py-2.5 text-caption text-stone-400">{item.categoryName}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{item.quantitySold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── Top / bottom split view ── */
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
                        <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">#</th>
                        <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">Item</th>
                        <th
                          className="cursor-pointer select-none px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500 hover:text-stone-800"
                          onClick={() => handleItemsSort('quantitySold')}
                        >
                          Qty<ItemsSortIcon col="quantitySold" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sortedTopItems.map((item, i) => (
                        <tr key={item.menuItemId} className="hover:bg-stone-50">
                          <td className="px-3 py-2.5 tabular-nums text-stone-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-stone-900">{item.name}</span>
                            <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-stone-700">{item.quantitySold}</td>
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
                        <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">#</th>
                        <th className="px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500">Item</th>
                        <th
                          className="cursor-pointer select-none px-3 py-2.5 text-label-sm font-medium uppercase tracking-wider text-stone-500 hover:text-stone-800"
                          onClick={() => handleItemsSort('quantitySold')}
                        >
                          Qty<ItemsSortIcon col="quantitySold" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sortedBottomItems.map((item, i) => (
                        <tr key={item.menuItemId} className="hover:bg-stone-50">
                          <td className="px-3 py-2.5 tabular-nums text-stone-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-stone-900">{item.name}</span>
                            <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-stone-700">{item.quantitySold}</td>
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

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5 — LEAVE
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Leave' && (
        <div className="space-y-5">

          {/* ── Summary KPI cards ─────────────────────────────────────── */}
          {isLoadingLeave ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-shimmer rounded-xl bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
              ))}
            </div>
          ) : leaveStats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Approved</p>
                <p className="mt-1.5 font-display text-display-md font-bold text-[#1A6B3C] tabular-nums">{leaveStats.approved}</p>
                <p className="mt-0.5 text-caption text-stone-400">{leaveStats.totalDaysTaken}d total taken</p>
              </div>
              <div className="rounded-xl border border-[#F0D080] bg-[#FFFDF5] p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-[#92650A]">Pending</p>
                <p className="mt-1.5 font-display text-display-md font-bold text-[#92650A] tabular-nums">{leaveStats.pending}</p>
                <p className="mt-0.5 text-caption text-[#92650A]">Awaiting HR review</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Rejected</p>
                <p className="mt-1.5 font-display text-display-md font-bold text-[#9B3A2A] tabular-nums">{leaveStats.rejected}</p>
                <p className="mt-0.5 text-caption text-stone-400">Declined requests</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Days Taken</p>
                <p className="mt-1.5 font-display text-display-md font-bold text-espresso tabular-nums">{leaveStats.totalDaysTaken}</p>
                <p className="mt-0.5 text-caption text-stone-400">Approved leave days</p>
              </div>
            </div>
          ) : null}

          {/* ── By leave type breakdown ────────────────────────────────── */}
          {!isLoadingLeave && leaveStats && (
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-heading-sm font-semibold text-stone-900">Approved Leave by Type</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {leaveStats.byType.map(({ type, count, days }) => (
                  <div key={type} className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
                    <div className="mb-2"><LeaveTypeBadge type={type} /></div>
                    <p className="tabular-nums text-heading-sm font-bold text-stone-900">{count} <span className="text-caption font-normal text-stone-400">requests</span></p>
                    <p className="tabular-nums text-caption text-stone-500">{days} days taken</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Request history table ──────────────────────────────────── */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-3">
              <p className="text-heading-sm font-semibold text-stone-900 mr-2">All Requests</p>
              <input
                type="search"
                placeholder="Search by name…"
                value={leaveSearch}
                onChange={(e) => setLeaveSearch(e.target.value)}
                className="h-8 w-40 rounded-lg border border-stone-200 bg-stone-50 px-3 text-body-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                {LEAVE_STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setLeaveStatusFilter(f.value)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                      leaveStatusFilter === f.value
                        ? 'bg-[#2C1810] text-white'
                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value as LeaveType | '')}
                className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2 text-body-sm text-stone-700 focus:border-stone-400 focus:outline-none"
              >
                {LEAVE_TYPE_FILTERS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void runLeave()}
                disabled={isLoadingLeave}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-label-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                <CalendarOff size={13} />
                {isLoadingLeave ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {isLoadingLeave ? (
              <div className="divide-y divide-stone-100">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-stone-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-36 animate-pulse rounded bg-stone-200" />
                      <div className="h-3 w-52 animate-pulse rounded bg-stone-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLeave.length === 0 ? (
              <div className="px-5 py-12">
                <EmptyState
                  icon={<CalendarOff size={22} />}
                  heading="No records found"
                  body={leaveRequests === null ? 'Click Refresh to load leave data.' : 'No requests match the current filters.'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50">
                      <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Employee</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Type</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Dates</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Days</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Status</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Reviewed By</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredLeave.map((req) => (
                      <tr key={req.id} className="transition-colors hover:bg-stone-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-[11px] font-bold text-[#2C1810]">
                              {req.employeeProfile.user.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-semibold text-stone-900">{req.employeeProfile.user.name}</p>
                              <p className="text-caption text-stone-400">{roleLabel(req.employeeProfile.user.role)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><LeaveTypeBadge type={req.leaveType} /></td>
                        <td className="px-4 py-3.5 text-stone-600">{formatDateRange(req.startDate, req.endDate)}</td>
                        <td className="px-4 py-3.5 tabular-nums font-medium text-stone-700">{Number(req.totalDays)}d</td>
                        <td className="px-4 py-3.5"><LeaveStatusBadge status={req.status} /></td>
                        <td className="px-4 py-3.5">
                          {req.reviewedBy ? (
                            <span className="text-body-sm text-stone-700">{req.reviewedBy.name}</span>
                          ) : (
                            <span className="text-caption text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          {req.reviewComment ? (
                            <span className="truncate text-caption italic text-stone-400">&ldquo;{req.reviewComment}&rdquo;</span>
                          ) : (
                            <span className="text-caption text-stone-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </PageLayout>
  );
}
