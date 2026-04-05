'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, PageHeader, PageLayout, SkeletonBlock, StatCard } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { BranchOverview } from '@/types/report';

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

function KpiSkeleton(): JSX.Element {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <SkeletonBlock className="mb-3 h-3 w-24 rounded" />
      <SkeletonBlock className="mb-2 h-9 w-32 rounded" />
      <SkeletonBlock className="h-3 w-20 rounded" />
    </div>
  );
}

function BranchRowSkeleton(): JSX.Element {
  return (
    <div className="flex h-[52px] items-center gap-3 border-b border-stone-100 px-4 last:border-0">
      <SkeletonBlock className="h-4 w-32 rounded" />
      <div className="ml-auto flex items-center gap-6">
        <SkeletonBlock className="h-4 w-20 rounded" />
        <SkeletonBlock className="h-4 w-12 rounded" />
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
  const monthStart = useMemo(() => {
    const d = new Date();
    return toYmd(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);
  const greeting = useMemo(() => getGreeting(new Date().getHours()), []);

  const [todayReport, setTodayReport] = useState<BranchOverview | null>(null);
  const [mtdReport, setMtdReport] = useState<BranchOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [todayData, mtdData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: today, endDate: today }),
        reportService.getBranchOverview(accessToken, { startDate: monthStart, endDate: today }),
      ]);
      setTodayReport(todayData);
      setMtdReport(mtdData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load dashboard.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, today, monthStart, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const todayRevenue = todayReport?.totalRevenue ?? '0';
  const todayOrders = todayReport?.totalOrders ?? 0;
  const mtdRevenue = mtdReport?.totalRevenue ?? '0';

  const sortedBranches = useMemo(() => {
    if (!todayReport) return [];
    return [...todayReport.branches].sort(
      (a, b) => Number.parseFloat(b.revenue) - Number.parseFloat(a.revenue),
    );
  }, [todayReport]);

  return (
    <PageLayout className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Dashboard"
          subtitle={`${greeting}, ${userName.split(' ')[0] ?? userName} — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}
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
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(todayRevenue)}
              icon={<TrendingUp size={18} className="text-amber-700" />}
            />
            <StatCard
              label="Today's Orders"
              value={String(todayOrders)}
              icon={<BarChart2 size={18} className="text-amber-700" />}
            />
            <StatCard
              label="Month-to-Date Revenue"
              value={formatCurrency(mtdRevenue)}
              icon={<TrendingUp size={18} className="text-amber-700" />}
            />
          </>
        )}
      </div>

      {/* Revenue by Branch */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-label-md font-semibold text-stone-800">Today&apos;s Revenue by Branch</h2>
          <Link
            href="/app/director/analytics"
            className="text-label-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Full Analytics →
          </Link>
        </div>

        {isLoading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3].map((i) => (
              <BranchRowSkeleton key={i} />
            ))}
          </div>
        ) : sortedBranches.length === 0 ? (
          <p className="px-4 py-6 text-center text-body-sm text-stone-400">No branch data for today.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {/* Header */}
            <div className="grid grid-cols-[1fr_160px_80px] gap-3 px-4 py-2 text-label-sm font-medium text-stone-500">
              <span>Branch</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Orders</span>
            </div>
            {sortedBranches.map((branch, idx) => {
              const revenue = Number.parseFloat(branch.revenue);
              const totalRev = Number.parseFloat(todayRevenue);
              const pct = totalRev > 0 ? Math.round((revenue / totalRev) * 100) : 0;
              const isTop = idx === 0 && sortedBranches.length > 1;
              const isBottom = idx === sortedBranches.length - 1 && sortedBranches.length > 1;
              return (
                <div
                  key={branch.id}
                  className="grid grid-cols-[1fr_160px_80px] items-center gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-medium text-stone-800">{branch.name}</span>
                    {isTop && (
                      <span className="flex items-center gap-0.5 text-caption font-medium text-status-ready-text">
                        <TrendingUp size={11} />
                        Top
                      </span>
                    )}
                    {isBottom && (
                      <span className="flex items-center gap-0.5 text-caption font-medium text-red-500">
                        <TrendingDown size={11} />
                        Low
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-body-sm font-semibold text-stone-900">
                      {formatCurrency(branch.revenue)}
                    </span>
                    <span className="ml-1.5 text-caption text-stone-400">{pct}%</span>
                  </div>
                  <div className="text-right text-body-sm text-stone-600">{branch.orderCount}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
