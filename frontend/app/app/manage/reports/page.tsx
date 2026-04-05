'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronUp, Clock, Download, FileText, Printer, ShoppingBag, TrendingDown, TrendingUp, Users } from 'lucide-react';
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
import { HourlyBarsChart, LineTrendChart } from '@/components/dashboard/PremiumChart';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { BranchTrendsReport, HourlyHeatmapReport, ItemsPerformanceReport, StaffPerformancePeriod, StaffPerformanceRow } from '@/types/report';

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStart = (value: Date): Date => {
  return new Date(value.getFullYear(), value.getMonth(), 1);
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

const daysBetween = (start: string, end: string): number => {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000));
};

type StaffRow = Record<string, unknown> & StaffPerformanceRow;

export default function ManagerReportsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [startDate, setStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [endDate, setEndDate] = useState<string>(() => toYmd(new Date()));
  const [role, setRole] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [report, setReport] = useState<StaffPerformancePeriod | null>(null);
  const [branchTrends, setBranchTrends] = useState<BranchTrendsReport | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [itemsData, setItemsData] = useState<ItemsPerformanceReport | null>(null);
  const [itemsLimit, setItemsLimit] = useState<number>(10);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const runReport = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const [staffData, trendData, heatmapData, itemsPerfData] = await Promise.all([
        reportService.getStaffPerformance(accessToken, {
          startDate,
          endDate,
          role: role === 'ALL' ? undefined : (role as 'WAITER' | 'CHEF' | 'BARISTA'),
        }),
        reportService.getBranchTrends(accessToken, {
          startDate,
          endDate,
        }),
        reportService.getHourlyHeatmap(accessToken, {
          startDate,
          endDate,
        }),
        reportService.getItemsPerformance(accessToken, {
          startDate,
          endDate,
          limit: itemsLimit,
        }),
      ]);
      setReport(staffData);
      setBranchTrends(trendData);
      setHourlyData(heatmapData);
      setItemsData(itemsPerfData);
      setLastUpdated(new Date());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff performance report.';
      toast({
        variant: 'error',
        title: 'Report failed',
        message,
      });
      setReport(null);
      setBranchTrends(null);
      setHourlyData(null);
      setItemsData(null);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, endDate, itemsLimit, role, startDate, toast]);

  const handleExport = useCallback(
    async (format: 'csv' | 'pdf'): Promise<void> => {
      if (!accessToken) {
        return;
      }

      setIsExporting(true);
      try {
        await reportService.exportReport(accessToken, {
          reportType: 'staff_performance',
          format,
          startDate,
          endDate,
        });
        toast({
          variant: 'success',
          title: `${format.toUpperCase()} download started`,
        });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to export report.';
        toast({
          variant: 'error',
          title: 'Export failed',
          message,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [accessToken, endDate, startDate, toast],
  );

  const rows = useMemo<StaffRow[]>(() => {
    return report?.staff.map((staff) => ({ ...staff })) ?? [];
  }, [report]);

  // KPI summary stats derived from staff data
  const kpiStats = useMemo(() => {
    if (!report || report.staff.length === 0) return null;

    const totalOrders = report.staff.reduce((sum, s) => sum + s.ordersHandled, 0);
    const prepStaff = report.staff.filter((s) => s.role === 'CHEF' || s.role === 'BARISTA');
    const avgPrepTime =
      prepStaff.length > 0
        ? prepStaff.reduce((sum, s) => sum + (s.averagePrepTimeMinutes ?? 0), 0) / prepStaff.length
        : 0;

    const scheduledTotal = report.staff.reduce((sum, s) => sum + s.scheduledHours, 0);
    const actualTotal = report.staff.reduce((sum, s) => sum + s.actualHours, 0);
    const attendanceRate = scheduledTotal > 0 ? (actualTotal / scheduledTotal) * 100 : 0;

    return { totalOrders, avgPrepTime, attendanceRate };
  }, [report]);

  const ordersTrendData = useMemo(() => {
    return (
      branchTrends?.points.map((point) => ({
        label: formatDay(point.date),
        value: point.orders,
        date: point.date,
      })) ?? []
    );
  }, [branchTrends]);

  const prepTrendData = useMemo(() => {
    return (
      branchTrends?.points.map((point) => ({
        label: formatDay(point.date),
        value: point.avgPrepCombined,
        date: point.date,
      })) ?? []
    );
  }, [branchTrends]);

  const columns: Array<TableColumn<StaffRow>> = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
      },
      {
        key: 'role',
        label: 'Role',
      },
      {
        key: 'ordersHandled',
        label: 'Orders / Tickets',
        render: (value) => <span className="tabular-nums">{String(value)}</span>,
      },
      {
        key: 'averageOrderValue',
        label: 'Avg Prep',
        render: (_value, row) => (
          <span className="tabular-nums">{row.averagePrepTimeMinutes ?? 0} min</span>
        ),
      },
      {
        key: 'scheduledHours',
        label: 'Scheduled Hrs',
        render: (value) => <span className="tabular-nums">{Number(value).toFixed(2)}</span>,
      },
      {
        key: 'actualHours',
        label: 'Actual Hrs',
        render: (value) => <span className="tabular-nums">{Number(value).toFixed(2)}</span>,
      },
    ],
    [],
  );

  const periodLabel =
    report
      ? `${formatDisplayDate(report.period.startDate)} – ${formatDisplayDate(report.period.endDate)}`
      : `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;

  return (
    <PageLayout className="animate-fade-up space-y-6 print:space-y-4">
      {/* ── Print header (hidden on screen) ───────────────────────── */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-stone-900">Staff Performance Report</h1>
        <p className="mt-1 text-sm text-stone-600">{periodLabel}</p>
        {report && <p className="text-sm text-stone-500">{report.organizationName}</p>}
        {lastUpdated && (
          <p className="mt-1 text-xs text-stone-400">
            Generated {lastUpdated.toLocaleString('en-GB')}
          </p>
        )}
        <hr className="mt-3 border-stone-200" />
      </div>

      <PageHeader
        title="Reports"
        titleClassName="font-display text-display-lg font-semibold text-espresso print:hidden"
        subtitle="Staff performance across the selected date range."
        className="print:hidden"
      />

      {/* ── Filters ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
          <Select
            label="Role Filter"
            value={role}
            options={[
              { value: 'ALL', label: 'All Roles' },
              { value: 'WAITER', label: 'Waiter' },
              { value: 'CHEF', label: 'Chef' },
              { value: 'BARISTA', label: 'Barista' },
            ]}
            onChange={(event) => setRole(event.target.value)}
          />
          <div className="col-span-2 flex items-end md:col-span-1">
            <Button className="w-full" onClick={() => void runReport()} isLoading={isLoading}>
              Run Report
            </Button>
          </div>
        </div>
      </section>

      {/* ── KPI Summary Row ───────────────────────────────────────── */}
      {(kpiStats || isLoading) && (
        <section>
          <h2 className="mb-3 text-label-sm font-semibold uppercase tracking-wider text-stone-400 print:text-xs">
            Performance Summary
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 animate-shimmer rounded-xl border border-stone-200 bg-stone-100" />
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
          ) : null}
        </section>
      )}

      {/* ── Operational Trends ────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Operational Trends</h3>
            <p className="mt-1 text-body-sm text-stone-500">
              {branchTrends
                ? `${branchTrends.organizationName} · ${periodLabel}`
                : 'Run the report to load operational trend charts.'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4">
            <SkeletonTable rows={4} columns={4} />
          </div>
        ) : !branchTrends ? (
          <EmptyState
            icon={<TrendingUp size={24} />}
            heading="No trend data"
            body="Run the report to load operational trend charts."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 space-y-4">
            <LineTrendChart
              title="Total Orders"
              subtitle="Daily closed orders (count)"
              data={ordersTrendData}
              valueFormatter={(value) => String(Math.round(value))}
              tooltipUnit="Orders"
              summaryLabel="Total Orders"
            />
            <LineTrendChart
              title="Avg Prep Time (min)"
              subtitle="Daily average prep time — kitchen + barista combined"
              data={prepTrendData}
              valueFormatter={(value) => `${Math.round(value)} min`}
              tooltipUnit="min"
              summaryLabel="Avg Prep"
            />
          </div>
        )}
      </section>

      {/* ── Order Volume by Time of Day ───────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Order Volume by Time of Day</h3>
            <p className="mt-1 text-body-sm text-stone-500">
              {hourlyData
                ? `When are customers most active? · ${periodLabel}`
                : 'Run the report to see peak hours.'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : !hourlyData ? (
          <EmptyState
            icon={<TrendingUp size={24} />}
            heading="No hourly data"
            body="Run the report to see order volume by time of day."
            className="mt-4"
          />
        ) : (
          <HourlyBarsChart
            data={hourlyData}
            showDow={daysBetween(startDate, endDate) >= 14}
          />
        )}
      </section>

      {/* ── Staff Performance Table ───────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Staff Performance</h3>
            <p className="mt-1 text-body-sm text-stone-500">
              {report
                ? `${report.organizationName} · ${periodLabel}`
                : 'Run the report to view staff performance data.'}
            </p>
            {lastUpdated && (
              <p className="mt-0.5 flex items-center gap-1 text-caption text-stone-400">
                <Clock size={11} />
                Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 print:hidden">
            <Button
              variant="ghost"
              leftIcon={<Printer size={16} />}
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Popover
              trigger={
                <Button variant="secondary" leftIcon={<Download size={16} />} isLoading={isExporting}>
                  Export
                </Button>
              }
              className="w-44"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
                onClick={() => void handleExport('csv')}
              >
                <FileText size={14} /> Download CSV
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
                onClick={() => void handleExport('pdf')}
              >
                <FileText size={14} /> Download PDF
              </button>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            heading="No staff rows found"
            body="Run the report, or try a wider date range and remove role filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table columns={columns} data={rows} keyField="id" />
            </div>
            {/* Summary row */}
            {kpiStats && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-stone-200 pt-3">
                <span className="text-label-sm font-semibold text-stone-700">
                  Total: {kpiStats.totalOrders} orders/tickets
                </span>
                <span className="text-label-sm text-stone-500">
                  Attendance: {kpiStats.attendanceRate.toFixed(1)}%
                </span>
              </div>
            )}
          </>
        )}
      </section>
      {/* ── Items Performance ─────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Item Performance</h3>
            <p className="mt-1 text-body-sm text-stone-500">
              {itemsData
                ? `${itemsData.organizationName} · ${periodLabel}`
                : 'Run the report to see top and bottom selling items.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-label-sm text-stone-500">Show top / bottom</span>
            <select
              value={itemsLimit}
              onChange={(e) => setItemsLimit(Number(e.target.value))}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-body-sm text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber"
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : !itemsData ? (
          <EmptyState
            icon={<ShoppingBag size={24} />}
            heading="No items data"
            body="Run the report to see item performance."
            className="mt-4"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top items */}
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
                      <th className="px-3 py-2.5 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Qty</th>
                      <th className="px-3 py-2.5 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Revenue</th>
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
                        <td className="px-3 py-2.5 text-right tabular-nums text-stone-700">{item.quantitySold}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-stone-900">
                          KES {Number.parseFloat(item.revenue).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom items */}
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
                      <th className="px-3 py-2.5 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Qty</th>
                      <th className="px-3 py-2.5 text-right text-label-sm font-medium uppercase tracking-wider text-stone-500">Revenue</th>
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
                        <td className="px-3 py-2.5 text-right tabular-nums text-stone-700">{item.quantitySold}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-stone-900">
                          KES {Number.parseFloat(item.revenue).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </PageLayout>
  );
}
