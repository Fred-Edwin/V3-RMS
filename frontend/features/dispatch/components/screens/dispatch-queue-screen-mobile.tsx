'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { useAuthStore } from '@/store/authStore';
import { useDispatchQueue } from '../../hooks/use-dispatch-queue';
import { DispatchQueueSkeletonMobile } from '../skeletons';
import type { DispatchQueueRow } from '../../types';

function requisitionLabel(type: string): string {
  const LABEL: Record<string, string> = { MORNING: 'Morning requisition', AFTERNOON: 'Afternoon requisition', EVENING: 'Evening requisition', AD_HOC: 'Ad-hoc requisition' };
  return LABEL[type] ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} requisition`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatWait(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function totalLines(row: DispatchQueueRow): number {
  return row.departments.length; // one "line" per department in this summary — matches Paper's "N lines" (dept-count proxy; per-line counts aren't in the queue contract)
}

function dispatchedCount(row: DispatchQueueRow): number {
  return row.departments.filter((d) => d.status !== null).length;
}

interface QueueCardProps {
  row: DispatchQueueRow;
  isOldest: boolean;
  onOpen: () => void;
}

function QueueCard({ row, isOldest, onOpen }: QueueCardProps) {
  const dispatched = dispatchedCount(row);
  const fullyOut = dispatched === row.departments.length;

  return (
    <div
      className={
        'flex flex-col gap-wds-2.5 rounded-wds-sm border bg-wds-surface p-wds-3.5 ' +
        (isOldest ? 'border-wds-primary' : 'border-wds-border')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="font-wds-sans text-[15px]/[20px] font-semibold text-wds-text-ink">{row.branchName}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            {requisitionLabel(row.requisitionType)} · approved {formatTime(row.openedAt)}
          </div>
        </div>
        <div className={'shrink-0 font-wds-mono text-wds-caption ' + (isOldest ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted')}>
          {formatWait(row.openedAt)}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          {row.departments.length} department{row.departments.length === 1 ? '' : 's'}
        </div>
        <div className={'font-wds-sans text-wds-caption ' + (fullyOut ? 'text-wds-success-fg' : dispatched > 0 ? 'text-wds-success-fg' : 'text-wds-text-faint')}>
          {dispatched} of {row.departments.length} dispatched
        </div>
      </div>
      {isOldest ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center justify-center rounded-wds-sm bg-wds-gradient-primary py-wds-2.75 shadow-wds-sheen"
        >
          <span className="font-wds-sans text-wds-body-sm font-medium text-white">Open &amp; fulfil →</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Central Store dispatch queue — mobile (`1500-0`), Store Attendant + Store
 * Manager shared. Status bar + hub header + 2-tile KPI row + queue cards,
 * oldest card gets a primary border + "Open & fulfil" CTA; the rest are
 * tap-to-open (no explicit CTA button, per Paper's `1500-0`).
 */
export function DispatchQueueScreenMobile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queue = useDispatchQueue();

  const initials = React.useMemo(() => {
    if (!user?.name) return '—';
    return user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

  const branchesWaiting = queue.rows.length;
  const deptLines = queue.rows.reduce((sum, r) => sum + totalLines(r), 0);
  const oldest = queue.rows[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-wds-canvas">
      <MobileStatusBar />
      <MobileHubHeader
        title="Dispatch"
        subtitle="Approved requisitions — pick, pack, sign out. Oldest first."
        userInitials={initials}
        orgLabel="Hub"
      />
      <div className="flex flex-col gap-wds-3 p-wds-4">
        {queue.status === 'loading' ? (
          <DispatchQueueSkeletonMobile />
        ) : queue.status === 'error' ? (
          <MobileErrorState title="Couldn't load the dispatch queue" description="Check your connection and try again." onRetry={queue.reload} />
        ) : queue.rows.length === 0 ? (
          <MobileEmptyState title="Nothing waiting" description="No approved requisitions need dispatching right now." />
        ) : (
          <>
            <div className="flex gap-wds-2">
              <div className="flex grow basis-0 flex-col gap-wds-0.75 rounded-wds-sm border border-wds-border bg-wds-surface p-wds-3">
                <div className="font-wds-mono text-[10px]/3 tracking-wds-label text-wds-text-copy-muted">BRANCHES WAITING</div>
                <div className="font-wds-mono text-[22px]/7 font-medium text-wds-text-ink">{branchesWaiting}</div>
                <div className="font-wds-sans text-wds-label text-wds-text-copy-muted">{deptLines} dept lines</div>
              </div>
              <div className="flex grow basis-0 flex-col gap-wds-0.75 rounded-wds-sm border border-wds-border bg-wds-surface p-wds-3">
                <div className="font-wds-mono text-[10px]/3 tracking-wds-label text-wds-text-copy-muted">OLDEST WAIT</div>
                <div className="font-wds-mono text-[22px]/7 font-medium text-wds-warning-fg">{oldest ? formatWait(oldest.openedAt) : '—'}</div>
                <div className="font-wds-sans text-wds-label text-wds-text-copy-muted">{oldest?.branchName ?? '—'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <div className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Waiting</div>
              <div className="rounded-wds-full bg-wds-neutral-100 px-1.75 py-px">
                <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">{branchesWaiting}</div>
              </div>
              <div className="grow basis-0 text-right font-wds-sans text-wds-label text-wds-warning-fg">Queue order fixed</div>
            </div>

            {queue.rows.map((row, i) => (
              <QueueCard
                key={row.requisitionId}
                row={row}
                isOldest={i === 0}
                onOpen={() => router.push(`/app/inventory/dispatch?id=${row.requisitionId}`)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
