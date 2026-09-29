'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { FormErrorBanner, STOCK_DRAWER_MOTION, StockMobileHeader, formatClock, formatCountDateLong, useReturnFocus } from '@/features/inventory';
import type { BranchDayToday } from '../types/branch-day';

/**
 * Reopen a closed day — desktop drawer `19PY-0`, mobile `1BYP-0`. A reason is
 * required (the button stays disabled until there is one); every reopen is
 * recorded — who, when, why. The warning explains the append-only reversal so
 * nobody expects the ledger to be rewritten.
 */
const REASON_MAX = 500;

export interface ReopenDayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'desktop' | 'mobile';
  today: BranchDayToday;
  actor: { name: string; roleLabel: string };
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string) => Promise<boolean>;
}

function ReopenBody({ reason, setReason, busy, error, actor, mobile }: { reason: string; setReason: (v: string) => void; busy: boolean; error: string | null; actor: ReopenDayProps['actor']; mobile: boolean }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-4">
      {error ? <FormErrorBanner title="Couldn't reopen the day" description="The day is still closed. Your reason is kept — try again." /> : null}
      <div className={cn('flex gap-2 border border-wds-warning-border bg-wds-warning-bg', mobile ? 'rounded-[4px] p-3.5' : 'rounded-wds-sm px-4 py-3.5')}>
        <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-wds-warning-fg" aria-hidden />
        <p className="font-wds-sans text-[13px]/[18px] text-wds-warning-fg">
          This will recompute today&apos;s adjustments. Superseded entries are reversed with linked ledger rows — the ledger stays append-only, nothing is deleted. Tomorrow&apos;s opening figures will also be recomputed if already populated.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={cn('text-[11px]/[14px] text-wds-error-fg', mobile ? 'font-wds-mono tracking-[0.04em]' : 'font-wds-sans font-semibold uppercase')}>
          {mobile ? 'REASON — REQUIRED' : 'Reason — required'}
        </label>
        <textarea
          id={id}
          data-reopen-reason
          value={reason}
          maxLength={REASON_MAX}
          rows={3}
          disabled={busy}
          placeholder="e.g. Kitchen's count was entered against the wrong department by mistake — needs correcting before month-end."
          onChange={(e) => setReason(e.target.value)}
          className={cn('resize-none border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px]/[18px] text-wds-text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring disabled:opacity-60', mobile ? 'rounded-[4px] py-3' : 'rounded-wds-sm py-2.5')}
        />
      </div>
      <p className={cn('bg-wds-neutral-50 px-3 py-3 font-wds-sans text-wds-text-copy-muted', mobile ? 'rounded-[4px] text-[12px]/4' : 'rounded-wds-sm text-[12px]/[17px]')}>
        Reopening as {actor.name}, {actor.roleLabel}. Every reopen is recorded — who, when, why — and visible on the Director&apos;s report.
      </p>
    </div>
  );
}

export function ReopenDay({ open, onOpenChange, variant, today, actor, busy, error, onSubmit }: ReopenDayProps) {
  const [reason, setReason] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const returnFocus = useReturnFocus();

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const dirty = reason.trim().length > 0;
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const requestClose = React.useCallback(() => {
    if (busy) return;
    if (dirty) setConfirmOpen(true);
    else close();
  }, [busy, dirty, close]);

  const submit = async (): Promise<void> => {
    if (!dirty || busy) return;
    const ok = await onSubmit(reason.trim());
    if (ok) close();
  };

  const dateLong = formatCountDateLong(today.date);
  const closedLine = `Closed ${today.closedAt ? formatClock(today.closedAt) : ''} by ${today.closedBy?.name ?? '—'}`;
  const label = busy ? 'Reopening…' : 'Reopen day';
  const confirm = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard this reason?"
      description="The day will stay closed."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => {
        setConfirmOpen(false);
        close();
      }}
    />
  );

  if (variant === 'mobile') {
    if (!open) return null;
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Reopen ${dateLong}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') requestClose();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-wds-canvas motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-[250ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <MobileStatusBar className="bg-wds-sidebar-top" />
          <StockMobileHeader title={`Reopen ${dateLong}`} subtitle={closedLine} onBack={requestClose} trailingLabel="Cancel" onTrailing={requestClose} />
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
            <ReopenBody reason={reason} setReason={setReason} busy={busy} error={error} actor={actor} mobile />
          </div>
          <div className="border-t border-wds-border px-4 pb-6 pt-3.5">
            <Button variant="destructive" className="h-11 w-full !rounded-[4px] text-[15px]/[18px] font-semibold" disabled={!dirty || busy} aria-busy={busy} onClick={() => void submit()}>
              {label}
            </Button>
          </div>
        </div>
        {confirm}
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <SheetContent
          className={cn('flex w-[440px] flex-col gap-0 p-0 [&>button:first-of-type]:hidden', STOCK_DRAWER_MOTION)}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onCloseAutoFocus={returnFocus.restore}
          onOpenAutoFocus={(e) => {
            returnFocus.capture();
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLTextAreaElement>('[data-reopen-reason]')?.focus();
          }}
        >
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-wds-border px-6 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Reopen {dateLong}</SheetTitle>
              <SheetPrimitive.Close
                onClick={(e) => {
                  e.preventDefault();
                  requestClose();
                }}
                aria-label="Close"
                className="-m-1.5 rounded-wds-sm p-1.5 font-wds-sans text-[16px]/5 text-wds-text-faint outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
              >
                <span aria-hidden>×</span>
              </SheetPrimitive.Close>
            </div>
            <SheetDescription className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{closedLine}</SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <ReopenBody reason={reason} setReason={setReason} busy={busy} error={error} actor={actor} mobile={false} />
          </div>
          <div className="flex shrink-0 gap-2 border-t border-wds-border px-6 py-4">
            <Button variant="secondary" className="h-11 grow basis-0" onClick={requestClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" className="h-11 grow basis-0" onClick={() => void submit()} disabled={!dirty || busy} aria-busy={busy}>
              {label}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {confirm}
    </>
  );
}
