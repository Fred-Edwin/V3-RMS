'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, XCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageLayout, PageHeader, EmptyState } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { listLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '@/services/hrService';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/hr';
import { LeaveTypeBadge, LeaveStatusBadge, formatDateRange, roleLabel } from '@/components/hr/LeaveTypeBadge';

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_STATUS_TABS: { value: LeaveStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const LEAVE_TYPE_OPTIONS: { value: LeaveType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SICK', label: 'Sick' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'UNPAID', label: 'Unpaid' },
];

// ─── Review Drawer ────────────────────────────────────────────────────────────

function ReviewDrawer({
  request,
  onClose,
  onApprove,
  onReject,
  loading,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onApprove: (comment: string) => Promise<void>;
  onReject: (comment: string) => Promise<void>;
  loading: boolean;
}) {
  const [comment, setComment] = useState('');

  const balanceAfter =
    request.leaveBalance
      ? Math.max(
          0,
          Number(request.leaveBalance.totalDays) -
            Number(request.leaveBalance.usedDays) -
            Number(request.totalDays),
        )
      : null;

  const user = request.employeeProfile.user;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-5 overflow-y-auto bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-heading-sm font-bold text-stone-900">Review Request</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
          >
            <X size={14} />
          </button>
        </div>

        {/* Employee card */}
        <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-label-md font-bold text-[#2C1810]">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-body-sm font-bold text-stone-900">{user.name}</p>
            <p className="text-caption text-stone-400">{roleLabel(user.role)}</p>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Leave Type</span>
            <LeaveTypeBadge type={request.leaveType} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Duration</span>
            <span className="text-body-sm font-medium text-stone-700">
              {Number(request.totalDays)} {Number(request.totalDays) === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Dates</span>
            <span className="text-body-sm font-medium text-stone-700">
              {formatDateRange(request.startDate, request.endDate)}
            </span>
          </div>
        </div>

        <hr className="border-stone-100" />

        {/* Reason */}
        {request.reason && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Reason</span>
            <p className="rounded-lg bg-stone-50 px-3 py-2.5 text-body-sm italic text-stone-600 leading-relaxed">
              &ldquo;{request.reason}&rdquo;
            </p>
          </div>
        )}

        {/* Balance preview */}
        {balanceAfter !== null && (
          <div className="flex items-center justify-between rounded-lg border border-[#86EFAC] bg-[#EDFAF1] px-3 py-2.5">
            <span className="text-body-sm font-medium text-[#1A6B3C]">Balance after approval</span>
            <span className="text-heading-sm font-bold text-[#1A6B3C]">{balanceAfter}d left</span>
          </div>
        )}

        {/* Comment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Comment <span className="normal-case font-normal">(optional, visible to staff)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Add a note for the staff member…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-body-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => void onApprove(comment)}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2C1810] py-2.5 text-label-sm font-bold text-white transition-colors hover:bg-[#4A2C1A] disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {loading ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={() => void onReject(comment)}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] py-2.5 text-label-sm font-bold text-[#991B1B] transition-colors hover:bg-[#FEE2E2] disabled:opacity-50"
          >
            <XCircle size={14} />
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaveRequestsPage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const router = useRouter();

  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [drawerRequest, setDrawerRequest] = useState<LeaveRequest | null>(null);

  // History table filters
  const [historyStatus, setHistoryStatus] = useState<LeaveStatus | 'ALL'>('ALL');
  const [historyType, setHistoryType] = useState<LeaveType | ''>('');
  const [historySearch, setHistorySearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      // Load ALL requests at once (pending + history combined)
      const result = await listLeaveRequests({ page: 1, limit: 200 }, accessToken);
      setAllRequests(result.items);
    } catch {
      toast({ variant: 'error', title: 'Failed to load leave requests' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const pending = useMemo(() => allRequests.filter((r) => r.status === 'PENDING'), [allRequests]);

  const history = useMemo(() => {
    return allRequests
      .filter((r) => r.status !== 'PENDING')
      .filter((r) => historyStatus === 'ALL' || r.status === historyStatus)
      .filter((r) => !historyType || r.leaveType === historyType)
      .filter((r) => {
        if (!historySearch) return true;
        const q = historySearch.toLowerCase();
        return r.employeeProfile.user.name.toLowerCase().includes(q);
      });
  }, [allRequests, historyStatus, historyType, historySearch]);

  const handleApprove = async (req: LeaveRequest, comment: string) => {
    if (!accessToken) return;
    setActionId(req.id);
    try {
      await approveLeaveRequest(req.id, comment, accessToken);
      toast({ variant: 'success', title: 'Leave approved', message: `${req.employeeProfile.user.name}'s leave has been approved.` });
      setDrawerRequest(null);
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to approve', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (req: LeaveRequest, comment: string) => {
    if (!accessToken) return;
    setActionId(req.id);
    try {
      await rejectLeaveRequest(req.id, comment, accessToken);
      toast({ variant: 'success', title: 'Leave rejected' });
      setDrawerRequest(null);
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to reject', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Leave Requests"
        subtitle="Review pending requests and manage leave history."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        action={
          <button
            onClick={() => router.push('/app/hr/leave/calendar')}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-label-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <Calendar size={14} />
            Calendar
          </button>
        }
      />

      {/* ── Pending Queue ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#92650A]">
            Pending Review
          </span>
          {pending.length > 0 && (
            <span className="inline-flex h-4.5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#9B3A2A] px-1.5 text-[10px] font-bold text-white">
              {pending.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 shadow-sm">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-48 animate-pulse rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center shadow-sm">
            <p className="text-body-sm text-stone-400">No pending requests — you&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#F0D080] bg-[#FFFDF5] shadow-sm overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-[#F0D080] bg-[#FDF3DC]">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#92650A]">Employee</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#92650A]">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#92650A]">Dates</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#92650A]">Days</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#92650A]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0D080]/50">
                {pending.map((req) => (
                  <tr key={req.id} className="bg-[#FFFDF5] transition-colors hover:bg-[#FDF8E8]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-label-sm font-bold text-[#2C1810]">
                          {req.employeeProfile.user.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-stone-900">{req.employeeProfile.user.name}</p>
                          <p className="text-caption text-stone-400">{roleLabel(req.employeeProfile.user.role)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><LeaveTypeBadge type={req.leaveType} /></td>
                    <td className="px-4 py-3.5 text-stone-600">{formatDateRange(req.startDate, req.endDate)}</td>
                    <td className="px-4 py-3.5 font-semibold text-stone-900">{Number(req.totalDays)}d</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setDrawerRequest(req)}
                        className="rounded-md bg-[#2C1810] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#4A2C1A]"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── History Table ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">History</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-3">
            {/* Search */}
            <input
              type="search"
              placeholder="Search by name…"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="h-8 w-44 rounded-lg border border-stone-200 bg-stone-50 px-3 text-body-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />

            {/* Status filter pills */}
            <div className="flex items-center gap-1">
              {HISTORY_STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setHistoryStatus(tab.value)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    historyStatus === tab.value
                      ? 'bg-[#2C1810] text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <select
              value={historyType}
              onChange={(e) => setHistoryType(e.target.value as LeaveType | '')}
              className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2 text-body-sm text-stone-700 focus:border-stone-400 focus:outline-none"
            >
              {LEAVE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <span className="ml-auto text-caption text-stone-400">
              {loading ? '…' : `${history.length} record${history.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div className="divide-y divide-stone-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-stone-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-36 animate-pulse rounded bg-stone-200" />
                    <div className="h-3 w-52 animate-pulse rounded bg-stone-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                icon={<Calendar size={22} />}
                heading="No records found"
                body="No leave history matches the current filter."
              />
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Dates</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Days</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Reviewed By</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((req) => (
                  <tr key={req.id} className="transition-colors hover:bg-stone-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-[11px] font-bold text-[#2C1810]">
                          {req.employeeProfile.user.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-stone-900">{req.employeeProfile.user.name}</p>
                          <p className="text-caption text-stone-400">{roleLabel(req.employeeProfile.user.role)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><LeaveTypeBadge type={req.leaveType} /></td>
                    <td className="px-4 py-3.5 text-stone-600">{formatDateRange(req.startDate, req.endDate)}</td>
                    <td className="px-4 py-3.5 font-medium text-stone-700">{Number(req.totalDays)}d</td>
                    <td className="px-4 py-3.5"><LeaveStatusBadge status={req.status} /></td>
                    <td className="px-4 py-3.5">
                      {req.reviewedBy ? (
                        <span className="text-body-sm text-stone-700">{req.reviewedBy.name}</span>
                      ) : (
                        <span className="text-caption text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 max-w-[180px]">
                      {req.reviewComment ? (
                        <span className="truncate text-caption italic text-stone-400">&ldquo;{req.reviewComment}&rdquo;</span>
                      ) : (
                        <span className="text-caption text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Review Drawer ──────────────────────────────────────────────────── */}
      {drawerRequest && (
        <ReviewDrawer
          request={drawerRequest}
          onClose={() => setDrawerRequest(null)}
          onApprove={(comment) => handleApprove(drawerRequest, comment)}
          onReject={(comment) => handleReject(drawerRequest, comment)}
          loading={actionId === drawerRequest.id}
        />
      )}
    </PageLayout>
  );
}
