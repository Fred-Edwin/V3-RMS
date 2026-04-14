'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Pencil } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { getLeaveBalances, updateLeaveBalance } from '@/services/hrService';
import { listLeaveRequests } from '@/services/hrService';
import type { EmployeeProfile, LeaveBalance, LeaveRequest, LeaveType } from '@/types/hr';
import { LeaveTypeBadge, LeaveStatusBadge, formatDateRange } from '@/components/hr/LeaveTypeBadge';

// ─── Colour map (locked palette) ─────────────────────────────────────────────

const LEAVE_COLORS: Record<LeaveType, { bar: string; bg: string; border: string; text: string }> = {
  ANNUAL:    { bar: '#059669', bg: '#EDFAF1', border: '#A7F3D0', text: '#059669' },
  SICK:      { bar: '#D97706', bg: '#FFF7ED', border: '#FED7AA', text: '#D97706' },
  EMERGENCY: { bar: '#DC2626', bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
  UNPAID:    { bar: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', text: '#64748B' },
};

// ─── Balance Card ─────────────────────────────────────────────────────────────

function BalanceCard({
  balance,
  userId,
  onUpdated,
}: {
  balance: LeaveBalance;
  userId: string;
  onUpdated: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(balance.totalDays));
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays));
  const pct = Number(balance.totalDays) > 0
    ? Math.max(0, Math.min(100, (remaining / Number(balance.totalDays)) * 100))
    : 0;

  const colors = LEAVE_COLORS[balance.leaveType];

  const handleSave = async () => {
    const val = Number(inputValue);
    if (isNaN(val) || val < 0) {
      toast({ variant: 'error', title: 'Invalid value', message: 'Enter a whole number ≥ 0' });
      return;
    }
    if (!accessToken) return;
    setSaving(true);
    try {
      await updateLeaveBalance(userId, balance.leaveType, val, balance.leaveYear, accessToken);
      toast({ variant: 'success', title: 'Balance updated' });
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to update', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
      <div className="flex items-start justify-between gap-2">
        <LeaveTypeBadge type={balance.leaveType} />
        <button
          onClick={() => { setEditing((e) => !e); setInputValue(String(balance.totalDays)); }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-stone-400 transition-colors hover:bg-white hover:text-stone-600"
          title="Edit entitlement"
        >
          <Pencil size={11} />
        </button>
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-8 w-20 rounded-lg border border-stone-200 bg-white px-2 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
            autoFocus
          />
          <span className="text-caption text-stone-500">days total</span>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg px-2.5 py-1 text-label-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: colors.bar }}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg px-2.5 py-1 text-label-sm font-medium text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 font-display text-[28px] font-extrabold leading-none tracking-tight" style={{ color: colors.text }}>
            {remaining}
            <span className="ml-1 text-[14px] font-medium opacity-60">days left</span>
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-white/60">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: colors.bar }}
            />
          </div>
          <p className="mt-1.5 text-caption text-stone-500">
            {Number(balance.usedDays)} used · {Number(balance.pendingDays)} pending · {balance.totalDays} total
          </p>
        </>
      )}
    </div>
  );
}

// ─── Leave Tab ────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  profile: EmployeeProfile;
}

export function LeaveTab({ userId }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        getLeaveBalances(userId, accessToken),
        listLeaveRequests({ page: 1, limit: 50 }, accessToken),
      ]);
      setBalances(b);
      setRequests(r.items.filter((req) => req.employeeProfile.user.id === userId));
    } catch {
      toast({ variant: 'error', title: 'Failed to load leave data' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, userId, toast]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-stone-200" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance cards */}
      {balances.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 text-center text-body-sm text-stone-400">
          No leave balances configured for this year.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <p className="text-caption text-stone-400">Click the pencil icon on any balance card to adjust the entitlement.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {balances.map((b) => (
              <BalanceCard key={b.id} balance={b} userId={userId} onUpdated={() => void load()} />
            ))}
          </div>
        </>
      )}

      {/* Leave history */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-heading-sm font-semibold text-stone-900">Leave History</h3>
          <p className="mt-0.5 text-body-sm text-stone-500">{requests.length} requests</p>
        </div>
        {requests.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Calendar size={24} className="mx-auto mb-2 text-stone-300" />
            <p className="text-body-sm text-stone-400">No leave taken yet this year.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {requests.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <LeaveTypeBadge type={req.leaveType} />
                    <span className="text-body-sm text-stone-600">{formatDateRange(req.startDate, req.endDate)}</span>
                    <span className="text-caption text-stone-400">· {req.totalDays} {Number(req.totalDays) === 1 ? 'day' : 'days'}</span>
                  </div>
                  {req.reviewComment && (
                    <p className="mt-0.5 text-caption text-stone-400">&ldquo;{req.reviewComment}&rdquo;</p>
                  )}
                </div>
                <LeaveStatusBadge status={req.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
