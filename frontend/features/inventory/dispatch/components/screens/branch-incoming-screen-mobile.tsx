'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { useAuthStore } from '@/store/authStore';
import { useDeliveries } from '../../hooks/use-deliveries';
import { DispatchQueueSkeletonMobile } from '../skeletons';
import type { DeliveryRow, DispatchStatus } from '../../types';

/** "12 min ago" / "2h 14m ago" from an ISO timestamp. */
function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return 'just now';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, '0')}m ago` : `${minutes} min ago`;
}

/**
 * `sequenceLabel` is "Dispatch N · <branch name> · <date>" (session-a-plan.md
 * §1). On the branch's own list, repeating its own branch name is redundant
 * — Paper's `15L1-0` instead shows "Dispatch N · Central Store" (the
 * sender), which is the useful counterparty info here. Full sequenceLabel
 * stays the source of truth everywhere else (delivery note, confirm screen).
 */
function cardTitle(sequenceLabel: string): string {
  const dispatchNumber = sequenceLabel.split('·')[0]?.trim() ?? sequenceLabel;
  return `${dispatchNumber} · Central Store`;
}

function statusDotClass(status: DispatchStatus): string {
  if (status === 'DISCREPANCY_OPEN') return 'bg-wds-error-fg';
  if (status === 'CONFIRMED') return 'bg-wds-success-fg';
  return 'bg-wds-warning-fg'; // IN_TRANSIT — arrived-unconfirmed reads as the attention state on this list
}

function isUnconfirmedArrived(row: DeliveryRow): boolean {
  return row.status === 'IN_TRANSIT' && Boolean(row.dispatchedAt) && Date.now() - new Date(row.dispatchedAt!).getTime() > 0;
}

interface DeliveryCardProps {
  row: DeliveryRow;
  isPrimary: boolean;
  onOpen: () => void;
}

/** One card per delivery. The single most-actionable "arrived, unconfirmed" delivery gets the highlighted border + CTA; everything else is a plain tap-to-open row. */
function DeliveryCard({ row, isPrimary, onOpen }: DeliveryCardProps) {
  const statusLabel = row.status === 'DISCREPANCY_OPEN' ? 'Discrepancy' : row.status === 'CONFIRMED' ? 'Confirmed' : isPrimary ? 'Arrived' : 'In transit';
  const statusTone = row.status === 'DISCREPANCY_OPEN' ? 'text-wds-error-fg' : row.status === 'CONFIRMED' ? 'text-wds-success-fg' : isPrimary ? 'text-wds-info-fg' : 'text-wds-warning-fg';
  const detailLine = row.status === 'CONFIRMED'
    ? `${row.lines.length} line${row.lines.length === 1 ? '' : 's'} · confirmed ${row.confirmedAt ? formatAgo(row.confirmedAt) : ''}`
    : isPrimary
      ? `${row.lines.length} line${row.lines.length === 1 ? '' : 's'} · arrived ${row.dispatchedAt ? formatAgo(row.dispatchedAt) : ''}`
      : `${row.lines.length} line${row.lines.length === 1 ? '' : 's'} · dispatched ${row.dispatchedAt ? formatAgo(row.dispatchedAt) : ''} · not yet arrived`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        'flex flex-col gap-wds-2.5 rounded-wds-sm border bg-wds-surface p-wds-4 text-left transition-colors active:bg-wds-neutral-100 ' +
        (isPrimary ? 'border-wds-info-border' : 'border-wds-border')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-wds-sans text-wds-section font-semibold text-wds-text-ink">{cardTitle(row.sequenceLabel)}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className={'size-1.5 shrink-0 rounded-full ' + statusDotClass(isPrimary ? 'IN_TRANSIT' : row.status)} />
          <div className={'font-wds-sans text-wds-caption ' + statusTone}>{statusLabel}</div>
        </div>
      </div>
      <div className="font-wds-mono text-wds-caption text-wds-text-copy-muted">{detailLine}</div>
      {isPrimary ? (
        <div className="flex items-center justify-center rounded-wds-sm bg-wds-gradient-primary py-wds-2.75">
          <span className="font-wds-sans text-wds-body font-semibold text-white">Confirm receipt</span>
        </div>
      ) : null}
    </button>
  );
}

/**
 * Branch mobile (`15L1-0`) — Department Head's own-department deliveries
 * list. Custom compact header (hamburger + title/subtitle + avatar in one
 * row) — genuinely new shape, doesn't fit `MobileHubHeader`'s two-tier
 * layout or `MobileTaskHeader`'s back-chevron layout, so built inline rather
 * than forcing an existing primitive or extracting a one-off component.
 */
export function BranchIncomingScreenMobile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const deliveries = useDeliveries();

  const initials = React.useMemo(() => {
    if (!user?.name) return '—';
    return user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

  const departmentLabel = user?.departmentTag
    ? user.departmentTag.charAt(0) + user.departmentTag.slice(1).toLowerCase()
    : 'Department';
  const orgLabel = user?.organizationName ?? 'Branch';

  const inTransitCount = deliveries.rows.filter((r) => r.status === 'IN_TRANSIT').length;
  const unconfirmedRows = deliveries.rows.filter((r) => isUnconfirmedArrived(r));
  const unconfirmedCount = unconfirmedRows.length;
  const primaryId = unconfirmedRows[0]?.id ?? null;

  const earlierRows = deliveries.rows.filter((r) => r.id !== primaryId && r.status !== 'IN_TRANSIT');
  const activeRows = deliveries.rows.filter((r) => r.id === primaryId || r.status === 'IN_TRANSIT');

  return (
    <div className="flex min-h-screen flex-col bg-wds-canvas">
      <div className="flex items-center gap-3 bg-wds-sidebar-mid px-wds-4 py-wds-3">
        <button type="button" aria-label="Open menu" className="flex shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
            <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="var(--wds-sidebar-fg-active)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex min-w-0 grow flex-col gap-px">
          <div className="truncate font-wds-sans text-wds-section font-semibold text-wds-sidebar-fg-active">Deliveries</div>
          <div className="truncate font-wds-mono text-wds-label text-wds-sidebar-fg-item">
            {departmentLabel} · {orgLabel}
          </div>
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-wds-sm bg-wds-espresso-800 font-wds-mono text-wds-label text-wds-sidebar-fg-item">
          {initials}
        </div>
      </div>

      <div className="flex flex-col gap-wds-4 p-wds-4">
        {deliveries.status === 'loading' ? (
          <DispatchQueueSkeletonMobile />
        ) : deliveries.status === 'error' ? (
          <MobileErrorState title="Couldn't load deliveries" description="Check your connection and try again." onRetry={deliveries.reload} />
        ) : deliveries.rows.length === 0 ? (
          <MobileEmptyState title="Nothing incoming" description="No deliveries for your department today." />
        ) : (
          <>
            <div className="flex gap-wds-2">
              <div className="flex grow basis-0 flex-col gap-wds-0.75 rounded-wds-sm border border-wds-border bg-wds-surface p-wds-3">
                <div className="font-wds-mono text-[10px]/3 tracking-wds-label uppercase text-wds-text-copy-muted">In transit</div>
                <div className="font-wds-mono text-[20px]/6 font-medium text-wds-text-ink">{inTransitCount}</div>
              </div>
              <div className="flex grow basis-0 flex-col gap-wds-0.75 rounded-wds-sm border border-wds-border bg-wds-surface p-wds-3">
                <div className="font-wds-mono text-[10px]/3 tracking-wds-label uppercase text-wds-text-copy-muted">Unconfirmed</div>
                <div className="font-wds-mono text-[20px]/6 font-medium text-wds-info-fg">{unconfirmedCount}</div>
              </div>
            </div>

            <div className="flex flex-col gap-wds-2.5">
              {activeRows.map((row) => (
                <DeliveryCard
                  key={row.id}
                  row={row}
                  isPrimary={row.id === primaryId}
                  onOpen={() => router.push(`/app/branch/deliveries/confirm?id=${row.id}`)}
                />
              ))}
            </div>

            {earlierRows.length > 0 ? (
              <div className="flex flex-col gap-wds-2.5">
                <div className="font-wds-mono text-wds-label font-medium uppercase tracking-wds-label text-wds-text-copy-muted">Earlier</div>
                {earlierRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => router.push(`/app/branch/deliveries/confirm?id=${row.id}`)}
                    className="flex items-center justify-between rounded-wds-sm border border-wds-border bg-wds-surface px-wds-4 py-wds-3.5 text-left transition-colors active:bg-wds-neutral-100"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="truncate font-wds-sans text-wds-body font-medium text-wds-text-ink">{cardTitle(row.sequenceLabel)}</div>
                      <div className="font-wds-mono text-wds-caption text-wds-text-copy-muted">
                        {row.lines.length} line{row.lines.length === 1 ? '' : 's'} ·{' '}
                        {row.status === 'CONFIRMED' ? `confirmed ${row.confirmedAt ? formatAgo(row.confirmedAt) : ''}` : 'discrepancy open'}
                      </div>
                    </div>
                    <div className={'size-1.5 shrink-0 rounded-full ' + statusDotClass(row.status)} />
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
