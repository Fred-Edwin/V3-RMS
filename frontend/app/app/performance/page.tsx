'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart2, CalendarRange, Clock, Flame, ListChecks, ShoppingBag, Timer } from 'lucide-react';
import {
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  Select,
  SkeletonTable,
  StatCard,
} from '@/components/ui';
import { LineTrendChart } from '@/components/dashboard/PremiumChart';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { MyPerformance } from '@/types/report';

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStart = (value: Date): Date => {
  return new Date(value.getFullYear(), value.getMonth(), 1);
};

const getWeekStart = (value: Date): Date => {
  const current = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = current.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + offset);
  return current;
};

const formatDay = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

type RangePreset = 'this_week' | 'this_month' | 'custom';

export default function PerformancePage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);

  const [preset, setPreset] = useState<RangePreset>('this_month');
  const [startDate, setStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [endDate, setEndDate] = useState<string>(() => toYmd(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<MyPerformance | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const applyPreset = useCallback((nextPreset: RangePreset) => {
    const today = new Date();
    if (nextPreset === 'this_week') {
      setStartDate(toYmd(getWeekStart(today)));
      setEndDate(toYmd(today));
      return;
    }

    if (nextPreset === 'this_month') {
      setStartDate(toYmd(getMonthStart(today)));
      setEndDate(toYmd(today));
    }
  }, []);

  const loadReport = useCallback(async (): Promise<void> => {
    if (!accessToken || (role !== 'WAITER' && role !== 'CHEF' && role !== 'BARISTA')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await reportService.getMyPerformance(accessToken, {
        startDate,
        endDate,
      });
      setReport(data);
      setLastUpdated(new Date());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load personal performance.';
      toast({
        variant: 'error',
        title: 'Report load failed',
        message,
      });
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, endDate, role, startDate, toast]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const isWaiterReport = report?.role === 'WAITER';

  const waiterTrendData = useMemo(() => {
    if (!isWaiterReport) {
      return [];
    }

    return report.ordersOverTime.map((point) => ({
      label: formatDay(point.date),
      value: point.count,
      date: point.date,
    }));
  }, [isWaiterReport, report]);

  const prepOrdersTrendData = useMemo(() => {
    if (!report || report.role === 'WAITER') {
      return [];
    }

    return report.ordersOverTime.map((point) => ({
      label: formatDay(point.date),
      value: point.count,
      date: point.date,
    }));
  }, [report]);

  if (role !== 'WAITER' && role !== 'CHEF' && role !== 'BARISTA') {
    return (
      <PageLayout>
        <PageHeader title="Performance" subtitle="This page is available to operational staff." />
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <EmptyState
            icon={<BarChart2 size={24} />}
            heading="No performance view for this role"
            body="Waiters, chefs, and baristas can access personal performance metrics here."
          />
        </div>
      </PageLayout>
    );
  }

  const periodSubtitle = `${formatDay(startDate)} – ${formatDay(endDate)}`;

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <div className="flex items-start justify-between gap-2">
        <PageHeader
          title="Performance"
          subtitle={`Personal metrics · ${periodSubtitle}`}
          titleClassName="font-display text-display-lg font-semibold text-espresso"
        />
        {lastUpdated && (
          <p className="mt-2 flex shrink-0 items-center gap-1 text-caption text-stone-400">
            <Clock size={11} />
            Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5">
        <Select
          label="Range"
          value={preset}
          options={[
            { value: 'this_week', label: 'This Week' },
            { value: 'this_month', label: 'This Month' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(event) => {
            const nextPreset = event.target.value as RangePreset;
            setPreset(nextPreset);
            applyPreset(nextPreset);
          }}
        />
        <Input
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(event) => {
            setPreset('custom');
            setStartDate(event.target.value);
          }}
        />
        <Input
          label="End Date"
          type="date"
          value={endDate}
          onChange={(event) => {
            setPreset('custom');
            setEndDate(event.target.value);
          }}
        />
      </section>

      {isLoading ? (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <SkeletonTable rows={6} columns={4} />
        </section>
      ) : !report ? (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <EmptyState
            icon={<BarChart2 size={24} />}
            heading="No performance data"
            body="Performance metrics will appear after your first completed shifts and orders."
          />
        </section>
      ) : report.role === 'WAITER' ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-2">
            <StatCard label="Orders Handled" value={report.ordersHandled} icon={<ShoppingBag size={18} />} />
            <StatCard label="Busiest Day" value={report.busiestDay ? formatDay(report.busiestDay) : '-'} icon={<Flame size={18} />} />
          </section>

          <LineTrendChart
            title="Orders Over Time"
            subtitle="Daily order volume for your selected period"
            data={waiterTrendData}
            valueFormatter={(value) => String(Math.round(value))}
            tooltipUnit="Orders"
            summaryLabel="Total Orders"
          />

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-heading-md font-semibold text-stone-900">Top 5 Items Ordered</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">Most frequently sold items from your orders.</p>
            <div className="mt-4">
              {report.topItems.length === 0 ? (
                <p className="text-body-sm text-stone-500">No item trends in this range.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {report.topItems.map((item, index) => (
                    <div
                      key={item.name}
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
          </section>
        </>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Tickets Completed" value={report.ticketsCompleted} icon={<ListChecks size={18} />} />
            <StatCard label="Average Prep Time" value={`${report.averagePrepTimeMinutes} min`} icon={<Timer size={18} />} />
            <StatCard label="Fastest Prep" value={`${report.fastestPrepTimeMinutes} min`} icon={<CalendarRange size={18} />} />
            <StatCard label="Busiest Day" value={report.busiestDay ? formatDay(report.busiestDay) : '-'} icon={<Flame size={18} />} />
          </section>

          <LineTrendChart
            title="Orders Over Time"
            subtitle="Daily completed ticket volume for your selected period"
            data={prepOrdersTrendData}
            valueFormatter={(value) => String(Math.round(value))}
            tooltipUnit="Completed Tickets"
            summaryLabel="Total Completed"
          />
        </>
      )}
    </PageLayout>
  );
}

