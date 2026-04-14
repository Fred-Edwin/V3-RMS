'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CalendarOff, Clock, AlertTriangle,
  ChevronRight, CheckCircle2, XCircle, UserCircle, Building2,
} from 'lucide-react';
import { PageLayout, PageHeader, EmptyState } from '@/components/ui';
import { InboxNudge } from '@/components/comms/InboxNudge';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { getHrDashboard, approveLeaveRequest, rejectLeaveRequest } from '@/services/hrService';
import type { HrDashboard, LeaveRequest } from '@/types/hr';
import { LeaveTypeBadge, formatDateRange } from '@/components/hr/LeaveTypeBadge';

export default function HrDashboardPage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const router = useRouter();

  const [data, setData] = useState<HrDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await getHrDashboard(undefined, accessToken);
      setData(result);
    } catch {
      toast({ variant: 'error', title: 'Failed to load HR dashboard' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (req: LeaveRequest) => {
    if (!accessToken) return;
    setActionId(req.id);
    try {
      await approveLeaveRequest(req.id, reviewComment[req.id], accessToken);
      toast({ variant: 'success', title: 'Leave approved', message: `${req.employeeProfile.user.name}'s leave has been approved.` });
      setExpandedId(null);
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to approve', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (req: LeaveRequest) => {
    if (!accessToken) return;
    setActionId(req.id);
    try {
      await rejectLeaveRequest(req.id, reviewComment[req.id], accessToken);
      toast({ variant: 'success', title: 'Leave rejected' });
      setExpandedId(null);
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to reject', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setActionId(null);
    }
  };

  const stats = data?.stats;

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="HR Overview"
        subtitle="People, leave, and workforce at a glance."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      <InboxNudge />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            icon: Users,
            label: 'Total Headcount',
            value: stats?.activeStaff ?? '—',
            sub: stats ? `${stats.onLeaveToday} on leave today` : null,
            color: '#2C1810',
          },
          {
            icon: CalendarOff,
            label: 'At Work Today',
            value: stats ? Math.max(0, stats.activeStaff - stats.onLeaveToday) : '—',
            sub: stats?.onLeaveToday ? `${stats.onLeaveToday} away` : 'Full team in',
            color: '#1A6B3C',
          },
          {
            icon: Clock,
            label: 'Pending Leave',
            value: stats?.pendingLeave ?? '—',
            sub: 'awaiting review',
            color: '#92650A',
          },
          {
            icon: AlertTriangle,
            label: 'Active Warnings',
            value: stats?.activeWarnings ?? '—',
            sub: 'unexpired records',
            color: '#9B3A2A',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div
            key={label}
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-label-sm text-stone-500">{label}</p>
                <p className="mt-1 font-display text-display-lg font-semibold" style={{ color }}>
                  {loading ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-stone-200" /> : value}
                </p>
                {!loading && sub && (
                  <p className="mt-0.5 text-caption text-stone-400">{sub}</p>
                )}
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-50">
                <Icon size={18} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Pending Leave Requests ── */}
        <div className="lg:col-span-2 rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="text-heading-sm font-semibold text-stone-900">Pending Leave Requests</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {data?.pendingRequests.length === 0
                  ? 'All caught up — no requests waiting for your review.'
                  : `${data?.pendingRequests.length ?? 0} awaiting review`}
              </p>
            </div>
            <button
              onClick={() => router.push('/app/hr/leave')}
              className="flex items-center gap-1 text-label-sm text-stone-500 transition-colors hover:text-espresso"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-stone-100">
              {[1, 2].map((i) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-56 animate-pulse rounded bg-stone-100" />
                </div>
              ))}
            </div>
          ) : data?.pendingRequests.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState
                icon={<CheckCircle2 size={22} />}
                heading="All caught up"
                body="No leave requests are waiting for your review."
              />
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data?.pendingRequests.map((req) => (
                <li key={req.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-label-sm font-semibold text-stone-600">
                        {req.employeeProfile.user.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-body-sm font-semibold text-stone-900">
                            {req.employeeProfile.user.name}
                          </p>
                          <LeaveTypeBadge type={req.leaveType} />
                        </div>
                        <p className="mt-0.5 text-caption text-stone-500">
                          {formatDateRange(req.startDate, req.endDate)} · {req.totalDays} {Number(req.totalDays) === 1 ? 'day' : 'days'}
                        </p>
                        {req.reason && (
                          <p className="mt-1 text-body-sm text-stone-600 line-clamp-2">&ldquo;{req.reason}&rdquo;</p>
                        )}
                        {/* Balance after this request */}
                        {req.leaveBalance && (
                          <p className="mt-1 text-caption text-stone-400">
                            Balance: {Math.max(0, Number(req.leaveBalance.totalDays) - Number(req.leaveBalance.usedDays) - Number(req.totalDays))} days remaining after this
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                      className="shrink-0 text-label-sm text-stone-400 transition-colors hover:text-stone-700"
                    >
                      {expandedId === req.id ? 'Close' : 'Review'}
                    </button>
                  </div>

                  {/* Inline expand for review */}
                  {expandedId === req.id && (
                    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-3">
                      <textarea
                        rows={2}
                        placeholder="Optional comment (visible to staff)…"
                        value={reviewComment[req.id] ?? ''}
                        onChange={(e) => setReviewComment((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        className="w-full resize-none rounded-md border border-stone-200 bg-white px-3 py-2 text-body-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleApprove(req)}
                          disabled={actionId === req.id}
                          className="flex items-center gap-1.5 rounded-lg bg-[#2C1810] px-4 py-2 text-label-sm font-semibold text-white transition-colors hover:bg-[#4A2C1A] disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          {actionId === req.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => void handleReject(req)}
                          disabled={actionId === req.id}
                          className="flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-2 text-label-sm font-semibold text-[#991B1B] transition-colors hover:bg-[#FEE2E2] disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          {actionId === req.id ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          {/* On Leave Today */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="text-heading-sm font-semibold text-stone-900">On Leave Today</h3>
            </div>
            {loading ? (
              <div className="px-4 py-3 space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-4 w-full animate-pulse rounded bg-stone-100" />)}
              </div>
            ) : data?.onLeaveToday.length === 0 ? (
              <div className="px-4 py-4 text-center text-body-sm text-stone-400">
                No one is on leave today.
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {data?.onLeaveToday.map((req) => (
                  <li key={req.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-label-sm font-semibold text-stone-600">
                      {req.employeeProfile.user.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-stone-800">
                        {req.employeeProfile.user.name}
                      </p>
                      <p className="text-caption text-stone-400">
                        Returns {new Date(req.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <LeaveTypeBadge type={req.leaveType} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Probation Ending Soon */}
          {(data?.stats.probationEnding?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] shadow-sm">
              <div className="border-b border-[#FCD34D] px-4 py-3">
                <h3 className="text-heading-sm font-semibold text-[#92400E]">Probation Ending Soon</h3>
              </div>
              <ul className="divide-y divide-[#FDE68A]">
                {data?.stats.probationEnding?.map((profile) => (
                  <li key={profile.id} className="flex items-center gap-3 px-4 py-3">
                    <UserCircle size={18} className="shrink-0 text-[#92400E]" />
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-[#78350F]">{profile.user.name}</p>
                      <p className="text-caption text-[#92400E]">
                        {profile.probationEndDate
                          ? `Ends ${new Date(profile.probationEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ''}
                      </p>
                    </div>
                    {profile.user.organization && (
                      <div className="ml-auto flex items-center gap-1 text-caption text-[#92400E]">
                        <Building2 size={12} />
                        {profile.user.organization.name}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
