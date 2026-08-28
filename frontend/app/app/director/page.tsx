'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Building2,
  ChevronRight,
  ChevronUp,
  Clock,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button, EmptyState, ExcelTable, Modal, PageLayout, SkeletonBlock, type ExcelColumn } from '@/components/ui';
import { LineTrendChart } from '@/components/dashboard/PremiumChart';
import { RankedItemList } from '@/components/dashboard/RankedItemList';
import { CHART_AMBER, CHART_SUCCESS } from '@/lib/chart-colors';
import { InboxNudge } from '@/components/comms/InboxNudge';
import { RevenueBreakdownCard } from '@/components/dashboard/RevenueBreakdownCard';
import { HouseAccountApprovalCard } from '@/components/dashboard/HouseAccountApprovalCard';
import { StaffDiscountApprovalCard } from '@/components/dashboard/StaffDiscountApprovalCard';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { getSocket } from '@/lib/socket';
import { houseAccountAuthService } from '@/services/houseAccountAuthService';
import { staffDiscountAuthService } from '@/services/staffDiscountAuthService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { LeaveRequestsWidget } from '@/components/hr/LeaveRequestsWidget';
import { ApiError } from '@/types/api';
import type { HouseAccountAuthRequest } from '@/types/houseAccountAuth';
import type { StaffDiscountAuthRequest } from '@/types/staffDiscountAuth';
import type {
  BranchOverview,
  DirectorPulseBranchRow,
  DirectorPulseLateOrder,
  DirectorPulseReport,
  DirectorTrendsReport,
  ItemsPerformanceReport,
} from '@/types/report';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toYmdInTimeZone = (value: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    return value.toISOString().slice(0, 10);
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
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const formatDay = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
};

const getGreeting = (hour: number): string => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
    <span
      className={`flex items-center gap-0.5 text-caption font-medium ${
        positive ? 'text-status-ready-text' : 'text-danger'
      }`}
    >
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positive ? '+' : ''}{pct}% vs yesterday
    </span>
  );
}

function KpiCardSkeleton(): JSX.Element {
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
      <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
      <SkeletonBlock className="h-4 w-28 rounded" />
      <div className="ml-auto flex items-center gap-4">
        <SkeletonBlock className="h-4 w-20 rounded" />
        <SkeletonBlock className="h-4 w-10 rounded" />
      </div>
    </div>
  );
}

const formatAge = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

interface LateOrdersModalProps {
  branchName: string;
  orders: DirectorPulseLateOrder[];
  onClose: () => void;
}

