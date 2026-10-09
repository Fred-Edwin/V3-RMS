'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

/**
 * The 600px centred dialog of Paper chapter 8 (retire an item, retire or restore a supplier, a supplier that may
 * already exist, an archive that is blocked): title (with an optional status dot) and one line of help, a body,
 * and a footer with a note on the left and the buttons on the right. Squares and borders follow the Paper nodes.
 */
export interface DecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Block 2 dialogs (Paper D16, D20): the description is a small mono line ABOVE the title and there is no rule under the header. */
  eyebrow?: boolean;
  /** The small dot before the title: amber for "may already exist", red for "cannot be archived yet". */
  tone?: 'warning' | 'error';
  /** Left of the buttons in the footer ("Restore any time from Show retired."). */
  footerNote?: React.ReactNode;
  /** The buttons, left to right. */
  actions: React.ReactNode;
  /** A failed request: shown at the top of the body, what was typed stays. */
  error?: string | null;
  /** While a request is in flight the dialog cannot be dismissed. */
  busy?: boolean;
  /** Where focus goes on close, for a dialog opened from a menu item (which no longer exists by then). Falls back to the opener. */
  returnFocus?: () => HTMLElement | null;
  children: React.ReactNode;
}

export function DecisionDialog({ open, onOpenChange, title, description, eyebrow = false, tone, footerNote, actions, error, busy = false, returnFocus, children }: DecisionDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            const target = returnFocus?.();
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-32px)] w-[600px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'border border-wds-border-strong bg-wds-surface outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=closed]:duration-150'
          )}
        >
          <div className={cn('flex shrink-0 flex-col gap-1 px-6 pb-4 pt-[22px]', eyebrow ? 'pb-3' : 'border-b border-wds-border')}>
            {eyebrow ? <DialogPrimitive.Description className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.08em] text-wds-text-copy-muted">{description}</DialogPrimitive.Description> : null}
            <div className="flex items-center gap-2">
              {tone ? <span aria-hidden className={cn('size-2 shrink-0 rounded-[4px]', tone === 'error' ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} /> : null}
              <DialogPrimitive.Title className="font-wds-sans text-[20px] font-semibold leading-[26px] tracking-tight text-wds-text-ink">{title}</DialogPrimitive.Title>
            </div>
            {eyebrow ? null : <DialogPrimitive.Description className="font-wds-sans text-[13px] leading-[18px] text-wds-text-copy-muted">{description}</DialogPrimitive.Description>}
          </div>
          <div className="flex min-h-0 flex-col gap-[18px] overflow-y-auto px-6 py-5">
            {error ? (
              <div role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                {error}
              </div>
            ) : null}
            {children}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-wds-border px-6 py-4">
            <div className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">{footerNote}</div>
            <div className="flex shrink-0 gap-2.5 max-sm:[&_button]:min-h-11">{actions}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** "WHAT THIS TOUCHES", "WHY?": mono, tracked, with an optional "required" / "optional" hint. */
export function DialogLabel({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <label htmlFor={htmlFor} className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink">
        {children}
      </label>
      {hint ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">{hint}</span> : null}
    </div>
  );
}

/** One dot-and-sentence line under "What this touches". */
export function TouchLine({ tone, children }: { tone: 'safe' | 'change'; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-[3px]', tone === 'safe' ? 'bg-wds-success-fg' : 'bg-wds-warning-fg')} />
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{children}</p>
    </div>
  );
}

/** The chips of a required choice ("Added twice" / "No longer sold" / "Other"). A radio group underneath. */
export function ChoiceChips<T extends string>({ name, label, options, value, onChange }: { name: string; label: string; options: readonly T[]; value: T | null; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = option === value;
        return (
          <label
            key={option}
            className={cn(
              'flex h-8 cursor-pointer items-center px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-colors duration-150 ease-out focus-within:shadow-wds-ring hover:bg-wds-neutral-50',
              on ? 'border-[1.5px] border-wds-primary bg-wds-espresso-50 font-medium' : 'border border-wds-border-strong bg-wds-surface'
            )}
          >
            <input type="radio" name={name} value={option} checked={on} onChange={() => onChange(option)} className="sr-only" />
            {option}
          </label>
        );
      })}
    </div>
  );
}
