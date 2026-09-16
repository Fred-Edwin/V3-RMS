'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui2/input-otp';

/**
 * Sign Sheet — PIN re-authentication for signing a Goods Receipt, plus the
 * read-only rendered signature shown afterward. Genuinely new this milestone
 * (04-components.md Milestone Two #2); no equivalent existed in the codebase.
 * Reference: page 4-0 (Store Manager) — D61-0 (Fulfil & dispatch,
 * mid-signature) for the PIN dialog, GEO-0 (dispatched/signed) for the
 * rendered-signature block. Not cloned onto Milestone Two's own page (C-0);
 * the New Goods Receipt (sign & save) and signed detail screens reuse this
 * exact pattern per the S0 session brief.
 */
export interface SignSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  helperText: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onSubmit: (pin: string) => void;
  submitting?: boolean;
  error?: string;
}

const PIN_LENGTH = 4;

export function SignSheetDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  helperText,
  confirmLabel = 'Sign & save',
  cancelLabel = 'Cancel',
  onSubmit,
  submitting = false,
  error,
}: SignSheetDialogProps) {
  const [pin, setPin] = React.useState('');

  React.useEffect(() => {
    if (open) setPin('');
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[380px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2',
            'flex flex-col overflow-hidden rounded-wds-lg border border-wds-border bg-wds-surface shadow-wds-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="flex flex-col gap-wds-1 px-wds-5 pt-wds-5">
            <DialogPrimitive.Title className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              {subtitle}
            </DialogPrimitive.Description>
          </div>

          <div className="flex flex-col gap-wds-2 p-wds-5">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">
              Enter your PIN
            </label>
            <InputOTP
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={setPin}
              autoFocus
              disabled={submitting}
            >
              <InputOTPGroup>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {error ? (
              <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p>
            ) : (
              // 11px/15px — one px taller than wds-helper (11px/14px); Paper
              // (DC8-0) draws this specific helper line 1px looser. Not worth
              // a new token for a single 1px variant; kept as an arbitrary
              // value matched via get_computed_styles.
              <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-faint">{helperText}</p>
            )}
          </div>

          <div className="flex gap-wds-2 px-wds-5 pb-wds-5 pt-wds-4">
            <Button
              variant="secondary"
              className="grow"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              className="grow"
              onClick={() => onSubmit(pin)}
              disabled={pin.length !== PIN_LENGTH || submitting}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface SignedBySignatureProps {
  label?: string;
  name: string;
  roleLine: string;
  className?: string;
}

/**
 * The read-only rendered signature shown once a receipt (or dispatch, per
 * GEO-0's precedent) is signed — "DISPATCHED & SIGNED BY" mono label, name
 * in font-wds-signature (Alex Brush), divider, then role + verified
 * timestamp. Milestone Two callers pass label="RECEIVED & SIGNED BY".
 */
export function SignedBySignature({ label = 'Signed by', name, roleLine, className }: SignedBySignatureProps) {
  return (
    <div className={cn('flex flex-col gap-wds-1.25', className)}>
      <div className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-copy-muted">
        {label}
      </div>
      <div className="font-wds-signature text-[30px] leading-8 text-wds-text-ink">{name}</div>
      <div className="mt-0.5 h-px w-[220px] shrink-0 bg-wds-border-strong" />
      <div className="font-wds-sans text-wds-field-label text-wds-text-copy-muted">{roleLine}</div>
    </div>
  );
}
