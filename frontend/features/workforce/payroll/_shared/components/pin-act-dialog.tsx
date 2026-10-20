'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { DialogButton, KeyValueRows, KitDialog, PIN_LENGTH, PinField, type KeyValueRow } from '../../../_shared';
import { newKey } from '../lib/format';
import { STALE_CODES, refusalWords } from '../lib/month-view';

/**
 * The dialog every signed Payroll act uses (Approve, Publish, Mark as paid, Add a line, a correction): a summary, optional extra fields,
 * the PIN, Cancel and the one brown button. It owns the parts that must be the same everywhere:
 * - one idempotency key per attempt, kept until the act is answered, so a double click or a retry is one act;
 * - the last PIN digit enables the button and Enter never signs (the kit's PinField rule);
 * - a refusal reads in the server's words under the PIN, the PIN is cleared, and a "changed underneath" answer gives a new key and
 *   asks the page to reload (`onStale`) so the figures shown are the fresh ones;
 * - while saving, everything is disabled and the dialog cannot be dismissed.
 * `locking` marks a locking act (Mark as paid). The kit dialog puts first focus on the first field in the body, so the PIN takes it;
 * the spec's "Cancel first" is not possible without changing the kit (logged as decision F5).
 */
export interface PinActProps {
  title: string;
  description?: string;
  rows?: KeyValueRow[];
  /** Extra fields or notices above the PIN. */
  children?: React.ReactNode;
  /** Words under the PIN field (the audit note). */
  note?: string;
  confirmLabel: string;
  busyLabel: string;
  /** A reason the button cannot be pressed yet, shown as text under the PIN. Null when it can. */
  blockedReason?: string | null;
  /** Locks the PIN and the button (for example a person who prepared the month and so cannot approve it). */
  disabled?: boolean;
  locking?: boolean;
  width?: number;
  /** Signs. Throw an ApiError to show a refusal; resolve to close. */
  onSign: (pin: string, idempotencyKey: string) => Promise<void>;
  onClose: () => void;
  /** Called after a refusal that means the month moved, so the page can reload. */
  onStale?: () => void;
  /** A refusal code the dialog turns into success (ALREADY_APPROVED, ALREADY_PAID ...): returns the line to show. */
  onAlready?: (code: string) => boolean;
}

export function PinActDialog({ title, description, rows, children, note, confirmLabel, busyLabel, blockedReason, disabled = false, locking = false, width = 600, onSign, onClose, onStale, onAlready }: PinActProps) {
  const [pin, setPin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  const pinBox = React.useRef<HTMLDivElement>(null);

  // The PIN field is disabled while signing, which drops keyboard focus; after a refusal it goes back there so the next try needs no mouse.
  React.useEffect(() => {
    if (!busy && error) pinBox.current?.querySelector('input')?.focus();
  }, [busy, error]);

  const sign = async (): Promise<void> => {
    if (busy || disabled || blockedReason) return;
    setBusy(true);
    setError(null);
    try {
      await onSign(pin, key.current);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setPin('');
      if (onAlready?.(code)) return;
      setError(err instanceof ApiError ? refusalWords(code, err.message) : 'The connection dropped. Nothing was changed. Try again.');
      if (STALE_CODES.includes(code)) {
        key.current = newKey();
        onStale?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open
      plain
      onOpenChange={(open) => !open && onClose()}
      busy={busy}
      width={width}
      title={title}
      description={description}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void sign()} disabled={busy || disabled || Boolean(blockedReason) || pin.length < PIN_LENGTH}>
            {busy ? busyLabel : confirmLabel}
          </DialogButton>
        </>
      }
    >
      {rows ? <KeyValueRows aria-label={title} rows={rows} /> : null}
      {children}
      <div ref={pinBox} className="flex flex-col gap-1.5">
        <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Your PIN</span>
        <PinField value={pin} onChange={setPin} label="Your PIN" disabled={busy || disabled} invalid={error !== null} autoFocus={!locking && !disabled} className="max-w-[240px]" />
      </div>
      {blockedReason ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{blockedReason}</p> : null}
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : null}
      {note ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{note}</p> : null}
    </KitDialog>
  );
}
