'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote } from 'lucide-react';
import { Button, EmptyState, PageHeader, PageLayout, Select, SkeletonBlock, SkeletonTable } from '@/components/ui';
import { LineTrendChart, MultiLineTrendChart } from '@/components/dashboard/PremiumChart';
import { RevenueBreakdownCard } from '@/components/dashboard/RevenueBreakdownCard';
import { RevenueSourcesCard } from '@/components/dashboard/RevenueSourcesCard';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { otherIncomeService } from '@/services/otherIncomeService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  BranchOverview,
  DirectorTrendsReport,
  StaffPerformancePeriod,
} from '@/types/report';
import type { OtherIncomeEntry } from '@/types/otherIncome';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStart = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDay = (dateString: string): string =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'payment' | 'allocation' | 'staff' | 'other-income';

// ── Date range controls ───────────────────────────────────────────────────────

interface DateRangeControlsProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onRun: () => void;
  isLoading: boolean;
  extraControls?: React.ReactNode;
}

function DateRangeControls({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onRun,
  isLoading,
  extraControls,
}: DateRangeControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1.5 block text-label-sm font-medium text-stone-700">From</label>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="rounded-sm border border-stone-200 bg-parchment px-3 py-2 text-body-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-label-sm font-medium text-stone-700">To</label>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={toYmd(new Date())}
          onChange={(e) => onEndChange(e.target.value)}
          className="rounded-sm border border-stone-200 bg-parchment px-3 py-2 text-body-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>
      {extraControls}
      <Button onClick={onRun} disabled={isLoading} size="sm">
        {isLoading ? 'Loading…' : 'Run'}
      </Button>
    </div>
  );
}

// ── Tab: Revenue Overview ─────────────────────────────────────────────────────

