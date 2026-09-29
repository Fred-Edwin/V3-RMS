import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';

/**
 * Milestone Six States kit — Paper `1I6L-0` ("one kit, every screen"). Every
 * Session 1–4 screen builds loading / empty / error from these pieces plus
 * the per-screen copy in `milestone-6-plan.md` §0.1; there are no per-screen
 * state artboards. Rules from the kit:
 *  1. Chrome (nav, top bar, title, filters, primary actions) never skeletons.
 *  2. Loading: only the data area swaps — KPI "—" + sub-line bar, matching
 *     rows (same count as a typical page), footers say "Loading …". No spinners.
 *  3. Empty: one card where the data would be; keep table headers.
 *  4. Page error: one error card replaces the data area, ends in Retry.
 *  5. Drawer/sheet/form error: banner at the top of the body, input kept,
 *     primary button retries.
 * Sizes are the kit's own (`1I74-0`, `1I8O-0`).
 */

/* ------------------------------------------------------------ loading */

/** Desktop table row — 44px, name bar + trailing column bars. `widths` are the trailing bars in px. */
export function TableRowSkeleton({ widths = [96, 64, 48, 56, 90], nameWidth = 180, className }: { widths?: number[]; nameWidth?: number; className?: string }) {
  return (
    <div className={cn('flex h-11 shrink-0 items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0', className)} aria-hidden>
      <Skeleton className="h-3 shrink-0" style={{ width: nameWidth }} />
      <div className="grow" />
      {widths.map((w, i) => (
        <Skeleton key={i} className="h-3 shrink-0" style={{ width: w }} />
      ))}
    </div>
  );
}

/** Desktop list row — 52px, two lines (55% / 35%). */
export function ListRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-[52px] shrink-0 flex-col justify-center gap-2 border-b border-wds-neutral-100 px-wds-4 last:border-b-0', className)} aria-hidden>
      <Skeleton className="h-3 w-[55%]" />
      <Skeleton className="h-2.5 w-[35%]" />
    </div>
  );
}

/** Desktop short row — 44px, label bar + one trailing value bar. */
export function ShortRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-11 shrink-0 items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0', className)} aria-hidden>
      <Skeleton className="h-3 w-[110px] shrink-0" />
      <div className="grow" />
      <Skeleton className="h-3 w-14 shrink-0" />
    </div>
  );
}

/**
 * KPI placeholder: the value is a faint "—". While loading the sub-line is a
 * 120px sweep bar; after a page error (`static`) there is no sweep — a
 * shimmering bar under an error card would read as "still loading".
 */
export function KpiValueSkeleton({ static: isStatic = false }: { static?: boolean }) {
  return (
    <>
      <span className="font-wds-mono text-wds-kpi font-medium text-wds-text-faint">—</span>
      {isStatic ? <span className="h-4" aria-hidden /> : <Skeleton className="my-[3px] h-2.5 w-[120px]" />}
    </>
  );
}

/** Mobile list row — 69px, two lines left + two right. */
export function MobileListRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-[69px] shrink-0 items-center gap-3 border-b border-wds-border last:border-b-0', className)} aria-hidden>
      <div className="flex grow flex-col gap-2">
        <Skeleton className="h-3 w-[55%]" />
        <Skeleton className="h-2.5 w-[35%]" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/** Mobile movement row — 60px, type + qty, then a date/counterparty bar. */
export function MobileMovementRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-[60px] shrink-0 flex-col justify-center gap-2 border-b border-wds-border last:border-b-0', className)} aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-[110px]" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-2.5 w-[150px]" />
    </div>
  );
}

/** Mobile status card (e.g. Today's count) — 40% / 80% bars. */
export function StatusCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5 rounded-wds-md border border-wds-border bg-wds-surface p-3.5', className)} aria-hidden>
      <Skeleton className="h-3 w-[40%]" />
      <Skeleton className="h-2.5 w-[80%]" />
    </div>
  );
}

/** Repeats a skeleton piece `count` times inside an sr-only "Loading" live region. */
export function SkeletonRows({ count, label, children }: { count: number; label: string; children: (i: number) => React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="contents">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => children(i))}
    </div>
  );
}

/* -------------------------------------------------------- empty / error */

/** Empty card — the shell `EmptyState` with the kit's optional secondary action. */
export function StockEmptyCard({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      className={className}
      action={
        actionLabel && onAction ? (
          <Button variant="secondary" size="sm" className="mt-1 h-[30px]" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

/** Page error — replaces the data area; always ends in Retry; announced politely. */
export function StockErrorCard({
  title,
  description,
  onRetry,
  className,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" aria-live="polite" className={cn('flex justify-center', className)}>
      <ErrorState title={title} description={description} onRetry={onRetry} className="w-full max-w-[346px]" />
    </div>
  );
}

/** In-drawer / sheet / form error banner — top of the body; input stays; primary button retries. `1I8O-0`. */
export function FormErrorBanner({ title, description, className }: { title: string; description: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-wds-md border border-wds-error-border bg-wds-error-bg px-3.5 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200',
        className,
      )}
    >
      <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-wds-error-fg" aria-hidden />
      <div className="flex flex-col gap-1">
        <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-error-fg">{title}</span>
        <span className="font-wds-sans text-wds-caption text-wds-error-fg">{description}</span>
      </div>
    </div>
  );
}
