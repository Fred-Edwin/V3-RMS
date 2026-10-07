import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';

/**
 * Universal states — Empty / Loading / Error / Permission-denied. These are
 * never redrawn per screen; every Inventory Milestone One screen reuses this
 * one set. Reference: Session-0 shell, Paper page `3-0`, node `1R7-0`
 * ("10 · Universal states"), specimens `1RC-0`/`1RG-0`/`1RL-0`/`1RR-0`.
 *
 * Card shell: 320×220, `p-6`, `gap-2.5`, `rounded-wds-md`, `bg-wds-surface`,
 * `border-wds-border` — confirmed via `get_computed_styles`, identical
 * across all four specimens. Copy is per-screen (a prop), the chrome is not.
 */

function StateCard({
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
        // mx-auto: the card is a fixed width, so it centers itself in whatever area it replaces.
        'mx-auto flex h-[220px] w-80 shrink-0 flex-col gap-2.5 rounded-wds-md border border-wds-border bg-wds-surface p-6',
        center && 'items-center justify-center',
        className
      )}
    >
      {children}
    </div>
  );
}

function StateTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{children}</div>;
}

function StateDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center font-wds-sans text-wds-caption text-wds-text-copy-muted">{children}</div>
  );
}

/** "Nothing here yet" — dashed square glyph, `1RC-0`. */
export function EmptyState({
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
    <StateCard className={className}>
      <div className="size-9 shrink-0 rounded-[6px] border-[1.5px] border-dashed border-wds-border-strong" aria-hidden />
      <StateTitle>{title}</StateTitle>
      <StateDescription>{description}</StateDescription>
      {action}
    </StateCard>
  );
}

/** Skeleton sweep, three lines — `1RG-0`. Not centered: skeleton lines are left-aligned. */
export function LoadingState({ className }: { className?: string }) {
  return (
    <StateCard center={false} className={className}>
      <Skeleton className="h-3 w-[70%]" />
      <Skeleton className="h-3 w-[45%]" />
      <Skeleton className="h-3 w-[60%]" />
    </StateCard>
  );
}

/** Red dot + "Couldn't load…" + Retry — `1RL-0`. */
export function ErrorState({
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
    <StateCard className={className}>
      <div className="size-1.5 shrink-0 rounded-wds-full bg-wds-error-fg" aria-hidden />
      <StateTitle>{title}</StateTitle>
      <StateDescription>{description}</StateDescription>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-1 h-[30px]" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </StateCard>
  );
}

/** Empty ring glyph + "Not available for your role" — `1RR-0`. */
export function PermissionDeniedState({
  title = 'Not available for your role',
  description,
  className,
}: {
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <StateCard className={className}>
      <div className="size-9 shrink-0 rounded-full border-[1.5px] border-wds-text-faint" aria-hidden />
      <StateTitle>{title}</StateTitle>
      <StateDescription>{description}</StateDescription>
    </StateCard>
  );
}
