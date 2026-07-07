'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, ArrowDownCircle, AlertTriangle } from 'lucide-react';
import { Button, ExcelTable, PageHeader, PageLayout, SkeletonBlock } from '@/components/ui';
import { InboxNudge } from '@/components/comms/InboxNudge';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { BranchOverview, OutstandingBalancesReport, StaleOrdersReport } from '@/types/report';

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
      ? 'bg-danger-bg'
      : accent === 'green'
        ? 'bg-success-bg'
        : 'bg-parchment';
  const accentText =
    accent === 'red'
      ? 'text-danger'
      : accent === 'green'
        ? 'text-success'
        : 'text-stone-600';

  return (
    <div className="flex items-start gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentBg} ${accentText}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-label-sm uppercase tracking-wider text-stone-400">{label}</p>
        <p className="mt-0.5 font-sans text-display-lg font-semibold leading-tight tabular-nums text-stone-900">{value}</p>
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
  const [staleReport, setStaleReport] = useState<StaleOrdersReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [todayData, outstandingData, staleData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: today, endDate: today }),
        reportService.getOutstandingBalances(accessToken),
        reportService.getStaleOrders(accessToken),
      ]);
      setTodayReport(todayData);
      setOutstanding(outstandingData);
      setStaleReport(staleData);
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

      <InboxNudge />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <KpiSkeleton />
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
            <KpiCard
              label="Unaccounted Orders"
              value={staleReport ? String(staleReport.totalOrders) : '—'}
              sub={
                staleReport
                  ? staleReport.totalOrders > 0
                    ? `${formatCurrency(staleReport.totalAtRisk)} unaccounted`
                    : 'All orders reconciled'
                  : 'All branches'
              }
              icon={<AlertTriangle size={20} />}
              accent={staleReport && staleReport.totalOrders > 0 ? 'red' : 'green'}
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
        ) : (
          <ExcelTable
            columns={[
              {
                key: 'branch',
                label: 'Branch',
                render: (branch) => {
                  const idx = sortedBranches.findIndex((b) => b.id === branch.id);
                  const isTop = idx === 0 && sortedBranches.length > 1;
                  const isBottom = idx === sortedBranches.length - 1 && sortedBranches.length > 1;
                  return (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-office-ink">{branch.name}</span>
                        {isTop && (
                          <span className="flex items-center gap-0.5 text-caption font-medium text-success">
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
                    </>
                  );
                },
              },
              { key: 'mpesa', label: 'M-Pesa', numeric: true, render: (branch) => formatCurrency(branch.paymentBreakdown.mpesa) },
              { key: 'cash', label: 'Cash', numeric: true, render: (branch) => formatCurrency(branch.paymentBreakdown.cash) },
              { key: 'card', label: 'Card', numeric: true, render: (branch) => formatCurrency(branch.paymentBreakdown.card) },
              {
                key: 'credit',
                label: 'Credit',
                numeric: true,
                render: (branch) => {
                  const pb = branch.paymentBreakdown;
                  const creditTotal =
                    Number.parseFloat(pb.houseAccount) +
                    Number.parseFloat(pb.corporateAccount) +
                    Number.parseFloat(pb.customerCredit);
                  return formatCurrency(creditTotal);
                },
              },
              {
                key: 'other',
                label: '+ Other',
                numeric: true,
                render: (branch) => {
                  const otherTotal = Number.parseFloat(branch.otherIncomeTotal ?? '0');
                  return <span className="text-amber">{otherTotal > 0 ? formatCurrency(otherTotal) : '—'}</span>;
                },
              },
              {
                key: 'total',
                label: 'Total',
                numeric: true,
                render: (branch) => <span className="font-semibold">{formatCurrency(branch.revenue)}</span>,
              },
            ]}
            rows={sortedBranches}
            rowKey={(branch) => branch.id}
            headerTone="navy"
            emptyState={<p className="text-body-sm text-stone-400">No branch data for today.</p>}
            totalsRow={paymentTotals ? {
              branch: <span className="text-label-sm uppercase tracking-wide">All Branches</span>,
              mpesa: formatCurrency(paymentTotals.mpesa),
              cash: formatCurrency(paymentTotals.cash),
              card: formatCurrency(paymentTotals.card),
              credit: formatCurrency(paymentTotals.credit),
              other: <span className="text-amber">{paymentTotals.other > 0 ? formatCurrency(paymentTotals.other) : '—'}</span>,
              total: <span className="font-bold text-espresso">{formatCurrency(todayRevenue)}</span>,
            } : undefined}
          />
        )}
      </div>

    </PageLayout>
  );
}
