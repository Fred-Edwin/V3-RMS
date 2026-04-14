'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { PageLayout, PageHeader } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import {
  getMyLeaveBalances,
  getMyLeaveRequests,
  submitLeaveRequest,
  cancelLeaveRequest,
} from '@/services/hrService';
import type { LeaveBalance, LeaveRequest, LeaveType, LeaveStatus } from '@/types/hr';
import { LeaveTypeBadge, LeaveStatusBadge, formatDateRange } from '@/components/hr/LeaveTypeBadge';
import { ApiError } from '@/types/api';

// ─── Leave type config ────────────────────────────────────────────────────────

const LEAVE_TYPES: {
  value: LeaveType;
  label: string;
  shortLabel: string;
  bg: string;
  border: string;
  text: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  barColour: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
}[] = [
  {
    value: 'ANNUAL',
    label: 'Annual Leave',
    shortLabel: 'Annual',
    bg: '#EDFAF1', border: '#A7F3D0', text: '#059669',
    activeBg: '#EDFAF1', activeBorder: '#059669', activeText: '#059669',
    barColour: '#059669',
    cardBg: '#EDFAF1', cardBorder: '#A7F3D0', cardText: '#059669',
  },
  {
    value: 'SICK',
    label: 'Sick Leave',
    shortLabel: 'Sick',
    bg: '#FFF7ED', border: '#FED7AA', text: '#D97706',
    activeBg: '#FFF7ED', activeBorder: '#D97706', activeText: '#D97706',
    barColour: '#D97706',
    cardBg: '#FFF7ED', cardBorder: '#FED7AA', cardText: '#D97706',
  },
  {
    value: 'EMERGENCY',
    label: 'Emergency Leave',
    shortLabel: 'Emergency',
    bg: '#FEF2F2', border: '#FECACA', text: '#DC2626',
    activeBg: '#FEF2F2', activeBorder: '#DC2626', activeText: '#DC2626',
    barColour: '#DC2626',
    cardBg: '#FEF2F2', cardBorder: '#FECACA', cardText: '#DC2626',
  },
  {
    value: 'UNPAID',
    label: 'Unpaid Leave',
    shortLabel: 'Unpaid',
    bg: '#F8FAFC', border: '#E2E8F0', text: '#64748B',
    activeBg: '#F8FAFC', activeBorder: '#64748B', activeText: '#64748B',
    barColour: '#64748B',
    cardBg: '#F8FAFC', cardBorder: '#E2E8F0', cardText: '#64748B',
  },
];

type FilterTab = LeaveStatus | 'ALL';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// ─── Working days calculator ──────────────────────────────────────────────────

function calcWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start);
  const last = new Date(end);
  cur.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── Balance card ─────────────────────────────────────────────────────────────

