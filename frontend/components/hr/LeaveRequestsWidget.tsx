'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Check, X } from 'lucide-react';
import { listLeaveRequests } from '@/services/hrService';
import { useAuthStore } from '@/store/authStore';
import { useLeaveAcknowledgements } from '@/hooks/useLeaveAcknowledgements';
import { LeaveTypeBadge, formatDateRange, roleLabel } from '@/components/hr/LeaveTypeBadge';
import type { LeaveRequest } from '@/types/hr';

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function LeaveDetailDrawer({
  request,
  onClose,
  onAcknowledge,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onAcknowledge: (() => void) | null;
}): JSX.Element {
  const isResolved = request.status === 'APPROVED' || request.status === 'REJECTED';
  const isApproved = request.status === 'APPROVED';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-5 overflow-y-auto bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-heading-sm font-bold text-stone-900">Leave Request</h2>
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
            {request.employeeProfile.user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-body-sm font-bold text-stone-900">{request.employeeProfile.user.name}</p>
            <p className="text-caption text-stone-400">{roleLabel(request.employeeProfile.user.role)}</p>
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

        {/* Decision banner — shown when resolved */}
        {isResolved && (
          <div
            className={`rounded-xl border px-4 py-3.5 ${
              isApproved
                ? 'border-[#86EFAC] bg-[#EDFAF1]'
                : 'border-[#F5A898] bg-[#FDF2F0]'
            }`}
          >
            <p className={`text-body-sm font-semibold ${isApproved ? 'text-[#1A6B3C]' : 'text-[#9B3A2A]'}`}>
              {isApproved ? 'Leave Approved' : 'Leave Rejected'}
            </p>
            {request.reviewedBy && (
              <p className={`mt-0.5 text-caption ${isApproved ? 'text-[#1A6B3C]' : 'text-[#9B3A2A]'}`}>
                by {request.reviewedBy.name}
              </p>
            )}
            {request.reviewComment && (
              <p className={`mt-2 text-body-sm italic ${isApproved ? 'text-[#1A6B3C]' : 'text-[#9B3A2A]'}`}>
                &ldquo;{request.reviewComment}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Pending info note */}
        {!isResolved && (
          <div className="rounded-lg border border-[#E0D5C8] bg-[#FAF7F4] px-4 py-3 text-body-sm text-[#6B4C2A]">
            Awaiting HR review. This card will remain visible until a decision is made.
          </div>
        )}

        {/* Got it CTA — only for resolved requests */}
        {isResolved && onAcknowledge && (
          <button
            onClick={() => { onAcknowledge(); onClose(); }}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-label-sm font-bold text-white transition-colors ${
              isApproved
                ? 'bg-[#1A6B3C] hover:bg-[#15593200] hover:bg-[#15593280] hover:brightness-110'
                : 'bg-[#9B3A2A] hover:brightness-110'
            }`}
            style={{ backgroundColor: isApproved ? '#1A6B3C' : '#9B3A2A' }}
          >
            <Check size={15} />
            Got it — dismiss
          </button>
        )}
      </div>
    </>
  );
}

// ─── Individual Request Card ──────────────────────────────────────────────────

function LeaveCard({
  request,
  onOpen,
  onAcknowledge,
}: {
  request: LeaveRequest;
  onOpen: () => void;
  onAcknowledge: () => void;
}): JSX.Element {
  const isPending = request.status === 'PENDING';
  const isApproved = request.status === 'APPROVED';

  // Visual treatment by status
  const cardClass = isPending
    ? 'border-[#E0D5C8] bg-white hover:bg-[#FAF7F4]'
    : isApproved
    ? 'border-[#86EFAC] bg-[#F6FEF9] hover:bg-[#EDFAF1]'
    : 'border-[#F5A898] bg-[#FFF8F7] hover:bg-[#FDF2F0]';

  const statusPill = isPending ? (
    <span className="rounded-full border border-[#F0D080] bg-[#FDF3DC] px-2 py-0.5 text-[10px] font-semibold text-[#92650A]">
      Pending HR
    </span>
  ) : isApproved ? (
    <span className="rounded-full border border-[#86EFAC] bg-[#EDFAF1] px-2 py-0.5 text-[10px] font-semibold text-[#1A6B3C]">
      Approved
    </span>
  ) : (
    <span className="rounded-full border border-[#F5A898] bg-[#FDF2F0] px-2 py-0.5 text-[10px] font-semibold text-[#9B3A2A]">
      Rejected
    </span>
  );

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${cardClass}`}>
      {/* Clickable main area → opens drawer */}
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-3 min-w-0 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-[11px] font-bold text-[#2C1810]">
          {request.employeeProfile.user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-body-sm font-semibold text-stone-900 truncate">
              {request.employeeProfile.user.name}
            </p>
            <LeaveTypeBadge type={request.leaveType} />
          </div>
          <p className="mt-0.5 text-caption text-stone-400">
            {formatDateRange(request.startDate, request.endDate)}
            {' · '}
            {Number(request.totalDays)}d
            {!isPending && request.reviewedBy && (
              <span className="ml-1">
                · {isApproved ? 'by' : 'by'} {request.reviewedBy.name}
              </span>
            )}
          </p>
        </div>
        {statusPill}
      </button>

      {/* Got it button — resolved only, separate from drawer trigger */}
      {!isPending && (
        <button
          type="button"
          onClick={onAcknowledge}
          title="Mark as seen"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
            isApproved
              ? 'border-[#86EFAC] bg-[#EDFAF1] text-[#1A6B3C] hover:bg-[#D1FAE5]'
              : 'border-[#F5A898] bg-[#FDF2F0] text-[#9B3A2A] hover:bg-[#FEE2E2]'
          }`}
        >
          <Check size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

interface LeaveRequestsWidgetProps {
  /** Pass organizationId to scope to a single branch (Manager). Omit for all branches (Director). */
  organizationId?: string;
}

export function LeaveRequestsWidget({ organizationId }: LeaveRequestsWidgetProps): JSX.Element | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { acknowledge, isAcknowledged } = useLeaveAcknowledgements(userId);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [drawer, setDrawer] = useState<LeaveRequest | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      // Load PENDING + recently resolved (no status filter = all, server returns up to limit)
      const [pending, resolved] = await Promise.all([
        listLeaveRequests({ organizationId, status: 'PENDING', page: 1, limit: 50 }, accessToken),
        listLeaveRequests({ organizationId, page: 1, limit: 50 }, accessToken),
      ]);
      // Merge: pending first, then resolved (APPROVED/REJECTED), deduped
      const seen = new Set<string>();
      const merged: LeaveRequest[] = [];
      for (const r of [...pending.items, ...resolved.items]) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          merged.push(r);
        }
      }
      setRequests(merged);
    } catch {
      // Non-critical — widget stays empty
    }
  }, [accessToken, organizationId]);

  useEffect(() => { void load(); }, [load]);

  // Filter: show PENDING always + APPROVED/REJECTED only if not yet acknowledged
  const visible = requests.filter((r) => {
    if (r.status === 'PENDING') return true;
    if (r.status === 'APPROVED' || r.status === 'REJECTED') return !isAcknowledged(r.id);
    return false;
  });

  // Counts for header
  const pendingCount = visible.filter((r) => r.status === 'PENDING').length;
  const needsAttentionCount = visible.filter((r) => r.status !== 'PENDING').length;

  if (visible.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-[#E0D5C8] bg-[#FAF7F4] p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff size={15} className="shrink-0 text-[#6B4C2A]" />
            <p className="text-body-sm font-semibold text-[#6B4C2A]">
              Leave Requests
            </p>
            {pendingCount > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#92650A] px-1.5 text-[10px] font-bold text-white">
                {pendingCount} pending
              </span>
            )}
            {needsAttentionCount > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-stone-400 px-1.5 text-[10px] font-bold text-white">
                {needsAttentionCount} to review
              </span>
            )}
          </div>
          <span className="text-caption text-[#9A7A5A]">Tap a card for details</span>
        </div>

        {/* Cards */}
        <div className="space-y-1.5">
          {visible.map((req) => (
            <LeaveCard
              key={req.id}
              request={req}
              onOpen={() => setDrawer(req)}
              onAcknowledge={() => acknowledge(req.id)}
            />
          ))}
        </div>

        {/* Footer hint — only shown when there are resolved cards awaiting ack */}
        {needsAttentionCount > 0 && (
          <p className="text-caption text-[#9A7A5A] pt-1">
            Tap <Check size={10} className="inline" /> to dismiss decisions you&apos;ve noted.
            Pending requests stay until HR acts.
          </p>
        )}
      </div>

      {/* Detail Drawer */}
      {drawer && (
        <LeaveDetailDrawer
          request={drawer}
          onClose={() => setDrawer(null)}
          onAcknowledge={
            drawer.status === 'APPROVED' || drawer.status === 'REJECTED'
              ? () => acknowledge(drawer.id)
              : null
          }
        />
      )}
    </>
  );
}
