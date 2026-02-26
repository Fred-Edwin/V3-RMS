'use client';

import { useCallback, useMemo, useState } from 'react';
import { Download, FileText, Users } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  Popover,
  Select,
  SkeletonTable,
  Table,
  type TableColumn,
} from '@/components/ui';
import { LineTrendChart } from '@/components/dashboard/PremiumChart';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { BranchTrendsReport, StaffPerformancePeriod, StaffPerformanceRow } from '@/types/report';

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

  const runReport = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const [staffData, trendData] = await Promise.all([
        reportService.getStaffPerformance(accessToken, {
          startDate,
          endDate,
          role: role === 'ALL' ? undefined : (role as 'WAITER' | 'CHEF' | 'BARISTA'),
        }),
        reportService.getBranchTrends(accessToken, {
          startDate,
          endDate,
        }),
      ]);
      setReport(staffData);
      setBranchTrends(trendData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff performance report.';
      toast({
        variant: 'error',
        title: 'Report failed',
        message,
      });
      setReport(null);
      setBranchTrends(null);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, endDate, role, startDate, toast]);

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

  const ordersTrendData = useMemo(() => {
    return (
      branchTrends?.points.map((point) => ({
        label: formatDay(point.date),
        value: point.orders,
        date: point.date,
      })) ?? []
    );
  }, [branchTrends]);

  const revenueTrendData = useMemo(() => {
    return (
      branchTrends?.points.map((point) => ({
        label: formatDay(point.date),
        value: Number.parseFloat(point.revenue) || 0,
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
        label: 'Orders/Tickets',
      },
      {
        key: 'averageOrderValue',
        label: 'Avg Value/Prep',
        render: (_value, row) =>
          row.role === 'WAITER'
            ? `KES ${row.averageOrderValue ?? '0.00'}`
            : `${row.averagePrepTimeMinutes ?? 0} min`,
      },
      {
        key: 'scheduledHours',
        label: 'Scheduled Hrs',
        render: (value) => Number(value).toFixed(2),
      },
      {
        key: 'actualHours',
        label: 'Actual Hrs',
        render: (value) => Number(value).toFixed(2),
      },
    ],
    [],
  );

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Staff performance across the selected date range."
      />

      <section className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-4">
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
        <div className="flex items-end gap-2">
          <Button className="w-full" onClick={() => void runReport()} isLoading={isLoading}>
            Run Report
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-heading-sm font-semibold text-stone-900">Operational Trends</h3>
          <p className="mt-1 text-body-sm text-stone-500">
            Trend analytics for orders, revenue, and prep velocity.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-4">
            <SkeletonTable rows={4} columns={4} />
          </div>
        ) : !branchTrends ? (
          <EmptyState
            icon={<Users size={24} />}
            heading="No trend data"
            body="Run the report to load operational trend charts."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 grid gap-4">
            <LineTrendChart
              title="Total Orders Trend"
              subtitle="Daily closed orders across the selected period."
              data={ordersTrendData}
              valueFormatter={(value) => String(Math.round(value))}
              tooltipUnit="Orders"
              summaryLabel="Total Orders"
            />
            <LineTrendChart
              title="Total Revenue Trend"
              subtitle="Daily closed revenue for the selected period."
              data={revenueTrendData}
              valueFormatter={(value) => `KES ${value.toFixed(2)}`}
              tooltipUnit="Revenue"
              summaryLabel="Total Revenue"
            />
            <LineTrendChart
              title="Average Prep Trend"
              subtitle="Daily average prep time (kitchen + barista)."
              data={prepTrendData}
              valueFormatter={(value) => `${Math.round(value)} min`}
              tooltipUnit="Prep Min"
              summaryLabel="Avg Prep"
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-heading-sm font-semibold text-stone-900">Staff Performance Results</h3>
            <p className="mt-1 text-body-sm text-stone-500">
              {report
                ? `${report.organizationName} · ${report.period.startDate} to ${report.period.endDate}`
                : 'Run the report to view staff performance data.'}
            </p>
          </div>

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

        {isLoading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            heading="No staff rows found"
            body="Try a wider date range or remove role filters."
          />
        ) : (
          <Table columns={columns} data={rows} keyField="id" />
        )}
      </section>
    </PageLayout>
  );
}

