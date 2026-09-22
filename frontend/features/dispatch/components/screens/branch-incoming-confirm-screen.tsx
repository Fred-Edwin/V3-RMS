'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useDeliveries } from '../../hooks/use-deliveries';
import { useDeliveryConfirm } from '../../hooks/use-delivery-confirm';
import { DeliveriesKpiSkeletonDesktop, DeliveriesRailSkeletonDesktop, DeliveryConfirmSkeletonDesktop } from '../skeletons';
import type { DeliveryLine, DeliveryRow, DepartmentTag, DispatchStatus } from '../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

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

function statusDotClass(status: DispatchStatus): string {
  if (status === 'DISCREPANCY_OPEN') return 'bg-wds-error-fg';
  if (status === 'CONFIRMED') return 'bg-wds-success-fg';
  return 'bg-wds-neutral-600'; // IN_TRANSIT
}

function statusLine(row: DeliveryRow): { text: string; tone: string } {
  if (row.status === 'DISCREPANCY_OPEN') {
    return { text: `Discrepancy open · ${formatAgo(row.dispatchedAt ?? row.confirmedAt ?? new Date().toISOString())}`, tone: 'text-wds-error-fg' };
  }
  if (row.status === 'CONFIRMED') {
    return { text: 'Confirmed', tone: 'text-wds-text-copy-muted' };
  }
  // IN_TRANSIT — "arrived, unconfirmed" isn't distinguishable from "still on the road" by status
  // alone; both render as in-transit until confirmed. dispatchedAt anchors the "ago" clock.
  return { text: `In transit · ${row.dispatchedAt ? formatAgo(row.dispatchedAt) : ''}`, tone: 'text-wds-text-copy-muted' };
}

interface ConfirmLineRowProps {
  line: DeliveryLine;
  onChange: (value: string) => void;
  readOnly: boolean;
}

