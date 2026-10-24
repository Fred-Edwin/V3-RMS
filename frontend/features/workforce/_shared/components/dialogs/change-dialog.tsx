'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { SetPinForm } from '@/components/app/shell/set-pin-form';
import { usePinStatus } from '@/hooks/usePinStatus';

import { DialogButton, KitDialog } from './kit-dialog';
import { KeyValueRows, type KeyValueRow } from '../layout/key-value-rows';
import { PIN_LENGTH, PinField } from '../fields/pin-field';

export { DialogButton, KitDialog };

/**
 * Dialogs for changing something (Paper "Assign a head for Housekeeping",
 * VM5-0, and the other "what changes" dialogs). The 580 px shell (`KitDialog`) and
 * the footer buttons (`DialogButton`) are in `kit-dialog.tsx` and re-exported here.
 *
 * `ChangeSummary` is the grey "What changes when ..." box. A dialog that records
 * a change shows it, and its last line says who is told and that it is logged.
 *
 * `ChangeDialog` puts the shell and the summary together with the footer: Cancel
 * (outlined) and the one brown button (rule 04).
 *
 * `WorkforcePinDialog` is the PIN step for a signed act (rule 02; Paper 1J7K-0):
 * a summary list, ONE wide dots field (`PinField`), a caption, Cancel and the
 * brown button. The shell's first-use "set your PIN" form and the phone number
 * pad are reused. The fourth digit signs; Enter never does.
 */

/** The grey "What changes when ..." box: caption, then one square-bulleted line per effect. */
export function ChangeSummary({ caption, lines }: { caption: string; lines: string[] }) {
  return (
    <section aria-label={caption} className="flex flex-col gap-2.5 border border-wds-border bg-wds-neutral-50 px-4 py-3.5">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">{caption}</h3>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {lines.map((l) => (
          <li key={l} className="flex gap-2.5">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-wds-primary" />
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Old to new, for a change of pay, time or a rule: "KES 38,000 → KES 42,000". */
export function OldToNew({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-wds-border py-2.5 last:border-b-0">
      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{label}</span>
      <span className="font-wds-mono text-[13px] leading-[18px] text-wds-text-ink">
        <span className="text-wds-text-secondary line-through decoration-wds-neutral-400">{from}</span>
        <span aria-hidden className="mx-2 text-wds-text-faint">→</span>
        <span className="sr-only"> to </span>
        {to}
      </span>
    </div>
  );
}

export function ChangeDialog({
  open,
  onOpenChange,
  title,
  description,
  summaryCaption,
  summaryLines,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  confirmDisabledReason,
  busy = false,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  summaryCaption: string;
  /** The last line should say who is told and that it is logged. */
  summaryLines: string[];
  /** The question part of the dialog (reason chips, a picker). */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Why the main button cannot be pressed yet. It is shown under the summary, not only as a tooltip. */
  confirmDisabledReason?: string;
  busy?: boolean;
  /** Red confirm button, for a destructive confirmation (rule 04). */
  destructive?: boolean;
}) {
  const blocked = Boolean(confirmDisabledReason) || busy;
  return (
    <KitDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      busy={busy}
      footer={
        <>
          <DialogButton kind="cancel" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </DialogButton>
          <DialogButton kind={destructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={blocked} title={confirmDisabledReason}>
            {busy ? 'Saving…' : confirmLabel}
          </DialogButton>
        </>
      }
    >
      {children}
      <ChangeSummary caption={summaryCaption} lines={summaryLines} />
      {confirmDisabledReason ? (
        <p role="status" className="-mt-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {confirmDisabledReason}
        </p>
      ) : null}
    </KitDialog>
  );
}

export function WorkforcePinDialog({
  open,
  onOpenChange,
  title,
  description,
  summaryRows,
  summary,
  pinLabel = 'Your PIN, to sign',
  caption,
  onSubmit,
  submitting = false,
  error,
  confirmLabel = 'Sign',
  cancelLabel = 'Cancel',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** What the signer is about to sign: label left, value right (Paper 1J7K-0). */
  summaryRows?: KeyValueRow[];
  /** Anything else drawn between the summary and the PIN. */
  summary?: React.ReactNode;
  pinLabel?: string;
  /** The line under the PIN: who is told, and that it is logged. */
  caption?: string;
  /** Called with the PIN when the last digit is typed, or when the button is pressed. Enter never calls it. */
  onSubmit: (pin: string) => void;
  submitting?: boolean;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const [pin, setPin] = React.useState('');
  // Everyone who signs needs a PIN. With none yet, the dialog first asks for one, then signs with it.
  const pinStatus = usePinStatus(open);
  const needsPin = pinStatus.hasPin === false;
  const wasSubmitting = React.useRef(false);
  const pinWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setPin('');
  }, [open]);

  // A rejected PIN clears the field and hands focus back, so the retry can be typed straight away.
  React.useEffect(() => {
    if (wasSubmitting.current && !submitting && error) {
      setPin('');
      pinWrapRef.current?.querySelector('input')?.focus();
    }
    wasSubmitting.current = submitting;
  }, [submitting, error]);

  const checkingPin = pinStatus.hasPin === null && pinStatus.loading;
  const ready = pin.length === PIN_LENGTH && !submitting && !checkingPin;
  const sign = (value: string) => {
    if (!submitting && !checkingPin && value.length === PIN_LENGTH) onSubmit(value);
  };

  return (
    <KitDialog
      plain
      open={open}
      onOpenChange={onOpenChange}
      title={needsPin ? 'Set your signing PIN' : title}
      description={needsPin ? "You haven't set a PIN yet. Choose 4 digits, then we'll continue to sign." : description}
      busy={submitting}
      width={540}
      footer={
        needsPin ? undefined : (
          <>
            <DialogButton kind="cancel" size="lg" onClick={() => onOpenChange(false)} disabled={submitting}>
              {cancelLabel}
            </DialogButton>
            <DialogButton kind="primary" size="lg" onClick={() => sign(pin)} disabled={!ready}>
              {submitting ? 'Signing…' : confirmLabel}
            </DialogButton>
          </>
        )
      }
    >
      {needsPin ? (
        <SetPinForm
          className="pb-[26px]"
          submitLabel="Set PIN & continue"
          onCancel={() => onOpenChange(false)}
          onDone={(newPin) => {
            pinStatus.markSet();
            onSubmit(newPin);
          }}
        />
      ) : (
        <>
          {summaryRows ? <KeyValueRows rows={summaryRows} aria-label="What you are signing" /> : null}
          {summary}
          <div ref={pinWrapRef} className="flex flex-col gap-1.5">
            <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{pinLabel}</span>
            <PinField value={pin} onChange={setPin} label={pinLabel} onComplete={sign} invalid={Boolean(error) && !submitting} disabled={submitting} autoFocus />
            <p role="alert" className={cn('m-0 font-wds-sans text-[12px] leading-[17px] text-wds-error-fg', !error && 'sr-only')}>
              {error ?? ''}
            </p>
          </div>
          {caption ? <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{caption}</p> : null}
        </>
      )}
    </KitDialog>
  );
}