const lateOrderColumns: Array<ExcelColumn<DirectorPulseLateOrder>> = [
  {
    key: 'dailyNumber',
    label: 'Order #',
    render: (order) => <span className="font-semibold">#{order.dailyNumber}</span>,
  },
  { key: 'waiterName', label: 'Waiter', render: (order) => order.waiterName },
  {
    key: 'total',
    label: 'Total',
    numeric: true,
    render: (order) =>
      `KES ${Number.parseFloat(order.total).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    key: 'age',
    label: 'Open for',
    numeric: true,
    render: (order) => <span className="font-semibold text-amber">{formatAge(order.ageMinutes)}</span>,
  },
];

function LateOrdersModal({ branchName, orders, onClose }: LateOrdersModalProps): JSX.Element {
  return (
    <Modal isOpen onClose={onClose} title={`Late Unclosed Orders — ${branchName}`}>
      <div className="space-y-1">
        <p className="mb-4 text-body-sm text-stone-500">
          Orders in READY status for more than 2 hours. Waiter has not closed payment.
        </p>
        <ExcelTable
          columns={lateOrderColumns}
          rows={orders}
          rowKey={(order) => order.id}
          headerTone="red"
        />
      </div>
    </Modal>
  );
}

interface BranchStatusRowProps {
  branch: BranchDto;
  pulse: DirectorPulseBranchRow | undefined;
  todayRevenue: string;
  todayOrders: number;
  otherIncomeTotal: string;
  onLateClick: (branchName: string, orders: DirectorPulseLateOrder[]) => void;
}

function BranchStatusRow({ branch, pulse, todayRevenue, todayOrders, otherIncomeTotal, onLateClick }: BranchStatusRowProps): JSX.Element {
  const hasClockedIn = (pulse?.clockedInCount ?? 0) > 0;
  const hasActiveOrders = (pulse?.activeOrders ?? 0) > 0;
  const isActive = hasClockedIn || hasActiveOrders;
  const lateCount = pulse?.lateOrderCount ?? 0;
  const otherIncome = Number.parseFloat(otherIncomeTotal ?? '0');

  const dotClass = hasClockedIn
    ? 'bg-status-ready-text'
    : hasActiveOrders
    ? 'bg-amber'
    : 'bg-stone-300';

  return (
    <div className="flex min-h-[52px] items-center gap-3 border-b border-stone-100 px-4 transition-colors duration-fast last:border-0 hover:bg-stone-50">
      <Link
        href={`/app/director/branches/${branch.id}`}
        className="flex flex-1 items-center gap-3"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
        <span className={`flex-1 text-body-sm font-medium ${isActive ? 'text-stone-900' : 'text-stone-500'}`}>
          {branch.name}
          {otherIncome > 0 && (
            <span className="ml-2 text-caption font-normal text-amber">
              +{formatCurrency(otherIncome)} other
            </span>
          )}
        </span>
        <span className="tabular-nums text-body-sm text-stone-700">{formatCurrency(todayRevenue)}</span>
        <span className="tabular-nums text-body-sm text-stone-500">{todayOrders} orders</span>
        {hasActiveOrders && (
          <span className="rounded-full bg-espresso/10 px-2 py-0.5 text-caption font-medium text-espresso">
            {pulse?.activeOrders} live
          </span>
        )}
      </Link>
      {lateCount > 0 && (
        <button
          type="button"
          onClick={() => onLateClick(branch.name, pulse?.lateOrders ?? [])}
          className="flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-caption font-medium text-amber transition-colors hover:bg-amber/20"
        >
          <AlertTriangle size={11} />
          {lateCount} late
        </button>
      )}
      <Link href={`/app/director/branches/${branch.id}`}>
        <ChevronRight size={14} className="shrink-0 text-stone-400" />
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectorCommandCentrePage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const displayName = useAuthStore((state) => state.user?.name ?? null);

  const todayInNairobi = useMemo(() => toYmdInTimeZone(new Date(), 'Africa/Nairobi'), []);
  const yesterdayInNairobi = useMemo(() => shiftYmd(todayInNairobi, -1), [todayInNairobi]);
  const sevenDaysAgo = useMemo(() => shiftYmd(todayInNairobi, -6), [todayInNairobi]);

  const greeting = useMemo(() => {
    const hourInNairobi = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false }).format(new Date()),
    );
    return getGreeting(hourInNairobi);
  }, []);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      timeZone: 'Africa/Nairobi',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // ── Branches ─────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);

  // ── Live Pulse ────────────────────────────────────────────────────────────
  const [pulse, setPulse] = useState<DirectorPulseReport | null>(null);
  const [isLoadingPulse, setIsLoadingPulse] = useState(true);
  const [pulseLoadedAt, setPulseLoadedAt] = useState<Date | null>(null);

  // ── Today overview + yesterday (for deltas) ───────────────────────────────
  const [overviewToday, setOverviewToday] = useState<BranchOverview | null>(null);
  const [overviewYesterday, setOverviewYesterday] = useState<BranchOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  // ── 7-day sparklines ──────────────────────────────────────────────────────
  const [sparklineTrends, setSparklineTrends] = useState<DirectorTrendsReport | null>(null);
  const [isLoadingSparklines, setIsLoadingSparklines] = useState(true);

  // ── Today's items performance (system-wide) ───────────────────────────────
  const [todayItems, setTodayItems] = useState<ItemsPerformanceReport | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadBranches = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingBranches(true);
    try {
      const data = await branchService.listBranches(accessToken);
      setBranches(data.filter((b) => b.isActive && !b.isHub));
    } catch {
      // Non-critical — page still renders
    } finally {
      setIsLoadingBranches(false);
    }
  }, [accessToken]);

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
    } finally {
      setIsLoadingPulse(false);
    }
  }, [accessToken, toast]);

  const loadOverview = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingOverview(true);
    try {
      const [todayData, yesterdayData] = await Promise.all([
        reportService.getBranchOverview(accessToken, { startDate: todayInNairobi, endDate: todayInNairobi }),
        reportService.getBranchOverview(accessToken, { startDate: yesterdayInNairobi, endDate: yesterdayInNairobi }),
      ]);
      setOverviewToday(todayData);
      setOverviewYesterday(yesterdayData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load today overview.';
      toast({ variant: 'error', title: 'Overview failed', message });
    } finally {
      setIsLoadingOverview(false);
    }
  }, [accessToken, todayInNairobi, yesterdayInNairobi, toast]);

  const loadSparklines = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingSparklines(true);
    try {
      const data = await reportService.getDirectorTrends(accessToken, {
        startDate: sevenDaysAgo,
        endDate: todayInNairobi,
      });
      setSparklineTrends(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load sparklines.';
      toast({ variant: 'error', title: 'Trend data failed', message });
    } finally {
      setIsLoadingSparklines(false);
    }
  }, [accessToken, sevenDaysAgo, todayInNairobi, toast]);

  const loadTodayItems = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingItems(true);
    try {
      const data = await reportService.getItemsPerformance(accessToken, {
        startDate: todayInNairobi,
        endDate: todayInNairobi,
        limit: 5,
      });
      setTodayItems(data);
    } catch {
      // Non-critical — section stays hidden
    } finally {
      setIsLoadingItems(false);
    }
  }, [accessToken, todayInNairobi]);

  // ── Effects — all fire in parallel on mount ───────────────────────────────

  useEffect(() => { void loadBranches(); }, [loadBranches]);
  useEffect(() => { void loadPulse(); }, [loadPulse]);
  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadSparklines(); }, [loadSparklines]);
  useEffect(() => { void loadTodayItems(); }, [loadTodayItems]);

  // ── Derived values ────────────────────────────────────────────────────────

  // Weighted avg prep time across branches (kitchen + barista average)
  const avgPrepTime = useMemo(() => {
    if (!overviewToday || overviewToday.branches.length === 0) return null;
    const sum = overviewToday.branches.reduce(
      (acc, b) => acc + b.averagePrepTimeMinutes.KITCHEN + b.averagePrepTimeMinutes.BARISTA,
      0,
    );
    return Math.round(sum / (overviewToday.branches.length * 2));
  }, [overviewToday]);

  const totalRevenueDelta = useMemo(
    () => deltaCurrencyPercent(overviewToday?.totalRevenue ?? '0', overviewYesterday?.totalRevenue ?? '0'),
    [overviewToday, overviewYesterday],
  );

  const totalOrdersDelta = useMemo(
    () => deltaPercent(overviewToday?.totalOrders ?? 0, overviewYesterday?.totalOrders ?? 0),
    [overviewToday, overviewYesterday],
  );

  // Build per-branch today data map (id → {revenue, orders, otherIncomeTotal})
  const branchTodayMap = useMemo(() => {
    const map = new Map<string, { revenue: string; orders: number; otherIncomeTotal: string }>();
    for (const row of overviewToday?.branches ?? []) {
      map.set(row.id, { revenue: row.revenue, orders: row.orderCount, otherIncomeTotal: row.otherIncomeTotal });
    }
    return map;
  }, [overviewToday]);

  // Build pulse map (id → DirectorPulseBranchRow)
  const pulseMap = useMemo(() => {
    const map = new Map<string, DirectorPulseBranchRow>();
    for (const row of pulse?.branches ?? []) {
      map.set(row.id, row);
    }
    return map;
  }, [pulse]);

  const activeBranchCount = useMemo(
    () => branches.filter((b) => pulseMap.has(b.id) && ((pulseMap.get(b.id)?.clockedInCount ?? 0) > 0 || (pulseMap.get(b.id)?.activeOrders ?? 0) > 0)).length,
    [branches, pulseMap],
  );

  const revenueTrendData = useMemo(
    () =>
      sparklineTrends?.aggregateSeries.map((point) => ({
        label: formatDay(point.date),
        value: Number.parseFloat(point.totalRevenue) || 0,
        date: point.date,
      })) ?? [],
    [sparklineTrends],
  );

  const ordersTrendData = useMemo(
    () =>
      sparklineTrends?.aggregateSeries.map((point) => ({
        label: formatDay(point.date),
        value: point.totalOrders,
        date: point.date,
      })) ?? [],
    [sparklineTrends],
  );

  const todayTotalRevenue = useMemo(
    () => Number.parseFloat(overviewToday?.totalRevenue ?? '0') || 0,
    [overviewToday],
  );

  const todayOtherIncome = useMemo(
    () => Number.parseFloat(overviewToday?.totalOtherIncome ?? '0') || 0,
    [overviewToday],
  );

  const todayFoodRevenue = todayTotalRevenue - todayOtherIncome;

  // ── Pending house account authorizations ─────────────────────────────────
  const [pendingAuths, setPendingAuths] = useState<HouseAccountAuthRequest[]>([]);
  const [authOverrideSubmittingId, setAuthOverrideSubmittingId] = useState<string | null>(null);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  // ── Pending staff discount authorizations (director-only approval) ────────
  const [pendingDiscountAuths, setPendingDiscountAuths] = useState<StaffDiscountAuthRequest[]>([]);
  const [discountOverrideSubmittingId, setDiscountOverrideSubmittingId] = useState<string | null>(null);


  useEffect(() => {
    if (!accessToken) return;
    houseAccountAuthService.listPending(accessToken)
      .then((data) => setPendingAuths(data))
      .catch(() => { /* non-critical */ });
    staffDiscountAuthService.listPending(accessToken)
      .then((data) => setPendingDiscountAuths(data))
      .catch(() => { /* non-critical */ });
  }, [accessToken]);

  // Keep widget in sync via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAuthPending = (payload: { orderId: string; authRequestId: string }) => {
      if (!accessToken) return;
      houseAccountAuthService.getById(payload.authRequestId, accessToken)
        .then((req) => setPendingAuths((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [...prev, req];
        }))
        .catch(() => { /* non-critical */ });
    };
    const handleAuthResolved = (payload: { orderId: string }) => {
      setPendingAuths((prev) => prev.filter((r) => r.orderId !== payload.orderId));
    };
    socket.on('order:auth_pending', handleAuthPending);
    socket.on('order:auth_resolved', handleAuthResolved);
    return () => {
      socket.off('order:auth_pending', handleAuthPending);
      socket.off('order:auth_resolved', handleAuthResolved);
    };
  }, [accessToken]);

  // Keep staff-discount approval card in sync via socket (director fan-out)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleDiscountPending = (payload: { orderId: string; authRequestId: string }) => {
      if (!accessToken) return;
      staffDiscountAuthService.getById(payload.authRequestId, accessToken)
        .then((req) => setPendingDiscountAuths((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [...prev, req];
        }))
        .catch(() => { /* non-critical */ });
    };
    const handleDiscountResolved = (payload: { orderId: string }) => {
      setPendingDiscountAuths((prev) => prev.filter((r) => r.orderId !== payload.orderId));
    };
    socket.on('order:staff_discount_pending', handleDiscountPending);
    socket.on('order:staff_discount_resolved', handleDiscountResolved);
    return () => {
      socket.off('order:staff_discount_pending', handleDiscountPending);
      socket.off('order:staff_discount_resolved', handleDiscountResolved);
    };
  }, [accessToken]);

  const handleDiscountDecision = useCallback(async (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || discountOverrideSubmittingId) return;
    setDiscountOverrideSubmittingId(authRequestId);
    try {
      await staffDiscountAuthService.override(authRequestId, decision, accessToken);
      setPendingDiscountAuths((prev) => prev.filter((r) => r.id !== authRequestId));
      toast({
        variant: 'success',
        title: decision === 'APPROVED' ? 'Discount approved' : 'Discount rejected',
        message: decision === 'APPROVED'
          ? 'Order returned to the waiter at the discounted total.'
          : 'Order returned to the waiter at full price.',
      });
    } catch {
      toast({ variant: 'error', title: 'Action failed', message: 'Could not process the decision.' });
    } finally {
      setDiscountOverrideSubmittingId(null);
    }
  }, [accessToken, discountOverrideSubmittingId, toast]);

  const handleAuthDecision = useCallback(async (authRequestId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || authOverrideSubmittingId) return;
    setAuthOverrideSubmittingId(authRequestId);
    try {
      await houseAccountAuthService.override(authRequestId, decision, accessToken);
      setPendingAuths((prev) => prev.filter((r) => r.id !== authRequestId));
      toast({
        variant: 'success',
        title: decision === 'APPROVED' ? 'Charge approved' : 'Charge rejected',
        message: decision === 'APPROVED' ? 'The order has been closed.' : 'Order returned to the waiter.',
      });
    } catch {
      toast({ variant: 'error', title: 'Action failed', message: 'Could not process the decision.' });
    } finally {
      setAuthOverrideSubmittingId(null);
    }
  }, [accessToken, authOverrideSubmittingId, toast]);

  // ── Late orders modal state ───────────────────────────────────────────────
  const [lateModal, setLateModal] = useState<{ branchName: string; orders: DirectorPulseLateOrder[] } | null>(null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout className="animate-fade-up space-y-6">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-display-xl font-semibold text-espresso">
            {greeting}{displayName ? `, ${displayName.split(' ')[0]}.` : '.'}
          </h1>
          <p className="mt-1 text-body-sm text-stone-500">
            {todayFormatted}
            {!isLoadingBranches && branches.length > 0 && (
              <> &middot; <span className="font-medium text-stone-700">{branches.length} branches active</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pulseLoadedAt && (
            <span className="hidden text-caption text-stone-400 sm:block">
              Live data as of {formatTime(pulseLoadedAt.toISOString())}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoadingPulse ? 'animate-spin' : ''} />}
            onClick={() => void loadPulse()}
            isLoading={isLoadingPulse}
          >
            Refresh
          </Button>
          <Link
            href="/app/director/analytics"
            className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-label-md font-medium text-stone-700 shadow-sm transition-colors duration-fast hover:bg-stone-50"
          >
            <BarChart2 size={14} />
            Analytics
            <ArrowRight size={13} className="text-stone-400" />
          </Link>
        </div>
      </div>

      <InboxNudge />

      {/* ── House account approvals + staff discounts + leave requests ──────── */}
      <section className="space-y-3">
        {pendingAuths.length === 0 && pendingDiscountAuths.length === 0 && pendingLeaveCount === 0 && (
          <EmptyState
            icon={<ChevronRight size={28} />}
            heading="Nothing pending right now"
            body="House account charges and staff discounts awaiting your approval will show up here."
            className="rounded-xl border border-stone-200 bg-white py-8"
          />
        )}
        <HouseAccountApprovalCard
          pendingAuths={pendingAuths}
          authOverrideSubmittingId={authOverrideSubmittingId}
          onDecide={(id, decision) => void handleAuthDecision(id, decision)}
        />
        <StaffDiscountApprovalCard
          pendingRequests={pendingDiscountAuths}
          overrideSubmittingId={discountOverrideSubmittingId}
          onDecide={(id, decision) => void handleDiscountDecision(id, decision)}
        />
        {/* Widget renders its own "pending" (action) + "recent decisions" (collapsed) sections */}
        <LeaveRequestsWidget onPendingCountChange={setPendingLeaveCount} />
      </section>

      {/* ── System-wide KPI strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Revenue Today */}
        {isLoadingOverview ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-500">Revenue Today</p>
                <TrendingUp size={16} className="text-stone-400" />
              </div>
              <p className="mt-2 font-sans text-display-lg font-semibold tabular-nums text-stone-900">
                {formatCurrency(overviewToday?.totalRevenue ?? '0')}
              </p>
              <DeltaBadge pct={totalRevenueDelta} />
              {todayOtherIncome > 0 && (
                <div className="mt-2 border-t border-stone-100 pt-2 space-y-0.5">
                  <div className="flex items-center justify-between text-caption">
                    <span className="flex items-center gap-1 text-stone-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-espresso" />
                      Food &amp; Bev
                    </span>
                    <span className="tabular-nums text-stone-700">{formatCurrency(todayFoodRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-caption">
                    <span className="flex items-center gap-1 text-stone-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                      Other Income
                    </span>
                    <span className="tabular-nums text-amber">{formatCurrency(todayOtherIncome)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-label-sm font-medium uppercase tracking-wider text-stone-500">Orders Today</p>
                <Building2 size={16} className="text-stone-400" />
              </div>
              <p className="mt-2 font-sans text-display-lg font-semibold tabular-nums text-stone-900">
                {overviewToday?.totalOrders ?? 0}
              </p>
              <DeltaBadge pct={totalOrdersDelta} />
            </div>
          </>
        )}

        {/* Avg Prep Time */}
        {isLoadingOverview ? (
          <KpiCardSkeleton />
        ) : (
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-label-sm font-medium uppercase tracking-wider text-stone-500">Avg Prep Time</p>
              <Clock size={16} className="text-stone-400" />
            </div>
            <p className="mt-2 font-sans text-display-lg font-semibold tabular-nums text-stone-900">
              {avgPrepTime !== null ? `${avgPrepTime} min` : '—'}
            </p>
            <span className="text-caption text-stone-400">All branches, all stations</span>
          </div>
        )}

        {/* Staff clocked in */}
        {isLoadingPulse ? (
          <KpiCardSkeleton />
        ) : (
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-label-sm font-medium uppercase tracking-wider text-stone-500">Staff Clocked In</p>
              <Users size={16} className="text-stone-400" />
            </div>
            <p className="mt-2 font-sans text-display-lg font-semibold tabular-nums text-stone-900">
              {pulse?.totalClockedIn ?? 0}
            </p>
            <span className="text-caption text-stone-400">
              {activeBranchCount} {activeBranchCount === 1 ? 'branch' : 'branches'} with activity
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom grid: branches + revenue allocation ────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">

        {/* Branch Status List */}
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <div>
              <h2 className="text-heading-sm font-semibold text-stone-900">Branch Status</h2>
              <p className="text-caption text-stone-500">Live · today&apos;s revenue and order count</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-status-ready-bg px-2 py-0.5 text-caption font-medium text-status-ready-text">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-ready-text" />
                Live
              </span>
            </div>
          </div>

          {isLoadingBranches || isLoadingOverview || isLoadingPulse ? (
            <div>
              {[1, 2, 3].map((i) => (
                <BranchRowSkeleton key={i} />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <EmptyState
              icon={<Building2 size={20} />}
              heading="No active branches"
              body="No customer-facing branches found."
              className="py-8"
            />
          ) : (
            <div>
              {branches.map((branch) => {
                const today = branchTodayMap.get(branch.id);
                return (
                  <BranchStatusRow
                    key={branch.id}
                    branch={branch}
                    pulse={pulseMap.get(branch.id)}
                    todayRevenue={today?.revenue ?? '0'}
                    todayOrders={today?.orders ?? 0}
                    otherIncomeTotal={today?.otherIncomeTotal ?? '0'}
                    onLateClick={(name, orders) => setLateModal({ branchName: name, orders })}
                  />
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-4 border-t border-stone-100 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-caption text-stone-500">
              <span className="h-2 w-2 rounded-full bg-status-ready-text" /> Staff clocked in
            </span>
            <span className="flex items-center gap-1.5 text-caption text-stone-500">
              <span className="h-2 w-2 rounded-full bg-amber" /> Orders, no staff
            </span>
            <span className="flex items-center gap-1.5 text-caption text-stone-500">
              <span className="h-2 w-2 rounded-full bg-stone-300" /> No activity
            </span>
          </div>
        </div>

        {/* Today's Revenue Allocation */}
        {isLoadingOverview ? (
          <div className="h-64 animate-shimmer rounded-lg bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
        ) : todayTotalRevenue > 0 ? (
          <RevenueBreakdownCard totalRevenue={todayTotalRevenue} period="Today's revenue" />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <EmptyState
              icon={<TrendingUp size={20} />}
              heading="No revenue yet"
              body="Today's allocation will appear once orders are closed."
            />
          </div>
        )}
      </div>

      {/* ── Today's Item Performance ─────────────────────────────────────── */}
      {(isLoadingItems || todayItems) && (
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-heading-sm font-semibold text-stone-900">Today&apos;s Item Performance</h2>
              <p className="text-caption text-stone-500">Top and bottom 5 items across all branches</p>
            </div>
            <Link href="/app/director/analytics" className="flex items-center gap-1 text-label-sm font-medium text-amber hover:underline">
              Full report <ArrowRight size={12} />
            </Link>
          </div>
          {isLoadingItems ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-40 animate-shimmer rounded-md bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
              <div className="h-40 animate-shimmer rounded-md bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
            </div>
          ) : todayItems && (todayItems.topItems.length > 0 || todayItems.bottomItems.length > 0) ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <ChevronUp size={14} className="text-status-ready-text" />
                  <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">Top 5</span>
                </div>
                <RankedItemList items={todayItems.topItems} variant="top" formatCurrency={formatCurrency} />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <TrendingDown size={14} className="text-danger" />
                  <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">Bottom 5</span>
                </div>
                <RankedItemList items={todayItems.bottomItems} variant="bottom" formatCurrency={formatCurrency} />
              </div>
            </div>
          ) : (
            <EmptyState icon={<ShoppingBag size={18} />} heading="No sales yet today" body="Items will appear once orders are closed." />
          )}
        </div>
      )}

      {/* ── 7-day Sparklines ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-heading-sm font-semibold text-stone-900">Last 7 Days</h2>
            <p className="text-caption text-stone-500">Revenue and order volume trend</p>
          </div>
          <Link
            href="/app/director/analytics"
            className="flex items-center gap-1 text-label-sm font-medium text-amber hover:underline"
          >
            Longer ranges in Analytics <ArrowRight size={12} />
          </Link>
        </div>

        {isLoadingSparklines ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-48 animate-shimmer rounded-md bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
            <div className="h-48 animate-shimmer rounded-md bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 bg-[length:200%_100%]" />
          </div>
        ) : !sparklineTrends ? (
          <EmptyState
            icon={<Activity size={20} />}
            heading="Trend data unavailable"
            body="Could not load the last 7 days. Try refreshing."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <LineTrendChart
              title="Revenue (KES)"
              subtitle="Daily total across all branches"
              data={revenueTrendData}
              accentColor={CHART_SUCCESS}
              valueFormatter={(value) =>
                `KES ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}`
              }
              tooltipUnit="KES"
              summaryLabel="Total Revenue"
            />
            <LineTrendChart
              title="Orders"
              subtitle="Daily closed order volume"
              data={ordersTrendData}
              accentColor={CHART_AMBER}
              valueFormatter={(value) => String(Math.round(value))}
              tooltipUnit="Orders"
              summaryLabel="Total Orders"
            />
          </div>
        )}
      </div>

      {/* ── Late Orders Modal ─────────────────────────────────────────────── */}
      {lateModal && (
        <LateOrdersModal
          branchName={lateModal.branchName}
          orders={lateModal.orders}
          onClose={() => setLateModal(null)}
        />
      )}

    </PageLayout>
  );
}
