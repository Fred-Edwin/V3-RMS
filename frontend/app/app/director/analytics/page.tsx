'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart2,
  CalendarOff,
  ChevronUp,
  Clock,
  Download,
  Globe,
  LayoutDashboard,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Button,
  DateRangeBar,
  EmptyState,
  ExcelTable,
  PageLayout,
  Select,
  SkeletonTable,
  StatCard,
  TabBar,
  type ExcelColumn,
} from '@/components/ui';
import { HourlyBarsChart, LineTrendChart, MultiLineTrendChart } from '@/components/dashboard/PremiumChart';
import { CHART_AMBER, CHART_SUCCESS } from '@/lib/chart-colors';
import { RevenueBreakdownCard } from '@/components/dashboard/RevenueBreakdownCard';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { listLeaveRequests } from '@/services/hrService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  BranchOverview,
  DirectorTrendsReport,
  DiscountUsageReport,
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

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const TABS = ['Overview', 'Branches', 'Revenue', 'Peak Hours', 'Staff', 'Menu Items', 'Discounts', 'Leave'] as const;
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

// ── Types ─────────────────────────────────────────────────────────────────────

type BranchReportRow = BranchOverview['branches'][number];
type StaffReportRow = StaffPerformanceRow;
type ItemRow = ItemsPerformanceReport['topItems'][number];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectorAnalyticsPage(): JSX.Element {
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
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [committedStart, setCommittedStart] = useState<string>(defaultStart);
  const [committedEnd, setCommittedEnd] = useState<string>(defaultEnd);
  const [hasRun, setHasRun] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Aggregate data (tabs 1–3) ─────────────────────────────────────────────
  const [branchOverviewReport, setBranchOverviewReport] = useState<BranchOverview | null>(null);
  const [directorTrends, setDirectorTrends] = useState<DirectorTrendsReport | null>(null);
  const [isLoadingAggregate, setIsLoadingAggregate] = useState(false);

  // ── Peak Hours (tab 4) ────────────────────────────────────────────────────
  const [hourlyBranchId, setHourlyBranchId] = useState<string>('');
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [isLoadingHourly, setIsLoadingHourly] = useState(false);

  // ── Staff (tab 5) ─────────────────────────────────────────────────────────
  const [staffBranchId, setStaffBranchId] = useState<string>('');
  const [staffRole, setStaffRole] = useState<string>('ALL');
  const [staffReport, setStaffReport] = useState<StaffPerformancePeriod | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // ── Menu Items (tab 6) ────────────────────────────────────────────────────
  const [itemsBranchId, setItemsBranchId] = useState<string>('');
  const [itemsLimit, setItemsLimit] = useState<number>(10);
  const [itemsData, setItemsData] = useState<ItemsPerformanceReport | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsSortKey, setItemsSortKey] = useState<'revenue' | 'quantitySold'>('revenue');
  const [itemsSortDir, setItemsSortDir] = useState<'desc' | 'asc'>('desc');

  // ── Discounts (tab 7) ─────────────────────────────────────────────────────
  const [discountsBranchId, setDiscountsBranchId] = useState<string>('');
  const [discountUsage, setDiscountUsage] = useState<DiscountUsageReport | null>(null);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);

  // ── Leave (tab 8) ─────────────────────────────────────────────────────────
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[] | null>(null);
  const [isLoadingLeave, setIsLoadingLeave] = useState(false);
  const [leaveBranchId, setLeaveBranchId] = useState<string>('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | ''>('');
  const [leaveSearch, setLeaveSearch] = useState('');

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadBranches = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    try {
      const data = await branchService.listBranches(accessToken);
      const active = data.filter((b) => b.isActive && !b.isHub);
      setBranches(active);
      setStaffBranchId((cur) => cur || active[0]?.id || '');
      setHourlyBranchId((cur) => cur || active[0]?.id || '');
      setItemsBranchId((cur) => cur || active[0]?.id || '');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branches.';
      toast({ variant: 'error', title: 'Branch lookup failed', message });
    }
  }, [accessToken, toast]);

  const runAggregate = useCallback(async (start: string, end: string): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingAggregate(true);
    try {
      const [branchData, trendsData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: start, endDate: end }),
        reportService.getDirectorTrends(accessToken, { startDate: start, endDate: end }),
      ]);
      setBranchOverviewReport(branchData);
      setDirectorTrends(trendsData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load analytics.';
      toast({ variant: 'error', title: 'Analytics failed', message });
      setBranchOverviewReport(null);
      setDirectorTrends(null);
    } finally {
      setIsLoadingAggregate(false);
    }
  }, [accessToken, toast]);

  const runHourly = useCallback(async (): Promise<void> => {
    if (!accessToken || !hourlyBranchId) return;
    setIsLoadingHourly(true);
    try {
      const data = await reportService.getHourlyHeatmap(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        organizationId: hourlyBranchId,
      });
      setHourlyData(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load hourly data.';
      toast({ variant: 'error', title: 'Peak hours failed', message });
      setHourlyData(null);
    } finally {
      setIsLoadingHourly(false);
    }
  }, [accessToken, committedEnd, committedStart, hourlyBranchId, toast]);

  const runStaff = useCallback(async (): Promise<void> => {
    if (!accessToken || !staffBranchId) return;
    setIsLoadingStaff(true);
    try {
      const data = await reportService.getStaffPerformance(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        organizationId: staffBranchId,
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
  }, [accessToken, committedEnd, committedStart, staffBranchId, staffRole, toast]);

  const runItems = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingItems(true);
    try {
      const data = await reportService.getItemsPerformance(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        organizationId: itemsBranchId || undefined,
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
  }, [accessToken, committedEnd, committedStart, itemsBranchId, itemsLimit, toast]);

  const runDiscounts = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingDiscounts(true);
    try {
      const data = await reportService.getDiscountUsage(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        organizationId: discountsBranchId || undefined,
      });
      setDiscountUsage(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load discount data.';
      toast({ variant: 'error', title: 'Discount report failed', message });
      setDiscountUsage(null);
    } finally {
      setIsLoadingDiscounts(false);
    }
  }, [accessToken, committedEnd, committedStart, discountsBranchId, toast]);

  const runLeave = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingLeave(true);
    try {
      const res = await listLeaveRequests(
        { organizationId: leaveBranchId || undefined, page: 1, limit: 500 },
        accessToken,
      );
      setLeaveRequests(res.items);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load leave data.';
      toast({ variant: 'error', title: 'Leave report failed', message });
      setLeaveRequests(null);
    } finally {
      setIsLoadingLeave(false);
    }
  }, [accessToken, leaveBranchId, toast]);

  const handleRun = useCallback((): void => {
    setCommittedStart(startDate);
    setCommittedEnd(endDate);
    setHasRun(true);
    // Invalidate lazy-loaded tab data so it re-fetches with the new date range
    setHourlyData(null);
    setStaffReport(null);
    setItemsData(null);
    setDiscountUsage(null);
    setLeaveRequests(null);
    void runAggregate(startDate, endDate);
  }, [endDate, runAggregate, startDate]);

  const handleExport = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsExporting(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'director_analytics',
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

  useEffect(() => { void loadBranches(); }, [loadBranches]);

  // Auto-run on first mount
  useEffect(() => {
    if (!hasRun) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);

  // Auto-load tab data on first visit to each tab
  useEffect(() => {
    if (!hasRun) return;
    if (activeTab === 'Peak Hours' && !hourlyData && !isLoadingHourly && hourlyBranchId) {
      void runHourly();
    }
    if (activeTab === 'Staff' && !staffReport && !isLoadingStaff && staffBranchId) {
      void runStaff();
    }
    if (activeTab === 'Menu Items' && !itemsData && !isLoadingItems) {
      void runItems();
    }
    if (activeTab === 'Discounts' && !discountUsage && !isLoadingDiscounts) {
      void runDiscounts();
    }
    if (activeTab === 'Leave' && !leaveRequests && !isLoadingLeave) {
      void runLeave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when tab changes
  }, [activeTab, hasRun]);

  // Re-fetch discounts when branch filter changes (if tab is active)
  useEffect(() => {
    if (activeTab === 'Discounts' && hasRun && !isLoadingDiscounts) {
      void runDiscounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only fire on branch change
  }, [discountsBranchId]);

  // Re-fetch leave when branch filter changes (if tab is active)
  useEffect(() => {
    if (activeTab === 'Leave' && hasRun && !isLoadingLeave) {
      void runLeave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only fire on branch change
  }, [leaveBranchId]);

  // ── Derived values ────────────────────────────────────────────────────────

  const periodLabel = `${formatDisplayDate(committedStart)} – ${formatDisplayDate(committedEnd)}`;

  const branchKpi = useMemo(() => {
    if (!branchOverviewReport) return null;
    const avgRevenue =
      branchOverviewReport.branches.length > 0
        ? Number.parseFloat(branchOverviewReport.totalRevenue) / branchOverviewReport.branches.length
        : 0;
    return {
      totalRevenue: branchOverviewReport.totalRevenue,
      totalOrders: branchOverviewReport.totalOrders,
      branchCount: branchOverviewReport.branches.length,
      avgRevenue,
    };
  }, [branchOverviewReport]);

  const totalRevenueTrendData = useMemo(
    () =>
      directorTrends?.aggregateSeries.map((p) => ({
        label: formatDay(p.date),
        value: Number.parseFloat(p.totalRevenue) || 0,
        date: p.date,
      })) ?? [],
    [directorTrends],
  );

  const totalOrdersTrendData = useMemo(
    () =>
      directorTrends?.aggregateSeries.map((p) => ({
        label: formatDay(p.date),
        value: p.totalOrders,
        date: p.date,
      })) ?? [],
    [directorTrends],
  );

  const branchRevenueSeries = useMemo(
    () =>
      directorTrends?.branchRevenueSeries.map((s) => ({
        id: s.id,
        label: s.name,
        data: s.points.map((p) => ({ label: formatDay(p.date), value: p.value, date: p.date })),
      })) ?? [],
    [directorTrends],
  );

  const branchOrdersSeries = useMemo(
    () =>
      directorTrends?.branchOrdersSeries.map((s) => ({
        id: s.id,
        label: s.name,
        data: s.points.map((p) => ({ label: formatDay(p.date), value: p.value, date: p.date })),
      })) ?? [],
    [directorTrends],
  );

  const trendPeriodTotalRevenue = useMemo(
    () =>
      directorTrends?.aggregateSeries.reduce(
        (sum, p) => sum + (Number.parseFloat(p.totalRevenue) || 0),
        0,
      ) ?? 0,
    [directorTrends],
  );

  const branchRows = useMemo<BranchReportRow[]>(
    () => branchOverviewReport?.branches.map((b) => ({ ...b })) ?? [],
    [branchOverviewReport],
  );

  const staffRows = useMemo<StaffReportRow[]>(
    () => staffReport?.staff.map((r) => ({ ...r })) ?? [],
    [staffReport],
  );

  const waiterRows = useMemo<StaffReportRow[]>(
    () => staffRows.filter((r) => r.role === 'WAITER'),
    [staffRows],
  );

  const staffTotals = useMemo(() => {
    if (staffRows.length === 0) return null;
    let ordersHandled = 0, scheduledHours = 0, actualHours = 0;
    for (const r of staffRows) {
      ordersHandled += Number(r.ordersHandled);
      scheduledHours += Number(r.scheduledHours);
      actualHours += Number(r.actualHours);
    }
    return { ordersHandled, scheduledHours, actualHours };
  }, [staffRows]);

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

  // ── Columns ───────────────────────────────────────────────────────────────

  const branchColumns: Array<ExcelColumn<BranchReportRow>> = useMemo(() => [
    { key: 'name', label: 'Branch', render: (row) => <span className="font-semibold">{row.name}</span> },
    {
      key: 'revenue',
      label: 'Revenue',
      numeric: true,
      render: (row) => formatCurrency(row.revenue),
    },
    {
      key: 'revShare',
      label: 'Rev Share',
      numeric: true,
      render: (row) => {
        const total = Number.parseFloat(branchOverviewReport?.totalRevenue ?? '0');
        const share = total > 0 ? (Number.parseFloat(String(row.revenue)) / total) * 100 : 0;
        return `${share.toFixed(1)}%`;
      },
    },
    {
      key: 'orderCount',
      label: 'Orders',
      numeric: true,
      render: (row) => row.orderCount,
    },
    {
      key: 'avgOrderValue',
      label: 'Avg Order Value',
      numeric: true,
      render: (row) => {
        const rev = Number.parseFloat(String(row.revenue));
        const orders = Number(row.orderCount);
        return orders > 0 ? formatCurrency(rev / orders) : '—';
      },
    },
    {
      key: 'kitchenPrep',
      label: 'Kitchen Prep',
      numeric: true,
      render: (row) => `${row.averagePrepTimeMinutes.KITCHEN} min`,
    },
    {
      key: 'baristaPrep',
      label: 'Barista Prep',
      numeric: true,
      render: (row) => `${row.averagePrepTimeMinutes.BARISTA} min`,
    },
  ], [branchOverviewReport]);

  const paymentBreakdownTotals = useMemo(() => {
    const branches = branchOverviewReport?.branches ?? [];
    let mpesa = 0, cash = 0, card = 0, houseAccount = 0, corporateAccount = 0, customerCredit = 0;
    for (const b of branches) {
      mpesa += Number.parseFloat(b.paymentBreakdown.mpesa);
      cash += Number.parseFloat(b.paymentBreakdown.cash);
      card += Number.parseFloat(b.paymentBreakdown.card);
      houseAccount += Number.parseFloat(b.paymentBreakdown.houseAccount);
      corporateAccount += Number.parseFloat(b.paymentBreakdown.corporateAccount);
      customerCredit += Number.parseFloat(b.paymentBreakdown.customerCredit);
    }
    return { mpesa, cash, card, houseAccount, corporateAccount, customerCredit };
  }, [branchOverviewReport]);

  const paymentColumns: Array<ExcelColumn<BranchReportRow>> = useMemo(() => [
    { key: 'name', label: 'Branch', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'mpesa', label: 'M-Pesa', numeric: true, render: (row) => formatCurrency(row.paymentBreakdown.mpesa) },
    { key: 'cash', label: 'Cash', numeric: true, render: (row) => formatCurrency(row.paymentBreakdown.cash) },
    { key: 'card', label: 'Card', numeric: true, render: (row) => formatCurrency(row.paymentBreakdown.card) },
    { key: 'houseAccount', label: 'House Acct', numeric: true, render: (row) => formatCurrency(row.paymentBreakdown.houseAccount) },
    { key: 'corporateAccount', label: 'Corporate', numeric: true, render: (row) => formatCurrency(row.paymentBreakdown.corporateAccount) },
    { key: 'customerCredit', label: 'Credit', numeric: true, render: (row) => formatCurrency(row.paymentBreakdown.customerCredit) },
    {
      key: 'total',
      label: 'Total',
      numeric: true,
      render: (row) => <span className="font-semibold">{formatCurrency(row.paymentBreakdown.total)}</span>,
    },
  ], []);

  const staffColumns: Array<ExcelColumn<StaffReportRow>> = useMemo(() => [
    { key: 'name', label: 'Name', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'role', label: 'Role', render: (row) => row.role },
    {
      key: 'ordersHandled',
      label: 'Orders / Tickets',
      numeric: true,
      render: (row) => row.ordersHandled,
    },
    {
      key: 'valueOrPrep',
      label: 'Avg Value / Prep',
      numeric: true,
      render: (row) =>
        row.role === 'WAITER'
          ? formatCurrency(row.averageOrderValue ?? '0.00')
          : `${row.averagePrepTimeMinutes ?? 0} min`,
    },
    {
      key: 'scheduledHours',
      label: 'Sched Hrs',
      numeric: true,
      render: (row) => Number(row.scheduledHours).toFixed(2),
    },
    {
      key: 'actualHours',
      label: 'Actual Hrs',
      numeric: true,
      render: (row) => Number(row.actualHours).toFixed(2),
    },
  ], []);

  const waiterCollectionColumns: Array<ExcelColumn<StaffReportRow>> = useMemo(() => [
    { key: 'name', label: 'Waiter', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'ordersHandled', label: 'Orders', numeric: true, render: (row) => row.ordersHandled },
    {
      key: 'mpesa',
      label: 'M-Pesa',
      numeric: true,
      render: (row) => (row.paymentBreakdown ? formatCurrency(row.paymentBreakdown.mpesa) : '—'),
    },
    {
      key: 'cash',
      label: 'Cash',
      numeric: true,
      render: (row) => (row.paymentBreakdown ? formatCurrency(row.paymentBreakdown.cash) : '—'),
    },
    {
      key: 'card',
      label: 'Card',
      numeric: true,
      render: (row) => (row.paymentBreakdown ? formatCurrency(row.paymentBreakdown.card) : '—'),
    },
    {
      key: 'total',
      label: 'Total',
      numeric: true,
      render: (row) => (
        <span className="font-semibold">{row.paymentBreakdown ? formatCurrency(row.paymentBreakdown.total) : '—'}</span>
      ),
    },
  ], []);

  const showCollections = staffRole === 'ALL' || staffRole === 'WAITER';

  const discountTypeColumns: Array<ExcelColumn<DiscountUsageReport['byDiscount'][number]>> = useMemo(() => [
    {
      key: 'name',
      label: 'Discount',
      render: (row) => (
        <>
          <span className="font-semibold">{row.name}</span>
          <span className="ml-1.5 text-stone-400">
            {row.type === 'PERCENTAGE' ? `${row.value}%` : `KES ${Number.parseFloat(row.value).toLocaleString('en-KE')}`}
          </span>
        </>
      ),
    },
    { key: 'orderCount', label: 'Uses', numeric: true, render: (row) => row.orderCount },
    {
      key: 'totalDiscounted',
      label: 'Discounted',
      numeric: true,
      render: (row) => <span className="font-semibold">{formatCurrency(row.totalDiscounted)}</span>,
    },
  ], []);

  const discountBranchColumns: Array<ExcelColumn<DiscountUsageReport['byBranch'][number]>> = useMemo(() => [
    { key: 'name', label: 'Branch', render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'orderCount', label: 'Uses', numeric: true, render: (row) => row.orderCount },
    {
      key: 'totalDiscounted',
      label: 'Discounted',
      numeric: true,
      render: (row) => <span className="font-semibold">{formatCurrency(row.totalDiscounted)}</span>,
    },
  ], []);

  const discountWaiterColumns: Array<ExcelColumn<DiscountUsageReport['byWaiter'][number]>> = useMemo(() => [
    {
      key: 'name',
      label: 'Waiter',
      render: (row) => (
        <span className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-espresso/10 text-[11px] font-bold text-espresso">
            {row.name.charAt(0).toUpperCase()}
          </span>
          <span className="font-semibold">{row.name}</span>
        </span>
      ),
    },
    { key: 'orderCount', label: 'Uses', numeric: true, render: (row) => row.orderCount },
    {
      key: 'totalDiscounted',
      label: 'Total Discounted',
      numeric: true,
      render: (row) => <span className="font-semibold">{formatCurrency(row.totalDiscounted)}</span>,
    },
    {
      key: 'avgPerUse',
      label: 'Avg per Use',
      numeric: true,
      tone: 'muted',
      render: (row) =>
        formatCurrency(String(row.orderCount > 0 ? Number.parseFloat(row.totalDiscounted) / row.orderCount : 0)),
    },
  ], []);

  const sortedByDiscount = useMemo(
    () =>
      discountUsage
        ? [...discountUsage.byDiscount].sort((a, b) => Number.parseFloat(b.totalDiscounted) - Number.parseFloat(a.totalDiscounted))
        : [],
    [discountUsage],
  );
  const sortedByBranch = useMemo(
    () =>
      discountUsage
        ? [...discountUsage.byBranch].sort((a, b) => Number.parseFloat(b.totalDiscounted) - Number.parseFloat(a.totalDiscounted))
        : [],
    [discountUsage],
  );
  const sortedByWaiter = useMemo(
    () =>
      discountUsage
        ? [...discountUsage.byWaiter].sort((a, b) => Number.parseFloat(b.totalDiscounted) - Number.parseFloat(a.totalDiscounted))
        : [],
    [discountUsage],
  );

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

  const leaveColumns: Array<ExcelColumn<LeaveRequest>> = useMemo(() => [
    {
      key: 'employee',
      label: 'Employee',
      render: (row) => (
        <span className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-espresso/10 text-[11px] font-bold text-espresso">
            {row.employeeProfile.user.name.charAt(0).toUpperCase()}
          </span>
          <span>
            <span className="block font-semibold">{row.employeeProfile.user.name}</span>
            <span className="block text-stone-400">{roleLabel(row.employeeProfile.user.role)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'branch',
      label: 'Branch',
      tone: 'muted',
      render: (row) => branches.find((b) => b.id === row.organizationId)?.name ?? '—',
    },
    { key: 'type', label: 'Type', render: (row) => <LeaveTypeBadge type={row.leaveType} /> },
    { key: 'dates', label: 'Dates', tone: 'muted', render: (row) => formatDateRange(row.startDate, row.endDate) },
    { key: 'days', label: 'Days', numeric: true, render: (row) => `${Number(row.totalDays)}d` },
    { key: 'status', label: 'Status', render: (row) => <LeaveStatusBadge status={row.status} /> },
    {
      key: 'reviewedBy',
      label: 'Reviewed By',
      render: (row) => row.reviewedBy ? row.reviewedBy.name : <span className="text-stone-300">—</span>,
    },
    {
      key: 'comment',
      label: 'Comment',
      render: (row) =>
        row.reviewComment ? (
          <span className="block max-w-[160px] truncate italic text-stone-400">&ldquo;{row.reviewComment}&rdquo;</span>
        ) : (
          <span className="text-stone-300">—</span>
        ),
    },
  ], [branches]);

  // ── Items sort ────────────────────────────────────────────────────────────

  const sortedTopItems = useMemo(() => {
    if (!itemsData) return [];
    return [...itemsData.topItems].sort((a, b) => {
      const aVal = itemsSortKey === 'revenue' ? Number.parseFloat(a.revenue) : a.quantitySold;
      const bVal = itemsSortKey === 'revenue' ? Number.parseFloat(b.revenue) : b.quantitySold;
      return itemsSortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [itemsData, itemsSortKey, itemsSortDir]);

  const sortedBottomItems = useMemo(() => {
    if (!itemsData) return [];
    return [...itemsData.bottomItems].sort((a, b) => {
      const aVal = itemsSortKey === 'revenue' ? Number.parseFloat(a.revenue) : a.quantitySold;
      const bVal = itemsSortKey === 'revenue' ? Number.parseFloat(b.revenue) : b.quantitySold;
      return itemsSortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [itemsData, itemsSortKey, itemsSortDir]);

  const handleItemsSort = useCallback((key: 'revenue' | 'quantitySold') => {
    if (itemsSortKey === key) {
      setItemsSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setItemsSortKey(key);
      setItemsSortDir('desc');
    }
  }, [itemsSortKey]);

  const itemColumns = useMemo((): {
    compact: Array<ExcelColumn<ItemRow>>;
    full: Array<ExcelColumn<ItemRow>>;
  } => {
    const sortFor = (key: 'revenue' | 'quantitySold') => ({
      direction: itemsSortKey === key ? itemsSortDir : null,
      onToggle: () => handleItemsSort(key),
    });
    const qtyCompact: ExcelColumn<ItemRow> = {
      key: 'quantitySold',
      label: 'Qty',
      numeric: true,
      sort: sortFor('quantitySold'),
      render: (row) => row.quantitySold,
    };
    const revenue: ExcelColumn<ItemRow> = {
      key: 'revenue',
      label: 'Revenue',
      numeric: true,
      sort: sortFor('revenue'),
      render: (row) => <span className="font-semibold">{formatCurrency(row.revenue)}</span>,
    };
    return {
      compact: [
        {
          key: 'name',
          label: 'Item',
          render: (row) => (
            <>
              <span className="font-semibold">{row.name}</span>
              <span className="ml-1.5 text-stone-400">{row.categoryName}</span>
            </>
          ),
        },
        qtyCompact,
        revenue,
      ],
      full: [
        { key: 'name', label: 'Item', render: (row) => <span className="font-semibold">{row.name}</span> },
        { key: 'categoryName', label: 'Category', tone: 'muted', render: (row) => row.categoryName },
        { ...qtyCompact, label: 'Qty Sold' },
        revenue,
      ],
    };
  }, [handleItemsSort, itemsSortDir, itemsSortKey]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout className="animate-fade-up space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-label-sm text-stone-500">
              <Link href="/app/director" className="flex items-center gap-1 hover:text-espresso">
                <LayoutDashboard size={13} />
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-stone-700">Analytics</span>
            </div>
            <h1 className="mt-1 font-display text-display-lg font-semibold text-espresso">Analytics</h1>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Period: <span className="font-medium text-stone-700">{periodLabel}</span>
            </p>
          </div>
          <DateRangeBar
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onRun={handleRun}
            isRunning={isLoadingAggregate}
            runIcon={<BarChart2 size={15} />}
          >
            <Button
              variant="secondary"
              leftIcon={<Download size={15} />}
              onClick={() => void handleExport()}
              isLoading={isExporting}
            >
              Download Report
            </Button>
          </DateRangeBar>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <TabBar
        tabs={TABS.map((tab) => ({ value: tab, label: tab }))}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1 — OVERVIEW
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {/* KPI strip */}
          {isLoadingAggregate ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-shimmer rounded-lg bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
              ))}
            </div>
          ) : branchKpi ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Total Revenue" value={formatCurrency(branchKpi.totalRevenue)} caption={periodLabel} icon={<TrendingUp size={18} />} />
              <StatCard label="Total Orders" value={branchKpi.totalOrders} caption={periodLabel} icon={<BarChart2 size={18} />} />
              <StatCard label="Active Branches" value={branchKpi.branchCount} caption="With closed orders" icon={<Globe size={18} />} />
              <StatCard label="Avg Revenue / Branch" value={formatCurrency(branchKpi.avgRevenue)} caption={periodLabel} icon={<TrendingUp size={18} />} />
            </div>
          ) : (
            <EmptyState icon={<TrendingUp size={22} />} heading="No data" body="Select a date range and click Run." />
          )}

          {/* Aggregate trend charts */}
          {isLoadingAggregate ? (
            <SkeletonTable rows={8} columns={6} />
          ) : directorTrends ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <LineTrendChart
                  title="Total Revenue (KES)"
                  subtitle="Daily total revenue across all active branches"
                  data={totalRevenueTrendData}
                  accentColor={CHART_SUCCESS}
                  valueFormatter={(v) => `KES ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
                  tooltipUnit="KES"
                  summaryLabel="Total Revenue"
                />
                <LineTrendChart
                  title="Total Orders"
                  subtitle="Daily closed order volume across all active branches"
                  data={totalOrdersTrendData}
                  accentColor={CHART_AMBER}
                  valueFormatter={(v) => String(Math.round(v))}
                  tooltipUnit="Orders"
                  summaryLabel="Total Orders"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <MultiLineTrendChart
                  title="Revenue by Branch (KES)"
                  subtitle="Revenue trajectory per branch"
                  series={branchRevenueSeries}
                  valueFormatter={(v) => `KES ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
                  tooltipUnit="KES"
                  summaryLabel="Top Branch Revenue"
                />
                <MultiLineTrendChart
                  title="Orders by Branch"
                  subtitle="Order volume trajectory per branch"
                  series={branchOrdersSeries}
                  valueFormatter={(v) => String(Math.round(v))}
                  tooltipUnit="Orders"
                  summaryLabel="Top Branch Orders"
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2 — BRANCH PERFORMANCE
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Branches' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-heading-md font-semibold text-stone-900">Branch Performance</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">Revenue, order count and prep-time comparison — {periodLabel}</p>
            </div>
            <ExcelTable
              columns={branchColumns}
              rows={branchRows}
              rowKey={(row) => row.id}
              numbered
              isLoading={isLoadingAggregate}
              skeletonRows={5}
              emptyState={
                <EmptyState icon={<Globe size={22} />} heading="No branch data" body="Select a date range and click Run." />
              }
              totalsRow={
                branchOverviewReport
                  ? {
                      name: <span className="uppercase tracking-wide">Total</span>,
                      revenue: formatCurrency(branchOverviewReport.totalRevenue),
                      orderCount: branchOverviewReport.totalOrders,
                    }
                  : undefined
              }
              footnote={
                branchOverviewReport
                  ? <>Other Income: {formatCurrency(branchOverviewReport.totalOtherIncome)}</>
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3 — REVENUE ALLOCATION
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Revenue' && (
        <div className="space-y-4">
          {isLoadingAggregate ? (
            <SkeletonTable rows={6} columns={4} />
          ) : !branchOverviewReport || trendPeriodTotalRevenue === 0 ? (
            <EmptyState icon={<Wallet size={22} />} heading="No revenue data" body="Select a date range and click Run." />
          ) : (
            <>
              <RevenueBreakdownCard
                totalRevenue={trendPeriodTotalRevenue}
                period={`Period total · ${periodLabel}`}
              />

              {/* Per-branch payment breakdown */}
              <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-heading-md font-semibold text-stone-900">Payment Breakdown by Branch</h2>
                <ExcelTable
                  columns={paymentColumns}
                  rows={branchOverviewReport.branches}
                  rowKey={(row) => row.id}
                  headerTone="green"
                  totalsRow={{
                    name: <span className="uppercase tracking-wide">Total</span>,
                    mpesa: formatCurrency(paymentBreakdownTotals.mpesa),
                    cash: formatCurrency(paymentBreakdownTotals.cash),
                    card: formatCurrency(paymentBreakdownTotals.card),
                    houseAccount: formatCurrency(paymentBreakdownTotals.houseAccount),
                    corporateAccount: formatCurrency(paymentBreakdownTotals.corporateAccount),
                    customerCredit: formatCurrency(paymentBreakdownTotals.customerCredit),
                    total: <span className="font-semibold">{formatCurrency(branchOverviewReport.totalRevenue)}</span>,
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4 — PEAK HOURS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Peak Hours' && (
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-heading-md font-semibold text-stone-900">Order Volume by Time of Day</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {hourlyData ? `${hourlyData.organizationName} · ${periodLabel}` : 'Select a branch to view peak hours.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-end gap-2">
              <Select
                label="Branch"
                value={hourlyBranchId}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Select branch"
                onChange={(e) => setHourlyBranchId(e.target.value)}
              />
              <Button size="sm" onClick={() => void runHourly()} isLoading={isLoadingHourly}>
                Load Chart
              </Button>
            </div>
          </div>
          {isLoadingHourly ? (
            <SkeletonTable rows={4} columns={4} />
          ) : !hourlyData ? (
            <EmptyState icon={<Clock size={22} />} heading="No data" body="Select a branch and click Load Chart." />
          ) : (
            <HourlyBarsChart data={hourlyData} showDow />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5 — STAFF
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Staff' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-heading-md font-semibold text-stone-900">Staff Performance</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {staffReport
                  ? `${staffReport.organizationName} · ${periodLabel}`
                  : 'Select a branch to view staff metrics.'}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select
                label="Branch"
                value={staffBranchId}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Select branch"
                onChange={(e) => setStaffBranchId(e.target.value)}
              />
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
              <div className="col-span-2 flex items-end sm:col-span-2">
                <Button leftIcon={<Users size={15} />} onClick={() => void runStaff()} isLoading={isLoadingStaff}>
                  Run Report
                </Button>
              </div>
            </div>

            <ExcelTable
              columns={staffColumns}
              rows={staffRows}
              rowKey={(row) => row.id}
              numbered
              isLoading={isLoadingStaff}
              emptyState={
                <EmptyState icon={<Users size={22} />} heading="No staff data" body="Pick a branch, optionally filter by role, then click Run Report." />
              }
              totalsRow={
                staffTotals
                  ? {
                      name: <span className="uppercase tracking-wide">Total</span>,
                      ordersHandled: staffTotals.ordersHandled,
                      scheduledHours: staffTotals.scheduledHours.toFixed(2),
                      actualHours: staffTotals.actualHours.toFixed(2),
                    }
                  : undefined
              }
            />
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
              <ExcelTable
                columns={waiterCollectionColumns}
                rows={waiterRows}
                rowKey={(row) => row.id}
                numbered
                headerTone="green"
                totalsRow={
                  waiterCollectionTotals
                    ? {
                        name: <span className="uppercase tracking-wide">Total</span>,
                        ordersHandled: waiterRows.reduce((sum, w) => sum + w.ordersHandled, 0),
                        mpesa: formatCurrency(waiterCollectionTotals.mpesa),
                        cash: formatCurrency(waiterCollectionTotals.cash),
                        card: formatCurrency(waiterCollectionTotals.card),
                        total: formatCurrency(waiterCollectionTotals.total),
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 6 — MENU ITEMS
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
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Branch"
                value={itemsBranchId}
                options={[{ value: '', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                onChange={(e) => setItemsBranchId(e.target.value)}
              />
              <div className="flex flex-col gap-1">
                <span className="text-label-sm text-stone-500">Show top / bottom</span>
                <select
                  value={itemsLimit}
                  onChange={(e) => setItemsLimit(Number(e.target.value))}
                  className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-body-sm text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber"
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
            <EmptyState icon={<ShoppingBag size={22} />} heading="No items data" body="Select a branch and click Load Report." />
          ) : itemsData.limit === 0 ? (
            /* ── All items — single ranked table ── */
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ChevronUp size={16} className="text-status-ready-text" />
                <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                  All Items ({sortedTopItems.length})
                </span>
              </div>
              <ExcelTable
                columns={itemColumns.full}
                rows={sortedTopItems}
                rowKey={(row) => row.menuItemId}
                numbered
              />
            </div>
          ) : (
            /* ── Top / bottom split view ── */
            <div className="grid gap-4 md:grid-cols-2">
              {/* Top items */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <ChevronUp size={16} className="text-status-ready-text" />
                  <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                    Top {itemsData.limit} Items
                  </span>
                </div>
                <ExcelTable
                  columns={itemColumns.compact}
                  rows={sortedTopItems}
                  rowKey={(row) => row.menuItemId}
                  numbered
                  headerTone="green"
                />
              </div>
              {/* Bottom items */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-400" />
                  <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                    Bottom {itemsData.limit} Items
                  </span>
                </div>
                <ExcelTable
                  columns={itemColumns.compact}
                  rows={sortedBottomItems}
                  rowKey={(row) => row.menuItemId}
                  numbered
                  headerTone="red"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 7 — DISCOUNTS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Discounts' && (
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-heading-md font-semibold text-stone-900">Discount Performance</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">{periodLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={discountsBranchId}
                onChange={(e) => { setDiscountsBranchId(e.target.value); }}
                className="w-44"
                options={[
                  { value: '', label: 'All Branches' },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
              <Button size="sm" variant="secondary" onClick={() => void runDiscounts()} isLoading={isLoadingDiscounts}>
                Reload
              </Button>
            </div>
          </div>

          {isLoadingDiscounts ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-shimmer rounded-xl bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
                ))}
              </div>
              <SkeletonTable rows={4} columns={4} />
            </div>
          ) : !discountUsage || discountUsage.totalOrders === 0 ? (
            <EmptyState
              icon={<Wallet size={22} />}
              heading="No discount usage in this period"
              body="No customer discounts were applied in the selected date range."
            />
          ) : (
            <div className="space-y-5">

              {/* ── KPI cards ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Total Discounted */}
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Total Discounted</p>
                  <p className="mt-1.5 font-sans text-display-md font-bold text-espresso tabular-nums">
                    {formatCurrency(discountUsage.totalDiscounted)}
                  </p>
                  <p className="mt-0.5 text-caption text-stone-400">{periodLabel}</p>
                </div>
                {/* Orders with discount */}
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Discounted Orders</p>
                  <p className="mt-1.5 font-sans text-display-md font-bold text-espresso tabular-nums">
                    {discountUsage.totalOrders}
                  </p>
                  <p className="mt-0.5 text-caption text-stone-400">Orders with a discount applied</p>
                </div>
                {/* Avg per discounted order */}
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Avg per Order</p>
                  <p className="mt-1.5 font-sans text-display-md font-bold text-espresso tabular-nums">
                    {discountUsage.totalOrders > 0
                      ? formatCurrency(
                          String(Number.parseFloat(discountUsage.totalDiscounted) / discountUsage.totalOrders),
                        )
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-caption text-stone-400">Average discount value</p>
                </div>
              </div>

              {/* ── By discount type + by branch ──────────────────────── */}
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-label-sm font-semibold uppercase tracking-wider text-stone-500">By Discount Type</h3>
                  <ExcelTable
                    columns={discountTypeColumns}
                    rows={sortedByDiscount}
                    rowKey={(row) => row.discountId}
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-label-sm font-semibold uppercase tracking-wider text-stone-500">By Branch</h3>
                  <ExcelTable
                    columns={discountBranchColumns}
                    rows={sortedByBranch}
                    rowKey={(row) => row.organizationId}
                  />
                </div>
              </div>

              {/* ── By Waiter ─────────────────────────────────────────── */}
              <div>
                <h3 className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">By Waiter</h3>
                <p className="mb-2 mt-0.5 text-caption text-stone-400">Waiters who applied the most discounts in this period</p>
                <ExcelTable
                  columns={discountWaiterColumns}
                  rows={sortedByWaiter}
                  rowKey={(row) => row.waiterId}
                  numbered
                />
              </div>

            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 8 — LEAVE
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Leave' && (
        <div className="space-y-5">

          {/* ── Branch filter + refresh ────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Branch"
              value={leaveBranchId}
              options={[{ value: '', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              onChange={(e) => setLeaveBranchId(e.target.value)}
            />
            <Button size="sm" variant="secondary" leftIcon={<CalendarOff size={14} />} onClick={() => void runLeave()} isLoading={isLoadingLeave}>
              {isLoadingLeave ? 'Loading…' : 'Refresh'}
            </Button>
          </div>

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
                <p className="mt-1.5 font-sans text-display-md font-bold text-success tabular-nums">{leaveStats.approved}</p>
                <p className="mt-0.5 text-caption text-stone-400">{leaveStats.totalDaysTaken}d total taken</p>
              </div>
              <div className="rounded-xl border border-warning-border bg-warning-bg p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-warning">Pending</p>
                <p className="mt-1.5 font-sans text-display-md font-bold text-warning tabular-nums">{leaveStats.pending}</p>
                <p className="mt-0.5 text-caption text-warning">Awaiting HR review</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Rejected</p>
                <p className="mt-1.5 font-sans text-display-md font-bold text-danger tabular-nums">{leaveStats.rejected}</p>
                <p className="mt-0.5 text-caption text-stone-400">Declined requests</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-400">Days Taken</p>
                <p className="mt-1.5 font-sans text-display-md font-bold text-espresso tabular-nums">{leaveStats.totalDaysTaken}</p>
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
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
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
                        ? 'bg-espresso text-white'
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
              <span className="ml-auto text-caption text-stone-400">{filteredLeave.length} record{filteredLeave.length !== 1 ? 's' : ''}</span>
            </div>

            <ExcelTable
              columns={leaveColumns}
              rows={filteredLeave}
              rowKey={(row) => row.id}
              isLoading={isLoadingLeave}
              skeletonRows={4}
              emptyState={
                <EmptyState
                  icon={<CalendarOff size={22} />}
                  heading="No records found"
                  body={leaveRequests === null ? 'Click Refresh to load leave data.' : 'No requests match the current filters.'}
                />
              }
            />
          </div>
        </div>
      )}

    </PageLayout>
  );
}
