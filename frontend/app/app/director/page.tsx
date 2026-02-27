'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Download, FileText, Globe, TrendingUp, Users } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  Popover,
  Select,
  SkeletonTable,
  StatCard,
  Table,
  type TableColumn,
} from '@/components/ui';
import { ComparisonBars, LineTrendChart, MultiLineTrendChart } from '@/components/dashboard/PremiumChart';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { BranchOverview, DirectorTrendsReport, StaffPerformancePeriod, StaffPerformanceRow } from '@/types/report';

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

const getMonthStart = (value: Date): Date => {
  return new Date(value.getFullYear(), value.getMonth(), 1);
};

const formatDay = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

type BranchReportRow = Record<string, unknown> & BranchOverview['branches'][number];

type StaffReportRow = Record<string, unknown> & StaffPerformanceRow & { branchName: string };

export default function DirectorDashboardPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const todayInNairobi = useMemo(() => toYmdInTimeZone(new Date(), 'Africa/Nairobi'), []);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedOverviewBranch, setSelectedOverviewBranch] = useState<string>('ALL');
  const [overviewDate, setOverviewDate] = useState<string>(todayInNairobi);

  const [overviewToday, setOverviewToday] = useState<BranchOverview | null>(null);
  const [isLoadingOverviewToday, setIsLoadingOverviewToday] = useState(true);

  const [branchStartDate, setBranchStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [branchEndDate, setBranchEndDate] = useState<string>(() => toYmd(new Date()));
  const [branchOverviewReport, setBranchOverviewReport] = useState<BranchOverview | null>(null);
  const [isLoadingBranchReport, setIsLoadingBranchReport] = useState(false);
  const [isExportingBranchReport, setIsExportingBranchReport] = useState(false);
  const [directorTrends, setDirectorTrends] = useState<DirectorTrendsReport | null>(null);
  const [isLoadingDirectorTrends, setIsLoadingDirectorTrends] = useState(false);

  const [staffStartDate, setStaffStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [staffEndDate, setStaffEndDate] = useState<string>(() => toYmd(new Date()));
  const [staffBranchId, setStaffBranchId] = useState<string>('');
  const [staffRole, setStaffRole] = useState<string>('ALL');
  const [staffReport, setStaffReport] = useState<StaffPerformancePeriod | null>(null);
  const [isLoadingStaffReport, setIsLoadingStaffReport] = useState(false);
  const [isExportingStaffReport, setIsExportingStaffReport] = useState(false);

  const loadBranches = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    try {
      const data = await branchService.listBranches(accessToken);
      setBranches(data.filter((branch) => branch.isActive));
      setStaffBranchId((current) => current || data.find((branch) => branch.isActive)?.id || '');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branches.';
      toast({
        variant: 'error',
        title: 'Branch lookup failed',
        message,
      });
      setBranches([]);
    }
  }, [accessToken, toast]);

  const loadOverviewToday = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoadingOverviewToday(true);
    try {
      const selectedDateData = await reportService.getBranchOverview(accessToken, {
        startDate: overviewDate,
        endDate: overviewDate,
      });

      if (overviewDate === todayInNairobi && selectedDateData.totalOrders === 0) {
        for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
          const fallbackDate = shiftYmd(todayInNairobi, -dayOffset);
          const fallbackData = await reportService.getBranchOverview(accessToken, {
            startDate: fallbackDate,
            endDate: fallbackDate,
          });

          if (fallbackData.totalOrders > 0) {
            setOverviewDate(fallbackDate);
            setOverviewToday(fallbackData);
            toast({
              variant: 'info',
              title: 'Showing latest branch activity',
              message: `No closed orders today. Showing ${fallbackDate} instead.`,
            });
            return;
          }
        }
      }

      setOverviewToday(selectedDateData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load today overview.';
      toast({
        variant: 'error',
        title: 'Overview failed',
        message,
      });
      setOverviewToday(null);
    } finally {
      setIsLoadingOverviewToday(false);
    }
  }, [accessToken, overviewDate, toast, todayInNairobi]);

  const runBranchReport = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoadingBranchReport(true);
    try {
      const data = await reportService.getBranchOverview(accessToken, {
        startDate: branchStartDate,
        endDate: branchEndDate,
      });
      setBranchOverviewReport(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branch performance report.';
      toast({
        variant: 'error',
        title: 'Branch report failed',
        message,
      });
      setBranchOverviewReport(null);
    } finally {
      setIsLoadingBranchReport(false);
    }
  }, [accessToken, branchEndDate, branchStartDate, toast]);

  const runStaffReport = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    if (!staffBranchId) {
      toast({
        variant: 'warning',
        title: 'Select a branch first',
      });
      return;
    }

    setIsLoadingStaffReport(true);
    try {
      const data = await reportService.getStaffPerformance(accessToken, {
        startDate: staffStartDate,
        endDate: staffEndDate,
        organizationId: staffBranchId,
        role: staffRole === 'ALL' ? undefined : (staffRole as 'WAITER' | 'CHEF' | 'BARISTA'),
      });
      setStaffReport(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff report.';
      toast({
        variant: 'error',
        title: 'Staff report failed',
        message,
      });
      setStaffReport(null);
    } finally {
      setIsLoadingStaffReport(false);
    }
  }, [accessToken, staffBranchId, staffEndDate, staffRole, staffStartDate, toast]);

  const runDirectorTrends = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoadingDirectorTrends(true);
    try {
      const data = await reportService.getDirectorTrends(accessToken, {
        startDate: branchStartDate,
        endDate: branchEndDate,
      });
      setDirectorTrends(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load trend analytics report.';
      toast({
        variant: 'error',
        title: 'Trend analytics failed',
        message,
      });
      setDirectorTrends(null);
    } finally {
      setIsLoadingDirectorTrends(false);
    }
  }, [accessToken, branchEndDate, branchStartDate, toast]);

  const exportBranchReport = useCallback(
    async (format: 'csv' | 'pdf'): Promise<void> => {
      if (!accessToken) {
        return;
      }

      setIsExportingBranchReport(true);
      try {
        await reportService.exportReport(accessToken, {
          reportType: 'branch_overview',
          format,
          startDate: branchStartDate,
          endDate: branchEndDate,
        });
        toast({
          variant: 'success',
          title: `${format.toUpperCase()} download started`,
        });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to export branch report.';
        toast({
          variant: 'error',
          title: 'Export failed',
          message,
        });
      } finally {
        setIsExportingBranchReport(false);
      }
    },
    [accessToken, branchEndDate, branchStartDate, toast],
  );

  const exportStaffReport = useCallback(
    async (format: 'csv' | 'pdf'): Promise<void> => {
      if (!accessToken || !staffBranchId) {
        return;
      }

      setIsExportingStaffReport(true);
      try {
        await reportService.exportReport(accessToken, {
          reportType: 'staff_performance',
          format,
          startDate: staffStartDate,
          endDate: staffEndDate,
          organizationId: staffBranchId,
        });
        toast({
          variant: 'success',
          title: `${format.toUpperCase()} download started`,
        });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to export staff report.';
        toast({
          variant: 'error',
          title: 'Export failed',
          message,
        });
      } finally {
        setIsExportingStaffReport(false);
      }
    },
    [accessToken, staffBranchId, staffEndDate, staffStartDate, toast],
  );

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    void loadOverviewToday();
  }, [loadOverviewToday]);

  useEffect(() => {
    void runBranchReport();
  }, [runBranchReport]);

  useEffect(() => {
    void runDirectorTrends();
  }, [runDirectorTrends]);

  useEffect(() => {
    if (staffBranchId) {
      void runStaffReport();
    }
  }, [runStaffReport, staffBranchId]);

  const selectedOverviewRecord = useMemo(() => {
    if (!overviewToday || selectedOverviewBranch === 'ALL') {
      return null;
    }

    return overviewToday.branches.find((branch) => branch.id === selectedOverviewBranch) ?? null;
  }, [overviewToday, selectedOverviewBranch]);

  const overviewRevenue = selectedOverviewRecord?.revenue ?? overviewToday?.totalRevenue ?? '0.00';
  const overviewOrders = selectedOverviewRecord?.orderCount ?? overviewToday?.totalOrders ?? 0;
  const isOverviewToday = overviewDate === todayInNairobi;

  const overviewBranchRows = useMemo(() => {
    if (!overviewToday) {
      return [];
    }

    if (selectedOverviewBranch === 'ALL') {
      return overviewToday.branches;
    }

    return overviewToday.branches.filter((branch) => branch.id === selectedOverviewBranch);
  }, [overviewToday, selectedOverviewBranch]);

  const overviewVolumeBars = useMemo(() => {
    return overviewBranchRows.map((branch) => ({
      label: branch.name,
      value: branch.orderCount,
    }));
  }, [overviewBranchRows]);

  const branchRows = useMemo<BranchReportRow[]>(() => {
    return branchOverviewReport?.branches.map((branch) => ({ ...branch })) ?? [];
  }, [branchOverviewReport]);

  const staffRows = useMemo<StaffReportRow[]>(() => {
    if (!staffReport) {
      return [];
    }

    return staffReport.staff.map((row) => ({
      ...row,
      branchName: staffReport.organizationName,
    }));
  }, [staffReport]);

  const totalRevenueTrendData = useMemo(() => {
    return (
      directorTrends?.aggregateSeries.map((point) => ({
        label: formatDay(point.date),
        value: Number.parseFloat(point.totalRevenue) || 0,
        date: point.date,
      })) ?? []
    );
  }, [directorTrends]);

  const totalOrdersTrendData = useMemo(() => {
    return (
      directorTrends?.aggregateSeries.map((point) => ({
        label: formatDay(point.date),
        value: point.totalOrders,
        date: point.date,
      })) ?? []
    );
  }, [directorTrends]);

  const branchRevenueSeries = useMemo(() => {
    return (
      directorTrends?.branchRevenueSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({
          label: formatDay(point.date),
          value: point.value,
          date: point.date,
        })),
      })) ?? []
    );
  }, [directorTrends]);

  const branchOrdersSeries = useMemo(() => {
    return (
      directorTrends?.branchOrdersSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({
          label: formatDay(point.date),
          value: point.value,
          date: point.date,
        })),
      })) ?? []
    );
  }, [directorTrends]);

  const branchContributionSeries = useMemo(() => {
    return (
      directorTrends?.branchContributionSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({
          label: formatDay(point.date),
          value: point.value,
          date: point.date,
        })),
      })) ?? []
    );
  }, [directorTrends]);

  const itemFamilySeries = useMemo(() => {
    return (
      directorTrends?.itemFamilySeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({
          label: formatDay(point.date),
          value: point.value,
          date: point.date,
        })),
      })) ?? []
    );
  }, [directorTrends]);

  const branchColumns: Array<TableColumn<BranchReportRow>> = [
    { key: 'name', label: 'Branch' },
    { key: 'revenue', label: 'Revenue', render: (value) => `KES ${String(value)}` },
    { key: 'orderCount', label: 'Orders' },
    {
      key: 'averagePrepTimeMinutes',
      label: 'Avg Prep (KITCHEN)',
      render: (_value, row) => `${row.averagePrepTimeMinutes.KITCHEN} min`,
    },
    {
      key: 'averagePrepTimeMinutesBarista',
      label: 'Avg Prep (BARISTA)',
      render: (_value, row) => `${row.averagePrepTimeMinutes.BARISTA} min`,
    },
  ];

  const staffColumns: Array<TableColumn<StaffReportRow>> = [
    { key: 'branchName', label: 'Branch' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'ordersHandled', label: 'Orders/Tickets' },
    {
      key: 'averageCombined',
      label: 'Avg Value/Prep',
      render: (_value, row) =>
        row.role === 'WAITER' ? `KES ${row.averageOrderValue ?? '0.00'}` : `${row.averagePrepTimeMinutes ?? 0} min`,
    },
    {
      key: 'scheduledHours',
      label: 'Sched/Actual Hrs',
      render: (_value, row) => `${row.scheduledHours.toFixed(2)} / ${row.actualHours.toFixed(2)}`,
    },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Director Dashboard"
        subtitle="Cross-branch oversight and executive reporting."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Overview Panel</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">Selected day across all branches, with optional branch focus.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2">
            <Input
              type="date"
              label="Overview Date"
              value={overviewDate}
              onChange={(event) => setOverviewDate(event.target.value)}
            />
            <Select
              label="Branch"
              value={selectedOverviewBranch}
              options={[
                { value: 'ALL', label: 'All Branches' },
                ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
              ]}
              onChange={(event) => setSelectedOverviewBranch(event.target.value)}
            />
          </div>
        </div>

        {isLoadingOverviewToday ? (
          <div className="mt-4">
            <SkeletonTable rows={4} columns={4} />
          </div>
        ) : !overviewToday ? (
          <EmptyState
            icon={<Globe size={22} />}
            heading="Overview unavailable"
            body="Unable to load the selected cross-branch overview."
            className="mt-4"
          />
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-3">
              <StatCard
                label="Total Revenue"
                value={`KES ${overviewRevenue}`}
                caption={isOverviewToday ? 'Today' : overviewDate}
                icon={<TrendingUp size={18} />}
              />
              <StatCard
                label="Total Orders"
                value={overviewOrders}
                caption={isOverviewToday ? 'Today' : overviewDate}
                icon={<Building2 size={18} />}
              />
            </div>

            {overviewToday.totalOrders === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/8 px-4 py-3">
                <Globe size={16} className="mt-0.5 shrink-0 text-amber" />
                <p className="text-body-sm text-stone-700">
                  No closed orders were recorded on <span className="font-medium">{overviewDate}</span>. Use a different date or the range report below.
                </p>
              </div>
            )}

            <ComparisonBars title="Order Volume Per Branch" data={overviewVolumeBars} />

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h4 className="text-label-lg font-semibold text-stone-900">Average Prep Time Per Branch</h4>
              <div className="mt-3 space-y-2">
                {overviewBranchRows.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2"
                  >
                    <span className="text-body-sm text-stone-800">{branch.name}</span>
                    <span className="text-label-sm font-semibold text-espresso">
                      K {branch.averagePrepTimeMinutes.KITCHEN}m · B {branch.averagePrepTimeMinutes.BARISTA}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h3 className="text-heading-md font-semibold text-stone-900">Trend Analytics</h3>
          <p className="mt-0.5 text-body-sm text-stone-500">
            Revenue, volume, contribution share, and category drivers over time.
          </p>
        </div>

        {isLoadingDirectorTrends ? (
          <SkeletonTable rows={8} columns={6} />
        ) : !directorTrends ? (
          <EmptyState
            icon={<TrendingUp size={22} />}
            heading="No trend analytics"
            body="Try another date range or run the report again."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <LineTrendChart
                title="Total Revenue"
                subtitle="Daily total revenue across all active branches."
                data={totalRevenueTrendData}
                valueFormatter={(value) => `KES ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}`}
                tooltipUnit="Revenue"
                summaryLabel="Total Revenue"
              />
              <LineTrendChart
                title="Total Orders"
                subtitle="Daily closed order volume across all active branches."
                data={totalOrdersTrendData}
                valueFormatter={(value) => String(Math.round(value))}
                tooltipUnit="Orders"
                summaryLabel="Total Orders"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <MultiLineTrendChart
                title="Revenue by Branch"
                subtitle="Revenue trajectory per branch."
                series={branchRevenueSeries}
                valueFormatter={(value) => `KES ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}`}
                tooltipUnit="Revenue"
                summaryLabel="Top Branch Revenue"
              />
              <MultiLineTrendChart
                title="Orders by Branch"
                subtitle="Order volume trajectory per branch."
                series={branchOrdersSeries}
                valueFormatter={(value) => String(Math.round(value))}
                tooltipUnit="Orders"
                summaryLabel="Top Branch Orders"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <MultiLineTrendChart
                title="Branch Contribution Share"
                subtitle="Each branch's share of total daily revenue."
                series={branchContributionSeries}
                valueFormatter={(value) => `${value.toFixed(1)}%`}
                tooltipUnit="Share"
                summaryLabel="Top Branch Share"
              />
              <MultiLineTrendChart
                title="Top Item Family Trends"
                subtitle="Top 5 category revenue trends across branches."
                series={itemFamilySeries}
                valueFormatter={(value) => `KES ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}`}
                tooltipUnit="Revenue"
                summaryLabel="Top Family Revenue"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Branch Performance Report</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">Revenue, order count, and prep-time comparison by branch.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[1fr_1fr_auto_auto]">
            <Input label="Start" type="date" value={branchStartDate} onChange={(event) => setBranchStartDate(event.target.value)} />
            <Input label="End" type="date" value={branchEndDate} onChange={(event) => setBranchEndDate(event.target.value)} />
            <div className="flex items-end">
              <Button onClick={() => void runBranchReport()} isLoading={isLoadingBranchReport}>Run</Button>
            </div>
            <div className="flex items-end">
              <Popover
                trigger={<Button variant="secondary" leftIcon={<Download size={16} />} isLoading={isExportingBranchReport}>Export</Button>}
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
        </div>

        {isLoadingBranchReport ? (
          <SkeletonTable rows={5} columns={5} />
        ) : branchRows.length === 0 ? (
          <EmptyState
            icon={<Building2 size={22} />}
            heading="No branch performance rows"
            body="Try another date range."
          />
        ) : (
          <Table columns={branchColumns} data={branchRows} keyField="id" />
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Staff Performance Report</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">Cross-branch staff metrics with branch and role filters.</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Input label="Start" type="date" value={staffStartDate} onChange={(event) => setStaffStartDate(event.target.value)} />
          <Input label="End" type="date" value={staffEndDate} onChange={(event) => setStaffEndDate(event.target.value)} />
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
          <Button onClick={() => void runStaffReport()} isLoading={isLoadingStaffReport}>Run Report</Button>
          <Popover
            trigger={<Button variant="secondary" leftIcon={<Download size={16} />} isLoading={isExportingStaffReport}>Export</Button>}
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
            body="Pick a branch and date range with completed operational activity."
          />
        ) : (
          <Table columns={staffColumns} data={staffRows} keyField="id" />
        )}
      </section>
    </PageLayout>
  );
}

