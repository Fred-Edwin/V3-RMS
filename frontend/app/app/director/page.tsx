'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Globe,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
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
import { ComparisonBars, HourlyBarsChart, LineTrendChart, MultiLineTrendChart } from '@/components/dashboard/PremiumChart';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  BranchOverview,
  DailySummary,
  DirectorPulseBranchRow,
  DirectorPulseReport,
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
  if (!year || !month || !day) return toYmd(value);
  return `${year}-${month}-${day}`;
};

const shiftYmd = (ymd: string, deltaDays: number): string => {
  const [yearToken, monthToken, dayToken] = ymd.split('-');
  const year = Number(yearToken ?? '0');
  const month = Number(monthToken ?? '1');
  const day = Number(dayToken ?? '1');
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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

const formatTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
};

const roleBadgeClass = (role: string): string => {
  switch (role) {
    case 'CHEF': return 'bg-amber/10 text-amber border border-amber/30';
    case 'BARISTA': return 'bg-espresso/10 text-espresso border border-espresso/20';
    default: return 'bg-stone-100 text-stone-600 border border-stone-200';
  }
};

const deltaPercent = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

const deltaCurrencyPercent = (current: string, previous: string): number | null => {
  const c = Number.parseFloat(current);
  const p = Number.parseFloat(previous);
  if (Number.isNaN(c) || Number.isNaN(p) || p === 0) return null;
  return Math.round(((c - p) / p) * 100);
};

// ── Sub-components ────────────────────────────────────────────────────────────

function DeltaBadge({ pct }: { pct: number | null }): JSX.Element {
  if (pct === null) return <span className="text-caption text-stone-400">vs yesterday</span>;
  const positive = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-caption font-medium ${positive ? 'text-status-ready-text' : 'text-red-600'}`}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positive ? '+' : ''}{pct}% vs yesterday
    </span>
  );
}

function PulseBranchCard({ branch }: { branch: DirectorPulseBranchRow }): JSX.Element {
  const hasActivity = branch.activeOrders > 0 || branch.clockedInCount > 0;
  return (
    <div className={`rounded-xl border p-4 ${hasActivity ? 'border-stone-200 bg-white' : 'border-stone-100 bg-stone-50'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-label-lg font-semibold text-stone-900">{branch.name}</h4>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm font-medium ${branch.clockedInCount > 0 ? 'bg-status-ready-bg text-status-ready-text' : 'bg-stone-100 text-stone-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${branch.clockedInCount > 0 ? 'bg-status-ready-text' : 'bg-stone-400'}`} />
          {branch.clockedInCount > 0 ? 'Active' : 'No staff clocked in'}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-center">
          <p className="text-heading-md font-bold tabular-nums text-espresso">{branch.activeOrders}</p>
          <p className="text-caption text-stone-500">Live orders</p>
        </div>
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-center">
          <p className="text-heading-md font-bold tabular-nums text-stone-800">{branch.pendingTickets}</p>
          <p className="text-caption text-stone-500">Pending tickets</p>
        </div>
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-center">
          <p className="text-heading-md font-bold tabular-nums text-stone-800">{branch.clockedInCount}</p>
          <p className="text-caption text-stone-500">Clocked in</p>
        </div>
      </div>

      {branch.clockedInStaff.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {branch.clockedInStaff.map((staff) => (
            <span
              key={`${staff.name}-${staff.role}`}
              className={`rounded-full px-2 py-0.5 text-caption font-medium ${roleBadgeClass(staff.role)}`}
            >
              {staff.name}
            </span>
          ))}
        </div>
      )}

      {!hasActivity && (
        <p className="text-caption text-stone-400">No live activity at this branch.</p>
      )}
    </div>
  );
}

