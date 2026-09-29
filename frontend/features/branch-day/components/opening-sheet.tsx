'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { FormErrorBanner, Reveal, SkeletonRows, StockErrorCard, formatClock } from '@/features/inventory';
import { normalizeCount, sanitizeCountInput, trimQty } from '../lib/branch-day-format';
import type { OpeningLine, OpeningView } from '../types/branch-day';

/**
 * Next-morning opening — Review sheet (Paper `1A5R-0`, Flow 12c). The pre-filled figures are last night's close;
 * the department head may recount any item. A recount that differs shows the overnight-variance note (dot + label)
 * and posts as an adjustment when the figures are accepted. Bottom sheet: drag handle, swipe-down dismiss, focus trap.
 */
export interface OpeningSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opening: OpeningView | null;
  loadStatus: 'loading' | 'error' | 'ready';
  onRetryLoad: () => void;
  submitting: boolean;
  error: string | null;
  onAccept: (lines: { inventoryItemId: string; acceptedQty: string }[]) => void;
}

const SWIPE_DISMISS_PX = 90;
const SWIPE_DISMISS_VELOCITY = 0.11;

/** The figure the ledger showed when the sheet was opened, trimmed for display. */
const prefill = (line: OpeningLine): string => trimQty(line.prefilledQty);

function sameQty(a: string, b: string): boolean {
  return Number.parseFloat(a) === Number.parseFloat(b);
}

function Stepper({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled: boolean }) {
  const bump = (delta: number) => {
    const current = Number.parseFloat(normalizeCount(value) ?? '0');
    onChange(String(Math.max(0, Number((current + delta).toFixed(3)))));
  };
  const btn =
    'flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-[2px] border border-wds-border-strong bg-wds-surface font-wds-sans text-[18px]/[22px] text-wds-text-copy-muted outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" className={btn} onClick={() => bump(-1)} disabled={disabled || Number.parseFloat(normalizeCount(value) ?? '0') <= 0} aria-label="Decrease by one">
        −
      </button>
      <input
        value={value}
        onChange={(e) => onChange(sanitizeCountInput(e.target.value))}
        inputMode="decimal"
        aria-label="Recounted quantity"
        disabled={disabled}
        className="h-10 min-w-0 grow basis-0 rounded-[2px] border border-wds-espresso-700 bg-wds-surface text-center font-wds-mono text-[16px]/5 text-wds-text-ink outline-none focus:shadow-wds-ring disabled:opacity-60"
      />
      <button type="button" className={btn} onClick={() => bump(1)} disabled={disabled} aria-label="Increase by one">
        +
      </button>
    </div>
  );
}

