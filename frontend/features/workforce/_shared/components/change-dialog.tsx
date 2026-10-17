'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';

import { DISABLED, FOCUS_RING, MOTION, PRESSED, onHover } from '../lib/interaction';

/**
 * Dialogs for changing something (Paper "Assign a head for Housekeeping",
 * VM5-0, and the other "what changes" dialogs).
 *
 * `KitDialog` is the 580 px shell: a title (20 px), one line under it, a ×,
 * a scrim, and a footer with the buttons. Radix gives the behaviour rule 09 asks
 * for: Escape closes and puts focus back on the button that opened it, Tab stays
 * inside, and the first focusable thing gets focus on open. There is no <form>,
 * so Enter in a field never completes anything.
 *
 * `ChangeSummary` is the grey "What changes when ..." box. A dialog that records
 * a change shows it, and its last line says who is told and that it is logged.
 *
 * `ChangeDialog` puts the two together with the footer: Cancel (outlined) and
 * the one brown button (rule 04).
 *
 * `WorkforcePinDialog` is the PIN step for a signed act (rule 02). It reuses the
 * shell's `SignSheetDialog`, so the PIN boxes, the first-use "set your PIN" step
 * and the number pad are the same as Inventory's. The fourth digit signs; Enter
 * on any other control never does.
 */

export function KitDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  busy = false,
  width = 580,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** While a save is in flight the dialog cannot be dismissed by Escape or the scrim. */
  busy?: boolean;
  width?: number;
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  // Radix returns focus only to its own Trigger; these dialogs are opened by state, so remember the opener here.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpen.current = open;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--wds-neutral-950)_55%,transparent)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={description ? undefined : undefined}
          // Rule 09: the first field has focus when it opens (not the ×, which comes first in the page order).
          onOpenAutoFocus={(e) => {
            const first = bodyRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            openerRef.current?.focus();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-32px)] w-full max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto',
            'border border-wds-border bg-wds-surface shadow-[0_24px_60px_color-mix(in_oklab,var(--wds-neutral-950)_35%,transparent)] focus:outline-none',
            'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
          style={{ width }}
        >
          <div className="flex items-start justify-between border-b border-wds-border px-6 pb-4 pt-5">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.02em] text-wds-text-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className={cn('-mr-2 -mt-1 flex h-9 w-9 items-center justify-center text-[20px] leading-5 text-wds-text-muted', MOTION, FOCUS_RING, onHover('text-wds-text-ink'))}
            >
              <span aria-hidden>×</span>
            </DialogPrimitive.Close>
          </div>
          {children ? <div ref={bodyRef} className="flex flex-col gap-5 px-6 pt-5">{children}</div> : null}
          {footer ? <div className="flex items-center justify-end gap-2 px-6 py-5">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

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

/** The kit's two buttons for a dialog footer (38/34 px as drawn): outlined Cancel, the one brown action. */
export function DialogButton({
  kind,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind: 'cancel' | 'primary' | 'danger' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-[34px] items-center justify-center px-4 font-wds-sans text-[13px] leading-4',
        MOTION,
        FOCUS_RING,
        PRESSED,
        DISABLED,
        kind === 'cancel' && cn('border border-wds-border-strong bg-transparent text-wds-text-ink', onHover('bg-wds-neutral-50')),
        kind === 'primary' && cn('rounded-wds-sm bg-wds-primary px-[18px] font-medium text-wds-primary-fg', onHover('bg-wds-primary-hover')),
        kind === 'danger' && cn('rounded-wds-sm bg-wds-error-fg px-[18px] font-medium text-wds-primary-fg', onHover('opacity-90')),
        className
      )}
      {...props}
    >
      {children}
    </button>
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
  subtitle,
  summary,
  onSubmit,
  submitting,
  error,
  confirmLabel = 'Sign',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** What the signer is about to sign, drawn between the heading and the PIN. */
  summary?: React.ReactNode;
  onSubmit: (pin: string) => void;
  submitting?: boolean;
  error?: string;
  confirmLabel?: string;
}) {
  // Rule 09: Escape returns focus to the button that opened the dialog. The shell's sheet does not do it, so do it here.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  React.useEffect(() => {
    if (wasOpen.current && !open) {
      const id = window.setTimeout(() => openerRef.current?.focus(), 0);
      wasOpen.current = open;
      return () => window.clearTimeout(id);
    }
    wasOpen.current = open;
    return undefined;
  }, [open]);
  return (
    <SignSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      helperText=""
      layout="wide"
      pinLabel="SIGNING PIN"
      confirmLabel={confirmLabel}
      signOnLastDigit
      onSubmit={onSubmit}
      submitting={submitting}
      error={error}
    >
      {summary}
    </SignSheetDialog>
  );
}
