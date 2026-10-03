'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { useAuthStore } from '@/store/authStore';
import { useDeliveryConfirm } from '../../hooks/use-delivery-confirm';
import { DispatchFulfilSkeletonMobile } from '../skeletons';
import type { DeliveryLine } from '../../types';

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
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

interface ConfirmLineCardProps {
  line: DeliveryLine & { confirmedQty: string };
  onChange: (value: string) => void;
}

function ConfirmLineCard({ line, onChange }: ConfirmLineCardProps) {
  const dispatched = Number(line.dispatchedQty);
  const confirmed = Number(line.confirmedQty);
  const short = confirmed < dispatched;
  const shortBy = short ? dispatched - confirmed : 0;
  const canDecrement = confirmed > 0;
  const canIncrement = confirmed < dispatched;

  const step = (delta: number) => {
    const next = Math.max(0, confirmed + delta);
    onChange(String(next));
  };

  return (
    <div className={'flex flex-col gap-1.5 rounded-wds-sm border bg-wds-surface px-3.5 py-3 ' + (short ? 'border-wds-error-border' : 'border-wds-border')}>
      <div className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{line.itemName}</div>
      <div className="flex items-center justify-between">
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">dispatched {line.dispatchedQty}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canDecrement}
            aria-label={`Decrease confirmed quantity for ${line.itemName}`}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-wds-sm border border-wds-border-strong font-wds-mono text-[16px]/5 text-wds-text-copy-muted transition-colors active:bg-wds-neutral-100 disabled:opacity-40"
          >
            −
          </button>
          <div
            className={
              'flex h-[30px] w-11 shrink-0 items-center justify-center rounded-wds-sm border font-wds-mono text-[16px]/5 font-medium ' +
              (short ? 'border-wds-error-fg text-wds-error-fg' : 'border-wds-border-strong text-wds-text-ink')
            }
          >
            {line.confirmedQty}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canIncrement}
            aria-label={`Increase confirmed quantity for ${line.itemName}`}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-wds-sm border border-wds-border-strong font-wds-mono text-[16px]/5 text-wds-text-copy-muted transition-colors active:bg-wds-neutral-100 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      {short ? (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="size-1.5 shrink-0 rounded-full bg-wds-error-fg" />
          <span className="font-wds-sans text-wds-caption text-wds-error-fg">
            {shortBy} short — will raise a transit discrepancy
          </span>
        </div>
      ) : null}
    </div>
  );
}

export interface ConfirmReceiptScreenMobileProps {
  dispatchId: string;
}

/**
 * Branch mobile Confirm receipt (`15I4-0` populated, `15MG-0` mid-signature,
 * `15OP-0` signed) — one component, three states, same
 * `dispatch-fulfil-screen-mobile.tsx` pattern. Confirmed qty pre-fills at
 * dispatchedQty (arrived-as-sent is the common case); a stepper down opens a
 * discrepancy automatically on sign, never a blocking validation error.
 */
