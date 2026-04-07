'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, ArrowDownCircle } from 'lucide-react';
import { Button, PageHeader, PageLayout, SkeletonBlock } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { BranchOverview, OutstandingBalancesReport } from '@/types/report'; // BranchOverview used for todayReport state

// ── Helpers ────────────────────────────────────────────────────────────────────

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getGreeting = (hour: number): string => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'amber' | 'red' | 'green';
}) {
  const accentBg =
    accent === 'red'
      ? 'bg-[#FEF2F2]'
      : accent === 'green'
        ? 'bg-[#EDFAF1]'
        : 'bg-parchment';
  const accentText =
    accent === 'red'
      ? 'text-[#991B1B]'
      : accent === 'green'
        ? 'text-[#1A6B3C]'
        : 'text-stone-600';

  return (
    <div className="flex items-start gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentBg} ${accentText}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-label-sm uppercase tracking-wider text-stone-400">{label}</p>
        <p className="mt-0.5 font-display text-display-lg font-semibold leading-tight text-stone-900">{value}</p>
        {sub && <p className="mt-0.5 text-caption text-stone-500">{sub}</p>}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <SkeletonBlock className="size-10 shrink-0 rounded-lg" />
      <div className="flex-1">
        <SkeletonBlock className="mb-2 h-3 w-28 rounded" />
        <SkeletonBlock className="h-8 w-36 rounded" />
      </div>
    </div>
  );
}