function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const cfg = LEAVE_TYPES.find((t) => t.value === balance.leaveType)!;
  const remaining = Math.max(
    0,
    Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays),
  );
  const pct =
    Number(balance.totalDays) > 0
      ? Math.max(0, Math.min(100, (remaining / Number(balance.totalDays)) * 100))
      : 0;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: cfg.cardBg, border: `1.5px solid ${cfg.cardBorder}` }}
    >
      <p
        className="text-label-sm font-bold uppercase tracking-widest"
        style={{ color: cfg.cardText }}
      >
        {cfg.shortLabel}
      </p>

      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-display-lg font-bold text-stone-900">
          {remaining}
        </span>
        <span className="text-body-sm text-stone-400">
          / {Number(balance.totalDays)} days
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 w-full rounded-full bg-black/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: cfg.barColour }}
        />
      </div>

      {/* Used / Pending metadata */}
      <div className="mt-2.5 flex gap-3">
        <span className="text-caption text-stone-400">
          Used{' '}
          <span className="font-semibold text-stone-600">{Number(balance.usedDays)}</span>
        </span>
        {Number(balance.pendingDays) > 0 && (
          <span className="text-caption text-stone-400">
            Pending{' '}
            <span className="font-semibold text-stone-600">{Number(balance.pendingDays)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onCancel,
  cancelling,
}: {
  req: LeaveRequest;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  const isPending = req.status === 'PENDING';
  const isRejected = req.status === 'REJECTED';

  const cardStyle = isPending
    ? { background: '#FFFBEB', border: '1.5px solid #FCD34D' }
    : isRejected
    ? { background: '#FDF2F0', border: '1.5px solid #F5A898' }
    : req.status === 'APPROVED'
    ? { background: '#F6FDF9', border: '1.5px solid #86EFAC' }
    : { background: '#FAFAF9', border: '1.5px solid #E7E5E4' };

  return (
    <div className="rounded-2xl p-4" style={cardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LeaveTypeBadge type={req.leaveType} />
            <LeaveStatusBadge status={req.status} />
          </div>
          <p className="mt-2 text-body-sm font-medium text-stone-700">
            {formatDateRange(req.startDate, req.endDate)}
          </p>
          <p className="mt-0.5 text-caption text-stone-400">
            {Number(req.totalDays)} working {Number(req.totalDays) === 1 ? 'day' : 'days'}
          </p>
          {req.reviewComment && !isPending && (
            <p className="mt-2 text-caption italic text-stone-500">
              &ldquo;{req.reviewComment}&rdquo;
            </p>
          )}
        </div>

        {isPending && (
          <button
            onClick={() => onCancel(req.id)}
            disabled={cancelling}
            className="shrink-0 text-label-sm font-semibold text-[#9B3A2A] transition-colors hover:text-[#7F1D1D] disabled:opacity-40"
          >
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function RequestSheet({
  balances,
  onClose,
  onSubmit,
}: {
  balances: LeaveBalance[];
  onClose: () => void;
  onSubmit: (input: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }) => Promise<void>;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const workingDays = calcWorkingDays(startDate, endDate);
  const canSubmit = !!startDate && !!endDate && reason.trim().length > 0 && workingDays > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ leaveType, startDate, endDate, reason });
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <div className="w-full rounded-t-3xl bg-white px-5 pb-10 pt-0 max-h-[88vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-9 rounded-full bg-stone-200" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between py-4">
          <h2 className="text-heading-md font-semibold text-stone-900">Request Leave</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Leave type pills */}
        <div className="mb-5">
          <p className="mb-2.5 text-label-sm font-semibold text-stone-500">Leave Type</p>
          <div className="flex flex-wrap gap-2">
            {LEAVE_TYPES.map((t) => {
              const bal = balances.find((b) => b.leaveType === t.value);
              const remaining = bal
                ? Math.max(0, Number(bal.totalDays) - Number(bal.usedDays) - Number(bal.pendingDays))
                : null;
              const active = leaveType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setLeaveType(t.value)}
                  className="rounded-full px-3.5 py-2 text-label-sm font-semibold transition-all"
                  style={
                    active
                      ? { background: t.cardBg, border: `2px solid ${t.cardText}`, color: t.cardText }
                      : { background: t.cardBg, border: `2px solid ${t.cardBorder}`, color: t.cardText, opacity: 0.7 }
                  }
                >
                  {t.shortLabel}
                  {remaining !== null && (
                    <span className="ml-1.5 opacity-70">· {remaining}d</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dates */}
        <div className="mb-4">
          <p className="mb-2.5 text-label-sm font-semibold text-stone-500">Dates</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-stone-400">From</p>
              <input
                type="date"
                min={today}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate('');
                }}
                className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-body-sm text-stone-800 focus:border-stone-400 focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-stone-400">To</p>
              <input
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-body-sm text-stone-800 focus:border-stone-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Working days preview */}
        {startDate && endDate && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-[#F5F0E8] px-4 py-3">
            <span className="text-body-sm text-stone-500">Working days</span>
            <span className="font-display text-heading-md font-bold text-[#2C1810]">
              {workingDays} {workingDays === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}

        {/* Reason */}
        <div className="mb-6">
          <p className="mb-2.5 text-label-sm font-semibold text-stone-500">Reason</p>
          <textarea
            rows={3}
            placeholder="Briefly describe the reason for your leave…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-body-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || submitting}
          className="h-12 w-full rounded-xl bg-[#2C1810] text-label-md font-bold text-white transition-colors hover:bg-[#4A2C1A] disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyLeavePage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('ALL');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        getMyLeaveBalances(accessToken),
        getMyLeaveRequests(1, 50, accessToken),
      ]);
      setBalances(b);
      setRequests(r.items);
    } catch {
      toast({ variant: 'error', title: 'Failed to load leave information' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (input: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }) => {
    if (!accessToken) return;
    try {
      await submitLeaveRequest(
        {
          leaveType: input.leaveType,
          startDate: new Date(input.startDate).toISOString(),
          endDate: new Date(input.endDate).toISOString(),
          reason: input.reason,
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Leave request submitted', message: 'Your manager has been notified.' });
      setShowSheet(false);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Please try again.';
      toast({ variant: 'error', title: 'Failed to submit request', message: msg });
      throw err; // let the sheet keep submitting=false correctly
    }
  };

  const handleCancel = async (id: string) => {
    if (!accessToken) return;
    setCancellingId(id);
    try {
      await cancelLeaveRequest(id, accessToken);
      toast({ variant: 'success', title: 'Request cancelled' });
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Cannot cancel', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setCancellingId(null);
    }
  };

  const filteredRequests =
    filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const year = new Date().getFullYear();

  return (
    <>
      <PageLayout className="animate-fade-up space-y-6">
        <PageHeader
          title="My Leave"
          subtitle={`${year} · Leave balances & requests`}
          titleClassName="font-display text-display-lg font-semibold text-espresso"
          action={
            <button
              onClick={() => setShowSheet(true)}
              className="flex items-center gap-1.5 rounded-full bg-[#2C1810] px-4 py-2 text-label-sm font-bold text-white shadow-sm transition-colors hover:bg-[#4A2C1A]"
            >
              <span className="text-base leading-none">+</span>
              Request
            </button>
          }
        />

        {/* ── Leave Balances ── */}
        <section>
          <p className="mb-3 text-label-sm font-bold uppercase tracking-widest text-stone-400">
            Leave Balances
          </p>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-200" />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center">
              <Calendar size={22} className="mx-auto mb-2 text-stone-300" />
              <p className="text-body-sm font-medium text-stone-500">No leave balances set up yet.</p>
              <p className="mt-0.5 text-caption text-stone-400">Contact HR to get your profile created.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {balances.map((b) => <BalanceCard key={b.id} balance={b} />)}
            </div>
          )}
        </section>

        {/* ── Requests ── */}
        <section>
          <p className="mb-3 text-label-sm font-bold uppercase tracking-widest text-stone-400">
            Requests
          </p>

          {/* Filter pills */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-label-sm font-semibold transition-colors ${
                  filter === tab.value
                    ? 'bg-[#2C1810] text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {tab.label}
                {tab.value === 'PENDING' && pendingCount > 0 && filter !== 'PENDING' && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#9B3A2A] px-1 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-100" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-8 text-center">
              <Calendar size={22} className="mx-auto mb-2 text-stone-300" />
              <p className="text-body-sm text-stone-400">
                {filter === 'ALL' ? 'No leave requests yet.' : `No ${filter.toLowerCase()} requests.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onCancel={handleCancel}
                  cancelling={cancellingId === req.id}
                />
              ))}
            </div>
          )}
        </section>
      </PageLayout>

      {/* ── Request sheet ── */}
      {showSheet && (
        <RequestSheet
          balances={balances}
          onClose={() => setShowSheet(false)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}