export function ConfirmReceiptScreenMobile({ dispatchId }: ConfirmReceiptScreenMobileProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'MANAGER';
  const { detail, visibleLines, setLineEdit, confirm, confirmOnBehalf, confirming, confirmError, lastDeliveryNote, status, error, reload } =
    useDeliveryConfirm(dispatchId);

  const [signOpen, setSignOpen] = React.useState(false);

  if (status === 'loading' || !detail) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <DispatchFulfilSkeletonMobile />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <div className="flex flex-1 items-center justify-center p-wds-4">
          <MobileErrorState title="Couldn't load this delivery" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  const departmentLabel = DEPARTMENT_LABEL[detail.departmentTag] ?? detail.departmentTag;

  // Signed state (15OP-0) — read-only receipt once confirmed on this visit.
  if (lastDeliveryNote) {
    const mismatchLines = lastDeliveryNote.lines.filter((l) => l.dispatchedQty !== visibleLines.find((v) => v.inventoryItemId === l.inventoryItemId)?.confirmedQty);
    const hasDiscrepancy = lastDeliveryNote.status === 'DISCREPANCY_OPEN';
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <div className="flex items-center gap-3 border-b border-wds-border px-wds-4 py-3">
          <button type="button" onClick={() => router.push('/app/branch/deliveries')} aria-label="Back" className="shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-text-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex grow flex-col gap-px">
            <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">{lastDeliveryNote.sequenceLabel} confirmed</div>
            <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Signed receipt · {departmentLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => window.open(`/app/inventory/dispatch-print/${lastDeliveryNote.id}`, '_blank')}
            className="shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted"
          >
            Print
          </button>
        </div>

        <div className="flex flex-col gap-3 p-wds-4">
          <div className="flex flex-col gap-1.5 rounded-wds-sm border border-wds-border bg-wds-surface p-3.5">
            <div className="font-wds-sans text-section font-semibold text-wds-text-ink">Received into {departmentLabel}</div>
            <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              from Central Store · {lastDeliveryNote.sequenceLabel}
            </div>
            {hasDiscrepancy ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-wds-error-fg" />
                <span className="font-wds-sans text-wds-caption text-wds-error-fg">
                  Discrepancy raised
                  {mismatchLines.length > 0 ? ` · ${mismatchLines.map((l) => l.itemName).join(', ')}` : ''}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col rounded-wds-sm border border-wds-border bg-wds-surface px-3.5 py-0.5">
            {lastDeliveryNote.lines.map((line, i) => {
              const visible = visibleLines.find((v) => v.inventoryItemId === line.inventoryItemId);
              const short = visible ? Number(visible.confirmedQty) < Number(line.dispatchedQty) : false;
              return (
                <div
                  key={line.inventoryItemId}
                  className={'flex h-10 shrink-0 items-center gap-2 ' + (i < lastDeliveryNote.lines.length - 1 ? 'border-b border-wds-neutral-100' : '')}
                >
                  <div className={'grow font-wds-sans text-wds-body-sm ' + (short ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{line.itemName}</div>
                  <div className="font-wds-mono text-wds-caption text-wds-text-copy-muted">dispatched {line.dispatchedQty}</div>
                  <div className={'w-[60px] shrink-0 text-right font-wds-mono text-wds-caption ' + (short ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                    {visible?.confirmedQty ?? line.dispatchedQty} recv.
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-0.5 rounded-wds-sm border border-wds-border bg-wds-surface p-3.5">
            <div className="font-wds-signature text-[30px]/8 text-wds-text-ink">{lastDeliveryNote.confirmedByName ?? user?.name ?? '—'}</div>
            <div className="font-wds-mono text-[10px]/3 text-wds-text-copy-muted">
              Signed by {lastDeliveryNote.confirmedOnBehalf ? 'Branch Manager (on behalf)' : 'Department Head'} · {formatDateTime(lastDeliveryNote.confirmedAt)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fullCount = visibleLines.filter((l) => Number(l.confirmedQty) >= Number(l.dispatchedQty)).length;
  const shortCount = visibleLines.length - fullCount;

  const handleSign = async (pin: string) => {
    const ok = isManager ? await confirmOnBehalf(pin) : await confirm(pin);
    if (ok) setSignOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-wds-canvas">
      <MobileStatusBar />
      <div className="flex items-center gap-3 border-b border-wds-border px-wds-4 py-3">
        <button type="button" onClick={() => router.push('/app/branch/deliveries')} aria-label="Back" className="shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-text-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex grow flex-col gap-px">
          <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">Confirm {departmentLabel} receipt</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{detail.sequenceLabel} from Central Store</div>
        </div>
        <button type="button" onClick={() => router.push('/app/branch/deliveries')} className="shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-wds-4">
        <div className="pb-1 font-wds-sans text-wds-caption text-wds-text-copy-muted">
          Confirm what actually arrived. A mismatch from dispatched raises a discrepancy automatically.
        </div>
        {confirmError ? (
          <div className="rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5">
            <div className="font-wds-sans text-wds-caption text-wds-error-fg">{confirmError}</div>
          </div>
        ) : null}
        {visibleLines.map((line) => (
          <ConfirmLineCard key={line.inventoryItemId} line={line} onChange={(v) => setLineEdit(line.dispatchLineId, v)} />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-wds-border bg-wds-surface px-wds-4 pb-5 pt-3.5">
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          {visibleLines.length} line{visibleLines.length === 1 ? '' : 's'} · {fullCount} match{shortCount > 0 ? ` · ${shortCount} short` : ''}
        </div>
        <button
          type="button"
          onClick={() => setSignOpen(true)}
          disabled={confirming}
          className="flex items-center justify-center rounded-wds-sm bg-wds-gradient-primary p-3.5 shadow-wds-sheen disabled:opacity-60"
        >
          <span className="font-wds-sans text-wds-body font-medium text-white">Confirm &amp; sign receipt</span>
        </button>
        <div className="text-center font-wds-sans text-wds-caption text-wds-text-faint">
          Signing commits stock in and flags any short line for the Store Manager
        </div>
      </div>

      <SignSheetDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Sign this receipt"
        subtitle={`${departmentLabel} · ${detail.branchName} — ${visibleLines.length} line${visibleLines.length === 1 ? '' : 's'}${shortCount > 0 ? `, ${shortCount} short` : ''}. Enter your PIN to commit.`}
        helperText="Signing commits stock into your department."
        confirmLabel="Sign & confirm"
        onSubmit={handleSign}
        submitting={confirming}
        error={confirmError ?? undefined}
      />
    </div>
  );
}