export function OpeningSheet({ open, onOpenChange, opening, loadStatus, onRetryLoad, submitting, error, onAccept }: OpeningSheetProps) {
  // Recounts typed so far, by item — only entries that were touched exist; everything else is accepted as pre-filled.
  const [recounts, setRecounts] = React.useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const drag = React.useRef<{ startY: number; startT: number; id: number } | null>(null);
  const firstRowRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      setRecounts({});
      setSelectedId(null);
      setPicking(false);
      setDragY(0);
    }
  }, [open]);

  const lines = opening?.lines ?? [];
  const figure = (line: OpeningLine): string => normalizeCount(recounts[line.inventoryItemId]) ?? prefill(line);
  const changed = lines.filter((l) => l.inventoryItemId in recounts && normalizeCount(recounts[l.inventoryItemId]) !== null && !sameQty(figure(l), l.prefilledQty));

  const choose = (line: OpeningLine) => {
    setPicking(false);
    setSelectedId(line.inventoryItemId);
    setRecounts((prev) => (line.inventoryItemId in prev ? prev : { ...prev, [line.inventoryItemId]: prefill(line) }));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || submitting) return; // ignore a second finger mid-drag
    drag.current = { startY: e.clientY, startT: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const delta = e.clientY - drag.current.startY;
    setDragY(delta < 0 ? delta / 8 : delta); // friction upward instead of a hard stop
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const delta = e.clientY - drag.current.startY;
    const velocity = Math.abs(delta) / Math.max(1, performance.now() - drag.current.startT);
    drag.current = null;
    if (delta >= SWIPE_DISMISS_PX || (delta > 20 && velocity > SWIPE_DISMISS_VELOCITY)) onOpenChange(false);
    else setDragY(0);
  };

  const subtitle = opening?.lastCloseAt
    ? `${opening.departmentName} · pre-filled from last night's close, ${formatClock(opening.lastCloseAt)}`
    : opening
      ? `${opening.departmentName} · pre-filled from the ledger — yesterday wasn't closed`
      : 'Pre-filled from last night’s close';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby="opening-sheet-subtitle"
          // Focus lands on the sheet, not its × (which would show a ring the moment it opens); Tab reaches everything.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          style={{ transform: dragY ? `translateY(${Math.max(dragY, -12)}px)` : undefined, transition: drag.current ? 'none' : undefined }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[480px] flex-col rounded-t-[12px] bg-wds-surface shadow-[0_-8px_24px_rgb(0_0_0/0.12)] outline-none',
            'data-[state=open]:duration-[250ms] data-[state=closed]:duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom motion-reduce:data-[state=closed]:slide-out-to-bottom-0 motion-reduce:data-[state=open]:slide-in-from-bottom-0',
          )}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="flex shrink-0 touch-none justify-center pb-1.5 pt-2.5"
            aria-hidden
          >
            <div className="h-1 w-9 rounded-[2px] bg-wds-border-strong" />
          </div>

          <div className="relative flex shrink-0 flex-col gap-1 px-5 pb-3.5 pt-2">
            <DialogPrimitive.Title className="font-wds-sans text-[18px]/[22px] font-semibold text-wds-text-ink">Review opening</DialogPrimitive.Title>
            <DialogPrimitive.Description id="opening-sheet-subtitle" className="pr-8 font-wds-sans text-[13px]/4 text-wds-text-copy-muted">
              {subtitle}
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close"
              disabled={submitting}
              className="absolute right-3 top-0 flex size-7 items-center justify-center rounded-wds-sm font-wds-sans text-[18px]/[22px] text-wds-text-copy-muted outline-none transition-colors hover:bg-wds-neutral-100 focus-visible:shadow-wds-ring"
            >
              ×
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 grow overflow-y-auto overscroll-contain">
            {error ? (
              <div className="px-5 pb-3">
                <FormErrorBanner title="Couldn't accept the opening figures" description={`${error} Nothing was changed — try again.`} />
              </div>
            ) : null}

            {loadStatus === 'error' && !opening ? (
              <div className="py-6">
                <StockErrorCard title="Couldn't load the opening figures" description="Check your connection and try again." onRetry={onRetryLoad} />
              </div>
            ) : !opening ? (
              <SkeletonRows count={5} label="Loading opening figures">
                {(i) => (
                  <div key={i} className="flex items-center justify-between border-t border-wds-neutral-200 px-5 py-3.5" aria-hidden>
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-2.5 w-8" />
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                )}
              </SkeletonRows>
            ) : lines.length === 0 ? (
              <div className="border-t border-wds-neutral-200 px-5 py-8 text-center">
                <p className="font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">Nothing to open</p>
                <p className="mt-1 font-wds-sans text-[13px]/4 text-wds-text-copy-muted">Last night&apos;s close had no lines for your department.</p>
              </div>
            ) : (
              <>
                {picking ? (
                  <p className="border-t border-wds-neutral-200 px-5 py-2.5 font-wds-sans text-[12px]/4 text-wds-text-copy-muted" role="status">
                    Tap the item you want to recount.
                  </p>
                ) : null}
                <ul>
                  {lines.map((line, i) => {
                    const shown = figure(line);
                    const isChanged = changed.some((c) => c.inventoryItemId === line.inventoryItemId);
                    const isSelected = line.inventoryItemId === selectedId;
                    return (
                      <li key={line.inventoryItemId} className="border-t border-wds-neutral-200">
                        <button
                          ref={i === 0 ? firstRowRef : undefined}
                          type="button"
                          onClick={() => choose(line)}
                          aria-pressed={isSelected}
                          disabled={submitting}
                          className={cn(
                            'flex w-full flex-col gap-2 px-5 py-3.5 text-left outline-none transition-colors duration-150 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)] disabled:cursor-not-allowed',
                            isSelected ? 'bg-wds-neutral-50' : 'hover:bg-wds-neutral-50',
                            picking && !isSelected && 'bg-wds-caramel-100/40',
                          )}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{line.name}</span>
                              <span className="font-wds-sans text-[11px]/[14px] text-wds-text-faint">{line.usageUnit}</span>
                            </span>
                            <span className="shrink-0 font-wds-mono text-[15px]/[18px] text-wds-text-ink">
                              {shown} {line.usageUnit}
                            </span>
                          </span>
                          {isChanged ? (
                            <Reveal>
                              <span className="flex items-center gap-1.5 pb-0.5">
                                <span className="size-[5px] shrink-0 rounded-full bg-wds-warning-fg" aria-hidden />
                                <span className="font-wds-sans text-[12px]/4 text-wds-warning-fg">
                                  Overnight variance — recount ({shown}) differs from last night&apos;s close ({prefill(line)} {line.usageUnit})
                                </span>
                              </span>
                            </Reveal>
                          ) : null}
                        </button>
                        {isSelected ? (
                          <Reveal>
                            <div className="flex flex-col gap-2 bg-wds-neutral-50 px-5 pb-3.5 pt-0.5">
                              <span className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">RECOUNTED QUANTITY</span>
                              <Stepper
                                value={recounts[line.inventoryItemId] ?? prefill(line)}
                                onChange={(next) => setRecounts((prev) => ({ ...prev, [line.inventoryItemId]: next }))}
                                disabled={submitting}
                              />
                            </div>
                          </Reveal>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2.5 border-t border-wds-neutral-200 px-5 pb-7 pt-3.5">
            <button
              type="button"
              onClick={() => onAccept(changed.map((l) => ({ inventoryItemId: l.inventoryItemId, acceptedQty: figure(l) })))}
              disabled={submitting || !opening || lines.length === 0}
              className={cn(
                'flex touch-manipulation items-center justify-center rounded-[2px] p-3.5 font-wds-sans text-[15px]/5 font-semibold outline-none transition-[transform,filter] duration-150 ease-out focus-visible:shadow-wds-ring',
                submitting || !opening || lines.length === 0
                  ? 'cursor-not-allowed bg-wds-neutral-300 text-wds-neutral-600'
                  : 'bg-wds-gradient-primary text-wds-primary-fg shadow-wds-sheen hover:brightness-110 motion-safe:active:scale-[0.98]',
              )}
            >
              {submitting ? 'Accepting…' : 'Accept opening figures'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPicking(true);
                firstRowRef.current?.focus();
              }}
              disabled={submitting || !opening || lines.length === 0}
              className="flex touch-manipulation items-center justify-center rounded-[2px] border border-wds-border-strong p-3.5 font-wds-sans text-[15px]/5 font-medium text-wds-text-ink outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Recount an item
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