function DailySummaryPanel({ summary, branchName }: { summary: DailySummary; branchName: string }): JSX.Element {
  const totalRevenueNum = Number.parseFloat(summary.totalRevenue);
  const mpesaNum = Number.parseFloat(summary.revenueByPaymentMethod.MPESA);
  const cashNum = Number.parseFloat(summary.revenueByPaymentMethod.CASH);
  const cardNum = Number.parseFloat(summary.revenueByPaymentMethod.CARD);

  const mpesaPct = totalRevenueNum > 0 ? Math.round((mpesaNum / totalRevenueNum) * 100) : 0;
  const cashPct = totalRevenueNum > 0 ? Math.round((cashNum / totalRevenueNum) * 100) : 0;
  const cardPct = totalRevenueNum > 0 ? Math.round((cardNum / totalRevenueNum) * 100) : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-label-lg font-semibold text-stone-900">{branchName}</h4>
          <p className="text-caption text-stone-500">{formatDisplayDate(summary.date)}</p>
        </div>
        <div className="text-right">
          <p className="text-heading-sm font-bold tabular-nums text-espresso">{formatCurrency(summary.totalRevenue)}</p>
          <p className="text-caption text-stone-500">{summary.orderCount} orders</p>
        </div>
      </div>

      {/* Order type split */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {[
          { label: 'Dine-In', value: summary.ordersByType.DINE_IN },
          { label: 'Take-Away', value: summary.ordersByType.TAKE_AWAY },
          { label: 'Delivery', value: summary.ordersByType.DELIVERY },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md bg-stone-50 px-2 py-1.5 text-center">
            <p className="text-label-md font-semibold tabular-nums text-stone-800">{value}</p>
            <p className="text-caption text-stone-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Payment split */}
      <div className="mb-3">
        <p className="mb-1.5 text-label-sm font-medium uppercase tracking-wide text-stone-400">Revenue by payment</p>
        <div className="flex h-2 overflow-hidden rounded-full bg-stone-100">
          {mpesaPct > 0 && <div className="bg-espresso" style={{ width: `${mpesaPct}%` }} />}
          {cashPct > 0 && <div className="bg-amber" style={{ width: `${cashPct}%` }} />}
          {cardPct > 0 && <div className="bg-stone-400" style={{ width: `${cardPct}%` }} />}
        </div>
        <div className="mt-1.5 flex gap-3">
          <span className="flex items-center gap-1 text-caption text-stone-600">
            <span className="h-2 w-2 rounded-full bg-espresso" /> Mpesa {mpesaPct}%
          </span>
          <span className="flex items-center gap-1 text-caption text-stone-600">
            <span className="h-2 w-2 rounded-full bg-amber" /> Cash {cashPct}%
          </span>
          <span className="flex items-center gap-1 text-caption text-stone-600">
            <span className="h-2 w-2 rounded-full bg-stone-400" /> Card {cardPct}%
          </span>
        </div>
      </div>

      {/* Top items */}
      {summary.topItems.length > 0 && (
        <div>
          <p className="mb-1.5 text-label-sm font-medium uppercase tracking-wide text-stone-400">Top items</p>
          <div className="space-y-1">
            {summary.topItems.slice(0, 5).map((item, index) => (
              <div key={item.menuItemId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-100 text-caption font-bold text-stone-500">{index + 1}</span>
                  <span className="text-body-sm text-stone-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-caption tabular-nums text-stone-500">×{item.quantitySold}</span>
                  <span className="text-label-sm font-medium tabular-nums text-stone-800">{formatCurrency(item.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prep times */}
      <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3">
        <span className="text-caption text-stone-500">
          Kitchen avg <span className="font-medium text-stone-700">{summary.averagePrepTimeMinutes.KITCHEN} min</span>
        </span>
        <span className="text-caption text-stone-500">
          Barista avg <span className="font-medium text-stone-700">{summary.averagePrepTimeMinutes.BARISTA} min</span>
        </span>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BranchReportRow = Record<string, unknown> & BranchOverview['branches'][number];
type StaffReportRow = Record<string, unknown> & StaffPerformanceRow & { branchName: string };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectorDashboardPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const todayInNairobi = useMemo(() => toYmdInTimeZone(new Date(), 'Africa/Nairobi'), []);
  const yesterdayInNairobi = useMemo(() => shiftYmd(todayInNairobi, -1), [todayInNairobi]);

  // ── Branches ────────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchDto[]>([]);

  // ── Live Pulse ───────────────────────────────────────────────────────────────
  const [pulse, setPulse] = useState<DirectorPulseReport | null>(null);
  const [isLoadingPulse, setIsLoadingPulse] = useState(true);
  const [pulseLoadedAt, setPulseLoadedAt] = useState<Date | null>(null);

  // ── Overview (today + yesterday for delta) ───────────────────────────────────
  const [overviewDate, setOverviewDate] = useState<string>(todayInNairobi);
  const [selectedOverviewBranch, setSelectedOverviewBranch] = useState<string>('ALL');
  const [overviewToday, setOverviewToday] = useState<BranchOverview | null>(null);
  const [overviewYesterday, setOverviewYesterday] = useState<BranchOverview | null>(null);
  const [isLoadingOverviewToday, setIsLoadingOverviewToday] = useState(true);

  // ── Daily summaries per branch ────────────────────────────────────────────
  const [summaryDate, setSummaryDate] = useState<string>(todayInNairobi);
  const [branchSummaries, setBranchSummaries] = useState<DailySummary[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);

  // ── Trend / Branch Performance ────────────────────────────────────────────
  const [branchStartDate, setBranchStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [branchEndDate, setBranchEndDate] = useState<string>(() => toYmd(new Date()));
  const [branchOverviewReport, setBranchOverviewReport] = useState<BranchOverview | null>(null);
  const [isLoadingBranchReport, setIsLoadingBranchReport] = useState(false);
  const [isExportingBranchReport, setIsExportingBranchReport] = useState(false);
  const [branchReportUpdatedAt, setBranchReportUpdatedAt] = useState<Date | null>(null);
  const [directorTrends, setDirectorTrends] = useState<DirectorTrendsReport | null>(null);
  const [isLoadingDirectorTrends, setIsLoadingDirectorTrends] = useState(false);
  const [hourlyBranchId, setHourlyBranchId] = useState<string>('');
  const [hourlyData, setHourlyData] = useState<HourlyHeatmapReport | null>(null);
  const [isLoadingHourly, setIsLoadingHourly] = useState(false);

  // ── Staff Performance ─────────────────────────────────────────────────────
  const [staffStartDate, setStaffStartDate] = useState<string>(() => toYmd(getMonthStart(new Date())));
  const [staffEndDate, setStaffEndDate] = useState<string>(() => toYmd(new Date()));
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
      const active = data.filter((branch) => branch.isActive);
      setBranches(active);
      setStaffBranchId((current) => current || active[0]?.id || '');
      setHourlyBranchId((current) => current || active[0]?.id || '');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branches.';
      toast({ variant: 'error', title: 'Branch lookup failed', message });
      setBranches([]);
    }
  }, [accessToken, toast]);

  const loadPulse = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingPulse(true);
    try {
      const data = await reportService.getDirectorPulse(accessToken);
      setPulse(data);
      setPulseLoadedAt(new Date());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load live pulse.';
      toast({ variant: 'error', title: 'Pulse failed', message });
      setPulse(null);
    } finally {
      setIsLoadingPulse(false);
    }
  }, [accessToken, toast]);

  const loadOverviewToday = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingOverviewToday(true);
    try {
      const [todayData, yesterdayData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: overviewDate, endDate: overviewDate }),
        reportService.getBranchOverview(accessToken, { startDate: yesterdayInNairobi, endDate: yesterdayInNairobi }),
      ]);

      if (overviewDate === todayInNairobi && todayData.totalOrders === 0) {
        for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
          const fallbackDate = shiftYmd(todayInNairobi, -dayOffset);
          const fallbackData = await reportService.getBranchOverview(accessToken, {
            startDate: fallbackDate,
            endDate: fallbackDate,
          });
          if (fallbackData.totalOrders > 0) {
            setOverviewDate(fallbackDate);
            setOverviewToday(fallbackData);
            setOverviewYesterday(yesterdayData);
            toast({
              variant: 'info',
              title: 'Showing latest branch activity',
              message: `No closed orders today. Showing ${fallbackDate} instead.`,
            });
            return;
          }
        }
      }

      setOverviewToday(todayData);
      setOverviewYesterday(yesterdayData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load today overview.';
      toast({ variant: 'error', title: 'Overview failed', message });
      setOverviewToday(null);
      setOverviewYesterday(null);
    } finally {
      setIsLoadingOverviewToday(false);
    }
  }, [accessToken, overviewDate, toast, todayInNairobi, yesterdayInNairobi]);

  const loadBranchSummaries = useCallback(async (branchList: BranchDto[]): Promise<void> => {
    if (!accessToken || branchList.length === 0) return;
    setIsLoadingSummaries(true);
    try {
      const results = await Promise.all(
        branchList.map((branch) =>
          reportService.getDailySummary(accessToken, {
            date: summaryDate,
            organizationId: branch.id,
          }),
        ),
      );
      setBranchSummaries(results);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branch summaries.';
      toast({ variant: 'error', title: 'Daily summaries failed', message });
      setBranchSummaries([]);
    } finally {
      setIsLoadingSummaries(false);
    }
  }, [accessToken, summaryDate, toast]);

  const runBranchReport = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingBranchReport(true);
    try {
      const data = await reportService.getBranchOverview(accessToken, {
        startDate: branchStartDate,
        endDate: branchEndDate,
      });
      setBranchOverviewReport(data);
      setBranchReportUpdatedAt(new Date());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branch performance report.';
      toast({ variant: 'error', title: 'Branch report failed', message });
      setBranchOverviewReport(null);
    } finally {
      setIsLoadingBranchReport(false);
    }
  }, [accessToken, branchEndDate, branchStartDate, toast]);

  const runStaffReport = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    if (!staffBranchId) {
      toast({ variant: 'warning', title: 'Select a branch first' });
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
      setStaffReportUpdatedAt(new Date());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load staff report.';
      toast({ variant: 'error', title: 'Staff report failed', message });
      setStaffReport(null);
    } finally {
      setIsLoadingStaffReport(false);
    }
  }, [accessToken, staffBranchId, staffEndDate, staffRole, staffStartDate, toast]);

  const runDirectorTrends = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingDirectorTrends(true);
    try {
      const data = await reportService.getDirectorTrends(accessToken, {
        startDate: branchStartDate,
        endDate: branchEndDate,
      });
      setDirectorTrends(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load trend analytics.';
      toast({ variant: 'error', title: 'Trend analytics failed', message });
      setDirectorTrends(null);
    } finally {
      setIsLoadingDirectorTrends(false);
    }
  }, [accessToken, branchEndDate, branchStartDate, toast]);

  const runHourlyHeatmap = useCallback(async (): Promise<void> => {
    if (!accessToken || !hourlyBranchId) return;
    setIsLoadingHourly(true);
    try {
      const data = await reportService.getHourlyHeatmap(accessToken, {
        startDate: branchStartDate,
        endDate: branchEndDate,
        organizationId: hourlyBranchId,
      });
      setHourlyData(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load hourly heatmap.';
      toast({ variant: 'error', title: 'Hourly heatmap failed', message });
      setHourlyData(null);
    } finally {
      setIsLoadingHourly(false);
    }
  }, [accessToken, branchEndDate, branchStartDate, hourlyBranchId, toast]);

  const exportBranchReport = useCallback(async (format: 'csv' | 'pdf'): Promise<void> => {
    if (!accessToken) return;
    setIsExportingBranchReport(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'branch_overview',
        format,
        startDate: branchStartDate,
        endDate: branchEndDate,
      });
      toast({ variant: 'success', title: `${format.toUpperCase()} download started` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to export branch report.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingBranchReport(false);
    }
  }, [accessToken, branchEndDate, branchStartDate, toast]);

  const exportStaffReport = useCallback(async (format: 'csv' | 'pdf'): Promise<void> => {
    if (!accessToken || !staffBranchId) return;
    setIsExportingStaffReport(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'staff_performance',
        format,
        startDate: staffStartDate,
        endDate: staffEndDate,
        organizationId: staffBranchId,
      });
      toast({ variant: 'success', title: `${format.toUpperCase()} download started` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to export staff report.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingStaffReport(false);
    }
  }, [accessToken, staffBranchId, staffEndDate, staffStartDate, toast]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { void loadBranches(); }, [loadBranches]);
  useEffect(() => { void loadPulse(); }, [loadPulse]);
  useEffect(() => { void loadOverviewToday(); }, [loadOverviewToday]);
  useEffect(() => { void runBranchReport(); }, [runBranchReport]);
  useEffect(() => { void runDirectorTrends(); }, [runDirectorTrends]);

  useEffect(() => {
    if (branches.length > 0) {
      void loadBranchSummaries(branches);
    }
  }, [branches, loadBranchSummaries]);

  useEffect(() => {
    if (staffBranchId) { void runStaffReport(); }
  }, [runStaffReport, staffBranchId]);

  // ── Derived values ────────────────────────────────────────────────────────

  const selectedOverviewRecord = useMemo(() => {
    if (!overviewToday || selectedOverviewBranch === 'ALL') return null;
    return overviewToday.branches.find((branch) => branch.id === selectedOverviewBranch) ?? null;
  }, [overviewToday, selectedOverviewBranch]);

  const selectedYesterdayRecord = useMemo(() => {
    if (!overviewYesterday || selectedOverviewBranch === 'ALL') return null;
    return overviewYesterday.branches.find((branch) => branch.id === selectedOverviewBranch) ?? null;
  }, [overviewYesterday, selectedOverviewBranch]);

  const overviewRevenue = selectedOverviewRecord?.revenue ?? overviewToday?.totalRevenue ?? '0.00';
  const overviewOrders = selectedOverviewRecord?.orderCount ?? overviewToday?.totalOrders ?? 0;
  const isOverviewToday = overviewDate === todayInNairobi;

  const yesterdayRevenue = selectedYesterdayRecord?.revenue ?? overviewYesterday?.totalRevenue ?? '0.00';
  const yesterdayOrders = selectedYesterdayRecord?.orderCount ?? overviewYesterday?.totalOrders ?? 0;

  const overviewBranchRows = useMemo(() => {
    if (!overviewToday) return [];
    if (selectedOverviewBranch === 'ALL') return overviewToday.branches;
    return overviewToday.branches.filter((branch) => branch.id === selectedOverviewBranch);
  }, [overviewToday, selectedOverviewBranch]);

  const overviewVolumeBars = useMemo(() => {
    return overviewBranchRows.map((branch) => ({ label: branch.name, value: branch.orderCount }));
  }, [overviewBranchRows]);

  const branchRows = useMemo<BranchReportRow[]>(() => {
    return branchOverviewReport?.branches.map((branch) => ({ ...branch })) ?? [];
  }, [branchOverviewReport]);

  const staffRows = useMemo<StaffReportRow[]>(() => {
    if (!staffReport) return [];
    return staffReport.staff.map((row) => ({ ...row, branchName: staffReport.organizationName }));
  }, [staffReport]);

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
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? []
    );
  }, [directorTrends]);

  const branchOrdersSeries = useMemo(() => {
    return (
      directorTrends?.branchOrdersSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? []
    );
  }, [directorTrends]);

  const branchContributionSeries = useMemo(() => {
    return (
      directorTrends?.branchContributionSeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? []
    );
  }, [directorTrends]);

  const itemFamilySeries = useMemo(() => {
    return (
      directorTrends?.itemFamilySeries.map((series) => ({
        id: series.id,
        label: series.name,
        data: series.points.map((point) => ({ label: formatDay(point.date), value: point.value, date: point.date })),
      })) ?? []
    );
  }, [directorTrends]);

  const branchPeriodLabel = `${formatDisplayDate(branchStartDate)} – ${formatDisplayDate(branchEndDate)}`;

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout className="animate-fade-up space-y-6 print:space-y-4">

      {/* ── Print header ─────────────────────────────────────────────────── */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-stone-900">Director Dashboard — Executive Report</h1>
        <p className="mt-1 text-sm text-stone-600">Period: {branchPeriodLabel}</p>
        <p className="mt-1 text-xs text-stone-400">Generated {new Date().toLocaleString('en-GB')}</p>
        <hr className="mt-3 border-stone-200" />
      </div>

      <PageHeader
        title="Director Dashboard"
        subtitle="Cross-branch oversight and executive reporting."
        titleClassName="font-display text-display-lg font-semibold text-espresso print:hidden"
        className="print:hidden"
      />

      {/* ── Live Operations Pulse ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-espresso" />
              <h3 className="text-heading-md font-semibold text-stone-900">Live Operations Pulse</h3>
              <span className="flex items-center gap-1 rounded-full bg-status-ready-bg px-2 py-0.5 text-caption font-medium text-status-ready-text">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-ready-text" />
                Live
              </span>
            </div>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Active orders, tickets in flight, and clocked-in staff across all branches right now.
              {pulseLoadedAt && (
                <span className="ml-2 text-stone-400">Snapshot at {formatTime(pulseLoadedAt.toISOString())}</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            leftIcon={<RefreshCw size={15} />}
            onClick={() => void loadPulse()}
            isLoading={isLoadingPulse}
          >
            Refresh
          </Button>
        </div>

        {isLoadingPulse ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 animate-shimmer rounded-xl bg-gradient-to-r from-stone-200 via-stone-100 to-stone-200 bg-[length:200%_100%]" />
            ))}
          </div>
        ) : !pulse ? (
          <EmptyState
            icon={<Activity size={22} />}
            heading="Pulse unavailable"
            body="Could not load live operations data. Try refreshing."
          />
        ) : (
          <>
            {/* System-wide totals */}
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Active Orders"
                value={pulse.totalActiveOrders}
                caption="Across all branches"
                icon={<Activity size={18} />}
              />
              <StatCard
                label="Staff Clocked In"
                value={pulse.totalClockedIn}
                caption="Across all branches"
                icon={<Users size={18} />}
              />
              <StatCard
                label="Branches Reporting"
                value={pulse.branches.length}
                caption="Active in system"
                icon={<Globe size={18} />}
              />
              <StatCard
                label="Branches Active"
                value={pulse.branches.filter((b) => b.clockedInCount > 0 || b.activeOrders > 0).length}
                caption="With live activity"
                icon={<Building2 size={18} />}
              />
            </div>

            {/* Per-branch cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pulse.branches.map((branch) => (
                <PulseBranchCard key={branch.id} branch={branch} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Overview Panel (with delta) ───────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Overview Panel</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Selected day snapshot with comparison to {formatDisplayDate(yesterdayInNairobi)}.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2 print:hidden">
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
          <div className="mt-4"><SkeletonTable rows={4} columns={4} /></div>
        ) : !overviewToday ? (
          <EmptyState
            icon={<Globe size={22} />}
            heading="Overview unavailable"
            body="Unable to load the selected cross-branch overview."
            className="mt-4"
          />
        ) : (
          <div className="mt-5 space-y-5">
            {/* KPI row with deltas */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-label-sm font-medium uppercase tracking-wider text-stone-500">Total Revenue</p>
                  <TrendingUp size={18} className="text-stone-400" />
                </div>
                <p className="mt-2 font-display text-display-lg font-medium text-stone-900">{formatCurrency(overviewRevenue)}</p>
                <DeltaBadge pct={deltaCurrencyPercent(overviewRevenue, yesterdayRevenue)} />
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-label-sm font-medium uppercase tracking-wider text-stone-500">Total Orders</p>
                  <Building2 size={18} className="text-stone-400" />
                </div>
                <p className="mt-2 font-display text-display-lg font-medium text-stone-900">{overviewOrders}</p>
                <DeltaBadge pct={deltaPercent(overviewOrders, yesterdayOrders)} />
              </div>
              <StatCard
                label="Active Branches"
                value={overviewToday.branches.length}
                caption="With closed orders"
                icon={<Globe size={18} />}
              />
              <StatCard
                label="Avg Revenue / Branch"
                value={
                  overviewToday.branches.length > 0
                    ? formatCurrency(Number.parseFloat(overviewRevenue) / overviewToday.branches.length)
                    : 'KES 0.00'
                }
                caption={isOverviewToday ? 'Today' : formatDisplayDate(overviewDate)}
                icon={<TrendingUp size={18} />}
              />
            </div>

            {overviewToday.totalOrders === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/8 px-4 py-3">
                <Globe size={16} className="mt-0.5 shrink-0 text-amber" />
                <p className="text-body-sm text-stone-700">
                  No closed orders on{' '}
                  <span className="font-medium">{formatDisplayDate(overviewDate)}</span>. Use a different date or the range report below.
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
                      Kitchen {branch.averagePrepTimeMinutes.KITCHEN} min · Barista{' '}
                      {branch.averagePrepTimeMinutes.BARISTA} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Daily Branch Summaries (top items + payment breakdown) ──────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-espresso" />
              <h3 className="text-heading-md font-semibold text-stone-900">Daily Branch Breakdown</h3>
            </div>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Per-branch daily summary — top items, payment split, and prep times.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Input
              type="date"
              label="Date"
              value={summaryDate}
              onChange={(event) => setSummaryDate(event.target.value)}
            />
            <Button
              onClick={() => void loadBranchSummaries(branches)}
              isLoading={isLoadingSummaries}
            >
              Load
            </Button>
          </div>
        </div>

        {isLoadingSummaries ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-56 animate-shimmer rounded-xl bg-gradient-to-r from-stone-200 via-stone-100 to-stone-200 bg-[length:200%_100%]"
              />
            ))}
          </div>
        ) : branchSummaries.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={22} />}
            heading="No summaries loaded"
            body="Select a date and click Load to see per-branch breakdowns."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {branchSummaries.map((summary) => {
              const branch = branches.find((b) => b.id === summary.organizationId);
              return (
                <DailySummaryPanel
                  key={summary.organizationId}
                  summary={summary}
                  branchName={branch?.name ?? summary.organizationName}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Trend Analytics ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Trend Analytics</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Revenue, volume, contribution share, and category drivers — {branchPeriodLabel}
            </p>
          </div>
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
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Order Volume by Time of Day</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Peak hours and busiest days — {branchPeriodLabel}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="hourly-branch" className="text-label-sm font-medium text-stone-600">
                Branch
              </label>
              <select
                id="hourly-branch"
                value={hourlyBranchId}
                onChange={(e) => setHourlyBranchId(e.target.value)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-body-sm text-stone-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={() => void runHourlyHeatmap()} isLoading={isLoadingHourly}>
              Load Chart
            </Button>
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
            showDow={daysBetween(branchStartDate, branchEndDate) >= 14}
          />
        )}
      </section>

      {/* ── Branch Performance Report ─────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Branch Performance Report</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Revenue, order count, and prep-time comparison — {branchPeriodLabel}
            </p>
            {branchReportUpdatedAt && (
              <p className="mt-0.5 flex items-center gap-1 text-caption text-stone-400">
                <Clock size={11} />
                Updated {branchReportUpdatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[1fr_1fr_auto_auto_auto]">
            <Input
              label="Start"
              type="date"
              value={branchStartDate}
              onChange={(event) => setBranchStartDate(event.target.value)}
            />
            <Input
              label="End"
              type="date"
              value={branchEndDate}
              onChange={(event) => setBranchEndDate(event.target.value)}
            />
            <div className="flex items-end print:hidden">
              <Button onClick={() => void runBranchReport()} isLoading={isLoadingBranchReport}>
                Run
              </Button>
            </div>
            <div className="flex items-end print:hidden">
              <Button variant="ghost" leftIcon={<Printer size={16} />} onClick={() => window.print()}>
                Print
              </Button>
            </div>
            <div className="flex items-end print:hidden">
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
        </div>

        {branchKpi && !isLoadingBranchReport && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={formatCurrency(branchKpi.totalRevenue)}
              caption={branchPeriodLabel}
              icon={<TrendingUp size={18} />}
            />
            <StatCard
              label="Total Orders"
              value={branchKpi.totalOrders}
              caption={branchPeriodLabel}
              icon={<Building2 size={18} />}
            />
            <StatCard
              label="Branches Reporting"
              value={branchKpi.branchCount}
              caption="Active branches"
              icon={<Globe size={18} />}
            />
            <StatCard
              label="Avg Revenue / Branch"
              value={formatCurrency(branchKpi.avgRevenue)}
              caption={branchPeriodLabel}
              icon={<TrendingUp size={18} />}
            />
          </div>
        )}

        {isLoadingBranchReport ? (
          <SkeletonTable rows={5} columns={5} />
        ) : branchRows.length === 0 ? (
          <EmptyState
            icon={<Building2 size={22} />}
            heading="No branch performance rows"
            body="Try another date range."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table columns={branchColumns} data={branchRows} keyField="id" />
          </div>
        )}
      </section>

      {/* ── Staff Performance Report ──────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-heading-md font-semibold text-stone-900">Staff Performance Report</h3>
            <p className="mt-0.5 text-body-sm text-stone-500">
              {staffReport
                ? `${staffReport.organizationName} · ${formatDisplayDate(staffReport.period.startDate)} – ${formatDisplayDate(staffReport.period.endDate)}`
                : 'Cross-branch staff metrics with branch and role filters.'}
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
          <Input
            label="Start"
            type="date"
            value={staffStartDate}
            onChange={(event) => setStaffStartDate(event.target.value)}
          />
          <Input
            label="End"
            type="date"
            value={staffEndDate}
            onChange={(event) => setStaffEndDate(event.target.value)}
          />
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

        <div className="mb-4 flex gap-2 print:hidden">
          <Button onClick={() => void runStaffReport()} isLoading={isLoadingStaffReport}>
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
            body="Pick a branch and date range with completed operational activity."
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
