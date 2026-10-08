import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { MobileEmptyState, MobileErrorState, MobilePermissionDeniedState } from '@/components/app/shell/mobile-states';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/app/shell/shell-states';

/**
 * One reusable empty, error and permission treatment for the Counting, Stock and Waste screens, drawn from the shared states kit
 * with the per-screen wording from each sub-module's `states-copy.ts` (never a state design per screen). `phone` picks the phone
 * layout of the same kit. Loading is a skeleton drawn by each screen that matches its own layout, with the copy line announced
 * through `aria-live` (see `LoadingAnnouncer`).
 */
export type ScwStateKind = 'empty' | 'error' | 'permission';

export interface ScwStatePanelProps {
  kind: ScwStateKind;
  /** The sentence from the copy table. */
  text: string;
  phone?: boolean;
  onRetry?: () => void;
  /** The one action an empty state offers ("Open Count setup"). Hidden when absent. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const TITLE: Record<ScwStateKind, string> = {
  empty: 'Nothing here yet',
  error: 'That did not work',
  permission: 'Not available for you',
};

export function ScwStatePanel({ kind, text, phone = false, onRetry, actionLabel, onAction, className }: ScwStatePanelProps) {
  const action =
    actionLabel && onAction ? (
      <Button variant="secondary" size="sm" className="mt-1 h-[30px]" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : undefined;
  if (kind === 'permission') {
    return phone ? (
      <MobilePermissionDeniedState title={TITLE.permission} description={text} className={className} />
    ) : (
      <PermissionDeniedState title={TITLE.permission} description={text} className={className} />
    );
  }
  if (kind === 'error') {
    return (
      <div role="alert" className={className}>
        {phone ? <MobileErrorState title={TITLE.error} description={text} onRetry={onRetry} /> : <ErrorState title={TITLE.error} description={text} onRetry={onRetry} />}
      </div>
    );
  }
  return phone ? (
    <MobileEmptyState title={TITLE.empty} description={text} action={action} className={className} />
  ) : (
    <EmptyState title={TITLE.empty} description={text} action={action} className={className} />
  );
}

/** Screen-reader announcement for a loading skeleton ("Getting today's sections"); renders nothing visible. */
export function LoadingAnnouncer({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {text}
    </div>
  );
}
