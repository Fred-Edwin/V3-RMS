'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDeliveryNote } from '../../hooks/use-delivery-note';
import type { DeliveryNote, DispatchStatus } from '../../types';

const DEPARTMENT_LABEL: Record<string, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function statusTone(status: DispatchStatus): { dot: string; text: string; label: string } {
  if (status === 'CONFIRMED') return { dot: 'bg-wds-success-fg', text: 'text-wds-success-fg', label: 'Delivered' };
  if (status === 'DISCREPANCY_OPEN') return { dot: 'bg-wds-error-fg', text: 'text-wds-error-fg', label: 'Discrepancy' };
  return { dot: 'bg-wds-warning-fg', text: 'text-wds-warning-fg', label: 'In Transit' };
}

function DesktopNote({ note }: { note: DeliveryNote }) {
  const router = useRouter();
  const tone = statusTone(note.status);
  const shortLines = note.lines.filter((l) => l.confirmedQty !== null && Number(l.confirmedQty) < Number(l.dispatchedQty));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Dispatch', screen: `Delivery note · ${note.sequenceLabel}` }}
        actions={
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={() => router.push('/app/inventory/dispatch')}>
              Back to queue
            </Button>
            <Button variant="secondary" onClick={() => window.open(`/app/inventory/dispatch-print/${note.id}`, '_blank')}>
              Print
            </Button>
          </div>
        }
        className="shrink-0"
      />
      <div className="flex flex-1 justify-center overflow-y-auto px-8 pb-10 pt-8">
        <div className="flex w-[720px] shrink-0 flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface">
          <div className="flex items-start justify-between border-b-2 border-wds-text-ink px-8 pb-5 pt-7">
            <div className="flex flex-col gap-[3px]">
              <div className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Wendo Coffee Bistro — Central Store</div>
            </div>
            <div className="flex flex-col items-end gap-[3px]">
              <div className="font-wds-mono text-wds-body-sm font-semibold tracking-[0.06em] text-wds-text-ink">DELIVERY NOTE</div>
              <div className="font-wds-mono text-wds-caption text-wds-text-copy-muted">{note.sequenceLabel}</div>
            </div>
          </div>
          <div className="flex gap-10 border-b border-wds-border px-8 py-5">
            <div className="flex flex-col gap-2.5">
              <div className="font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">DELIVER TO</div>
              <div className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">
                {note.branchName} branch · {DEPARTMENT_LABEL[note.departmentTag] ?? note.departmentTag}
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-2.5">
              <div className="text-right font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">DISPATCHED</div>
              <div className="text-right font-wds-mono text-wds-body-sm text-wds-text-ink">{formatDateTime(note.dispatchedAt)}</div>
              <div className="text-right font-wds-sans text-wds-caption text-wds-text-copy-muted">by {note.dispatchedByName ?? '—'}, Store Manager</div>
            </div>
          </div>
          <div className="flex h-8 shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-8">
            <div className="grow font-wds-mono text-[10px]/3 font-semibold tracking-[0.06em] text-wds-text-ink">ITEM</div>
            <div className="w-[90px] shrink-0 text-right font-wds-mono text-[10px]/3 font-semibold tracking-[0.06em] text-wds-text-ink">REQUESTED</div>
            <div className="w-[90px] shrink-0 text-right font-wds-mono text-[10px]/3 font-semibold tracking-[0.06em] text-wds-text-ink">DISPATCHED</div>
            <div className="w-[110px] shrink-0 text-right font-wds-mono text-[10px]/3 font-semibold tracking-[0.06em] text-wds-text-ink">NOTE</div>
          </div>
          {note.lines.map((line, i) => {
            const short = line.confirmedQty !== null && Number(line.confirmedQty) < Number(line.dispatchedQty);
            const shortBy = short ? Number(line.dispatchedQty) - Number(line.confirmedQty) : 0;
            return (
              <div key={line.inventoryItemId} className={'flex h-10 shrink-0 items-center px-8 ' + (i < note.lines.length - 1 ? 'border-b border-wds-neutral-100' : '')}>
                <div className={'grow font-wds-sans text-wds-body-sm ' + (short ? 'font-semibold text-wds-error-fg' : 'text-wds-text-ink')}>
                  {line.itemName}
                  {line.isSubstitute ? <span className="ml-1.5 font-wds-sans text-wds-label text-wds-primary">substitute</span> : null}
                </div>
                <div className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{line.requestedQty ?? '—'}</div>
                <div className={'w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm ' + (short ? 'font-semibold text-wds-error-fg' : 'text-wds-text-ink')}>{line.dispatchedQty}</div>
                <div className={'w-[110px] shrink-0 text-right font-wds-sans text-wds-body-sm ' + (short ? 'font-semibold text-wds-error-fg' : 'text-wds-text-ink')}>
                  {short ? `Short ${shortBy} ${line.usageUnit}` : '—'}
                </div>
              </div>
            );
          })}
          <div className="border-b border-wds-border bg-wds-neutral-50 px-8 py-3.5">
            <div className="pb-1 font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">NOTES</div>
            <div className="font-wds-sans text-wds-caption leading-[17px] text-wds-text-copy-muted">
              Driver does not carry cost figures on this copy. Confirm each line on receipt in the app — any difference against the dispatched quantity raises a transit discrepancy.
              {shortLines.length > 0
                ? ` ${shortLines.map((l) => `${l.itemName} short by ${Number(l.dispatchedQty) - Number(l.confirmedQty)} ${l.usageUnit}`).join('; ')} against the dispatched amount; shortfall recorded as a discrepancy for the Store Manager to resolve.`
                : ''}
            </div>
          </div>
          <div className="flex gap-12 px-8 pb-7 pt-6">
            <div className="flex grow flex-col gap-1.5">
              <div className="font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">DISPATCHED BY</div>
              <div className="font-wds-signature text-[30px]/8 text-wds-text-ink">{note.dispatchedByName ?? '—'}</div>
              <div className="mt-0.5 h-px shrink-0 bg-wds-border-strong" />
              <div className="font-wds-sans text-wds-label text-wds-text-copy-muted">Store Manager · PIN verified {formatDateTime(note.dispatchedAt)}</div>
            </div>
            <div className="flex grow flex-col gap-1.5">
              <div className="font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted">RECEIVED BY</div>
              <div className="h-8 shrink-0 font-wds-sans text-wds-body-sm text-wds-text-faint">
                {note.confirmedByName ?? '— signed in the app on receipt —'}
              </div>
              <div className="mt-0.5 h-px shrink-0 bg-wds-border-strong" />
              <div className="font-wds-sans text-wds-label text-wds-text-copy-muted">
                {DEPARTMENT_LABEL[note.departmentTag] ?? note.departmentTag}, {note.branchName}
              </div>
            </div>
          </div>
          <div className={'flex items-center gap-1.5 px-8 pb-5'}>
            <span className={'size-1.5 shrink-0 rounded-full ' + tone.dot} />
            <span className={'font-wds-sans text-wds-caption ' + tone.text}>{tone.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileNote({ note, isDriversCopy }: { note: DeliveryNote; isDriversCopy: boolean }) {
  const router = useRouter();
  const tone = statusTone(note.status);

  return (
    <div className="flex min-h-screen flex-col bg-wds-neutral-50">
      <MobileStatusBar />
      <div className="flex items-center gap-3 border-b border-wds-border px-wds-4 py-3">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-text-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex grow flex-col gap-px">
          <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">Delivery note</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            {note.sequenceLabel}
            {isDriversCopy ? " · driver's copy" : ''}
          </div>
        </div>
        <button type="button" onClick={() => window.open(`/app/inventory/dispatch-print/${note.id}`, '_blank')} className="shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
          Print
        </button>
      </div>

      <div className="m-wds-4 flex flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface">
        <div className="flex flex-col gap-1 border-b border-wds-border p-4">
          <div className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">{note.sequenceLabel}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            Central Store → {DEPARTMENT_LABEL[note.departmentTag] ?? note.departmentTag}, {note.branchName} · {formatDateTime(note.dispatchedAt)}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={'size-1.5 shrink-0 rounded-full ' + tone.dot} />
            <span className={'font-wds-sans text-wds-body-sm ' + tone.text}>{tone.label}</span>
          </div>
        </div>
        <div className="flex flex-col px-4 py-1">
          {note.lines.map((line, i) => (
            <div key={line.inventoryItemId} className={'flex h-9 shrink-0 items-center gap-2 ' + (i < note.lines.length - 1 ? 'border-b border-wds-neutral-100' : '')}>
              <div className="grow font-wds-sans text-wds-body-sm text-wds-text-ink">{line.itemName}</div>
              <div className="font-wds-mono text-wds-caption text-wds-text-copy-muted">
                {line.dispatchedQty} {line.usageUnit}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 border-t border-wds-border p-4">
          <div className="font-wds-signature text-[30px]/8 text-wds-text-ink">{note.dispatchedByName ?? '—'}</div>
          <div className="font-wds-mono text-[10px]/3 text-wds-text-copy-muted">
            Dispatched by Store Manager · {formatDateTime(note.dispatchedAt)}
          </div>
        </div>
      </div>

      {isDriversCopy ? (
        <div className="mx-wds-4 mb-4 flex items-start gap-2 rounded-wds-sm border border-wds-info-border bg-wds-info-bg px-3 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 5" fill="none" stroke="var(--wds-info-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19" fill="none" stroke="var(--wds-info-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="font-wds-sans text-wds-caption text-wds-info-fg">
            This dispatch&apos;s original record lives on the Store Manager&apos;s Dispatch queue (Central Store) — the same {note.sequenceLabel} id links both views.
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface DeliveryNoteScreenProps {
  dispatchId: string;
  /** Mobile-only label variant — the store-side driver's copy vs. the branch-side read view. Session A only ever renders the driver's copy live (branch confirm is Session B). */
  isDriversCopy?: boolean;
}

/**
 * Delivery note — on-screen (`1707-0` desktop, `15JU-0`/`15PX-0` mobile).
 * Shared by the print renderer (`PrintableDeliveryNote`) — one `Dispatch`
 * record, two views (session-a-plan.md decision #5).
 */
export function DeliveryNoteScreen({ dispatchId, isDriversCopy = true }: DeliveryNoteScreenProps) {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { note, status, error, reload } = useDeliveryNote(dispatchId);

  if (!hydrated) return null;

  if (status === 'loading' || !note) {
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Dispatch', screen: 'Delivery note' }} className="shrink-0" />
        <div className="flex flex-col gap-3 px-8 py-8">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    ) : (
      <div className="flex min-h-screen flex-col bg-wds-neutral-50">
        <MobileStatusBar />
        <div className="flex flex-col gap-3 p-wds-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-48 w-full rounded-wds-sm" />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Dispatch', screen: 'Delivery note' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load this delivery note" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    ) : (
      <div className="flex min-h-screen flex-col bg-wds-neutral-50">
        <MobileStatusBar />
        <div className="flex flex-1 items-center justify-center p-wds-4">
          <MobileErrorState title="Couldn't load this delivery note" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  return isDesktop ? <DesktopNote note={note} /> : <MobileNote note={note} isDriversCopy={isDriversCopy} />;
}
