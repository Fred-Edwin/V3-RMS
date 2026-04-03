'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  Clock,
  Download,
  FileText,
  Globe,
  LayoutDashboard,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  PageLayout,
  Popover,
  Select,
  SkeletonTable,
  StatCard,
  Table,
  type TableColumn,
} from '@/components/ui';
import { HourlyBarsChart, LineTrendChart, MultiLineTrendChart } from '@/components/dashboard/PremiumChart';
import { RevenueBreakdownCard } from '@/components/dashboard/RevenueBreakdownCard';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  BranchOverview,
  DirectorTrendsReport,
  HourlyHeatmapReport,
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

const daysBetween = (start: string, end: string): number => {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000));
};

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

// ── Types ─────────────────────────────────────────────────────────────────────

type BranchReportRow = Record<string, unknown> & BranchOverview['branches'][number];
type StaffReportRow = Record<string, unknown> & StaffPerformanceRow & { branchName: string };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectorAnalyticsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const defaultStart = useMemo(() => toYmd(getMonthStart(new Date())), []);
  const defaultEnd = useMemo(() => toYmd(new Date()), []);

  // ── Branches ────────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchDto[]>([]);

  // ── Shared date range (single "Run" controls all fetches) ─────────────────
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [committedStart, setCommittedStart] = useState<string>(defaultStart);
  const [committedEnd, setCommittedEnd] = useState<string>(defaultEnd);
  const [hasRun, setHasRun] = useState(false);

  // ── Branch performance report ─────────────────────────────────────────────
  const [branchOverviewReport, setBranchOverviewReport] = useState<BranchOverview | null>(null);
  const [isLoadingBranchReport, setIsLoadingBranchReport] = useState(false);
  const [isExportingBranchReport, setIsExportingBranchReport] = useState(false);
  const [branchReportUpdatedAt, setBranchReportUpdatedAt] = useState<Date | null>(null);

  // ── Director trends (charts) ──────────────────────────────────────────────
  const [directorTrends, setDirectorTrends] = useState<DirectorTrendsReport | null>(null);
  const [isLoadingDirectorTrends, setIsLoadingDirectorTrends] = useState(false);

  // ── Hourly heatmap ────────────────────────────────────────────────────────
  const [hourlyBranchId, setHourlyBranchId] = useState<string>('');
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [isLoadingHourly, setIsLoadingHourly] = useState(false);

  // ── Staff performance ─────────────────────────────────────────────────────
  const [staffBranchId, setStaffBranchId] = useState<string>('');
  const [staffRole, setStaffRole] = useState<string>('ALL');
  const [staffReport, setStaffReport] = useState<StaffPerformancePeriod | null>(null);
  const [isLoadingStaffReport, setIsLoadingStaffReport] = useState(false);
  const [isExportingStaffReport, setIsExportingStaffReport] = useState(false);
  const [staffReportUpdatedAt, setStaffReportUpdatedAt] = useState<Date | null>(null);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadBranches = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    try {
      const data = await branchService.listBranches(accessToken);
      const active = data.filter((branch) => branch.isActive && !branch.isHub);
      setBranches(active);
      setStaffBranchId((current) => current || active[0]?.id || '');
      setHourlyBranchId((current) => current || active[0]?.id || '');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branches.';
      toast({ variant: 'error', title: 'Branch lookup failed', message });
    }
  }, [accessToken, toast]);

  const runAllReports = useCallback(async (start: string, end: string): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingBranchReport(true);
    setIsLoadingDirectorTrends(true);
    try {
      const [branchData, trendsData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: start, endDate: end }),
        reportService.getDirectorTrends(accessToken, { startDate: start, endDate: end }),
      ]);
      setBranchOverviewReport(branchData);
      setBranchReportUpdatedAt(new Date());
      setDirectorTrends(trendsData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load analytics.';
      toast({ variant: 'error', title: 'Analytics failed', message });
      setBranchOverviewReport(null);
      setDirectorTrends(null);
    } finally {
      setIsLoadingBranchReport(false);
      setIsLoadingDirectorTrends(false);
    }
  }, [accessToken, toast]);

  const runStaffReport = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    if (!staffBranchId) {
      toast({ variant: 'warning', title: 'Select a branch first' });
      return;
    }
    setIsLoadingStaffReport(true);
    try {
      const data = await reportService.getStaffPerformance(accessToken, {
        startDate: committedStart,
        endDate: committedEnd,
        organizationId: staffBranchId,
        role: staffRole === 'ALL' ? undefined : (staffRole as 'WAITER' | 'CHEF' | 'BARISTA'),
      });
      setStaffReport(data);
      setStaffReportUpdatedAt(new Date());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff report.';
      toast({ variant: 'error', title: 'Staff report failed', message });
      setStaffReport(null);
    } finally {
      setIsLoadingStaffReport(false);
    }
  }, [accessToken, committedEnd, committedStart, staffBranchId, staffRole, toast]);

  const runHourlyHeatmap = useCallback(async (): Promise<void> => {
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
      toast({ variant: 'error', title: 'Hourly heatmap failed', message });
      setHourlyData(null);
    } finally {
      setIsLoadingHourly(false);
    }
  }, [accessToken, committedEnd, committedStart, hourlyBranchId, toast]);

  const exportBranchReport = useCallback(async (format: 'csv' | 'pdf'): Promise<void> => {
    if (!accessToken) return;
    setIsExportingBranchReport(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'branch_overview',
        format,
        startDate: committedStart,
        endDate: committedEnd,
      });
      toast({ variant: 'success', title: `${format.toUpperCase()} download started` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to export branch report.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingBranchReport(false);
    }
  }, [accessToken, committedEnd, committedStart, toast]);

  const exportStaffReport = useCallback(async (format: 'csv' | 'pdf'): Promise<void> => {
    if (!accessToken || !staffBranchId) return;
    setIsExportingStaffReport(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'staff_performance',
        format,
        startDate: committedStart,
        endDate: committedEnd,
        organizationId: staffBranchId,
      });
      toast({ variant: 'success', title: `${format.toUpperCase()} download started` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to export staff report.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingStaffReport(false);
    }
  }, [accessToken, committedEnd, committedStart, staffBranchId, toast]);

  const handleRun = useCallback((): void => {
    setCommittedStart(startDate);
    setCommittedEnd(endDate);
    setHasRun(true);
    void runAllReports(startDate, endDate);
  }, [endDate, runAllReports, startDate]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { void loadBranches(); }, [loadBranches]);

  // Auto-run on first mount with defaults
  useEffect(() => {
    if (!hasRun) {
      handleRun();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

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
      directorTrends?.aggregateSeries.map((point) => ({
        label: formatDay(point.date),
        value: Number.parseFloat(point.totalRevenue) || 0,
        date: point.date,
      })) ?? [],
    [directorTrends],
  );

  const totalOrdersTrendData = useMemo(
    () =>
      directorTrends?.aggregateSeries.map((point) => ({
        label: formatDay(point.date),
        value: point.totalOrders,
        date: point.date,
      })) ?? [],
    [directorTrends],
  );

  const branchRevenueSeries = useMemo(
    () =>
      directorTrends?.branchRevenueSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? [],
    [directorTrends],
  );

  const branchOrdersSeries = useMemo(
    () =>
      directorTrends?.branchOrdersSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? [],
    [directorTrends],
  );

  const branchContributionSeries = useMemo(
    () =>
      directorTrends?.branchContributionSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? [],
    [directorTrends],
  );

  const itemFamilySeries = useMemo(
    () =>
      directorTrends?.itemFamilySeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? [],
    [directorTrends],
  );

  const trendPeriodTotalRevenue = useMemo(
    () =>
      directorTrends?.aggregateSeries.reduce(
        (sum, point) => sum + (Number.parseFloat(point.totalRevenue) || 0),
        0,
      ) ?? 0,
    [directorTrends],
  );

  const periodLabel = `${formatDisplayDate(committedStart)} – ${formatDisplayDate(committedEnd)}`;

  const branchRows = useMemo<BranchReportRow[]>(
    () => branchOverviewReport?.branches.map((branch) => ({ ...branch })) ?? [],
    [branchOverviewReport],
  );

  const staffRows = useMemo<StaffReportRow[]>(
    () =>
      staffReport?.staff.map((row) => ({ ...row, branchName: staffReport.organizationName })) ?? [],
    [staffReport],
  );

  const branchColumns: Array<TableColumn<BranchReportRow>> = [
    { key: 'name', label: 'Branch' },
    {
      key: 'revenue',
      label: 'Revenue',
      render: (value) => <span className="tabular-nums">{formatCurrency(String(value))}</span>,
    },
    {
      key: 'orderCount',
      label: 'Orders',
      render: (value) => <span className="tabular-nums">{String(value)}</span>,
    },
    {
      key: 'averagePrepTimeMinutes',
      label: 'Avg Prep Kitchen',
      render: (_value, row) => <span className="tabular-nums">{row.averagePrepTimeMinutes.KITCHEN} min</span>,
    },
    {
      key: 'averagePrepTimeMinutesBarista',
      label: 'Avg Prep Barista',
      render: (_value, row) => <span className="tabular-nums">{row.averagePrepTimeMinutes.BARISTA} min</span>,
    },
  ];

  const staffColumns: Array<TableColumn<StaffReportRow>> = [
    { key: 'branchName', label: 'Branch' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    {
      key: 'ordersHandled',
      label: 'Orders / Tickets',
      render: (value) => <span className="tabular-nums">{String(value)}</span>,
    },
    {
      key: 'averageCombined',
      label: 'Avg Value / Prep',
      render: (_value, row) =>
        row.role === 'WAITER' ? (
          <span className="tabular-nums">{formatCurrency(row.averageOrderValue ?? '0.00')}</span>
        ) : (
          <span className="tabular-nums">{row.averagePrepTimeMinutes ?? 0} min</span>
        ),
    },
    {
      key: 'scheduledHours',
      label: 'Sched / Actual Hrs',
      render: (_value, row) => (
        <span className="tabular-nums">
          {row.scheduledHours.toFixed(2)} / {row.actualHours.toFixed(2)}
        </span>
      ),
    },
  ];

  const isRunning = isLoadingBranchReport || isLoadingDirectorTrends;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout className="animate-fade-up space-y-6">

      {/* ── Page header + date range controls ────────────────────────────── */}
      <div className="border-b border-stone-200 pb-6">
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
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            <div className="flex items-end">
              <Button
                leftIcon={<BarChart2 size={15} />}
                onClick={handleRun}
                isLoading={isRunning}
              >
                Run
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Period KPI strip ─────────────────────────────────────────────── */}
      {isLoadingBranchReport ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-shimmer rounded-lg bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]"
            />
          ))}
        </div>
      ) : branchKpi ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(branchKpi.totalRevenue)}
            caption={periodLabel}
            icon={<TrendingUp size={18} />}
          />
          <StatCard
            label="Total Orders"
            value={branchKpi.totalOrders}
            caption={periodLabel}
            icon={<BarChart2 size={18} />}
          />
          <StatCard
            label="Active Branches"
            value={branchKpi.branchCount}
            caption="With closed orders"
            icon={<Globe size={18} />}
          />
          <StatCard
            label="Avg Revenue / Branch"
            value={formatCurrency(branchKpi.avgRevenue)}
            caption={periodLabel}
            icon={<TrendingUp size={18} />}
          />
        </div>
      ) : null}

      {/* ── Trend charts ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-heading-md font-semibold text-stone-900">Trend Analytics</h2>
          <p className="mt-0.5 text-body-sm text-stone-500">
            Revenue, volume, contribution share, and category drivers — {periodLabel}
          </p>
        </div>

        {isLoadingDirectorTrends ? (
          <SkeletonTable rows={8} columns={6} />
        ) : !directorTrends ? (
          <EmptyState
            icon={<TrendingUp size={22} />}
            heading="No trend data"
            body="Select a date range and click Run."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <LineTrendChart
                title="Total Revenue (KES)"
                subtitle="Daily total revenue across all active branches"
                data={totalRevenueTrendData}
                valueFormatter={(value) =>
                  `KES ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}`
                }
                tooltipUnit="KES"
                summaryLabel="Total Revenue"
              />
              <LineTrendChart
                title="Total Orders"
                subtitle="Daily closed order volume across all active branches"
                data={totalOrdersTrendData}
                valueFormatter={(value) => String(Math.round(value))}
                tooltipUnit="Orders"
                summaryLabel="Total Orders"
              />
            </div>

            {trendPeriodTotalRevenue > 0 && (
              <RevenueBreakdownCard
                totalRevenue={trendPeriodTotalRevenue}
                period={`Period total · ${periodLabel}`}
              />
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <MultiLineTrendChart
                title="Revenue by Branch (KES)"
                subtitle="Revenue trajectory per branch"
                series={branchRevenueSeries}
                valueFormatter={(value) =>
                  `KES ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}`
                }
                tooltipUnit="KES"
                summaryLabel="Top Branch Revenue"
              />
              <MultiLineTrendChart
                title="Orders by Branch"
                subtitle="Order volume trajectory per branch"
                series={branchOrdersSeries}
                valueFormatter={(value) => String(Math.round(value))}
                tooltipUnit="Orders"
                summaryLabel="Top Branch Orders"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <MultiLineTrendChart
                title="Branch Contribution Share (%)"
                subtitle="Each branch's share of total daily revenue"
                series={branchContributionSeries}
                valueFormatter={(value) => `${value.toFixed(1)}%`}
                tooltipUnit="%"
                summaryLabel="Top Branch Share"
              />
              <MultiLineTrendChart
                title="Top Item Family Revenue (KES)"
                subtitle="Top 5 menu category revenue trends across branches"
                series={itemFamilySeries}
                valueFormatter={(value) =>
                  `KES ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}`
                }
                tooltipUnit="KES"
                summaryLabel="Top Family Revenue"
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Order Volume by Time of Day ───────────────────────────────────── */}
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-heading-md font-semibold text-stone-900">Order Volume by Time of Day</h2>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Peak hours and busiest days — {periodLabel}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2">
            <Select
              label="Branch"
              value={hourlyBranchId}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              placeholder="Select branch"
              onChange={(event) => setHourlyBranchId(event.target.value)}
            />
            <div className="flex items-end">
              <Button size="sm" onClick={() => void runHourlyHeatmap()} isLoading={isLoadingHourly}>
                Load Chart
              </Button>
            </div>
          </div>
        </div>

        {isLoadingHourly ? (
          <SkeletonTable rows={4} columns={4} />
        ) : !hourlyData ? (
          <EmptyState
            icon={<TrendingUp size={22} />}
            heading="No hourly data"
            body={hourlyBranchId ? 'Click Load Chart to see peak hours for the selected branch.' : 'Select a branch and click Load Chart.'}
          />
        ) : (
          <HourlyBarsChart
            data={hourlyData}
            showDow={daysBetween(committedStart, committedEnd) >= 14}
          />
        )}
      </section>

      {/* ── Branch Performance Table ──────────────────────────────────────── */}
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-heading-md font-semibold text-stone-900">Branch Performance</h2>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Revenue, order count, and prep-time comparison — {periodLabel}
            </p>
            {branchReportUpdatedAt && (
              <p className="mt-0.5 flex items-center gap-1 text-caption text-stone-400">
                <Clock size={11} />
                Updated {branchReportUpdatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-end gap-2">
            <Popover
              trigger={
                <Button variant="secondary" leftIcon={<Download size={16} />} isLoading={isExportingBranchReport}>
                  Export
                </Button>
              }
              className="w-44"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
                onClick={() => void exportBranchReport('csv')}
              >
                <FileText size={14} /> Download CSV
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
                onClick={() => void exportBranchReport('pdf')}
              >
                <FileText size={14} /> Download PDF
              </button>
            </Popover>
          </div>
        </div>

        {isLoadingBranchReport ? (
          <SkeletonTable rows={5} columns={5} />
        ) : branchRows.length === 0 ? (
          <EmptyState
            icon={<Globe size={22} />}
            heading="No branch data"
            body="Select a date range and click Run."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table columns={branchColumns} data={branchRows} keyField="id" />
          </div>
        )}
      </section>

      {/* ── Staff Performance ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-heading-md font-semibold text-stone-900">Staff Performance</h2>
            <p className="mt-0.5 text-body-sm text-stone-500">
              {staffReport
                ? `${staffReport.organizationName} · ${formatDisplayDate(staffReport.period.startDate)} – ${formatDisplayDate(staffReport.period.endDate)}`
                : 'Filter by branch and role to see staff metrics.'}
            </p>
            {staffReportUpdatedAt && (
              <p className="mt-0.5 flex items-center gap-1 text-caption text-stone-400">
                <Clock size={11} />
                Updated {staffReportUpdatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select
            label="Branch"
            value={staffBranchId}
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            placeholder="Select branch"
            onChange={(event) => setStaffBranchId(event.target.value)}
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
            onChange={(event) => setStaffRole(event.target.value)}
          />
        </div>

        <div className="mb-4 flex gap-2">
          <Button leftIcon={<Users size={15} />} onClick={() => void runStaffReport()} isLoading={isLoadingStaffReport}>
            Run Report
          </Button>
          <Popover
            trigger={
              <Button variant="secondary" leftIcon={<Download size={16} />} isLoading={isExportingStaffReport}>
                Export
              </Button>
            }
            className="w-44"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
              onClick={() => void exportStaffReport('csv')}
            >
              <FileText size={14} /> Download CSV
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
              onClick={() => void exportStaffReport('pdf')}
            >
              <FileText size={14} /> Download PDF
            </button>
          </Popover>
        </div>

        {isLoadingStaffReport ? (
          <SkeletonTable rows={6} columns={6} />
        ) : staffRows.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            heading="No staff metrics"
            body="Pick a branch, optionally filter by role, then click Run Report."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table columns={staffColumns} data={staffRows} keyField="id" />
          </div>
        )}
      </section>

    </PageLayout>
  );
}
