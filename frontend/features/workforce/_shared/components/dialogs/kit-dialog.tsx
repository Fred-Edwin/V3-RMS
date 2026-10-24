'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

import { DISABLED, FOCUS_RING, MOTION, PRESSED, onHover } from '../../lib/style/interaction';

/**
 * The dialog shell and its two footer buttons (`change-dialog.tsx` builds the change and PIN dialogs on them and re-exports both).
 *
 * `KitDialog` is the 580 px shell: a title (20 px), one line under it, a ×,
 * a scrim, and a footer with the buttons. Radix gives the behaviour rule 09 asks
 * for: Escape closes and puts focus back on the button that opened it, Tab stays
 * inside, and the first focusable thing gets focus on open. There is no <form>,
 * so Enter in a field never completes anything.
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
  plain = false,
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
  /** The approval-dialog paint (Paper 1J7K-0): 28/26 padding, no rule under the title, no ×. */
  plain?: boolean;
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
          <div className={cn('flex items-start justify-between', plain ? 'px-7 pt-[26px]' : 'border-b border-wds-border px-6 pb-4 pt-5')}>
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
            {plain ? null : (
              <DialogPrimitive.Close
                aria-label="Close"
                className={cn('-mr-2 -mt-1 flex h-9 w-9 items-center justify-center text-[20px] leading-5 text-wds-text-muted', MOTION, FOCUS_RING, onHover('text-wds-text-ink'))}
              >
                <span aria-hidden>×</span>
              </DialogPrimitive.Close>
            )}
          </div>
          {children ? <div ref={bodyRef} className={cn('flex flex-col', plain ? 'gap-3.5 px-7 pt-3.5' : 'gap-5 px-6 pt-5')}>{children}</div> : null}
          {footer ? <div className={cn('flex items-center justify-end', plain ? 'gap-2.5 px-7 pb-[26px] pt-3.5' : 'gap-2 px-6 py-5')}>{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The kit's two buttons for a dialog footer (38/34 px as drawn): outlined Cancel, the one brown action. */
export function DialogButton({
  kind,
  size = 'md',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind: 'cancel' | 'primary' | 'danger'; size?: 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap px-4 font-wds-sans',
        size === 'lg' ? 'h-[38px] px-5 text-[14px] leading-[18px]' : 'h-[34px] text-[13px] leading-4',
        MOTION,
        FOCUS_RING,
        PRESSED,
        DISABLED,
        kind === 'cancel' && cn('border border-wds-border-strong bg-transparent text-wds-text-ink', onHover('bg-wds-neutral-50')),
        kind === 'primary' && cn('rounded-wds-sm bg-wds-primary font-medium text-wds-primary-fg', size === 'lg' ? 'px-[22px] font-semibold' : 'px-[18px]', onHover('bg-wds-primary-hover')),
        kind === 'danger' && cn('rounded-wds-sm bg-wds-error-fg font-medium text-wds-primary-fg', size === 'lg' ? 'px-[22px] font-semibold' : 'px-[18px]', onHover('opacity-90')),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
