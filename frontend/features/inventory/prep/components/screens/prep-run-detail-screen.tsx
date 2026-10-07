'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { StatusDot, type StatusTone } from '@/components/ui2/status-dot';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui2/sheet';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { usePrepRunDetail } from '../../hooks/use-prep-run-detail';
import type { PrepRunDetail } from '../../types/prep';

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "+0.5 L · normal" / "-5 L · low yield" — same convention as the list/History VS AVERAGE column (`ZMU-0`'s top strip). */
function YieldVsAverageDot({ run }: { run: PrepRunDetail }) {
  const label =
    !run.yieldVarianceLabel || run.yieldVarianceLabel === 'normal'
      ? 'normal'
      : run.yieldVarianceLabel === 'low yield'
        ? 'low yield'
        : 'high yield';
  const tone: StatusTone = label === 'normal' ? 'neutral' : 'warning';
  return (
    <StatusDot tone={tone}>
      {run.yieldVarianceDelta ? `${run.yieldVarianceDelta}${run.yieldUnit} · ` : ''}
      {label}
    </StatusDot>
  );
}

/**
 * Read-only line list for a signed Prep run — matches `ZMU-0`'s
 * "INPUT CONSUMED / QTY / COST" table (grow item-name + two fixed-width
 * numeric columns), built inline here, not as a shared component —
 * 04-components.md's Milestone Three section says a third consumer would
 * justify extracting it, and there isn't one.
 */
function PrepRunInputLineList({ lines, costsHidden }: { lines: PrepRunDetail['inputLines']; costsHidden: boolean }) {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-wds-sm border border-wds-border">
      <div className="flex h-[34px] shrink-0 items-center border-b border-wds-text-ink px-wds-3">
        <span className="grow font-wds-mono text-[10px] font-semibold uppercase tracking-wide text-wds-text-ink">Input consumed</span>
        <span className="w-[110px] shrink-0 text-right font-wds-mono text-[10px] font-semibold uppercase tracking-wide text-wds-text-ink">Qty</span>
        {costsHidden ? null : <span className="w-[90px] shrink-0 text-right font-wds-mono text-[10px] font-semibold uppercase tracking-wide text-wds-text-ink">Cost</span>}
      </div>
      <div className="flex flex-col">
        {(lines ?? []).map((line, index) => (
          <div
            key={`${line.itemName}-${index}`}
            className="flex h-10 shrink-0 items-center border-b border-wds-neutral-100 px-wds-3 last:border-b-0"
          >
            <span className="grow min-w-0 truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={line.itemName}>
              {line.itemName}
            </span>
            <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
              {line.quantity} {line.unit}
            </span>
            {costsHidden ? null : (
              <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">
                KES {line.lineCost}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrepRunDetailBody({ run }: { run: PrepRunDetail }) {
  return (
    <>
      {/* When / Recorded by / Yield vs average — ZMU-0's top 3-column strip. */}
      <div className="flex gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">When</span>
          <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">{formatDate(run.createdAt)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Recorded by</span>
          <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{run.createdByName}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Yield vs average</span>
          <YieldVsAverageDot run={run} />
        </div>
      </div>

      <div className="flex flex-col gap-wds-4 overflow-y-auto py-5">
        <div className="flex flex-col gap-wds-1.5 rounded-wds-sm border border-wds-border bg-wds-neutral-50 px-wds-4 py-3.5">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Output produced</span>
          <div className="flex items-baseline justify-between">
            <span className="font-wds-sans text-wds-section font-medium text-wds-text-ink">{run.outputName}</span>
            <span className="font-wds-mono text-[18px] text-wds-text-ink">
              {run.actualYield} {run.yieldUnit}
            </span>
          </div>
        </div>

        <PrepRunInputLineList lines={run.inputLines} costsHidden={run.costsHidden} />

        {run.typicalYieldAtRunTime ? (
          <div className="flex items-start gap-wds-2 rounded-wds-md border border-wds-info-border bg-wds-info-bg px-wds-3 py-wds-2.5">
            <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-wds-info-fg" aria-hidden />
            <span className="font-wds-sans text-wds-caption text-wds-info-fg">
              Typical for this output at the time of this run: ~{run.typicalYieldAtRunTime}
              {run.yieldUnit}. Shown for context only — yield is never validated against it.
            </span>
          </div>
        ) : null}
      </div>

      {run.costsHidden ? null : (
        <div className="flex flex-col gap-wds-1.5 border-t border-wds-border pt-wds-3">
          <div className="flex items-baseline justify-between">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Output unit cost</span>
            <span className="font-wds-mono text-wds-body text-wds-text-ink">
              KES {run.outputUnitCost} / {run.yieldUnit}
            </span>
          </div>
          <span className="font-wds-sans text-wds-field-label text-wds-text-faint">
            = Σ input cost KES {Number(run.totalInputCost).toLocaleString()} ÷ {run.actualYield} {run.yieldUnit}. No signature — the ledger records who and when.
          </span>
        </div>
      )}
    </>
  );
}

export interface PrepRunDetailDrawerProps {
  /** `null` = closed; `open` gates rendering (same convention as `ItemFormDrawer`). */
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'desktop' | 'mobile';
}

/**
 * Prep run detail — screen 3 (desktop drawer `ZMU-0` / mobile `ZUK-0`).
 * Immutable, read-only, no primary action — built as a thin wrapper directly
 * over `Sheet` (desktop) / a full-screen overlay (mobile), not `DrawerShell`
 * (per 04-components.md's Milestone Three reuse audit). Mounted inline from
 * `PrepRunsListScreen` / `PrepHistoryScreen`, same pattern as `ItemFormDrawer`
 * from `ItemCatalogScreen` — local open/close state, not a route.
 */
export function PrepRunDetailDrawer({ runId, open, onOpenChange, variant }: PrepRunDetailDrawerProps) {
  const { run, status, error, reload } = usePrepRunDetail(runId ?? '');

  if (!open || !runId) return null;

  // status === 'ready' is not enough on its own to trust `run` — a stale
  // 'ready' from the previous runId can otherwise render for one tick while
  // switching between rows without closing the drawer in between. Require
  // both.
  const content =
    status === 'error' ? (
      variant === 'desktop' ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <ErrorState title="Couldn't load this prep run" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      ) : (
        <MobileErrorState title="Couldn't load this prep run" description={error ?? 'Try again.'} onRetry={reload} />
      )
    ) : status === 'ready' && run ? (
      <PrepRunDetailBody run={run} />
    ) : (
      <div className="flex flex-1 items-center justify-center py-10">
        <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Loading…</span>
      </div>
    );

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title={run ? `Prep run · ${run.outputName}` : 'Prep run'}
          subtitle="Immutable ledger record — corrections are a new adjustment, not an edit."
          trailingAction="Done"
          onBack={() => onOpenChange(false)}
          onTrailingAction={() => onOpenChange(false)}
        />
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto p-wds-4', run ? 'gap-4' : '')}>{content}</div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{run ? `Prep run · ${run.outputName}` : 'Prep run'}</SheetTitle>
          <SheetDescription>Immutable ledger record — corrections are a new adjustment, not an edit.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-wds-6 pt-wds-4">{content}</div>
        {run ? (
          <SheetFooter className="!justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