function ConfirmLineRow({ line, onChange, readOnly }: ConfirmLineRowProps) {
  const requested = line.requestedQty ?? '—';
  const mismatched = line.confirmedQty !== null && Number(line.confirmedQty) !== Number(line.dispatchedQty);

  return (
    <div className="flex items-center gap-3 border-t border-t-solid border-t-wds-neutral-200 py-2.5">
      <div className="min-w-0 grow basis-0 font-wds-sans text-wds-body-sm text-wds-text-ink">{line.itemName}</div>
      <div className="w-20 shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{requested}</div>
      <div className="w-20 shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{line.dispatchedQty}</div>
      <div className="w-[110px] shrink-0 flex justify-end pr-2">
        {readOnly ? (
          <span className={'font-wds-mono text-wds-body-sm ' + (mismatched ? 'font-semibold text-wds-primary' : 'text-wds-text-ink')}>
            {line.confirmedQty ?? '—'}
          </span>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Confirmed quantity for ${line.itemName}`}
            value={line.confirmedQty ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={
              'w-16 rounded-wds-sm border py-0.5 px-2 text-right font-wds-mono text-wds-body-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-wds-primary focus-visible:ring-offset-1 ' +
              (mismatched ? 'border-wds-primary text-wds-primary' : 'border-transparent text-wds-text-ink')
            }
          />
        )}
      </div>
    </div>
  );
}

export interface BranchIncomingConfirmScreenProps {
  dispatchId?: string;
}

/**
 * Branch desktop master-detail (`168U-0`) — deliveries rail + confirm
 * detail. Same measured shape as Session A's `DispatchQueueFulfilScreen`:
 * rail 380px (Paper: w-95 = 380px), Item/Requested(80px)/Dispatched(80px)/
 * Confirmed(110px) columns. Branch Manager sees every department and can
 * confirm-on-behalf; Department Head sees only their own department (guard
 * enforced server-side, this screen simply renders what the API returns).
 */
export function BranchIncomingConfirmScreen({ dispatchId }: BranchIncomingConfirmScreenProps) {
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((s) => s.role);
  const isManager = role === 'MANAGER';

  const deliveries = useDeliveries();
  const { detail, visibleLines, setLineEdit, confirm, confirmOnBehalf, confirming, confirmError, status, error, reload } =
    useDeliveryConfirm(dispatchId ?? '');

  const [signing, setSigning] = React.useState(false);

  const inTransitCount = deliveries.rows.filter((r) => r.status === 'IN_TRANSIT').length;
  const unconfirmedCount = deliveries.rows.filter((r) => r.status === 'IN_TRANSIT' && r.dispatchedAt && Date.now() - new Date(r.dispatchedAt).getTime() > 2 * 60 * 60 * 1000).length;
  const discrepancyOpenRows = deliveries.rows.filter((r) => r.status === 'DISCREPANCY_OPEN');

  const kpis = [
    { label: 'In transit', value: String(inTransitCount), detail: 'on the road' },
    { label: 'Unconfirmed', value: String(unconfirmedCount), detail: 'arrived > 2h ago', accent: unconfirmedCount > 0 },
    {
      label: 'Discrepancy open',
      value: String(discrepancyOpenRows.length),
      detail: discrepancyOpenRows[0] ? `${DEPARTMENT_LABEL[discrepancyOpenRows[0].departmentTag]} · with Store Manager` : 'none open',
      error: discrepancyOpenRows.length > 0,
    },
  ];

  const handleSign = async (pin: string) => {
    const ok = isManager ? await confirmOnBehalf(pin) : await confirm(pin);
    if (ok) {
      setSigning(false);
      await deliveries.reload();
    }
  };

  const mismatchCount = detail ? visibleLines.filter((l) => Number(l.confirmedQty) !== Number(l.dispatchedQty)).length : 0;
  const matchCount = visibleLines.length - mismatchCount;

  if (!hydrated) return null;

  if (!isDesktop) {
    return null; // mobile screens (15L1-0/15I4-0/etc.) render via a separate route-level check
  }

  if (deliveries.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Branch', screen: 'Deliveries' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load deliveries" description="Check your connection and try again." onRetry={deliveries.reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Branch', screen: 'Deliveries' }}
        actions={
          isManager ? (
            <Button variant="secondary" onClick={() => router.push('/app/branch/deliveries/discrepancies')}>
              Discrepancies
            </Button>
          ) : undefined
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-1 px-8 pb-5 pt-7">
          <h1 className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Deliveries</h1>
          <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            What&apos;s arriving and what&apos;s still unconfirmed, across all five departments.
          </p>
        </div>

        {deliveries.status === 'loading' ? (
          <DeliveriesKpiSkeletonDesktop className="mx-8 mb-5" />
        ) : (
          <div className="mx-8 mb-5 flex overflow-hidden rounded-wds-sm border border-wds-border">
            {kpis.map((kpi, i) => (
              <div key={kpi.label} className={'flex grow basis-0 flex-col gap-1.5 px-5 py-4 ' + (i > 0 ? 'border-l border-l-wds-border' : '')}>
                <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">{kpi.label}</div>
                <div
                  className={
                    'font-wds-mono text-wds-kpi font-semibold ' +
                    (kpi.error ? 'text-wds-error-fg' : kpi.accent ? 'text-wds-warning-fg' : 'text-wds-text-ink')
                  }
                >
                  {kpi.value}
                </div>
                <div className="font-wds-sans text-wds-caption text-wds-text-faint">{kpi.detail}</div>
              </div>
            ))}
          </div>
        )}

        {discrepancyOpenRows.length > 0 ? (
          <div className="mx-8 mb-5 flex items-center gap-2">
            <div className="size-1.5 shrink-0 rounded-full bg-wds-error-fg" />
            <div className="font-wds-sans text-wds-body-sm text-wds-error-fg">
              {discrepancyOpenRows.length} open discrepanc{discrepancyOpenRows.length === 1 ? 'y' : 'ies'} · with Store Manager
            </div>
            <a href="/app/inventory/discrepancies" className="font-wds-sans text-wds-body-sm text-wds-primary underline decoration-wds-primary underline-offset-2">
              View discrepancies →
            </a>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 border-t border-t-solid border-t-wds-neutral-800">
          <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-r-solid border-r-wds-neutral-800">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Today</div>
            </div>
            {deliveries.status === 'loading' ? (
              <DeliveriesRailSkeletonDesktop />
            ) : deliveries.rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Nothing incoming today.</div>
              </div>
            ) : (
              deliveries.rows.map((row) => {
                const s = statusLine(row);
                const href = `/app/branch/deliveries?id=${row.id}`;
                return (
                  <a
                    key={row.id}
                    href={href}
                    onClick={(e) => {
                      // Plain left-click: client-side query update, no full page reload.
                      // Cmd/Ctrl/middle-click fall through to the browser's native
                      // open-in-new-tab handling via the real href.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      router.push(href, { scroll: false });
                    }}
                    className={
                      'flex cursor-pointer flex-col gap-1 border-l-2 border-l-solid px-4 py-3 transition-colors hover:bg-wds-neutral-100 ' +
                      (row.id === dispatchId ? 'border-l-wds-primary bg-wds-neutral-100' : 'border-l-transparent')
                    }
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[row.departmentTag]}</div>
                      <div className="font-wds-mono text-wds-caption text-wds-text-copy-muted">{row.sequenceLabel.split('·')[0]?.trim()}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={'size-1.5 shrink-0 rounded-full ' + statusDotClass(row.status)} />
                      <div className={'font-wds-sans text-wds-caption ' + s.tone}>{s.text}</div>
                    </div>
                  </a>
                );
              })
            )}
          </div>

          <div className="flex min-w-0 grow basis-0 flex-col overflow-y-auto">
            {!dispatchId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-[120px]">
                <div className="font-wds-sans text-wds-section font-medium text-wds-text-ink">Select a delivery</div>
                <div className="max-w-[280px] text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                  Choose one from the list to confirm what actually arrived.
                </div>
              </div>
            ) : status === 'loading' ? (
              <DeliveryConfirmSkeletonDesktop />
            ) : status === 'error' ? (
              <div className="flex flex-1 items-center justify-center">
                <ErrorState title="Couldn't load this delivery" description={error ?? 'Try again.'} onRetry={reload} />
              </div>
            ) : !detail ? null : (
              <>
                <div className="flex items-start justify-between pt-5 pb-4 px-8">
                  <div className="flex flex-col gap-1">
                    <div className="font-wds-sans text-[20px]/6 font-semibold tracking-tight text-wds-text-ink">
                      {DEPARTMENT_LABEL[detail.departmentTag]} · {detail.sequenceLabel.split('·')[0]?.trim()}
                    </div>
                    <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                      {detail.status === 'IN_TRANSIT'
                        ? isManager
                          ? `Arrived ${detail.dispatchedAt ? formatAgo(detail.dispatchedAt) : ''}. Enter what actually arrived on their behalf.`
                          : `Arrived ${detail.dispatchedAt ? formatAgo(detail.dispatchedAt) : ''}. Enter what actually arrived.`
                        : detail.status === 'CONFIRMED'
                          ? `Confirmed by ${detail.confirmedByName ?? 'the department'}${detail.confirmedOnBehalf ? ' on behalf of the department' : ''}.`
                          : `Confirmed with a discrepancy — under review by the Store Manager.`}
                    </div>
                  </div>
                </div>

                {isManager && detail.status === 'IN_TRANSIT' ? (
                  <div className="mb-4 mx-8 flex items-center gap-2 rounded-wds-sm py-2.5 px-3.5">
                    <div className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
                    <div className="font-wds-sans text-wds-body-sm text-wds-warning-fg">
                      You&apos;re confirming on the department&apos;s behalf. Your name is recorded as the real signer.
                    </div>
                  </div>
                ) : null}

                {confirmError ? (
                  <div className="mx-8 mb-2 rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5">
                    <div className="font-wds-sans text-wds-caption text-wds-error-fg">{confirmError}</div>
                  </div>
                ) : null}

                <div className="flex flex-col grow basis-0 min-h-0 mb-6 border-t border-t-solid border-t-wds-neutral-800 mx-8">
                  <div className="flex items-center pt-3.5 pb-1.5 gap-3">
                    <div className="grow basis-0 min-w-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Item
                    </div>
                    <div className="w-20 shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Requested
                    </div>
                    <div className="w-20 shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Dispatched
                    </div>
                    <div className="w-[110px] shrink-0 text-right pr-2 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Confirmed
                    </div>
                  </div>

                  {visibleLines.map((line) => (
                    <ConfirmLineRow
                      key={line.dispatchLineId}
                      line={line}
                      onChange={(v) => setLineEdit(line.dispatchLineId, v)}
                      readOnly={detail.status !== 'IN_TRANSIT'}
                    />
                  ))}

                  <div aria-live="polite">
                    {mismatchCount > 0 ? (
                      <div className="mt-3.5 flex items-center gap-2 rounded-wds-sm py-2.5 px-3.5">
                        <div className="size-1.5 shrink-0 rounded-full bg-wds-error-fg" />
                        <div className="font-wds-sans text-wds-body-sm text-wds-error-fg">
                          {mismatchCount} line{mismatchCount === 1 ? '' : 's'} confirming a different quantity than dispatched raises a transit
                          discrepancy — Store Manager will review the gap.
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-t-solid border-t-wds-neutral-200">
                    <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                      {visibleLines.length} line{visibleLines.length === 1 ? '' : 's'} · {matchCount} match
                      {mismatchCount > 0 ? ` · ${mismatchCount} short` : ''}
                      {detail.status === 'IN_TRANSIT' ? (
                        <>
                          <br />
                          {isManager ? 'Signing moves stock in and records you as the real signer' : 'Signing moves stock into your department'}
                        </>
                      ) : null}
                    </div>
                    {detail.status === 'IN_TRANSIT' ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => reload()} disabled={confirming}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => setSigning(true)} disabled={confirming}>
                          {isManager ? 'Sign & confirm on behalf' : 'Sign & confirm'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <SignSheetDialog
        open={signing}
        onOpenChange={setSigning}
        title={isManager ? 'Sign to confirm on behalf' : 'Sign to confirm'}
        subtitle="Enter your PIN to sign and confirm this delivery."
        helperText="Signing moves stock into your department's balance."
        confirmLabel={isManager ? 'Sign & confirm on behalf' : 'Sign & confirm'}
        onSubmit={handleSign}
        submitting={confirming}
        error={confirmError ?? undefined}
      />
    </div>
  );
}