function OverviewTab({
  accessToken,
  defaultStart,
  defaultEnd,
}: {
  accessToken: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [trends, setTrends] = useState<DirectorTrendsReport | null>(null);
  const [overview, setOverview] = useState<BranchOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [t, o] = await Promise.all([
        reportService.getDirectorTrends(accessToken, { startDate, endDate }),
        reportService.getBranchOverview(accessToken, { startDate, endDate }),
      ]);
      setTrends(t);
      setOverview(o);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load revenue overview.';
      toast({ variant: 'error', title: 'Analytics failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, startDate, endDate, toast]);

  useEffect(() => {
    void run();
  // Run once on mount with defaults — startDate/endDate intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revenuePoints = useMemo(
    () =>
      trends?.aggregateSeries.map((p) => ({
        label: formatDay(p.date),
        date: p.date,
        value: Number.parseFloat(p.totalRevenue) || 0,
      })) ?? [],
    [trends],
  );

  const ordersPoints = useMemo(
    () =>
      trends?.aggregateSeries.map((p) => ({
        label: formatDay(p.date),
        date: p.date,
        value: p.totalOrders,
      })) ?? [],
    [trends],
  );

  return (
    <div className="space-y-6">
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onRun={() => void run()}
        isLoading={isLoading}
      />

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-xl border border-stone-200 bg-white p-5">
            <SkeletonBlock className="mb-4 h-4 w-40 rounded" />
            <SkeletonBlock className="h-48 rounded" />
          </div>
          <div className="h-64 rounded-xl border border-stone-200 bg-white p-5">
            <SkeletonBlock className="mb-4 h-4 w-40 rounded" />
            <SkeletonBlock className="h-48 rounded" />
          </div>
        </div>
      ) : trends ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <LineTrendChart
              title="Total Revenue (KES)"
              subtitle="Daily total revenue across all branches"
              data={revenuePoints}
              valueFormatter={(v) => `KES ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              tooltipUnit="KES"
              summaryLabel="Total Revenue"
            />
            <LineTrendChart
              title="Total Orders"
              subtitle="Daily closed order volume across all branches"
              data={ordersPoints}
              valueFormatter={(v) => String(Math.round(v))}
              tooltipUnit="Orders"
              summaryLabel="Total Orders"
            />
          </div>

          {trends.branchRevenueSeries.length > 0 && (
            <MultiLineTrendChart
              title="Revenue by Branch (KES)"
              subtitle="Revenue trajectory per branch"
              series={trends.branchRevenueSeries.map((s) => ({
                id: s.id,
                label: s.name,
                data: s.points.map((p) => ({ label: formatDay(p.date), date: p.date, value: p.value })),
              }))}
              valueFormatter={(v) => `KES ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              tooltipUnit="KES"
              summaryLabel="Top Branch Revenue"
            />
          )}

          {/* Revenue sources breakdown */}
          {overview && (
            <RevenueSourcesCard
              foodRevenue={Number.parseFloat(overview.totalRevenue) - Number.parseFloat(overview.totalOtherIncome ?? '0')}
              otherIncomeTotal={Number.parseFloat(overview.totalOtherIncome ?? '0')}
              period={`${startDate} – ${endDate}`}
            />
          )}

          {/* Branch summary table */}
          {overview && (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-100 px-5 py-4">
                <h3 className="text-heading-sm font-semibold text-stone-900">Branch Summary</h3>
                <p className="mt-0.5 text-caption text-stone-500">
                  {startDate} – {endDate} · Total: {formatCurrency(overview.totalRevenue)} · {overview.totalOrders} orders
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/60">
                      <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Branch</th>
                      <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">Revenue</th>
                      <th className="px-5 py-2.5 text-right text-label-sm font-medium text-amber">+ Other</th>
                      <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">Orders</th>
                      <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {[...overview.branches]
                      .sort((a, b) => Number.parseFloat(b.revenue) - Number.parseFloat(a.revenue))
                      .map((branch) => {
                        const total = Number.parseFloat(overview.totalRevenue);
                        const rev = Number.parseFloat(branch.revenue);
                        const pct = total > 0 ? ((rev / total) * 100).toFixed(1) : '0.0';
                        const otherAmt = Number.parseFloat(branch.otherIncomeTotal ?? '0');
                        return (
                          <tr key={branch.id} className="hover:bg-stone-50/60">
                            <td className="px-5 py-3 text-body-sm font-medium text-stone-900">{branch.name}</td>
                            <td className="px-5 py-3 text-right font-mono text-body-sm tabular-nums text-stone-700">
                              {formatCurrency(branch.revenue)}
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-body-sm tabular-nums text-amber">
                              {otherAmt > 0 ? formatCurrency(otherAmt) : '—'}
                            </td>
                            <td className="px-5 py-3 text-right text-body-sm text-stone-600">{branch.orderCount}</td>
                            <td className="px-5 py-3 text-right text-body-sm text-stone-500">{pct}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="py-12 text-center text-body-sm text-stone-400">Set a date range and click Run.</p>
      )}
    </div>
  );
}

// ── Tab: Payment Methods ──────────────────────────────────────────────────────

function PaymentTab({
  accessToken,
  defaultStart,
  defaultEnd,
}: {
  accessToken: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [overview, setOverview] = useState<BranchOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await reportService.getBranchOverview(accessToken, { startDate, endDate });
      setOverview(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load payment breakdown.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, startDate, endDate, toast]);

  useEffect(() => {
    void run();
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    if (!overview) return null;
    let mpesa = 0; let cash = 0; let card = 0; let credit = 0; let other = 0;
    for (const b of overview.branches) {
      const pb = b.paymentBreakdown;
      mpesa += Number.parseFloat(pb.mpesa);
      cash += Number.parseFloat(pb.cash);
      card += Number.parseFloat(pb.card);
      credit +=
        Number.parseFloat(pb.houseAccount) +
        Number.parseFloat(pb.corporateAccount) +
        Number.parseFloat(pb.customerCredit);
      other += Number.parseFloat(b.otherIncomeTotal ?? '0');
    }
    return { mpesa, cash, card, credit, other };
  }, [overview]);

  return (
    <div className="space-y-6">
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onRun={() => void run()}
        isLoading={isLoading}
      />

      {isLoading ? (
        <SkeletonTable rows={4} columns={6} />
      ) : overview && totals ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: 'M-Pesa', value: totals.mpesa, color: 'text-[#1A6B3C]', bg: 'bg-[#EDFAF1] border-[#86EFAC]' },
              { label: 'Cash', value: totals.cash, color: 'text-stone-700', bg: 'bg-parchment border-stone-200' },
              { label: 'Card', value: totals.card, color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF] border-blue-200' },
              { label: 'Credit', value: totals.credit, color: 'text-[#92650A]', bg: 'bg-[#FDF3DC] border-[#F0D080]' },
              { label: '+ Other', value: totals.other, color: 'text-amber', bg: 'bg-amber/10 border-amber/30' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border px-4 py-4 ${bg}`}>
                <p className={`text-label-sm font-medium uppercase tracking-wider ${color} opacity-70`}>{label}</p>
                <p className={`mt-1 font-display text-display-lg font-semibold leading-tight ${color}`}>
                  {formatCurrency(value)}
                </p>
                <p className={`mt-0.5 text-caption ${color} opacity-60`}>
                  {overview.totalRevenue && Number.parseFloat(overview.totalRevenue) > 0
                    ? `${((value / Number.parseFloat(overview.totalRevenue)) * 100).toFixed(1)}% of total`
                    : '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Per-branch breakdown table */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-heading-sm font-semibold text-stone-900">Payment Breakdown by Branch</h3>
              <p className="mt-0.5 text-caption text-stone-500">{startDate} – {endDate}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/60">
                    <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Branch</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#1A6B3C]">M-Pesa</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Cash</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#1D4ED8]">Card</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#92650A]">Credit</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-amber">+ Other</th>
                    <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[...overview.branches]
                    .sort((a, b) => Number.parseFloat(b.revenue) - Number.parseFloat(a.revenue))
                    .map((branch) => {
                      const pb = branch.paymentBreakdown;
                      const creditAmt =
                        Number.parseFloat(pb.houseAccount) +
                        Number.parseFloat(pb.corporateAccount) +
                        Number.parseFloat(pb.customerCredit);
                      const otherAmt = Number.parseFloat(branch.otherIncomeTotal ?? '0');
                      return (
                        <tr key={branch.id} className="hover:bg-stone-50/60">
                          <td className="px-5 py-3.5 text-body-sm font-medium text-stone-900">{branch.name}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#1A6B3C]">
                            {formatCurrency(pb.mpesa)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                            {formatCurrency(pb.cash)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#1D4ED8]">
                            {formatCurrency(pb.card)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#92650A]">
                            {formatCurrency(creditAmt)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-amber">
                            {otherAmt > 0 ? formatCurrency(otherAmt) : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                            {formatCurrency(branch.revenue)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td className="px-5 py-3 text-label-sm font-semibold text-stone-700">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-[#1A6B3C]">
                      {formatCurrency(totals.mpesa)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-stone-900">
                      {formatCurrency(totals.cash)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-[#1D4ED8]">
                      {formatCurrency(totals.card)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-[#92650A]">
                      {formatCurrency(totals.credit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-amber">
                      {totals.other > 0 ? formatCurrency(totals.other) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-label-sm font-bold tabular-nums text-espresso">
                      {formatCurrency(overview.totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-body-sm text-stone-400">Set a date range and click Run.</p>
      )}
    </div>
  );
}

// ── Tab: Revenue Allocation ───────────────────────────────────────────────────

function AllocationTab({
  accessToken,
  defaultStart,
  defaultEnd,
}: {
  accessToken: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [overview, setOverview] = useState<BranchOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await reportService.getBranchOverview(accessToken, { startDate, endDate });
      setOverview(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load allocation data.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, startDate, endDate, toast]);

  useEffect(() => {
    void run();
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRevenue = Number.parseFloat(overview?.totalRevenue ?? '0');

  return (
    <div className="space-y-6">
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onRun={() => void run()}
        isLoading={isLoading}
      />

      {isLoading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <SkeletonBlock className="mb-4 h-6 w-48 rounded" />
          <SkeletonBlock className="mb-6 h-3 w-full rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="mb-3 h-4 w-full rounded" />
          ))}
        </div>
      ) : overview && totalRevenue > 0 ? (
        <RevenueBreakdownCard
          totalRevenue={totalRevenue}
          period={`${startDate} – ${endDate}`}
        />
      ) : (
        <p className="py-12 text-center text-body-sm text-stone-400">
          {overview ? 'No revenue recorded in this period.' : 'Set a date range and click Run.'}
        </p>
      )}
    </div>
  );
}

// ── Tab: Staff Collections ────────────────────────────────────────────────────

function StaffTab({
  accessToken,
  branches,
  defaultStart,
  defaultEnd,
}: {
  accessToken: string;
  branches: BranchDto[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [staffReport, setStaffReport] = useState<StaffPerformancePeriod | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    if (!branchId) {
      toast({ variant: 'warning', title: 'Select a branch first' });
      return;
    }
    setIsLoading(true);
    try {
      const data = await reportService.getStaffPerformance(accessToken, {
        startDate,
        endDate,
        organizationId: branchId,
        role: 'WAITER',
      });
      setStaffReport(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff collections.';
      toast({ variant: 'error', title: 'Staff report failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, branchId, startDate, endDate, toast]);

  // Update branchId when branches load
  useEffect(() => {
    if (branches.length > 0 && !branchId) {
      setBranchId(branches[0]?.id ?? '');
    }
  }, [branches, branchId]);

  return (
    <div className="space-y-6">
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onRun={() => void run()}
        isLoading={isLoading}
        extraControls={
          <div>
            <Select
              label="Branch"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            />
          </div>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : staffReport ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h3 className="text-heading-sm font-semibold text-stone-900">Waiter Collections</h3>
            <p className="mt-0.5 text-caption text-stone-500">
              {staffReport.organizationName} · {startDate} – {endDate}
            </p>
          </div>

          {staffReport.staff.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-stone-400">No waiter data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/60">
                    <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Waiter</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Orders</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#1A6B3C]">M-Pesa</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Cash</th>
                    <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#1D4ED8]">Card</th>
                    <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {staffReport.staff.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50/60">
                      <td className="px-5 py-3.5">
                        <span className="text-body-sm font-medium text-stone-900">{row.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-body-sm text-stone-600">{row.ordersHandled}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#1A6B3C]">
                        {formatCurrency(row.paymentBreakdown?.mpesa ?? '0')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                        {formatCurrency(row.paymentBreakdown?.cash ?? '0')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#1D4ED8]">
                        {formatCurrency(row.paymentBreakdown?.card ?? '0')}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                        {formatCurrency(row.paymentBreakdown?.total ?? row.averageOrderValue ?? '0')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className="py-12 text-center text-body-sm text-stone-400">
          Select a branch and date range, then click Run.
        </p>
      )}
    </div>
  );
}

// ── Tab: Other Income ─────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Cash', MPESA: 'M-Pesa', CARD: 'Card' };

function OtherIncomeTab({
  accessToken,
  branches,
  defaultStart,
  defaultEnd,
}: {
  accessToken: string;
  branches: BranchDto[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [branchFilter, setBranchFilter] = useState('');
  const [entries, setEntries] = useState<OtherIncomeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const { entries: data } = await otherIncomeService.listEntries(
        { startDate, endDate, branchId: branchFilter || undefined, perPage: 100 },
        accessToken,
      );
      setEntries(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load other income.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, startDate, endDate, branchFilter, toast]);

  useEffect(() => {
    void run();
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalValue = useMemo(
    () => entries.reduce((sum, e) => sum + Number.parseFloat(e.amount), 0),
    [entries],
  );

  // Group by category for summary
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const e of entries) {
      const existing = map.get(e.categoryId);
      if (existing) {
        existing.total += Number.parseFloat(e.amount);
        existing.count += 1;
      } else {
        map.set(e.categoryId, { name: e.category.name, total: Number.parseFloat(e.amount), count: 1 });
      }
    }
    const values: { name: string; total: number; count: number }[] = [];
    map.forEach((v) => values.push(v));
    return values.sort((a, b) => b.total - a.total);
  }, [entries]);

  const branchOptions = [
    { value: '', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="space-y-6">
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onRun={() => void run()}
        isLoading={isLoading}
        extraControls={
          branches.length > 1 ? (
            <div>
              <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Branch</label>
              <Select
                options={branchOptions}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              />
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Banknote size={48} className="text-stone-300" />}
          heading="No other income recorded"
          body="No non-food revenue entries found for the selected date range"
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[#F0D080] bg-[#FDF3DC] px-4 py-4">
              <p className="text-label-sm font-medium uppercase tracking-wider text-[#92650A] opacity-70">
                Total Other Income
              </p>
              <p className="mt-1 font-display text-display-lg font-semibold leading-tight text-[#92650A]">
                {formatCurrency(totalValue)}
              </p>
              <p className="mt-0.5 text-caption text-[#92650A] opacity-60">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>
            {byCategory.slice(0, 2).map((cat) => (
              <div key={cat.name} className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
                <p className="truncate text-label-sm font-medium uppercase tracking-wider text-stone-500">
                  {cat.name}
                </p>
                <p className="mt-1 font-sans text-heading-xl font-bold tabular-nums tracking-tight text-stone-900">
                  {formatCurrency(cat.total)}
                </p>
                <p className="mt-0.5 text-caption text-stone-400">{cat.count} entries</p>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {byCategory.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-100 px-5 py-4">
                <h3 className="text-heading-sm font-semibold text-stone-900">By Category</h3>
                <p className="mt-0.5 text-caption text-stone-500">{startDate} – {endDate}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/60">
                      <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Category</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Entries</th>
                      <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">Total</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {byCategory.map((cat) => {
                      const pct = totalValue > 0 ? ((cat.total / totalValue) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={cat.name} className="hover:bg-stone-50/60">
                          <td className="px-5 py-3 text-body-sm font-medium text-stone-900">{cat.name}</td>
                          <td className="px-4 py-3 text-right text-body-sm text-stone-600">{cat.count}</td>
                          <td className="px-5 py-3 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                            {formatCurrency(cat.total)}
                          </td>
                          <td className="px-4 py-3 text-right text-body-sm text-stone-500">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 bg-stone-50">
                      <td className="px-5 py-3 text-label-sm font-semibold text-stone-700">Total</td>
                      <td className="px-4 py-3 text-right text-label-sm font-semibold text-stone-700">
                        {entries.length}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-label-sm font-bold tabular-nums text-espresso">
                        {formatCurrency(totalValue)}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Full entry list */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-heading-sm font-semibold text-stone-900">All Entries</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/60">
                    <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Date</th>
                    <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Category</th>
                    <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Branch</th>
                    <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Payment</th>
                    <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Recorded By</th>
                    <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-stone-50/60">
                      <td className="px-5 py-3 text-body-sm text-stone-600">
                        {new Date(`${entry.entryDate.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-body-sm font-medium text-stone-900">{entry.category.name}</td>
                      <td className="px-4 py-3 text-body-sm text-stone-600">{entry.branch.name}</td>
                      <td className="px-4 py-3 text-body-sm text-stone-600">
                        {PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-stone-500">{entry.recordedBy.name}</td>
                      <td className="px-5 py-3 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                        {formatCurrency(entry.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Revenue Overview' },
  { key: 'payment', label: 'Payment Methods' },
  { key: 'allocation', label: 'Revenue Allocation' },
  { key: 'staff', label: 'Staff Collections' },
  { key: 'other-income', label: 'Other Income' },
];

export default function AccountantAnalyticsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [branches, setBranches] = useState<BranchDto[]>([]);

  const defaultStart = useMemo(() => toYmd(getMonthStart(new Date())), []);
  const defaultEnd = useMemo(() => toYmd(new Date()), []);

  useEffect(() => {
    if (!accessToken) return;
    branchService
      .listBranches(accessToken)
      .then((data) => setBranches(data.filter((b) => b.isActive && !b.isHub)))
      .catch(() => {
        toast({ variant: 'error', title: 'Failed to load branches', message: 'Could not fetch branch list.' });
      });
  // accessToken and toast are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (!accessToken) return <></>;

  return (
    <PageLayout className="space-y-6 animate-fade-up">
      <PageHeader
        title="Analytics"
        subtitle="Financial trends, payment breakdowns, and staff collections"
      />

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-label-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-espresso text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab accessToken={accessToken} defaultStart={defaultStart} defaultEnd={defaultEnd} />
        )}
        {activeTab === 'payment' && (
          <PaymentTab accessToken={accessToken} defaultStart={defaultStart} defaultEnd={defaultEnd} />
        )}
        {activeTab === 'allocation' && (
          <AllocationTab accessToken={accessToken} defaultStart={defaultStart} defaultEnd={defaultEnd} />
        )}
        {activeTab === 'staff' && (
          <StaffTab
            accessToken={accessToken}
            branches={branches}
            defaultStart={defaultStart}
            defaultEnd={defaultEnd}
          />
        )}
        {activeTab === 'other-income' && (
          <OtherIncomeTab
            accessToken={accessToken}
            branches={branches}
            defaultStart={defaultStart}
            defaultEnd={defaultEnd}
          />
        )}
      </div>
    </PageLayout>
  );
}
