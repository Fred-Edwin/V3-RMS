import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Mobile Universal States — Empty / Loading / Error / Permission-denied.
 * Cross-feature shell (same category as `mobile-headers.tsx`/
 * `mobile-status-bar.tsx`), not feature-scoped, mirroring the desktop
 * `shell-states.tsx`'s API shape (title/description/onRetry) but a
 * genuinely different mobile layout — confirmed, not resized from the
 * desktop card. Reference: page `3-0`, node `X7O-0` ("10m · Universal
 * states · mobile") — designed alongside the desktop set but, per its own
 * note, "deliberately not built" until a real Milestone Two mobile screen
 * needed it. This is that build.
 *
 * "Composited with the Mobile Hub Header; chrome stays, content area
 * swaps" (X7O-0's own subtitle) — this composite renders only the content
 * area below the header; the consuming screen renders `MobileHubHeader`
 * itself and swaps this in as the body when loading/empty/error/denied,
 * per the same pattern the desktop `shell-states.tsx` cards use standalone.
 */

function ContentArea({
  center = true,
  className,
  children,
}: {
  center?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col bg-wds-canvas px-wds-6 py-12',
        center && 'items-center gap-wds-2.5',
        className
      )}
    >
      {children}
    </div>
  );
}

function StateTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{children}</p>;
}

function StateDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-center font-wds-sans text-wds-caption text-wds-text-copy-muted">{children}</p>;
}

/** "Nothing here yet" — dashed square glyph, `X7U-0`. */
export function MobileEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <ContentArea className={className}>
      <div className="size-9 shrink-0 rounded-wds-lg border-[1.5px] border-dashed border-wds-border-strong" aria-hidden />
      <StateTitle>{title}</StateTitle>
      <StateDescription>{description}</StateDescription>
      {action}
    </ContentArea>
  );
}

/**
 * Skeleton sweep — `X86-0`. Note reads "skeleton · animated sweep, neutral
 * not espresso" — a KPI-strip-shaped skeleton (two joined cells) plus two
 * bordered card skeletons, not left-aligned lines like the desktop card.
 * `rows` lets a consuming screen add more card skeletons for a longer list.
 */
export function MobileLoadingState({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <ContentArea center={false} className={cn('gap-wds-3.5', className)}>
      <div className="flex gap-px overflow-hidden rounded-wds-md border border-wds-border bg-wds-border">
        {[0, 1].map((i) => (
          <div key={i} className="flex grow basis-0 flex-col gap-wds-1.5 bg-wds-surface px-wds-3.5 py-wds-3">
            <div className="h-[9px] w-[60px] shrink-0 rounded-wds-sm bg-wds-neutral-100" />
            <div className="h-[14px] w-10 shrink-0 rounded-wds-sm bg-wds-neutral-100" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-border p-wds-3.5">
          <div className="h-3 w-[120px] shrink-0 rounded-wds-sm bg-wds-neutral-100" />
          <div className="h-[11px] w-[200px] shrink-0 rounded-wds-sm bg-wds-neutral-100" />
        </div>
      ))}
    </ContentArea>
  );
}

/** Red dot + "Couldn't load…" + Retry — `X8T-0`. */
export function MobileErrorState({
  title,
  description,
  onRetry,
  className,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <ContentArea className={className}>
      <div className="size-1.5 shrink-0 rounded-wds-full bg-wds-error-fg" aria-hidden />
      <StateTitle>{title}</StateTitle>
      <StateDescription>{description}</StateDescription>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-wds-1 flex h-8 items-center rounded-wds-sm border border-wds-border-strong px-wds-4 font-wds-sans text-wds-caption text-wds-text-ink"
        >
          Retry
        </button>
      ) : null}
    </ContentArea>
  );
}

/** Empty ring glyph + "Not available for your role" — `X97-0`. */
export function MobilePermissionDeniedState({
  title = 'Not available for your role',
  description,
  className,
}: {
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <ContentArea className={className}>
      <div className="size-9 shrink-0 rounded-wds-full border-[1.5px] border-wds-border-strong" aria-hidden />
      <StateTitle>{title}</StateTitle>
      <StateDescription>{description}</StateDescription>
    </ContentArea>
  );
}
