'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { StatusDot } from '@/components/ui2/status-dot';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToast } from '@/hooks/useWdsToast';
import { usePinStatus } from '@/hooks/usePinStatus';
import { SetPinForm } from './set-pin-form';

/**
 * "Signing PIN" card — the account owner's own PIN status + set/change.
 * Two homes (Paper page "Pre-Demo · Team & PIN"):
 *  - `profile` (artboard 6): a compact card on the Profile page for every
 *    role, form revealed by the Set/Change PIN button.
 *  - `settings` (artboard 4): the form is always open — the Store Manager
 *    Settings › My PIN tab.
 * Changing an existing PIN asks for the current password; the first set
 * doesn't (server-enforced, see `authService.setPin`).
 */
export interface SigningPinCardProps {
  variant: 'profile' | 'settings';
  className?: string;
}

export function SigningPinCard({ variant, className }: SigningPinCardProps) {
  const { toast } = useWdsToast();
  const pinStatus = usePinStatus(true);
  const [editing, setEditing] = React.useState(false);
  const formOpen = variant === 'settings' || editing;
  const hasPin = pinStatus.hasPin === true;

  return (
    <section
      aria-labelledby="signing-pin-heading"
      className={cn('flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-6', className)}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="signing-pin-heading" className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">
          Signing PIN
        </h2>
        {pinStatus.loading && pinStatus.hasPin === null ? (
          <Skeleton className="h-3 w-14" />
        ) : pinStatus.hasPin === null ? null : (
          <StatusDot tone={hasPin ? 'success' : 'warning'}>{hasPin ? 'Set' : 'Not set'}</StatusDot>
        )}
      </div>

      <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        {variant === 'profile'
          ? 'Your 4-digit PIN signs counts, requisitions, dispatches and receipts. Changing it needs your current password.'
          : hasPin
            ? 'Your 4-digit PIN signs counts, dispatches and receipts. Changing it needs your current password.'
            : 'Your 4-digit PIN signs counts, dispatches and receipts. Choose one only you know.'}
      </p>

      {pinStatus.failed ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3.5 py-3">
          <span className="font-wds-sans text-wds-caption text-wds-error-fg">Couldn&apos;t check your PIN status.</span>
          <Button variant="secondary" size="sm" onClick={pinStatus.refresh}>
            Retry
          </Button>
        </div>
      ) : null}

      {formOpen && pinStatus.hasPin !== null ? (
        <SetPinForm
          requireCurrentPassword={hasPin}
          submitLabel={hasPin ? 'Change PIN' : 'Set PIN'}
          onCancel={variant === 'profile' ? () => setEditing(false) : undefined}
          onDone={() => {
            toast({ variant: 'success', title: hasPin ? 'PIN updated' : 'PIN set' });
            pinStatus.markSet();
            setEditing(false);
          }}
        />
      ) : null}

      {variant === 'profile' && !formOpen && pinStatus.hasPin !== null ? (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {hasPin ? 'Change PIN' : 'Set PIN'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