function PaymentMethodBadge({ method }: { method: 'mpesa' | 'cash' | 'card' | 'credit' | 'total' }) {
  const styles = {
    mpesa: 'bg-[#EDFAF1] text-[#1A6B3C]',
    cash: 'bg-parchment text-stone-700',
    card: 'bg-[#EFF6FF] text-[#1D4ED8]',
    credit: 'bg-[#FDF3DC] text-[#92650A]',
    total: 'bg-espresso/10 text-espresso',
  };
  const labels = { mpesa: 'M-Pesa', cash: 'Cash', card: 'Card', credit: 'Credit', total: 'Total' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-label-sm font-medium ${styles[method]}`}>
      {labels[method]}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AccountantDashboardPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userName = useAuthStore((state) => state.user?.name ?? '');

  const today = useMemo(() => toYmd(new Date()), []);
  const greeting = useMemo(() => getGreeting(new Date().getHours()), []);
  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  const [todayReport, setTodayReport] = useState<BranchOverview | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingBalancesReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [todayData, outstandingData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: today, endDate: today }),
        reportService.getOutstandingBalances(accessToken),
      ]);
      setTodayReport(todayData);
      setOutstanding(outstandingData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load dashboard.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, today, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedBranches = useMemo(() => {
    if (!todayReport) return [];
    return [...todayReport.branches].sort(
      (a, b) => Number.parseFloat(b.revenue) - Number.parseFloat(a.revenue),
    );
  }, [todayReport]);

  // Aggregate payment totals across all branches (today)
  const paymentTotals = useMemo(() => {
    if (!todayReport) return null;
    let mpesa = 0; let cash = 0; let card = 0; let credit = 0; let other = 0;
    for (const b of todayReport.branches) {
      mpesa += Number.parseFloat(b.paymentBreakdown.mpesa);
      cash += Number.parseFloat(b.paymentBreakdown.cash);
      card += Number.parseFloat(b.paymentBreakdown.card);
      credit +=
        Number.parseFloat(b.paymentBreakdown.houseAccount) +
        Number.parseFloat(b.paymentBreakdown.corporateAccount) +
        Number.parseFloat(b.paymentBreakdown.customerCredit);
      other += Number.parseFloat(b.otherIncomeTotal ?? '0');
    }
    return { mpesa, cash, card, credit, other };
  }, [todayReport]);

  const outstandingTotal = outstanding
    ? Number.parseFloat(outstanding.totals.grandTotal)
    : null;

  const todayRevenue = Number.parseFloat(todayReport?.totalRevenue ?? '0');
  const todayOrders = todayReport?.totalOrders ?? 0;
  const todayOtherIncome = Number.parseFloat(todayReport?.totalOtherIncome ?? '0');

  return (
    <PageLayout className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <PageHeader
          title="Dashboard"
          subtitle={`${greeting}, ${userName.split(' ')[0] ?? userName} — ${dateLabel}`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={isLoading}
          className="mt-1 flex items-center gap-1.5 text-stone-500"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Today's Revenue"
              value={formatCurrency(todayRevenue)}
              sub={
                todayOtherIncome > 0
                  ? `${todayOrders} orders · ${formatCurrency(todayOtherIncome)} other income`
                  : `${todayOrders} orders`
              }
              icon={<TrendingUp size={20} />}
              accent="amber"
            />
            <KpiCard
              label="Outstanding Credit"
              value={outstandingTotal !== null ? formatCurrency(outstandingTotal) : '—'}
              sub="Across all accounts"
              icon={<AlertCircle size={20} />}
              accent={outstandingTotal !== null && outstandingTotal > 0 ? 'red' : 'green'}
            />
            <KpiCard
              label="Today's Cash Collected"
              value={paymentTotals ? formatCurrency(paymentTotals.cash) : '—'}
              sub="Cash orders only"
              icon={<ArrowDownCircle size={20} />}
              accent="green"
            />
          </>
        )}
      </div>

      {/* Payment Method Breakdown by Branch */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-heading-sm font-semibold text-stone-900">Today&apos;s Collections by Branch</h2>
          <p className="mt-0.5 text-caption text-stone-500">
            Reconcile each branch against M-Pesa statements and cash totals
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex h-14 items-center gap-4 px-5">
                <SkeletonBlock className="h-4 w-32 rounded" />
                <div className="ml-auto flex gap-6">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <SkeletonBlock key={j} className="h-4 w-20 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : sortedBranches.length === 0 ? (
          <p className="px-5 py-8 text-center text-body-sm text-stone-400">No branch data for today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Branch</th>
                  <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">
                    <PaymentMethodBadge method="mpesa" />
                  </th>
                  <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">
                    <PaymentMethodBadge method="cash" />
                  </th>
                  <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">
                    <PaymentMethodBadge method="card" />
                  </th>
                  <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">
                    <PaymentMethodBadge method="credit" />
                  </th>
                  <th className="px-4 py-2.5 text-right text-label-sm font-medium text-amber">
                    + Other
                  </th>
                  <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">
                    <PaymentMethodBadge method="total" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedBranches.map((branch, idx) => {
                  const pb = branch.paymentBreakdown;
                  const creditTotal =
                    Number.parseFloat(pb.houseAccount) +
                    Number.parseFloat(pb.corporateAccount) +
                    Number.parseFloat(pb.customerCredit);
                  const otherTotal = Number.parseFloat(branch.otherIncomeTotal ?? '0');
                  const isTop = idx === 0 && sortedBranches.length > 1;
                  const isBottom = idx === sortedBranches.length - 1 && sortedBranches.length > 1;

                  return (
                    <tr key={branch.id} className="transition-colors hover:bg-stone-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-body-sm font-medium text-stone-900">{branch.name}</span>
                          {isTop && (
                            <span className="flex items-center gap-0.5 text-caption font-medium text-[#1A6B3C]">
                              <TrendingUp size={11} /> Top
                            </span>
                          )}
                          {isBottom && (
                            <span className="flex items-center gap-0.5 text-caption font-medium text-red-500">
                              <TrendingDown size={11} /> Low
                            </span>
                          )}
                        </div>
                        <span className="text-caption text-stone-400">{branch.orderCount} orders</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                        {formatCurrency(pb.mpesa)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                        {formatCurrency(pb.cash)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                        {formatCurrency(pb.card)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                        {formatCurrency(creditTotal)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-amber">
                        {otherTotal > 0 ? formatCurrency(otherTotal) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                        {formatCurrency(branch.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              {paymentTotals && (
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td className="px-5 py-3 text-label-sm font-semibold text-stone-700">All Branches</td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-stone-900">
                      {formatCurrency(paymentTotals.mpesa)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-stone-900">
                      {formatCurrency(paymentTotals.cash)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-stone-900">
                      {formatCurrency(paymentTotals.card)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-stone-900">
                      {formatCurrency(paymentTotals.credit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-amber">
                      {paymentTotals.other > 0 ? formatCurrency(paymentTotals.other) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-label-sm font-bold tabular-nums text-espresso">
                      {formatCurrency(todayRevenue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

    </PageLayout>
  );
}
