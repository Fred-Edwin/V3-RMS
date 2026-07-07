'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, XCircle, X, MoreHorizontal, RotateCcw, Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageLayout, PageHeader, EmptyState, ExcelTable } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { listLeaveRequests, approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest, revertLeaveRequest } from '@/services/hrService';
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crema text-label-md font-bold text-espresso">
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
          <div className="flex items-center justify-between rounded-lg border border-success-border bg-success-bg px-3 py-2.5">
            <span className="text-body-sm font-medium text-success">Balance after approval</span>
            <span className="text-heading-sm font-bold text-success">{balanceAfter}d left</span>
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-espresso py-2.5 text-label-sm font-bold text-white transition-colors hover:bg-espresso-light disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {loading ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={() => void onReject(comment)}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger-border bg-danger-bg py-2.5 text-label-sm font-bold text-danger transition-colors hover:bg-danger-bg/80 disabled:opacity-50"
          >
            <XCircle size={14} />
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── History Action Menu ──────────────────────────────────────────────────────

function HistoryActionMenu({
  request,
  onRevert,
  onCancel,
  loading,
}: {
  request: LeaveRequest;
  onRevert: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const canRevert = request.status === 'APPROVED' || request.status === 'REJECTED';
  const canCancel = request.status === 'APPROVED';

  if (!canRevert && !canCancel) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-40"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {canRevert && (
            <button
              onClick={() => { setOpen(false); onRevert(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              <RotateCcw size={13} className="text-stone-400" />
              Revert to Pending
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => { setOpen(false); onCancel(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-body-sm text-danger transition-colors hover:bg-danger-bg"
            >
              <Ban size={13} />
              Cancel Leave
            </button>
          )}
        </div>
      )}
    </div>
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

  const handleRevert = async (req: LeaveRequest) => {
    if (!accessToken) return;
    setActionId(req.id);
    try {
      await revertLeaveRequest(req.id, accessToken);
      toast({ variant: 'success', title: 'Reverted to pending', message: `${req.employeeProfile.user.name}'s leave request is pending review again.` });
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to revert', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (req: LeaveRequest) => {
    if (!accessToken) return;
    setActionId(req.id);
    try {
      await cancelLeaveRequest(req.id, accessToken);
      toast({ variant: 'success', title: 'Leave cancelled', message: `${req.employeeProfile.user.name}'s leave has been cancelled.` });
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to cancel', message: err instanceof Error ? err.message : 'Please try again.' });
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
          <span className="text-[11px] font-bold uppercase tracking-widest text-warning">
            Pending Review
          </span>
          {pending.length > 0 && (
            <span className="inline-flex h-4.5 min-w-[1.25rem] items-center justify-center rounded-full bg-status-cancelled-text px-1.5 text-[10px] font-bold text-white">
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
          <div className="rounded-xl border border-status-pending-border bg-status-pending-bg p-2 shadow-sm">
            <ExcelTable
              headerTone="gray"
              rowKey={(req) => req.id}
              rows={pending}
              columns={[
                {
                  key: 'employee',
                  label: 'Employee',
                  render: (req) => (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-crema text-label-sm font-bold text-espresso">
                        {req.employeeProfile.user.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-stone-900">{req.employeeProfile.user.name}</p>
                        <p className="text-caption text-stone-400">{roleLabel(req.employeeProfile.user.role)}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'type', label: 'Type', render: (req) => <LeaveTypeBadge type={req.leaveType} /> },
                { key: 'dates', label: 'Dates', render: (req) => formatDateRange(req.startDate, req.endDate) },
                {
                  key: 'days',
                  label: 'Days',
                  render: (req) => <span className="font-semibold text-stone-900">{Number(req.totalDays)}d</span>,
                },
                {
                  key: 'action',
                  label: '',
                  align: 'right',
                  render: (req) => (
                    <button
                      onClick={() => setDrawerRequest(req)}
                      className="rounded-md bg-espresso px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-espresso-light"
                    >
                      Review
                    </button>
                  ),
                },
              ]}
            />
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
                      ? 'bg-espresso text-white'
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
            <ExcelTable
              headerTone="gray"
              rowKey={(req) => req.id}
              rows={history}
              columns={[
                {
                  key: 'employee',
                  label: 'Employee',
                  render: (req) => (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crema text-[11px] font-bold text-espresso">
                        {req.employeeProfile.user.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-stone-900">{req.employeeProfile.user.name}</p>
                        <p className="text-caption text-stone-400">{roleLabel(req.employeeProfile.user.role)}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'type', label: 'Type', render: (req) => <LeaveTypeBadge type={req.leaveType} /> },
                { key: 'dates', label: 'Dates', render: (req) => <span className="text-stone-600">{formatDateRange(req.startDate, req.endDate)}</span> },
                {
                  key: 'days',
                  label: 'Days',
                  render: (req) => <span className="font-medium text-stone-700">{Number(req.totalDays)}d</span>,
                },
                { key: 'status', label: 'Status', render: (req) => <LeaveStatusBadge status={req.status} /> },
                {
                  key: 'reviewedBy',
                  label: 'Reviewed By',
                  render: (req) =>
                    req.reviewedBy
                      ? <span className="text-body-sm text-stone-700">{req.reviewedBy.name}</span>
                      : <span className="text-caption text-stone-300">—</span>,
                },
                {
                  key: 'comment',
                  label: 'Comment',
                  render: (req) =>
                    req.reviewComment
                      ? <span className="block max-w-[180px] truncate text-caption italic text-stone-400">&ldquo;{req.reviewComment}&rdquo;</span>
                      : <span className="text-caption text-stone-300">—</span>,
                },
                {
                  key: 'action',
                  label: '',
                  align: 'right',
                  render: (req) => (
                    <HistoryActionMenu
                      request={req}
                      onRevert={() => void handleRevert(req)}
                      onCancel={() => void handleCancel(req)}
                      loading={actionId === req.id}
                    />
                  ),
                },
              ]}
            />
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
